package com.carnalysys.service;

import com.carnalysys.api.ApiException;
import com.carnalysys.config.AppProperties;
import com.carnalysys.domain.AddressEntity;
import com.carnalysys.domain.Cart;
import com.carnalysys.domain.CartItem;
import com.carnalysys.domain.OrderEntity;
import com.carnalysys.domain.OrderLine;
import com.carnalysys.domain.OrderStatus;
import com.carnalysys.domain.OrderStatusAuditEntity;
import com.carnalysys.domain.PaymentEventEntity;
import com.carnalysys.domain.PaymentMethod;
import com.carnalysys.domain.PaymentStatus;
import com.carnalysys.domain.PaymentTransactionEntity;
import com.carnalysys.domain.PaymentTransactionStatus;
import com.carnalysys.domain.Product;
import com.carnalysys.domain.ProductType;
import com.carnalysys.domain.UserEntity;
import com.carnalysys.domain.UserProfile;
import com.carnalysys.repo.AddressRepository;
import com.carnalysys.repo.CartItemRepository;
import com.carnalysys.repo.OrderLineRepository;
import com.carnalysys.repo.OrderRepository;
import com.carnalysys.repo.OrderStatusAuditRepository;
import com.carnalysys.repo.PaymentEventRepository;
import com.carnalysys.repo.PaymentTransactionRepository;
import com.carnalysys.repo.ProductRepository;
import com.carnalysys.repo.AdminUserRepository;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import com.carnalysys.repo.UserProfileRepository;
import com.carnalysys.util.EmployeeAvailability;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {
  private static final Logger log = LoggerFactory.getLogger(OrderService.class);

  private final OrderRepository orderRepository;
  private final OrderLineRepository orderLineRepository;
  private final AddressRepository addressRepository;
  private final CartService cartService;
  private final CartItemRepository cartItemRepository;
  private final UserProfileRepository userProfileRepository;
  private final ProductRepository productRepository;
  private final OrderStatusAuditRepository orderStatusAuditRepository;
  private final PaymentEventRepository paymentEventRepository;
  private final PaymentTransactionRepository paymentTransactionRepository;
  private final AdminUserRepository adminUserRepository;
  private final UploadStorageService uploadStorageService;
  private final NotificationService notificationService;
  private final WhatsappService whatsappService;
  private final LowStockAlertService lowStockAlertService;
  private final DeliveryWorkflowService deliveryWorkflowService;
  private final AppProperties appProperties;

  public OrderService(
      OrderRepository orderRepository,
      OrderLineRepository orderLineRepository,
      AddressRepository addressRepository,
      CartService cartService,
      CartItemRepository cartItemRepository,
      UserProfileRepository userProfileRepository,
      ProductRepository productRepository,
      OrderStatusAuditRepository orderStatusAuditRepository,
      PaymentEventRepository paymentEventRepository,
      PaymentTransactionRepository paymentTransactionRepository,
      AdminUserRepository adminUserRepository,
      UploadStorageService uploadStorageService,
      NotificationService notificationService,
      WhatsappService whatsappService,
      LowStockAlertService lowStockAlertService,
      @Lazy DeliveryWorkflowService deliveryWorkflowService,
      AppProperties appProperties) {
    this.orderRepository = orderRepository;
    this.orderLineRepository = orderLineRepository;
    this.addressRepository = addressRepository;
    this.cartService = cartService;
    this.cartItemRepository = cartItemRepository;
    this.userProfileRepository = userProfileRepository;
    this.productRepository = productRepository;
    this.orderStatusAuditRepository = orderStatusAuditRepository;
    this.paymentEventRepository = paymentEventRepository;
    this.paymentTransactionRepository = paymentTransactionRepository;
    this.adminUserRepository = adminUserRepository;
    this.uploadStorageService = uploadStorageService;
    this.notificationService = notificationService;
    this.whatsappService = whatsappService;
    this.lowStockAlertService = lowStockAlertService;
    this.deliveryWorkflowService = deliveryWorkflowService;
    this.appProperties = appProperties;
  }

  @Transactional
  public Map<String, Object> placeOrder(
      UUID userId, String addressIdStr, String paymentMethodRaw, String paymentTxnIdRaw) {
    return placeOrder(userId, addressIdStr, paymentMethodRaw, paymentTxnIdRaw, null);
  }

  @Transactional
  public Map<String, Object> placeOrder(
      UUID userId,
      String addressIdStr,
      String paymentMethodRaw,
      String paymentTxnIdRaw,
      String demoPaymentOutcome) {
    UUID uid = Objects.requireNonNull(userId, "userId");
    Cart cart = cartService.requireNonEmptyCart(Optional.of(uid), Optional.empty());
    List<CartItem> lines = cartItemRepository.findByCart_IdAndDeletedAtIsNull(cart.getId());
    if (lines.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_CART", "Cart is empty");
    }
    PaymentMethod paymentMethod = parsePaymentMethod(paymentMethodRaw);
    String paymentTxnId =
        normalizePaymentTxnId(
            uploadStorageService.persistReceiptIfDataUrl(uid, paymentTxnIdRaw), userId, paymentMethod);

    // Lock product rows to guarantee stock consistency during checkout.
    List<String> productIds = lines.stream().map(ci -> ci.getProduct().getId()).distinct().toList();
    Map<String, Product> productsById =
        productRepository.findAllByIdInForUpdate(productIds).stream()
            .collect(Collectors.toMap(Product::getId, p -> p));

    UserEntity user = cart.getUser();
    OrderEntity order = new OrderEntity();
    order.setId("ord_" + UUID.randomUUID());
    order.setUser(user);
    order.setCurrency("INR");
    AddressEntity ship = null;
    if (addressIdStr != null && !addressIdStr.isBlank()) {
      try {
        UUID aid = UUID.fromString(addressIdStr);
        ship =
            addressRepository
                .findById(Objects.requireNonNull(aid, "address id"))
                .filter(a -> a.getDeletedAt() == null && a.getUser().getId().equals(uid))
                .orElse(null);
      } catch (IllegalArgumentException ignored) {
        ship = null;
      }
    }
    order.setShippingAddress(ship);
    order.setPaymentMethod(paymentMethod);
    order.setPaymentTxnId(paymentTxnId);
    boolean onlineRazorpay =
        paymentMethod != PaymentMethod.cod
            && (paymentTxnIdRaw == null || paymentTxnIdRaw.isBlank())
            && !"success".equalsIgnoreCase(demoPaymentOutcome)
            && "razorpay".equalsIgnoreCase(appProperties.payment().provider());
    order.setPaymentProvider(
        paymentMethod == PaymentMethod.cod ? "cod" : onlineRazorpay ? "razorpay" : "manual");
    order.setPaymentOrderRef(null);
    order.setPaymentAttemptCount(1);

    BigDecimal total = BigDecimal.ZERO;
    List<OrderLine> persisted = new ArrayList<>();
    for (CartItem ci : lines) {
      Product p = productsById.get(ci.getProduct().getId());
      if (p == null) continue;
      if (p.getDeletedAt() != null) continue;
      if (!p.isPublished()) continue;
      if (p.getType() == com.carnalysys.domain.ProductType.part && p.getStockQuantity() < ci.getQuantity()) {
        throw new ApiException(
            HttpStatus.CONFLICT,
            "INSUFFICIENT_STOCK",
            "Insufficient stock for " + p.getName());
      }
      BigDecimal unit = p.getPriceInr();
      BigDecimal lineTotal = unit.multiply(BigDecimal.valueOf(ci.getQuantity()));
      total = total.add(lineTotal);
      OrderLine ol = new OrderLine();
      ol.setOrder(order);
      ol.setProductId(p.getId());
      ol.setProductNameSnapshot(p.getName());
      ol.setSkuSnapshot(p.getSku());
      ol.setQuantity(ci.getQuantity());
      ol.setUnitPriceInr(unit);
      ol.setLineTotalInr(lineTotal);
      persisted.add(ol);
    }
    if (persisted.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_CART", "Cart is empty");
    }
    order.setTotalInr(total.setScale(2, RoundingMode.HALF_UP));
    boolean paidNow =
        (paymentTxnIdRaw != null && !paymentTxnIdRaw.isBlank())
            || "success".equalsIgnoreCase(demoPaymentOutcome);
    if ("failed".equalsIgnoreCase(demoPaymentOutcome)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "PAYMENT_FAILED", "Demo payment failed");
    }
    if (paidNow) {
      order.setPaymentStatus(PaymentStatus.paid);
      order.setPaidAt(Instant.now());
      order.setStatus(OrderStatus.placed);
    } else if (paymentMethod == PaymentMethod.cod) {
      order.setPaymentStatus(PaymentStatus.pending);
      order.setStatus(OrderStatus.placed);
    } else if (onlineRazorpay) {
      order.setPaymentStatus(PaymentStatus.pending);
      order.setStatus(OrderStatus.draft);
    } else {
      order.setPaymentStatus(PaymentStatus.pending);
      order.setStatus(OrderStatus.placed);
    }
    orderRepository.saveAndFlush(order);
    orderLineRepository.saveAll(persisted);

    if (order.getPaymentStatus() == PaymentStatus.paid || paymentMethod == PaymentMethod.cod) {
      decrementStock(lines, productsById);
    }
    // Lines are snapshotted on the order; active cart must not retain them for a new checkout.
    cartService.emptyCart(cart);

    writePaymentEvent(order, null, "checkout", "init_" + order.getId(), "payment_initiated");
    if (order.getStatus() == OrderStatus.draft) {
      notificationService.notifyUser(
          uid,
          "payment",
          "Complete payment",
          "Your order " + order.getId() + " is awaiting payment.",
          "order",
          order.getId(),
          Map.of("paymentStatus", order.getPaymentStatus().name(), "orderStatus", order.getStatus().name()));
    } else {
      writeStatusAudit(order, null, order.getStatus(), "system", uid.toString(), "order_placed");
      notifyOrderPlaced(order, uid);
    }

    UUID userRef = Objects.requireNonNull(user.getId(), "order user id");
    UserProfile profile = userProfileRepository.findById(userRef).orElse(null);
    return Map.of(
        "order",
        toOrderMap(order, persisted, addressIdStr, profile, true, false, null));
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listMine(UUID userId) {
    UUID uid = Objects.requireNonNull(userId, "userId");
    UserProfile profile = userProfileRepository.findById(uid).orElse(null);
    List<OrderEntity> orders = orderRepository.findByUser_IdOrderByPlacedAtDesc(uid);
    Map<String, PaymentTransactionEntity> latestByOrder =
        latestPaymentAttemptsForOrders(orders.stream().map(OrderEntity::getId).toList());
    return orders.stream()
        .map(
            o ->
                toOrderMap(
                    o,
                    orderLineRepository.findByOrder_Id(o.getId()),
                    null,
                    profile,
                    true,
                    true,
                    latestByOrder.get(o.getId())))
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listMinePage(UUID userId, int page, int size) {
    UUID uid = Objects.requireNonNull(userId, "userId");
    int safePage = Math.max(0, page);
    int safeSize = Math.max(1, Math.min(50, size));
    var pageResult =
        orderRepository.findByUser_IdOrderByPlacedAtDesc(uid, PageRequest.of(safePage, safeSize));
    UserProfile profile = userProfileRepository.findById(uid).orElse(null);
    List<OrderEntity> content = pageResult.getContent();
    Map<String, PaymentTransactionEntity> latestByOrder =
        latestPaymentAttemptsForOrders(content.stream().map(OrderEntity::getId).toList());
    List<Map<String, Object>> rows =
        content.stream()
            .map(
                o ->
                    toOrderMap(
                        o,
                        orderLineRepository.findByOrder_Id(o.getId()),
                        null,
                        profile,
                        true,
                        true,
                        latestByOrder.get(o.getId())))
            .toList();
    return Map.of(
        "items", rows,
        "page", safePage,
        "size", safeSize,
        "hasMore", pageResult.hasNext(),
        "nextPage", pageResult.hasNext() ? safePage + 1 : safePage);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listMineByPhone(UUID userId, String phoneE164) {
    UUID uid = Objects.requireNonNull(userId, "userId");
    if (phoneE164 == null || phoneE164.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "phone required");
    }
    String normalized = normalizePhone(phoneE164);
    UserProfile profile = userProfileRepository.findById(uid).orElse(null);
    List<OrderEntity> orders =
        orderRepository.findByUser_PhoneE164OrderByPlacedAtDesc(normalized).stream()
            .filter(o -> o.getUser().getId().equals(uid))
            .toList();
    Map<String, PaymentTransactionEntity> latestByOrder =
        latestPaymentAttemptsForOrders(orders.stream().map(OrderEntity::getId).toList());
    return orders.stream()
        .map(
            o ->
                toOrderMap(
                    o,
                    orderLineRepository.findByOrder_Id(o.getId()),
                    null,
                    profile,
                    true,
                    true,
                    latestByOrder.get(o.getId())))
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listMineByPhonePage(UUID userId, String phoneE164, int page, int size) {
    UUID uid = Objects.requireNonNull(userId, "userId");
    if (phoneE164 == null || phoneE164.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "phone required");
    }
    int safePage = Math.max(0, page);
    int safeSize = Math.max(1, Math.min(50, size));
    String normalized = normalizePhone(phoneE164);
    UserProfile profile = userProfileRepository.findById(uid).orElse(null);
    var pageResult =
        orderRepository.findByUser_PhoneE164OrderByPlacedAtDesc(
            normalized, PageRequest.of(safePage, safeSize));
    List<OrderEntity> content =
        pageResult.getContent().stream().filter(o -> o.getUser().getId().equals(uid)).toList();
    Map<String, PaymentTransactionEntity> latestByOrder =
        latestPaymentAttemptsForOrders(content.stream().map(OrderEntity::getId).toList());
    List<Map<String, Object>> rows =
        content.stream()
            .map(
                o ->
                    toOrderMap(
                        o,
                        orderLineRepository.findByOrder_Id(o.getId()),
                        null,
                        profile,
                        true,
                        true,
                        latestByOrder.get(o.getId())))
            .toList();
    return Map.of(
        "items", rows,
        "page", safePage,
        "size", safeSize,
        "hasMore", pageResult.hasNext(),
        "nextPage", pageResult.hasNext() ? safePage + 1 : safePage);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getMine(UUID userId, String orderId) {
    UUID uid = Objects.requireNonNull(userId, "userId");
    OrderEntity o =
        orderRepository
            .findByIdAndUser_Id(orderId, uid)
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    UserProfile profile = userProfileRepository.findById(uid).orElse(null);
    PaymentTransactionEntity latest =
        paymentTransactionRepository
            .findFirstByOrder_IdOrderByAttemptNoDescCreatedAtDesc(o.getId())
            .orElse(null);
    return Map.of(
        "order",
        toOrderMap(o, orderLineRepository.findByOrder_Id(o.getId()), null, profile, true, true, latest));
  }

  /** Live delivery OTP for order owner (not cached in list pagination). */
  @Transactional(readOnly = true)
  public Map<String, Object> getDeliveryOtpForOwner(UUID userId, String orderId) {
    UUID uid = Objects.requireNonNull(userId, "userId");
    OrderEntity o =
        orderRepository
            .findByIdAndUser_Id(orderId, uid)
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    return deliveryWorkflowService.customerDeliveryOtpView(o);
  }

  private Map<String, Object> toOrderMap(
      OrderEntity o,
      List<OrderLine> lines,
      String addressIdOverride,
      UserProfile profileOrNull,
      boolean includeHistory,
      boolean includeUserDeliveryOtp) {
    return toOrderMap(
        o, lines, addressIdOverride, profileOrNull, includeHistory, includeUserDeliveryOtp, null);
  }

  private Map<String, Object> toOrderMap(
      OrderEntity o,
      List<OrderLine> lines,
      String addressIdOverride,
      UserProfile profileOrNull,
      boolean includeHistory,
      boolean includeUserDeliveryOtp,
      PaymentTransactionEntity latestPaymentAttempt) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", o.getId());
    UserEntity customer = o.getUser();
    m.put("userId", customer.getId().toString());
    putCustomerFields(m, customer, profileOrNull);
    m.put("status", o.getStatus().name());
    m.put("paymentMethod", o.getPaymentMethod() != null ? o.getPaymentMethod().name() : null);
    m.put("paymentStatus", o.getPaymentStatus() != null ? o.getPaymentStatus().name() : null);
    m.put("paymentTxnId", o.getPaymentTxnId());
    m.put("paymentProvider", o.getPaymentProvider());
    m.put("paidAt", o.getPaidAt() != null ? o.getPaidAt().toString() : null);
    m.put(
        "latestPaymentAttempt",
        latestPaymentAttempt != null ? toPaymentAttemptMap(latestPaymentAttempt) : null);
    List<Map<String, Object>> ls = new ArrayList<>();
    long total = 0;
    for (OrderLine ol : lines) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("productId", ol.getProductId());
      row.put("productName", ol.getProductNameSnapshot());
      row.put("sku", ol.getSkuSnapshot());
      row.put("quantity", ol.getQuantity());
      int unit = ol.getUnitPriceInr().setScale(0, RoundingMode.DOWN).intValue();
      row.put("unitPrice", unit);
      int lt = ol.getLineTotalInr().setScale(0, RoundingMode.DOWN).intValue();
      row.put("lineTotal", lt);
      total += lt;
      ls.add(row);
    }
    m.put("lines", ls);
    m.put("subtotal", total);
    long grandTotal = total;
    if (o.getTotalInr() != null) {
      grandTotal = o.getTotalInr().setScale(0, RoundingMode.DOWN).longValue();
    }
    m.put("total", grandTotal);
    m.put("createdAt", o.getPlacedAt().toString());
    m.put("assignedDeliveryAdminEmail", o.getAssignedDeliveryAdminEmail());
    m.put("assignedDeliveryAt", o.getAssignedDeliveryAt() != null ? o.getAssignedDeliveryAt().toString() : null);
    String aid =
        addressIdOverride != null
            ? addressIdOverride
            : (o.getShippingAddress() != null ? o.getShippingAddress().getId().toString() : null);
    m.put("addressId", aid);
    AddressEntity shipping = o.getShippingAddress();
    if (shipping != null) {
      m.put("shippingAddress", toAddressMap(shipping));
    }
    if (includeHistory) {
      m.put("statusHistory", toStatusHistory(o.getId()));
    }
    m.put(
        "deliveredAt",
        o.getStatus() == OrderStatus.delivered && o.getUpdatedAt() != null
            ? o.getUpdatedAt().toString()
            : null);
    deliveryWorkflowService.putDeliveryFields(
        m,
        o,
        includeUserDeliveryOtp
            ? DeliveryWorkflowService.DeliveryFieldsMode.USER
            : DeliveryWorkflowService.DeliveryFieldsMode.ADMIN);
    return m;
  }

  private static Map<String, Object> toAddressMap(AddressEntity a) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", a.getId().toString());
    m.put("line1", a.getLine1());
    m.put("line2", a.getLine2());
    m.put("city", a.getCity());
    m.put("state", a.getState());
    m.put("pincode", a.getPincode());
    m.put("country", a.getCountry());
    m.put("label", a.getLabel());
    m.put("isDefault", a.isDefaultAddress());
    return m;
  }

  private List<Map<String, Object>> toStatusHistory(String orderId) {
    return orderStatusAuditRepository.findByOrder_IdOrderByCreatedAtAsc(orderId).stream()
        .map(a -> {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("from", a.getFromStatus() != null ? a.getFromStatus().name() : null);
          row.put("to", a.getToStatus().name());
          row.put("actorType", a.getChangedByType());
          row.put("actorId", a.getChangedById());
          row.put("reason", a.getReason());
          row.put("createdAt", a.getCreatedAt().toString());
          return row;
        })
        .toList();
  }

  private static void putCustomerFields(
      Map<String, Object> m, UserEntity u, UserProfile profileOrNull) {
    String fromProfile =
        profileOrNull != null && profileOrNull.getFullName() != null
            ? profileOrNull.getFullName().trim()
            : "";
    String fromUser =
        u.getDisplayName() != null ? u.getDisplayName().trim() : "";
    String name =
        !fromProfile.isEmpty()
            ? fromProfile
            : !fromUser.isEmpty()
                ? fromUser
                : null;
    m.put("customerName", name);
    m.put("customerPhone", u.getPhoneE164());
    String email =
        profileOrNull != null && profileOrNull.getEmail() != null
            ? profileOrNull.getEmail().trim()
            : null;
    if (email != null && email.isEmpty()) {
      email = null;
    }
    m.put("customerEmail", email);
    m.put("customerRole", u.getRole() != null ? u.getRole() : "user");
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listAllAdmin() {
    List<OrderEntity> sorted =
        orderRepository.findAll().stream()
            .sorted((a, b) -> b.getPlacedAt().compareTo(a.getPlacedAt()))
            .toList();
    Set<UUID> userIds =
        sorted.stream().map(o -> o.getUser().getId()).collect(Collectors.toSet());
    Map<UUID, UserProfile> profilesByUserId = new HashMap<>();
    if (!userIds.isEmpty()) {
      for (UserProfile p : userProfileRepository.findAllById(userIds)) {
        profilesByUserId.put(p.getUserId(), p);
      }
    }
    return sorted.stream()
        .map(
            o ->
                toOrderMap(
                    o,
                    orderLineRepository.findByOrder_Id(o.getId()),
                    null,
                    profilesByUserId.get(o.getUser().getId()),
                    false,
                    false))
        .toList();
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listAllAdminByPhone(String phone) {
    String normalized = normalizePhone(phone);
    return orderRepository.findByUser_PhoneE164OrderByPlacedAtDesc(normalized).stream()
        .map(
            o ->
                toOrderMap(
                    o,
                    orderLineRepository.findByOrder_Id(o.getId()),
                    null,
                    userProfileRepository
                        .findById(Objects.requireNonNull(o.getUser().getId(), "order user id"))
                        .orElse(null),
                    false,
                    false))
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listAllAdminByPhonePage(String phone, int page, int size) {
    String normalized = normalizePhone(phone);
    int safePage = Math.max(0, page);
    int safeSize = Math.max(1, Math.min(50, size));
    var pageResult =
        orderRepository.findByUser_PhoneE164OrderByPlacedAtDesc(
            normalized, PageRequest.of(safePage, safeSize));
    List<Map<String, Object>> rows =
        pageResult.getContent().stream()
            .map(
                o ->
                    toOrderMap(
                        o,
                        orderLineRepository.findByOrder_Id(o.getId()),
                        null,
                        userProfileRepository
                            .findById(Objects.requireNonNull(o.getUser().getId(), "order user id"))
                            .orElse(null),
                        false,
                        false))
            .toList();
    return Map.of(
        "items", rows,
        "page", safePage,
        "size", safeSize,
        "hasMore", pageResult.hasNext(),
        "nextPage", pageResult.hasNext() ? safePage + 1 : safePage);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> toAdminOrderMap(OrderEntity order, List<OrderLine> lines) {
    UserProfile profile =
        userProfileRepository
            .findById(Objects.requireNonNull(order.getUser().getId(), "order user id"))
            .orElse(null);
    return toOrderMap(order, lines, null, profile, true, false);
  }

  /**
   * Delivery partner view: line prices hidden; includes payment collection totals and status.
   */
  @Transactional(readOnly = true)
  public Map<String, Object> toDeliveryPartnerOrderMap(OrderEntity order, List<OrderLine> lines) {
    UserProfile profile =
        userProfileRepository
            .findById(Objects.requireNonNull(order.getUser().getId(), "order user id"))
            .orElse(null);
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", order.getId());
    UserEntity customer = order.getUser();
    m.put("userId", customer.getId().toString());
    putCustomerFields(m, customer, profile);
    m.put("status", order.getStatus().name());
    m.put("paymentMethod", order.getPaymentMethod() != null ? order.getPaymentMethod().name() : null);
    m.put("paymentStatus", order.getPaymentStatus() != null ? order.getPaymentStatus().name() : null);
    m.put("paymentProvider", order.getPaymentProvider());
    m.put("paidAt", order.getPaidAt() != null ? order.getPaidAt().toString() : null);
    if (order.getTotalInr() != null) {
      long grandTotal = order.getTotalInr().setScale(0, RoundingMode.DOWN).longValue();
      m.put("totalInr", grandTotal);
      m.put("total", grandTotal);
    }
    m.put("currency", order.getCurrency() != null ? order.getCurrency() : "INR");
    List<Map<String, Object>> ls = new ArrayList<>();
    for (OrderLine ol : lines) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("productId", ol.getProductId());
      row.put("productName", ol.getProductNameSnapshot());
      row.put("sku", ol.getSkuSnapshot());
      row.put("quantity", ol.getQuantity());
      ls.add(row);
    }
    m.put("lines", ls);
    m.put("createdAt", order.getPlacedAt().toString());
    m.put("assignedDeliveryAdminEmail", order.getAssignedDeliveryAdminEmail());
    m.put(
        "assignedDeliveryAt",
        order.getAssignedDeliveryAt() != null ? order.getAssignedDeliveryAt().toString() : null);
    m.put(
        "deliveredAt",
        order.getStatus() == OrderStatus.delivered && order.getUpdatedAt() != null
            ? order.getUpdatedAt().toString()
            : null);
    m.put("statusHistory", toStatusHistory(order.getId()));
    String aid =
        order.getShippingAddress() != null ? order.getShippingAddress().getId().toString() : null;
    m.put("addressId", aid);
    AddressEntity shipping = order.getShippingAddress();
    if (shipping != null) {
      m.put("shippingAddress", toAddressMap(shipping));
    }
    deliveryWorkflowService.putDeliveryFields(
        m, order, DeliveryWorkflowService.DeliveryFieldsMode.ADMIN);
    return m;
  }

  @Transactional
  public Map<String, Object> patchStatusAdmin(String orderId, String status) {
    OrderEntity o =
        orderRepository
            .findById(Objects.requireNonNull(orderId, "orderId"))
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    OrderStatus next;
    try {
      next = normalizeAdminStatus(status);
    } catch (IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid status");
    }
    return applyOrderStatusTransition(o, next, "admin_status_patch", false);
  }

  /**
   * Delivery role only: assigned partner may mark {@code shipped} → {@code delivered}. Response uses
   * delivery-safe fields (no prices).
   */
  @Transactional
  public Map<String, Object> patchStatusAsDeliveryPartner(
      String orderId, String status, String deliveryAdminEmail) {
    OrderEntity o =
        orderRepository
            .findById(Objects.requireNonNull(orderId, "orderId"))
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    OrderStatus next;
    try {
      next = normalizeAdminStatus(status);
    } catch (IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid status");
    }
    if (next != OrderStatus.delivered) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "VALIDATION_ERROR",
          "Delivery partners may only set status to delivered");
    }
    String assigned = o.getAssignedDeliveryAdminEmail();
    if (assigned == null || assigned.isBlank()) {
      throw new ApiException(
          HttpStatus.FORBIDDEN, "FORBIDDEN", "Order is not assigned for delivery");
    }
    String deliveryKey =
        deliveryAdminEmail == null ? "" : deliveryAdminEmail.trim().toLowerCase();
    if (!assigned.trim().equalsIgnoreCase(deliveryKey)) {
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Order is not assigned to you");
    }
    if (o.getStatus() != OrderStatus.shipped) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "INVALID_STATUS_TRANSITION",
          "Order must be shipped before marking delivered");
    }
    return applyOrderStatusTransition(o, OrderStatus.delivered, "delivery_partner_delivered", true);
  }

  private Map<String, Object> applyOrderStatusTransition(
      OrderEntity o,
      OrderStatus next,
      String auditReason,
      boolean deliveryPartnerResponse) {
    OrderStatus before = o.getStatus();
    if (!isOrderStatusTransitionAllowed(before, next)) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "INVALID_STATUS_TRANSITION",
          "Cannot move order from " + before + " to " + next);
    }
    o.setStatus(next);
    o.setUpdatedAt(Instant.now());
    if (next == OrderStatus.delivered) {
      markCodPaymentCollected(o);
    }
    orderRepository.save(o);
    String actor = null;
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.isAuthenticated()) actor = auth.getName();
    writeStatusAudit(o, before, next, "admin", actor, auditReason);
    updateAssignedDeliveryAvailabilityOnStatusTransition(o, before, next);
    notificationService.notifyUser(
        o.getUser().getId(),
        "order_status",
        "Your order status has changed",
        "Your order " + o.getId() + " moved from " + before.name() + " to " + next.name() + ".",
        "order",
        o.getId(),
        Map.of("from", before.name(), "to", next.name()));
    if (next == OrderStatus.delivered) {
      notificationService.notifySuperAdminAndSalesDeliveryCompleted(o.getId());
    }
    notifyOrderStatusWhatsappBestEffort(o, next);
    List<OrderLine> lines = orderLineRepository.findByOrder_Id(o.getId());
    if (deliveryPartnerResponse) {
      return Map.of("order", toDeliveryPartnerOrderMap(o, lines));
    }
    UserProfile profile =
        userProfileRepository
            .findById(Objects.requireNonNull(o.getUser().getId(), "order user id"))
            .orElse(null);
    return Map.of("order", toOrderMap(o, lines, null, profile, true, false));
  }

  private static OrderStatus normalizeAdminStatus(String status) {
    if (status == null) throw new IllegalArgumentException("status required");
    String raw = status.trim().toLowerCase();
    if ("dispatched".equals(raw)) {
      return OrderStatus.shipped;
    }
    return OrderStatus.valueOf(raw);
  }

  private void updateAssignedDeliveryAvailabilityOnStatusTransition(
      OrderEntity order, OrderStatus before, OrderStatus after) {
    String deliveryEmail = order.getAssignedDeliveryAdminEmail();
    if (deliveryEmail == null || deliveryEmail.isBlank()) return;
    if (before == after) return;
    syncDeliveryAvailabilityFromAssignedOrders(deliveryEmail);
  }

  private void syncDeliveryAvailabilityFromAssignedOrders(String deliveryEmail) {
    var deliveryOpt = adminUserRepository.findByEmailIgnoreCase(deliveryEmail);
    if (deliveryOpt.isEmpty()) return;
    var delivery = deliveryOpt.get();
    if (!"delivery".equalsIgnoreCase(delivery.getRole())) return;

    String stored =
        delivery.getAvailabilityStatus() != null
            ? delivery.getAvailabilityStatus().trim().toLowerCase()
            : "offline";
    if ("offline".equals(stored)) {
      return;
    }

    boolean hasActiveAssignedOrders =
        orderRepository.findByAssignedDeliveryAdminEmailOrderByPlacedAtDesc(deliveryEmail).stream()
            .anyMatch(o -> EmployeeAvailability.isActiveDeliveryOrderStatus(o.getStatus()));

    String target = hasActiveAssignedOrders ? "busy" : "online";
    if (!target.equalsIgnoreCase(stored)) {
      delivery.setAvailabilityStatus(target);
      adminUserRepository.save(delivery);
    }
  }

  private static PaymentMethod parsePaymentMethod(String raw) {
    if (raw == null || raw.isBlank()) return PaymentMethod.cod;
    try {
      return PaymentMethod.valueOf(raw.trim().toLowerCase());
    } catch (IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid payment method");
    }
  }

  private static String normalizePaymentTxnId(String raw, UUID userId, PaymentMethod method) {
    if (raw != null && !raw.isBlank()) return raw.trim();
    if (method == PaymentMethod.cod) {
      return "txn_cod_" + userId.toString().substring(0, 8) + "_" + Instant.now().toEpochMilli();
    }
    return null;
  }

  public String normalizePhoneForAdminListing(String phoneE164) {
    if (phoneE164 == null || phoneE164.isBlank()) {
      return "";
    }
    return normalizePhone(phoneE164);
  }

  private static String normalizePhone(String phoneE164) {
    String p = phoneE164.trim();
    if (!p.startsWith("+")) {
      p = p.replaceAll("[^0-9]", "");
    }
    return p;
  }

  private void decrementStock(List<CartItem> lines, Map<String, Product> productsById) {
    for (CartItem ci : lines) {
      Product p = productsById.get(ci.getProduct().getId());
      if (p == null || !p.isPublished()) continue;
      if (p.getType() == ProductType.vehicle) continue;
      int before = p.getStockQuantity();
      int left = before - ci.getQuantity();
      if (left < 0) {
        throw new ApiException(
            HttpStatus.CONFLICT, "INSUFFICIENT_STOCK", "Insufficient stock for " + p.getName());
      }
      p.setStockQuantity(left);
      productRepository.save(p);
      lowStockAlertService.onStockChanged(p, before, left);
    }
  }

  private void writeStatusAudit(
      OrderEntity order,
      OrderStatus fromStatus,
      OrderStatus toStatus,
      String actorType,
      String actorId,
      String reason) {
    OrderStatusAuditEntity audit = new OrderStatusAuditEntity();
    audit.setOrder(order);
    audit.setFromStatus(fromStatus);
    audit.setToStatus(toStatus);
    audit.setChangedByType(actorType);
    audit.setChangedById(actorId);
    audit.setReason(reason);
    orderStatusAuditRepository.save(audit);
  }

  private void writePaymentEvent(
      OrderEntity order,
      PaymentTransactionEntity transaction,
      String provider,
      String providerEventId,
      String eventType) {
    PaymentEventEntity event = new PaymentEventEntity();
    event.setOrder(order);
    event.setTransaction(transaction);
    event.setProvider(provider);
    event.setProviderEventId(providerEventId);
    event.setEventType(eventType);
    event.setPayload(JsonNodeFactory.instance.objectNode());
    paymentEventRepository.save(event);
  }

  private Map<String, PaymentTransactionEntity> latestPaymentAttemptsForOrders(List<String> orderIds) {
    if (orderIds == null || orderIds.isEmpty()) {
      return Map.of();
    }
    Map<String, PaymentTransactionEntity> latest = new HashMap<>();
    for (PaymentTransactionEntity tx : paymentTransactionRepository.findByOrder_IdIn(orderIds)) {
      String oid = tx.getOrder().getId();
      PaymentTransactionEntity prev = latest.get(oid);
      if (prev == null || isNewerPaymentAttempt(tx, prev)) {
        latest.put(oid, tx);
      }
    }
    return latest;
  }

  private static boolean isNewerPaymentAttempt(
      PaymentTransactionEntity candidate, PaymentTransactionEntity current) {
    if (candidate.getAttemptNo() != current.getAttemptNo()) {
      return candidate.getAttemptNo() > current.getAttemptNo();
    }
    return candidate.getCreatedAt().isAfter(current.getCreatedAt());
  }

  private static Map<String, Object> toPaymentAttemptMap(PaymentTransactionEntity tx) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("status", tx.getStatus().name());
    m.put("provider", tx.getProvider());
    m.put("providerOrderId", tx.getProviderOrderId());
    m.put("providerPaymentId", tx.getProviderPaymentId());
    m.put("attemptNo", tx.getAttemptNo());
    m.put("errorCode", tx.getErrorCode());
    m.put("errorMessage", tx.getErrorMessage());
    m.put("createdAt", tx.getCreatedAt().toString());
    m.put("updatedAt", tx.getUpdatedAt().toString());
    return m;
  }

  @Transactional
  public Map<String, Object> cancelLatestRazorpayPaymentAttempt(UUID userId, String orderId) {
    UUID uid = Objects.requireNonNull(userId, "userId");
    if (orderId == null || orderId.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "orderId required");
    }
    OrderEntity order =
        orderRepository
            .findByIdAndUser_Id(orderId.trim(), uid)
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    OrderEntity locked =
        orderRepository
            .findByIdForUpdate(order.getId())
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    if (locked.getPaymentMethod() == PaymentMethod.cod) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Cash on Delivery orders do not use Razorpay");
    }
    String provider = locked.getPaymentProvider();
    if (provider == null || !"razorpay".equalsIgnoreCase(provider.trim())) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Order is not an online Razorpay checkout");
    }
    if (locked.getPaymentStatus() == PaymentStatus.paid
        || locked.getPaymentStatus() == PaymentStatus.authorized) {
      throw new ApiException(
          HttpStatus.CONFLICT, "PAYMENT_ALREADY_COMPLETED", "Order is already paid");
    }
    PaymentTransactionEntity latest =
        paymentTransactionRepository
            .findFirstByOrder_IdOrderByAttemptNoDescCreatedAtDesc(locked.getId())
            .orElse(null);
    if (latest == null) {
      return Map.of("cancelled", false, "reason", "no_payment_attempt");
    }
    if (latest.getStatus() == PaymentTransactionStatus.cancelled) {
      return Map.of(
          "cancelled",
          true,
          "replayed",
          true,
          "latestPaymentAttempt",
          toPaymentAttemptMap(latest));
    }
    if (latest.getStatus() != PaymentTransactionStatus.created
        && latest.getStatus() != PaymentTransactionStatus.authorized) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "PAYMENT_CANCEL_NOT_ALLOWED",
          "Latest payment attempt cannot be cancelled");
    }
    latest.setStatus(PaymentTransactionStatus.cancelled);
    paymentTransactionRepository.save(latest);
    String eventId = "cancel_attempt_" + latest.getId();
    if (paymentEventRepository
        .findByProviderAndProviderEventId(provider.toLowerCase(), eventId)
        .isEmpty()) {
      writePaymentEvent(locked, latest, provider.toLowerCase(), eventId, "payment_cancelled");
    }
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("cancelled", true);
    response.put("latestPaymentAttempt", toPaymentAttemptMap(latest));
    return response;
  }

  @Transactional
  public void notifyOrderPlaced(OrderEntity order, UUID userId) {
    if (order == null || userId == null) return;
    notificationService.notifyUser(
        userId,
        "order_status",
        "Order placed",
        "Your order " + order.getId() + " has been placed.",
        "order",
        order.getId(),
        Map.of("status", order.getStatus().name()));
    notificationService.notifySuperAdminAndSalesNewOrder(order.getId());
    notifyOrderStatusWhatsappBestEffort(order, order.getStatus());
  }

  /**
   * Cash collected on delivery: payment moves to paid without re-running stock decrement (stock is
   * committed when the COD order is placed).
   */
  private void markCodPaymentCollected(OrderEntity order) {
    if (order.getPaymentMethod() != PaymentMethod.cod) return;
    if (order.getPaymentStatus() == PaymentStatus.paid) return;
    order.setPaymentStatus(PaymentStatus.paid);
    order.setPaidAt(Instant.now());
    writePaymentEvent(order, null, "cod", "cod_collected_" + order.getId(), "payment_collected");
  }

  @Transactional
  public void applyPaidEffects(OrderEntity order) {
    if (order == null || order.getPaymentStatus() != PaymentStatus.paid) return;
    List<OrderLine> lines = orderLineRepository.findByOrder_Id(order.getId());
    List<String> productIds = lines.stream().map(OrderLine::getProductId).distinct().toList();
    Map<String, Product> productsById =
        productRepository.findAllByIdInForUpdate(productIds).stream()
            .collect(Collectors.toMap(Product::getId, p -> p));
    for (OrderLine ol : lines) {
      Product p = productsById.get(ol.getProductId());
      if (p == null || !p.isPublished() || p.getType() == ProductType.vehicle) continue;
      int before = p.getStockQuantity();
      int left = before - ol.getQuantity();
      if (left < 0) {
        throw new ApiException(
            HttpStatus.CONFLICT, "INSUFFICIENT_STOCK", "Insufficient stock for " + p.getName());
      }
      p.setStockQuantity(left);
      productRepository.save(p);
      lowStockAlertService.onStockChanged(p, before, left);
    }
    UUID userId = Objects.requireNonNull(order.getUser().getId(), "order user id");
    CartService.CartSnapshot snap =
        cartService.resolveCart(Optional.of(userId), Optional.empty(), false);
    if (snap.cart() != null) {
      cartService.emptyCart(snap.cart());
    }
  }

  @Transactional
  public int reconcilePendingPayments(int olderThanMinutes) {
    Instant cutoff = Instant.now().minusSeconds(Math.max(1, olderThanMinutes) * 60L);
    List<OrderEntity> stale =
        orderRepository.findByPaymentStatusAndPlacedAtBeforeOrderByPlacedAtAsc(
            PaymentStatus.pending, cutoff);
    int changed = 0;
    for (OrderEntity order : stale) {
      OrderEntity locked =
          orderRepository
              .findByIdForUpdate(Objects.requireNonNull(order.getId(), "order id"))
              .orElse(null);
      if (locked == null || locked.getPaymentStatus() != PaymentStatus.pending) continue;
      PaymentStatus beforePay = locked.getPaymentStatus();
      OrderStatus beforeStatus = locked.getStatus();
      locked.setPaymentStatus(PaymentStatus.failed);
      locked.setPaymentLastError("reconciliation_timeout");
      if (locked.getStatus() == OrderStatus.placed) {
        locked.setStatus(OrderStatus.cancelled);
      }
      orderRepository.save(locked);
      writePaymentEvent(locked, null, "reconciliation", "reco_" + locked.getId(), "payment_timeout");
      writeStatusAudit(locked, beforeStatus, locked.getStatus(), "system", null, "reconciliation");
      notificationService.notifyUser(
          locked.getUser().getId(),
          "payment",
          "Payment timed out",
          "Payment for order " + locked.getId() + " timed out. Please retry.",
          "order",
          locked.getId(),
          Map.of("paymentStatus", locked.getPaymentStatus().name(), "orderStatus", locked.getStatus().name()));
      if (beforeStatus != locked.getStatus()) {
        notifyOrderStatusWhatsappBestEffort(locked, locked.getStatus());
      }
      if (beforePay != locked.getPaymentStatus()) {
        changed++;
      }
    }
    return changed;
  }

  @Transactional
  public void writeAuditFromPayment(
      OrderEntity order,
      OrderStatus beforeOrderStatus,
      PaymentStatus beforePaymentStatus,
      String actor,
      String reason) {
    writeStatusAudit(order, beforeOrderStatus, order.getStatus(), actor, null, reason);
    if (beforePaymentStatus != order.getPaymentStatus()) {
      writePaymentEvent(
          order,
          null,
          "payment",
          "evt_" + Instant.now().toEpochMilli(),
          "status_" + order.getPaymentStatus().name());
      notificationService.notifyUser(
          order.getUser().getId(),
          "payment",
          "Payment update",
          "Payment for order " + order.getId() + " is " + order.getPaymentStatus().name() + ".",
          "order",
          order.getId(),
          Map.of("paymentStatus", order.getPaymentStatus().name(), "orderStatus", order.getStatus().name()));
    }
  }

  /**
   * Customer in-app + WhatsApp after order status is already persisted (e.g. delivery workflow).
   * Does not mutate the order. Safe to call when status actually changed.
   */
  public void notifyCustomerOrderStatusBestEffort(
      OrderEntity order, OrderStatus before, OrderStatus after) {
    if (order == null || after == null || before == after) return;
    UserEntity user = order.getUser();
    if (user == null || user.getId() == null) return;
    notificationService.notifyUser(
        user.getId(),
        "order_status",
        "Your order status has changed",
        "Your order " + order.getId() + " moved from " + before.name() + " to " + after.name() + ".",
        "order",
        order.getId(),
        Map.of("from", before.name(), "to", after.name()));
    notifyOrderStatusTransitionWhatsappBestEffort(order, before, after);
  }

  /**
   * Used by other services (e.g. webhooks) after a status transition.
   * This must never throw.
   */
  public void notifyOrderStatusTransitionWhatsappBestEffort(
      OrderEntity order, OrderStatus before, OrderStatus after) {
    if (order == null || after == null) return;
    if (before == after) return;
    notifyOrderStatusWhatsappBestEffort(order, after);
  }

  private void notifyOrderStatusWhatsappBestEffort(OrderEntity order, OrderStatus status) {
    try {
      if (order == null || status == null) return;
      UserEntity user = order.getUser();
      String phone = user != null ? user.getPhoneE164() : null;
      if (phone == null || phone.isBlank()) return;
      boolean sent = whatsappService.sendOrderStatusUpdateBestEffort(phone, order.getId(), status);
      if (sent) {
        log.info(
            "WhatsApp order status notification sent: orderId={}, status={}",
            order.getId(),
            status.name());
      }
    } catch (RuntimeException ex) {
      log.error(
          "WhatsApp order status notification failed (ignored): orderId={}, status={}",
          order != null ? order.getId() : null,
          status != null ? status.name() : null,
          ex);
    }
  }

  @Transactional
  public PaymentTransactionEntity createPaymentTransactionForOrder(
      UUID userId, String orderId, String provider) {
    UUID uid = Objects.requireNonNull(userId, "userId");
    OrderEntity order =
        orderRepository
            .findByIdAndUser_Id(orderId, uid)
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    OrderEntity locked =
        orderRepository
            .findByIdForUpdate(order.getId())
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    if (locked.getPaymentMethod() == PaymentMethod.cod) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "COD orders do not use online gateway");
    }
    if (locked.getPaymentStatus() == PaymentStatus.paid) {
      throw new ApiException(HttpStatus.CONFLICT, "PAYMENT_ALREADY_COMPLETED", "Order is already paid");
    }
    if (!isRetryEligibleForGateway(locked)) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "PAYMENT_RETRY_NOT_ALLOWED",
          "Order is not in a retryable state for online payment");
    }
    OrderStatus beforeStatus = locked.getStatus();
    if (beforeStatus == OrderStatus.cancelled) {
      locked.setStatus(OrderStatus.placed);
      writeStatusAudit(
          locked,
          beforeStatus,
          locked.getStatus(),
          "user",
          uid.toString(),
          "payment_retry_initiated");
      notificationService.notifyUser(
          uid,
          "payment",
          "Payment retry started",
          "You can retry payment for order " + locked.getId() + ".",
          "order",
          locked.getId(),
          Map.of("status", locked.getStatus().name()));
    }
    int nextAttempt = Math.max(1, locked.getPaymentAttemptCount() + 1);
    PaymentTransactionEntity transaction = new PaymentTransactionEntity();
    transaction.setOrder(locked);
    transaction.setProvider(provider);
    transaction.setStatus(PaymentTransactionStatus.created);
    transaction.setAmountInr(locked.getTotalInr());
    transaction.setCurrency(locked.getCurrency());
    transaction.setAttemptNo(nextAttempt);
    transaction = paymentTransactionRepository.save(transaction);
    locked.setPaymentAttemptCount(nextAttempt);
    locked.setPaymentProvider(provider);
    locked.setPaymentStatus(PaymentStatus.pending);
    locked.setPaymentLastError(null);
    locked.setPaymentTxnId(null);
    locked.setPaymentOrderRef(null);
    orderRepository.save(locked);
    writePaymentEvent(
        locked,
        transaction,
        provider,
        "txn_create_" + transaction.getId(),
        "transaction_created");
    return transaction;
  }

  @Transactional
  public void attachProviderOrderToTransaction(
      PaymentTransactionEntity transaction, String providerOrderId, String receiptId) {
    PaymentTransactionEntity tx =
        paymentTransactionRepository
            .findById(Objects.requireNonNull(transaction.getId(), "transaction id"))
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.NOT_FOUND, "NOT_FOUND", "Payment transaction not found"));
    tx.setProviderOrderId(providerOrderId);
    paymentTransactionRepository.save(tx);
    OrderEntity order =
        orderRepository
            .findByIdForUpdate(tx.getOrder().getId())
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    order.setPaymentOrderRef(providerOrderId);
    orderRepository.save(order);
    writePaymentEvent(order, tx, tx.getProvider(), receiptId, "provider_order_created");
  }

  private static boolean isOrderStatusTransitionAllowed(OrderStatus from, OrderStatus to) {
    if (from == to) return true;
    if (from == OrderStatus.placed) {
      return to == OrderStatus.confirmed
          || to == OrderStatus.processing
          || to == OrderStatus.cancelled
          || to == OrderStatus.refunded;
    }
    if (from == OrderStatus.confirmed) {
      return to == OrderStatus.processing || to == OrderStatus.cancelled || to == OrderStatus.refunded;
    }
    if (from == OrderStatus.processing) {
      return to == OrderStatus.shipped || to == OrderStatus.cancelled || to == OrderStatus.refunded;
    }
    if (from == OrderStatus.shipped) {
      return to == OrderStatus.delivered || to == OrderStatus.refunded;
    }
    // terminal statuses cannot move forward
    return false;
  }

  private static boolean isRetryEligibleForGateway(OrderEntity order) {
    PaymentStatus paymentStatus = order.getPaymentStatus();
    OrderStatus orderStatus = order.getStatus();
    boolean retryablePaymentState =
        paymentStatus == PaymentStatus.pending
            || paymentStatus == PaymentStatus.failed
            || paymentStatus == PaymentStatus.cancelled;
    if (!retryablePaymentState) {
      return false;
    }
    return orderStatus == OrderStatus.placed
        || orderStatus == OrderStatus.cancelled
        || orderStatus == OrderStatus.draft;
  }
}
