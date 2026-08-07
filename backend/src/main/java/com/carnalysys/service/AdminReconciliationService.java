package com.carnalysys.service;

import com.carnalysys.api.ApiException;
import com.carnalysys.domain.OrderEntity;
import com.carnalysys.domain.OrderStatus;
import com.carnalysys.domain.PaymentMethod;
import com.carnalysys.domain.PaymentStatus;
import com.carnalysys.domain.PaymentTransactionEntity;
import com.carnalysys.domain.PaymentTransactionStatus;
import com.carnalysys.repo.OrderRepository;
import com.carnalysys.repo.PaymentTransactionRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin order↔payment reconciliation. Compares {@code orders.total_inr} against paid/refunded rows
 * in {@code payment_transactions} (Razorpay / COD ledger). Unlike sales-report, includes draft /
 * cancelled / refunded orders for visibility.
 *
 * <p>Note: {@code payment_transactions.order_id} is NOT NULL, so true orphan payments (payment with
 * no order) cannot exist in the current schema — {@code orphan_payment} rows are never produced.
 */
@Service
public class AdminReconciliationService {

  private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;
  private static final Set<String> STATUS_FILTERS =
      Set.of("all", "matched", "mismatched", "missing_payment", "orphan_payment", "refunded");

  private final OrderRepository orderRepository;
  private final PaymentTransactionRepository paymentTransactionRepository;

