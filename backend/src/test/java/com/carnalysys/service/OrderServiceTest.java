package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.carnalysys.api.ApiException;
import com.carnalysys.config.AppProperties;
import com.carnalysys.domain.Cart;
import com.carnalysys.domain.CartItem;
import com.carnalysys.domain.OrderEntity;
import com.carnalysys.domain.OrderStatus;
import com.carnalysys.domain.PaymentMethod;
import com.carnalysys.domain.PaymentStatus;
import com.carnalysys.domain.PaymentTransactionEntity;
import com.carnalysys.domain.Product;
import com.carnalysys.domain.UserEntity;
import com.carnalysys.repo.AddressRepository;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.CartItemRepository;
import com.carnalysys.repo.OrderLineRepository;
import com.carnalysys.repo.OrderRepository;
import com.carnalysys.repo.OrderStatusAuditRepository;
import com.carnalysys.repo.PaymentEventRepository;
import com.carnalysys.repo.PaymentTransactionRepository;
import com.carnalysys.repo.ProductRepository;
import com.carnalysys.repo.UserProfileRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

  private static final UUID USER_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

  @Mock private OrderRepository orderRepository;
  @Mock private OrderLineRepository orderLineRepository;
  @Mock private AddressRepository addressRepository;
  @Mock private CartService cartService;
  @Mock private CartItemRepository cartItemRepository;
  @Mock private UserProfileRepository userProfileRepository;
  @Mock private ProductRepository productRepository;
  @Mock private OrderStatusAuditRepository orderStatusAuditRepository;
  @Mock private PaymentEventRepository paymentEventRepository;
  @Mock private PaymentTransactionRepository paymentTransactionRepository;
  @Mock private UploadStorageService uploadStorageService;
  @Mock private NotificationService notificationService;
  @Mock private AdminUserRepository adminUserRepository;
  @Mock private WhatsappService whatsappService;
  @Mock private DeliveryWorkflowService deliveryWorkflowService;
  @Mock private LowStockAlertService lowStockAlertService;
  @Mock private AppProperties appProperties;
  @Mock private AppProperties.Payment paymentProperties;

  @InjectMocks private OrderService orderService;

  @BeforeEach
  void wirePaymentProvider() {
    when(appProperties.payment()).thenReturn(paymentProperties);
    when(paymentProperties.provider()).thenReturn("mockpay");
  }

  @Test
  void placeOrderThrowsWhenCartLinesEmpty() {
    Cart cart = cartForUser();
    when(cartService.requireNonEmptyCart(Optional.of(USER_ID), Optional.empty())).thenReturn(cart);
    when(cartItemRepository.findByCart_IdAndDeletedAtIsNull(cart.getId())).thenReturn(List.of());

    assertThatThrownBy(() -> orderService.placeOrder(USER_ID, null, null, null))
        .isInstanceOf(ApiException.class)
        .extracting(ex -> ((ApiException) ex).code())
        .isEqualTo("EMPTY_CART");
  }

  @Test
  void placeOrderThrowsWhenOnlyUnpublishedProducts() {
    Cart cart = cartForUser();
    when(cartService.requireNonEmptyCart(Optional.of(USER_ID), Optional.empty())).thenReturn(cart);
    Product p = product("p1", false);
    CartItem line = line(cart, p, 1);
    when(cartItemRepository.findByCart_IdAndDeletedAtIsNull(cart.getId())).thenReturn(List.of(line));
    when(uploadStorageService.persistReceiptIfDataUrl(USER_ID, null)).thenReturn(null);
    when(productRepository.findAllByIdInForUpdate(List.of("p1"))).thenReturn(List.of(p));

    assertThatThrownBy(() -> orderService.placeOrder(USER_ID, null, null, null))
        .isInstanceOf(ApiException.class)
        .extracting(ex -> ((ApiException) ex).code())
        .isEqualTo("EMPTY_CART");
  }

  @Test
  void placeOrderPersistsAndEmptiesCart() {
    Cart cart = cartForUser();
    when(cartService.requireNonEmptyCart(Optional.of(USER_ID), Optional.empty())).thenReturn(cart);
    Product p = product("p1", true);
    p.setPriceInr(new BigDecimal("50.00"));
    CartItem line = line(cart, p, 2);
    when(cartItemRepository.findByCart_IdAndDeletedAtIsNull(cart.getId())).thenReturn(List.of(line));
    when(uploadStorageService.persistReceiptIfDataUrl(USER_ID, null)).thenReturn(null);
    when(productRepository.findAllByIdInForUpdate(List.of("p1"))).thenReturn(List.of(p));
    when(userProfileRepository.findById(USER_ID)).thenReturn(Optional.empty());

    Map<String, Object> result = orderService.placeOrder(USER_ID, null, "cod", null);

    assertThat(result).containsKey("order");
    @SuppressWarnings("unchecked")
    Map<String, Object> order = (Map<String, Object>) result.get("order");
    assertThat(order.get("total")).isEqualTo(100L);
    ArgumentCaptor<OrderEntity> orderCap = ArgumentCaptor.forClass(OrderEntity.class);
    verify(orderRepository).saveAndFlush(orderCap.capture());
    assertThat(orderCap.getValue().getTotalInr()).isEqualByComparingTo("100.00");
    verify(orderLineRepository).saveAll(any());
    verify(cartService).emptyCart(cart);
  }

  @Test
  void getMineThrowsWhenMissing() {
    when(orderRepository.findByIdAndUser_Id("missing", USER_ID)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> orderService.getMine(USER_ID, "missing"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.NOT_FOUND);
              assertThat(ae.code()).isEqualTo("NOT_FOUND");
            });
  }

  @Test
  void patchStatusAdminUpdatesStatus() {
    UserEntity u = new UserEntity();
    u.setId(USER_ID);
    OrderEntity o = new OrderEntity();
    o.setId("ord_1");
    o.setUser(u);
    o.setStatus(OrderStatus.placed);
    o.setTotalInr(new BigDecimal("10.00"));
    o.setPlacedAt(Instant.parse("2024-01-01T00:00:00Z"));
    o.setUpdatedAt(Instant.parse("2024-01-01T00:00:00Z"));
    when(orderRepository.findById("ord_1")).thenReturn(Optional.of(o));
    when(orderLineRepository.findByOrder_Id("ord_1")).thenReturn(List.of());
    when(userProfileRepository.findById(USER_ID)).thenReturn(Optional.empty());

    orderService.patchStatusAdmin("ord_1", "confirmed");

    assertThat(o.getStatus()).isEqualTo(OrderStatus.confirmed);
    verify(orderRepository).save(o);
  }

  @Test
  void patchStatusAsDeliveryPartnerMarksDeliveredWhenAssignedAndShipped() {
    UserEntity u = new UserEntity();
    u.setId(USER_ID);
    OrderEntity o = new OrderEntity();
    o.setId("ord_dp");
    o.setUser(u);
    o.setStatus(OrderStatus.shipped);
    o.setAssignedDeliveryAdminEmail("driver@example.com");
    o.setTotalInr(new BigDecimal("10.00"));
    o.setPlacedAt(Instant.parse("2024-01-01T00:00:00Z"));
    o.setUpdatedAt(Instant.parse("2024-01-01T00:00:00Z"));
    when(orderRepository.findById("ord_dp")).thenReturn(Optional.of(o));
    when(orderLineRepository.findByOrder_Id("ord_dp")).thenReturn(List.of());
    when(userProfileRepository.findById(USER_ID)).thenReturn(Optional.empty());

    Map<String, Object> result =
        orderService.patchStatusAsDeliveryPartner("ord_dp", "delivered", "driver@example.com");

    assertThat(o.getStatus()).isEqualTo(OrderStatus.delivered);
    assertThat(result).containsKey("order");
    @SuppressWarnings("unchecked")
    Map<String, Object> orderMap = (Map<String, Object>) result.get("order");
    assertThat(orderMap.get("status")).isEqualTo("delivered");
    assertThat(orderMap).doesNotContainKey("total");
    verify(orderRepository).save(o);
  }

  @Test
  void patchStatusAsDeliveryPartnerRejectsWrongAssignee() {
    UserEntity u = new UserEntity();
    u.setId(USER_ID);
    OrderEntity o = new OrderEntity();
    o.setId("ord_dp2");
    o.setUser(u);
    o.setStatus(OrderStatus.shipped);
    o.setAssignedDeliveryAdminEmail("driver@example.com");
    when(orderRepository.findById("ord_dp2")).thenReturn(Optional.of(o));

    assertThatThrownBy(
            () ->
                orderService.patchStatusAsDeliveryPartner(
                    "ord_dp2", "delivered", "someone.else@example.com"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.FORBIDDEN);
              assertThat(ae.code()).isEqualTo("FORBIDDEN");
            });
  }

  @Test
  void patchStatusAsDeliveryPartnerRejectsNonDeliveredTargetStatus() {
    UserEntity u = new UserEntity();
    u.setId(USER_ID);
    OrderEntity o = new OrderEntity();
    o.setId("ord_dp3");
    o.setUser(u);
    o.setStatus(OrderStatus.shipped);
    o.setAssignedDeliveryAdminEmail("driver@example.com");
    when(orderRepository.findById("ord_dp3")).thenReturn(Optional.of(o));

    assertThatThrownBy(
            () -> orderService.patchStatusAsDeliveryPartner("ord_dp3", "processing", "driver@example.com"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(ae.code()).isEqualTo("VALIDATION_ERROR");
            });
  }

  @Test
  void patchStatusAsDeliveryPartnerRejectsWhenNotShipped() {
    UserEntity u = new UserEntity();
    u.setId(USER_ID);
    OrderEntity o = new OrderEntity();
    o.setId("ord_dp4");
    o.setUser(u);
    o.setStatus(OrderStatus.processing);
    o.setAssignedDeliveryAdminEmail("driver@example.com");
    when(orderRepository.findById("ord_dp4")).thenReturn(Optional.of(o));

    assertThatThrownBy(
            () -> orderService.patchStatusAsDeliveryPartner("ord_dp4", "delivered", "driver@example.com"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.CONFLICT);
              assertThat(ae.code()).isEqualTo("INVALID_STATUS_TRANSITION");
            });
  }

  @Test
  void createPaymentTransactionReopensCancelledOrderForRetry() {
    OrderEntity order = retryableOrder("ord_retry", OrderStatus.cancelled, PaymentStatus.failed);
    when(orderRepository.findByIdAndUser_Id("ord_retry", USER_ID)).thenReturn(Optional.of(order));
    when(orderRepository.findByIdForUpdate("ord_retry")).thenReturn(Optional.of(order));
    when(paymentTransactionRepository.save(any(PaymentTransactionEntity.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    PaymentTransactionEntity tx =
        orderService.createPaymentTransactionForOrder(USER_ID, "ord_retry", "razorpay");

    assertThat(tx.getStatus().name()).isEqualTo("created");
    assertThat(order.getStatus()).isEqualTo(OrderStatus.placed);
    assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.pending);
    assertThat(order.getPaymentLastError()).isNull();
    verify(orderRepository).save(order);
  }

  @Test
  void createPaymentTransactionRejectsNonRetryableOrderState() {
    OrderEntity order = retryableOrder("ord_processing", OrderStatus.processing, PaymentStatus.pending);
    when(orderRepository.findByIdAndUser_Id("ord_processing", USER_ID)).thenReturn(Optional.of(order));
    when(orderRepository.findByIdForUpdate("ord_processing")).thenReturn(Optional.of(order));

    assertThatThrownBy(
            () -> orderService.createPaymentTransactionForOrder(USER_ID, "ord_processing", "razorpay"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.CONFLICT);
              assertThat(ae.code()).isEqualTo("PAYMENT_RETRY_NOT_ALLOWED");
            });
  }

  private static Cart cartForUser() {
    UserEntity user = new UserEntity();
    user.setId(USER_ID);
    user.setPhoneE164("+15550001");
    Cart cart = new Cart();
    cart.setUser(user);
    return cart;
  }

  private static Product product(String id, boolean published) {
    Product p = new Product();
    p.setId(id);
    p.setPublished(published);
    p.setName("N");
    p.setSku("S");
    p.setPriceInr(BigDecimal.TEN);
    p.setStockQuantity(10);
    return p;
  }

  private static CartItem line(Cart cart, Product p, int qty) {
    CartItem ci = new CartItem();
    ci.setCart(cart);
    ci.setProduct(p);
    ci.setQuantity(qty);
    return ci;
  }

  private static OrderEntity retryableOrder(String id, OrderStatus status, PaymentStatus paymentStatus) {
    UserEntity user = new UserEntity();
    user.setId(USER_ID);
    OrderEntity o = new OrderEntity();
    o.setId(id);
    o.setUser(user);
    o.setStatus(status);
    o.setPaymentStatus(paymentStatus);
    o.setPaymentMethod(PaymentMethod.upi);
    o.setCurrency("INR");
    o.setTotalInr(new BigDecimal("99.00"));
    o.setPaymentAttemptCount(1);
    o.setPlacedAt(Instant.parse("2024-01-01T00:00:00Z"));
    o.setUpdatedAt(Instant.parse("2024-01-01T00:00:00Z"));
    return o;
  }
}
