package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.when;

import com.carnalysys.domain.OrderEntity;
import com.carnalysys.domain.OrderStatus;
import com.carnalysys.domain.PaymentMethod;
import com.carnalysys.domain.PaymentStatus;
import com.carnalysys.domain.PaymentTransactionEntity;
import com.carnalysys.domain.PaymentTransactionStatus;
import com.carnalysys.repo.OrderRepository;
import com.carnalysys.repo.PaymentTransactionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class AdminReconciliationServiceTest {

  @Mock private OrderRepository orderRepository;
  @Mock private PaymentTransactionRepository paymentTransactionRepository;

  @InjectMocks private AdminReconciliationService service;

  @Test
  void classifyMatchedWhenPaidAmountEqualsOrderTotal() {
    OrderEntity order = order("o1", "1000.00", OrderStatus.placed, PaymentStatus.paid, PaymentMethod.upi);
    PaymentTransactionEntity paid = txn(order, "1000.00", PaymentTransactionStatus.paid, "pay_abc");

    Map<String, Object> row = service.classifyOrder(order, List.of(paid));

    assertThat(row.get("status")).isEqualTo("matched");
    assertThat(row.get("orderAmount")).isEqualTo(1000L);
    assertThat(row.get("paymentAmount")).isEqualTo(1000L);
    assertThat(row.get("difference")).isEqualTo(0L);
    assertThat(row.get("paymentGatewayRef")).isEqualTo("pay_abc");
  }

  @Test
  void classifyMismatchedWhenAmountsDiffer() {
    OrderEntity order = order("o2", "1000.00", OrderStatus.placed, PaymentStatus.paid, PaymentMethod.upi);
    PaymentTransactionEntity paid = txn(order, "900.00", PaymentTransactionStatus.paid, "pay_x");

    Map<String, Object> row = service.classifyOrder(order, List.of(paid));

    assertThat(row.get("status")).isEqualTo("mismatched");
    assertThat(row.get("difference")).isEqualTo(100L);
  }

  @Test
  void classifyMissingPaymentWhenPlacedOnlineOrderHasNoPaidTxn() {
    OrderEntity order =
        order("o3", "500.00", OrderStatus.placed, PaymentStatus.pending, PaymentMethod.upi);

    Map<String, Object> row = service.classifyOrder(order, List.of());

    assertThat(row.get("status")).isEqualTo("missing_payment");
    assertThat(row.get("paymentAmount")).isEqualTo(0L);
    assertThat(row.get("difference")).isEqualTo(500L);
  }

  @Test
  void classifyRefundedWhenOrderOrTxnIsRefunded() {
    OrderEntity order =
        order("o4", "800.00", OrderStatus.refunded, PaymentStatus.refunded, PaymentMethod.upi);
    PaymentTransactionEntity refunded =
        txn(order, "800.00", PaymentTransactionStatus.refunded, "pay_ref");

    Map<String, Object> row = service.classifyOrder(order, List.of(refunded));

    assertThat(row.get("status")).isEqualTo("refunded");
    assertThat(row.get("paymentAmount")).isEqualTo(800L);
  }

  @Test
  void draftAndOpenCodAreMatchedWithoutPayment() {
    OrderEntity draft =
        order("d1", "200.00", OrderStatus.draft, PaymentStatus.pending, PaymentMethod.upi);
    OrderEntity cod =
        order("c1", "300.00", OrderStatus.placed, PaymentStatus.pending, PaymentMethod.cod);

    assertThat(service.classifyOrder(draft, List.of()).get("status")).isEqualTo("matched");
    assertThat(service.classifyOrder(cod, List.of()).get("status")).isEqualTo("matched");
  }

  @Test
  void summaryAndPaginationAndStatusFilter() {
    OrderEntity matched =
        order("m1", "100.00", OrderStatus.placed, PaymentStatus.paid, PaymentMethod.upi);
    OrderEntity mismatched =
        order("x1", "200.00", OrderStatus.placed, PaymentStatus.paid, PaymentMethod.upi);
    OrderEntity missing =
        order("n1", "50.00", OrderStatus.placed, PaymentStatus.failed, PaymentMethod.upi);

    when(orderRepository.findAllByOrderByPlacedAtDesc(any(Pageable.class)))
        .thenReturn(new PageImpl<>(List.of(matched, mismatched, missing)));
    when(paymentTransactionRepository.findByOrder_IdIn(anyCollection()))
        .thenReturn(
            List.of(
                txn(matched, "100.00", PaymentTransactionStatus.paid, "pay_m"),
                txn(mismatched, "150.00", PaymentTransactionStatus.paid, "pay_x")));

    Map<String, Object> all = service.getReconciliation(null, null, "all", null, 0, 20);
    @SuppressWarnings("unchecked")
    Map<String, Object> summary = (Map<String, Object>) all.get("summary");
    assertThat(summary.get("totalOrders")).isEqualTo(3L);
    assertThat(summary.get("unmatchedCount")).isEqualTo(2L);
    assertThat(summary.get("totalDiscrepancyAmount")).isEqualTo(100L);

    Map<String, Object> page0 =
        service.getReconciliation(null, null, "mismatched", null, 0, 1);
    assertThat(page0.get("totalElements")).isEqualTo(1);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> rows = (List<Map<String, Object>>) page0.get("rows");
    assertThat(rows).hasSize(1);
    assertThat(rows.get(0).get("status")).isEqualTo("mismatched");
  }

  @Test
  void searchFiltersByOrderIdOrGatewayRef() {
    OrderEntity order =
        order("ord-find-me", "100.00", OrderStatus.placed, PaymentStatus.paid, PaymentMethod.upi);
    when(orderRepository.findAllByOrderByPlacedAtDesc(any(Pageable.class)))
        .thenReturn(new PageImpl<>(List.of(order)));
    when(paymentTransactionRepository.findByOrder_IdIn(anyCollection()))
        .thenReturn(List.of(txn(order, "100.00", PaymentTransactionStatus.paid, "rzp_secret")));

    Map<String, Object> byId = service.getReconciliation(null, null, "all", "find-me", 0, 20);
    assertThat(byId.get("totalElements")).isEqualTo(1);

    Map<String, Object> byRef = service.getReconciliation(null, null, "all", "rzp_secret", 0, 20);
    assertThat(byRef.get("totalElements")).isEqualTo(1);

    Map<String, Object> miss = service.getReconciliation(null, null, "all", "nope", 0, 20);
    assertThat(miss.get("totalElements")).isEqualTo(0);
  }

  @Test
  void csvExportIncludesHeaderAndRows() {
    OrderEntity order =
        order("csv1", "100.00", OrderStatus.placed, PaymentStatus.paid, PaymentMethod.upi);
    when(orderRepository.findAllByOrderByPlacedAtDesc(any(Pageable.class)))
        .thenReturn(new PageImpl<>(List.of(order)));
    when(paymentTransactionRepository.findByOrder_IdIn(anyCollection()))
        .thenReturn(List.of(txn(order, "100.00", PaymentTransactionStatus.paid, "pay_csv")));

    String csv = service.exportReconciliationCsv(null, null, "all", null);
    assertThat(csv).startsWith("orderId,orderDate,orderAmount,paymentAmount,difference,status,paymentGatewayRef");
    assertThat(csv).contains("csv1");
    assertThat(csv).contains("matched");
  }

  @Test
  void orphanPaymentFilterReturnsEmptyBecauseSchemaRequiresOrderId() {
    when(orderRepository.findAllByOrderByPlacedAtDesc(any(Pageable.class)))
        .thenReturn(new PageImpl<>(List.of()));
    Map<String, Object> result =
        service.getReconciliation(null, null, "orphan_payment", null, 0, 20);
    assertThat(result.get("totalElements")).isEqualTo(0);
    assertThat(result.get("rows")).asList().isEmpty();
  }

  private static OrderEntity order(
      String id, String total, OrderStatus status, PaymentStatus payStatus, PaymentMethod method) {
    OrderEntity o = new OrderEntity();
    o.setId(id);
    o.setTotalInr(new BigDecimal(total));
    o.setStatus(status);
    o.setPaymentStatus(payStatus);
    o.setPaymentMethod(method);
    o.setPlacedAt(Instant.parse("2026-08-01T10:00:00Z"));
    return o;
  }

  private static PaymentTransactionEntity txn(
      OrderEntity order, String amount, PaymentTransactionStatus status, String providerPaymentId) {
    PaymentTransactionEntity t = new PaymentTransactionEntity();
    t.setOrder(order);
    t.setProvider("razorpay");
    t.setAmountInr(new BigDecimal(amount));
    t.setStatus(status);
    t.setProviderPaymentId(providerPaymentId);
    t.setAttemptNo(1);
    return t;
  }
}