  public AdminReconciliationService(
      OrderRepository orderRepository, PaymentTransactionRepository paymentTransactionRepository) {
    this.orderRepository = orderRepository;
    this.paymentTransactionRepository = paymentTransactionRepository;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getReconciliation(
      String startDate, String endDate, String status, String search, int page, int size) {
    Built built = buildFilteredRows(startDate, endDate, status, search);
    int safePage = Math.max(0, page);
    int safeSize = Math.max(1, Math.min(100, size));
    int totalElements = built.filtered().size();
    int from = Math.min(safePage * safeSize, totalElements);
    int to = Math.min(from + safeSize, totalElements);

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("summary", built.summary());
    body.put("rows", new ArrayList<>(built.filtered().subList(from, to)));
    body.put("page", safePage);
    body.put("size", safeSize);
    body.put("totalElements", totalElements);
    body.put("hasMore", to < totalElements);
    body.put("nextPage", to < totalElements ? safePage + 1 : safePage);
    return body;
  }

  @Transactional(readOnly = true)
  public String exportReconciliationCsv(
      String startDate, String endDate, String status, String search) {
    Built built = buildFilteredRows(startDate, endDate, status, search);
    StringBuilder csv = new StringBuilder();
    csv.append(
        "orderId,orderDate,orderAmount,paymentAmount,difference,status,paymentGatewayRef\n");
    for (Map<String, Object> row : built.filtered()) {
      csv.append(csvEscape(row.get("orderId"))).append(',');
      csv.append(csvEscape(row.get("orderDate"))).append(',');
      csv.append(csvEscape(row.get("orderAmount"))).append(',');
      csv.append(csvEscape(row.get("paymentAmount"))).append(',');
      csv.append(csvEscape(row.get("difference"))).append(',');
      csv.append(csvEscape(row.get("status"))).append(',');
      csv.append(csvEscape(row.get("paymentGatewayRef"))).append('\n');
    }
    return csv.toString();
  }

  private record Built(Map<String, Object> summary, List<Map<String, Object>> filtered) {}

  private Built buildFilteredRows(
      String startDate, String endDate, String status, String search) {
    String statusFilter = normalizeStatusFilter(status);
    Instant startAt = null;
    Instant endAt = null;
    DateRange range = parseOptionalDateRange(startDate, endDate);
    if (range != null) {
      startAt = range.startInclusive();
      endAt = range.endExclusive();
    }

    List<OrderEntity> orders = loadOrdersInRange(startAt, endAt);
    Map<String, List<PaymentTransactionEntity>> txnsByOrder = loadTransactions(orders);

    List<Map<String, Object>> allRows = new ArrayList<>();
    for (OrderEntity order : orders) {
      List<PaymentTransactionEntity> txns =
          txnsByOrder.getOrDefault(order.getId(), List.of());
      allRows.add(classifyOrder(order, txns));
    }

    String searchQ = search != null ? search.trim().toLowerCase(Locale.ROOT) : "";
    if (!searchQ.isEmpty()) {
      allRows =
          allRows.stream().filter(row -> matchesSearch(row, searchQ)).collect(Collectors.toList());
    }

    Map<String, Object> summary = buildSummary(allRows);

    List<Map<String, Object>> filtered = allRows;
    if (!"all".equals(statusFilter)) {
      filtered =
          allRows.stream()
              .filter(r -> statusFilter.equals(String.valueOf(r.get("status"))))
              .collect(Collectors.toList());
    }

    filtered.sort(
        Comparator.comparing(
                (Map<String, Object> r) -> String.valueOf(r.getOrDefault("orderDate", "")),
                Comparator.reverseOrder())
            .thenComparing(r -> String.valueOf(r.getOrDefault("orderId", ""))));

    return new Built(summary, filtered);
  }

  /** Package-visible for unit tests. */
  Map<String, Object> classifyOrder(OrderEntity order, List<PaymentTransactionEntity> txns) {
    BigDecimal orderAmount =
        order.getTotalInr() != null ? order.getTotalInr() : BigDecimal.ZERO;
    PaymentTransactionEntity paidTxn = latestByStatus(txns, PaymentTransactionStatus.paid);
    PaymentTransactionEntity refundedTxn = latestByStatus(txns, PaymentTransactionStatus.refunded);

    boolean orderRefunded =
        order.getStatus() == OrderStatus.refunded
            || order.getPaymentStatus() == PaymentStatus.refunded
            || refundedTxn != null;

    String gatewayRef = resolveGatewayRef(order, paidTxn, refundedTxn, txns);
    String orderDate =
        order.getPlacedAt() != null ? order.getPlacedAt().toString() : "";

    if (orderRefunded) {
      BigDecimal paymentAmount =
          refundedTxn != null
              ? money(refundedTxn.getAmountInr())
              : paidTxn != null ? money(paidTxn.getAmountInr()) : BigDecimal.ZERO;
      return row(
          order.getId(),
          orderDate,
          money(orderAmount),
          paymentAmount,
          money(orderAmount).subtract(paymentAmount),
          "refunded",
          gatewayRef);
    }

    if (paidTxn != null) {
      BigDecimal paymentAmount = money(paidTxn.getAmountInr());
      BigDecimal difference = money(orderAmount).subtract(paymentAmount);
      String status = difference.compareTo(BigDecimal.ZERO) == 0 ? "matched" : "mismatched";
      return row(
          order.getId(),
          orderDate,
          money(orderAmount),
          paymentAmount,
          difference,
          status,
          gatewayRef);
    }

    if (isDraftOrPendingCheckout(order) || isOpenCodReceivable(order)) {
      return row(
          order.getId(),
          orderDate,
          money(orderAmount),
          BigDecimal.ZERO,
          BigDecimal.ZERO,
          "matched",
          gatewayRef);
    }

    return row(
        order.getId(),
        orderDate,
        money(orderAmount),
        BigDecimal.ZERO,
        money(orderAmount),
        "missing_payment",
        gatewayRef);
  }

  private static boolean isDraftOrPendingCheckout(OrderEntity order) {
    return order.getStatus() == OrderStatus.draft;
  }

  private static boolean isOpenCodReceivable(OrderEntity order) {
    return order.getPaymentMethod() == PaymentMethod.cod
        && order.getPaymentStatus() == PaymentStatus.pending
        && order.getStatus() != OrderStatus.cancelled
        && order.getStatus() != OrderStatus.refunded;
  }

  private static PaymentTransactionEntity latestByStatus(
      List<PaymentTransactionEntity> txns, PaymentTransactionStatus status) {
    if (txns == null || txns.isEmpty()) return null;
    return txns.stream()
        .filter(t -> t.getStatus() == status)
        .max(
            Comparator.comparing(
                    (PaymentTransactionEntity t) ->
                        t.getUpdatedAt() != null ? t.getUpdatedAt() : Instant.EPOCH)
                .thenComparing(PaymentTransactionEntity::getAttemptNo))
        .orElse(null);
  }

  private static String resolveGatewayRef(
      OrderEntity order,
      PaymentTransactionEntity paidTxn,
      PaymentTransactionEntity refundedTxn,
      List<PaymentTransactionEntity> txns) {
    PaymentTransactionEntity preferred =
        paidTxn != null
            ? paidTxn
            : refundedTxn != null
                ? refundedTxn
                : (txns != null && !txns.isEmpty() ? txns.get(0) : null);
    if (preferred != null) {
      if (preferred.getProviderPaymentId() != null && !preferred.getProviderPaymentId().isBlank()) {
        return preferred.getProviderPaymentId();
      }
      if (preferred.getProviderOrderId() != null && !preferred.getProviderOrderId().isBlank()) {
        return preferred.getProviderOrderId();
      }
    }
    if (order.getPaymentTxnId() != null && !order.getPaymentTxnId().isBlank()) {
      return order.getPaymentTxnId();
    }
    if (order.getPaymentOrderRef() != null && !order.getPaymentOrderRef().isBlank()) {
      return order.getPaymentOrderRef();
    }
    return "";
  }

  private static Map<String, Object> row(
      String orderId,
      String orderDate,
      BigDecimal orderAmount,
      BigDecimal paymentAmount,
      BigDecimal difference,
      String status,
      String gatewayRef) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("orderId", orderId);
    m.put("orderDate", orderDate);
    m.put("orderAmount", orderAmount.longValue());
    m.put("paymentAmount", paymentAmount.longValue());
    m.put("difference", difference.longValue());
    m.put("status", status);
    m.put("paymentGatewayRef", gatewayRef != null ? gatewayRef : "");
    return m;
  }

  private static Map<String, Object> buildSummary(List<Map<String, Object>> rows) {
    long totalOrders = rows.size();
    long totalOrderValue = 0L;
    long totalPaymentsReceived = 0L;
    long totalDiscrepancyAmount = 0L;
    long unmatchedCount = 0L;
    for (Map<String, Object> row : rows) {
      totalOrderValue += toLong(row.get("orderAmount"));
      String status = String.valueOf(row.get("status"));
      if ("matched".equals(status) || "mismatched".equals(status) || "refunded".equals(status)) {
        totalPaymentsReceived += toLong(row.get("paymentAmount"));
      }
      if ("mismatched".equals(status)
          || "missing_payment".equals(status)
          || "orphan_payment".equals(status)) {
        unmatchedCount++;
        totalDiscrepancyAmount += Math.abs(toLong(row.get("difference")));
      }
    }
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("totalOrders", totalOrders);
    summary.put("totalOrderValue", totalOrderValue);
    summary.put("totalPaymentsReceived", totalPaymentsReceived);
    summary.put("totalDiscrepancyAmount", totalDiscrepancyAmount);
    summary.put("unmatchedCount", unmatchedCount);
    return summary;
  }

  private static boolean matchesSearch(Map<String, Object> row, String q) {
    String orderId = String.valueOf(row.getOrDefault("orderId", "")).toLowerCase(Locale.ROOT);
    String ref =
        String.valueOf(row.getOrDefault("paymentGatewayRef", "")).toLowerCase(Locale.ROOT);
    return orderId.contains(q) || ref.contains(q);
  }

  private List<OrderEntity> loadOrdersInRange(Instant startAt, Instant endAt) {
    if (startAt == null && endAt == null) {
      return orderRepository.findAllByOrderByPlacedAtDesc(
          org.springframework.data.domain.Pageable.unpaged()).getContent();
    }
    return orderRepository.findForReconciliation(startAt, endAt);
  }

  private Map<String, List<PaymentTransactionEntity>> loadTransactions(List<OrderEntity> orders) {
    if (orders.isEmpty()) return Map.of();
    List<String> ids = orders.stream().map(OrderEntity::getId).filter(Objects::nonNull).toList();
    List<PaymentTransactionEntity> all = paymentTransactionRepository.findByOrder_IdIn(ids);
    Map<String, List<PaymentTransactionEntity>> byOrder = new HashMap<>();
    for (PaymentTransactionEntity txn : all) {
      if (txn.getOrder() == null || txn.getOrder().getId() == null) continue;
      byOrder.computeIfAbsent(txn.getOrder().getId(), k -> new ArrayList<>()).add(txn);
    }
    return byOrder;
  }

  private static String normalizeStatusFilter(String status) {
    String s = status == null ? "all" : status.trim().toLowerCase(Locale.ROOT);
    if (!STATUS_FILTERS.contains(s)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "VALIDATION_ERROR",
          "status must be one of: all, matched, mismatched, missing_payment, orphan_payment, refunded");
    }
    return s;
  }

  private record DateRange(Instant startInclusive, Instant endExclusive) {}

  private DateRange parseOptionalDateRange(String startDate, String endDate) {
    String from = startDate != null ? startDate.trim() : "";
    String to = endDate != null ? endDate.trim() : "";
    if (from.isEmpty() && to.isEmpty()) return null;
    if (from.isEmpty()) from = to;
    else if (to.isEmpty()) to = from;
    LocalDate fromD;
    LocalDate toD;
    try {
      fromD = LocalDate.parse(from, ISO_DATE);
      toD = LocalDate.parse(to, ISO_DATE);
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "startDate/endDate must be ISO dates (YYYY-MM-DD)");
    }
    if (toD.isBefore(fromD)) {
      LocalDate tmp = fromD;
      fromD = toD;
      toD = tmp;
    }
    Instant start = fromD.atStartOfDay().toInstant(ZoneOffset.UTC);
    Instant end = toD.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    return new DateRange(start, end);
  }

  private static BigDecimal money(BigDecimal v) {
    return (v != null ? v : BigDecimal.ZERO).setScale(0, RoundingMode.DOWN);
  }

  private static long toLong(Object v) {
    if (v == null) return 0L;
    if (v instanceof Number n) return n.longValue();
    try {
      return Long.parseLong(String.valueOf(v));
    } catch (NumberFormatException ex) {
      return 0L;
    }
  }

  private static String csvEscape(Object value) {
    String s = value == null ? "" : String.valueOf(value);
    if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
      return '"' + s.replace("\"", "\"\"") + '"';
    }
    return s;
  }
}
