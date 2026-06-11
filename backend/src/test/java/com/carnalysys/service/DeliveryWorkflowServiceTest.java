package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.carnalysys.api.ApiException;
import com.carnalysys.config.AppProperties;
import com.carnalysys.domain.DeliveryStage;
import com.carnalysys.domain.OrderEntity;
import com.carnalysys.domain.OrderStatus;
import com.carnalysys.domain.UserEntity;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.OrderLineRepository;
import com.carnalysys.repo.OrderRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class DeliveryWorkflowServiceTest {

  @Mock OrderRepository orderRepository;
  @Mock OrderLineRepository orderLineRepository;
  @Mock AdminUserRepository adminUserRepository;
  @Mock OrderService orderService;
  @Mock NotificationService notificationService;
  @Mock WhatsappService whatsappService;
  @Mock PasswordEncoder passwordEncoder;
  @Mock UploadStorageService uploadStorageService;

  private DeliveryOtpDerivationService otpDerivation;
  private DeliveryWorkflowService service;

  @BeforeEach
  void setUp() {
    var props =
        new AppProperties(
            new AppProperties.Jwt("test-secret-for-delivery-otp", 900),
            new AppProperties.RefreshToken(604800),
            new AppProperties.Otp(20),
            new AppProperties.Delivery(900, 30),
            new AppProperties.Cors(""),
            new AppProperties.Payment("mockpay", null, null, null, 600, 300000, 30));
    otpDerivation = new DeliveryOtpDerivationService(props);
    service =
        new DeliveryWorkflowService(
            orderRepository,
            orderLineRepository,
            adminUserRepository,
            orderService,
            notificationService,
            whatsappService,
            passwordEncoder,
            props,
            uploadStorageService,
            otpDerivation);
  }

  @Test
  void markDelivered_requiresVerifiedOtpAndProof() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpVerifiedAt(null);
    order.setProofPhotoUrl(null);
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));

    assertThatThrownBy(() -> service.markDelivered("ord-1", "partner@carnalysys.local"))
        .isInstanceOf(ApiException.class)
        .hasMessageContaining("OTP");

    order.setDeliveryOtpVerifiedAt(Instant.now());
    assertThatThrownBy(() -> service.markDelivered("ord-1", "partner@carnalysys.local"))
        .isInstanceOf(ApiException.class)
        .hasMessageContaining("proof");
  }

  @Test
  void markOutForDelivery_setsOtpPendingAndUserCanReadDerivedOtp() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.accepted);
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));
    when(passwordEncoder.encode(anyString())).thenReturn("hash");
    when(orderLineRepository.findByOrder_Id("ord-1")).thenReturn(java.util.List.of());
    when(orderService.toDeliveryPartnerOrderMap(any(), any())).thenReturn(Map.of("id", "ord-1"));
    service.markOutForDelivery("ord-1", "partner@carnalysys.local");

    assertThat(order.getDeliveryStage()).isEqualTo(DeliveryStage.otp_pending);
    assertThat(order.getDeliveryOtpNonce()).isNotBlank();
    assertThat(order.getDeliveryOtpHash()).isEqualTo("hash");

    Map<String, Object> userMap = new LinkedHashMap<>();
    service.putDeliveryFields(userMap, order, DeliveryWorkflowService.DeliveryFieldsMode.USER);
    assertThat(userMap.get("otpPending")).isEqualTo(true);
    assertThat(userMap.get("deliveryOtp")).isNotNull();
    assertThat(String.valueOf(userMap.get("deliveryOtp"))).matches("\\d{6}");
    assertThat(userMap).doesNotContainKey("proofPhotoUrl");
  }

  @Test
  void markOutForDelivery_sendsDerivedOtpViaWhatsApp() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.accepted);
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));
    when(passwordEncoder.encode(anyString())).thenReturn("hash");
    when(orderLineRepository.findByOrder_Id("ord-1")).thenReturn(java.util.List.of());
    when(orderService.toDeliveryPartnerOrderMap(any(), any())).thenReturn(Map.of("id", "ord-1"));
    service.markOutForDelivery("ord-1", "partner@carnalysys.local");

    String expectedOtp = otpDerivation.deriveOtp("ord-1", order.getDeliveryOtpNonce());
    verify(whatsappService).sendDeliveryOtpBestEffort(eq("9004027637"), eq("ord-1"), eq(expectedOtp));
    Map<String, Object> userMap = new LinkedHashMap<>();
    service.putDeliveryFields(userMap, order, DeliveryWorkflowService.DeliveryFieldsMode.USER);
    assertThat(userMap.get("deliveryOtp")).isEqualTo(expectedOtp);
  }

  @Test
  void verifyDeliveryOtp_rejects123456WhenNotIssued() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpNonce("nonce-1");
    order.setDeliveryOtpExpiresAt(Instant.now().plusSeconds(600));
    order.setDeliveryOtpHash("hash");
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));
    when(passwordEncoder.matches(eq("123456"), eq("hash"))).thenReturn(false);

    assertThatThrownBy(
            () -> service.verifyDeliveryOtp("ord-1", "partner@carnalysys.local", "123456"))
        .isInstanceOf(ApiException.class)
        .hasMessageContaining("Invalid");
  }

  @Test
  void markOutForDelivery_notifiesShippedWhenStatusChanges() {
    OrderEntity order = assignedOrder();
    order.setStatus(OrderStatus.processing);
    order.setDeliveryStage(DeliveryStage.accepted);
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));
    when(passwordEncoder.encode(anyString())).thenReturn("hash");
    when(orderLineRepository.findByOrder_Id("ord-1")).thenReturn(java.util.List.of());
    when(orderService.toDeliveryPartnerOrderMap(any(), any())).thenReturn(Map.of("id", "ord-1"));
    service.markOutForDelivery("ord-1", "partner@carnalysys.local");

    verify(orderService)
        .notifyCustomerOrderStatusBestEffort(order, OrderStatus.processing, OrderStatus.shipped);
  }

  @Test
  void markOutForDelivery_notifiesCustomerWithOtpInAppAndWhatsApp() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.accepted);
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));
    when(passwordEncoder.encode(anyString())).thenReturn("hash");
    when(orderLineRepository.findByOrder_Id("ord-1")).thenReturn(java.util.List.of());
    when(orderService.toDeliveryPartnerOrderMap(any(), any())).thenReturn(Map.of("id", "ord-1"));
    service.markOutForDelivery("ord-1", "partner@carnalysys.local");

    String expectedOtp = otpDerivation.deriveOtp("ord-1", order.getDeliveryOtpNonce());
    verify(notificationService)
        .notifyUser(
            eq(order.getUser().getId()),
            eq("order_status"),
            eq("Delivery OTP"),
            argThat(
                body ->
                    body.contains("Carpharmarcy delivery OTP")
                        && body.contains("ord-1")
                        && body.contains(expectedOtp)),
            eq("order"),
            eq("ord-1"),
            any());
    verify(whatsappService).sendDeliveryOtpBestEffort(eq("9004027637"), eq("ord-1"), eq(expectedOtp));
  }

  @Test
  void resendDeliveryOtp_notifiesCustomerWithNewOtp() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpIssuedAt(Instant.now().minusSeconds(60));
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));
    when(passwordEncoder.encode(anyString())).thenReturn("hash");
    when(orderLineRepository.findByOrder_Id("ord-1")).thenReturn(java.util.List.of());
    when(orderService.toDeliveryPartnerOrderMap(any(), any())).thenReturn(Map.of("id", "ord-1"));
    service.resendDeliveryOtp("ord-1", "partner@carnalysys.local");

    String expectedOtp = otpDerivation.deriveOtp("ord-1", order.getDeliveryOtpNonce());
    verify(notificationService)
        .notifyUser(
            eq(order.getUser().getId()),
            eq("order_status"),
            eq("Delivery OTP resent"),
            argThat(body -> body.contains(expectedOtp)),
            eq("order"),
            eq("ord-1"),
            any());
    verify(whatsappService).sendDeliveryOtpBestEffort(eq("9004027637"), eq("ord-1"), eq(expectedOtp));
  }

  @Test
  void markOutForDelivery_usesDeliveryOtpTtlNotLoginChallengeTtl() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.accepted);
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));
    when(passwordEncoder.encode(anyString())).thenReturn("hash");
    when(orderLineRepository.findByOrder_Id("ord-1")).thenReturn(java.util.List.of());
    when(orderService.toDeliveryPartnerOrderMap(any(), any())).thenReturn(Map.of("id", "ord-1"));
    Instant before = Instant.now();
    service.markOutForDelivery("ord-1", "partner@carnalysys.local");
    Instant after = Instant.now();

    assertThat(order.getDeliveryOtpExpiresAt()).isNotNull();
    long minExpected = before.plusSeconds(890).toEpochMilli();
    long maxExpected = after.plusSeconds(910).toEpochMilli();
    assertThat(order.getDeliveryOtpExpiresAt().toEpochMilli())
        .isBetween(minExpected, maxExpected);
  }

  @Test
  void putDeliveryFields_userModeOmitsDeliveryOtpWhenChallengeExpired() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpNonce("nonce-1");
    order.setDeliveryOtpExpiresAt(Instant.now().minusSeconds(5));

    Map<String, Object> userMap = new LinkedHashMap<>();
    service.putDeliveryFields(userMap, order, DeliveryWorkflowService.DeliveryFieldsMode.USER);
    assertThat(userMap.get("otpPending")).isEqualTo(false);
    assertThat(userMap.get("otpExpired")).isEqualTo(true);
    assertThat(userMap.get("deliveryOtp")).isNull();
    assertThat(userMap.get("message"))
        .isEqualTo("Delivery OTP expired. Ask delivery partner to resend OTP.");
  }

  @Test
  void customerDeliveryOtpView_returnsActiveOtpForOwnerEligibleStage() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpNonce("nonce-1");
    order.setDeliveryOtpExpiresAt(Instant.now().plusSeconds(600));
    Map<String, Object> view = service.customerDeliveryOtpView(order);
    assertThat(view.get("otpPending")).isEqualTo(true);
    assertThat(view.get("otpExpired")).isEqualTo(false);
    assertThat(String.valueOf(view.get("deliveryOtp"))).matches("\\d{6}");
  }

  @Test
  void customerDeliveryOtpView_expiredSetsMessageAndFlags() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpNonce("nonce-1");
    order.setDeliveryOtpExpiresAt(Instant.now().minusSeconds(1));

    Map<String, Object> view = service.customerDeliveryOtpView(order);
    assertThat(view.get("otpExpired")).isEqualTo(true);
    assertThat(view.get("deliveryOtp")).isNull();
    assertThat(view.get("message"))
        .isEqualTo("Delivery OTP expired. Ask delivery partner to resend OTP.");
  }

  @Test
  void resendDeliveryOtp_regeneratesNonceAfterCooldown() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpNonce("old-nonce");
    order.setDeliveryOtpIssuedAt(Instant.now().minusSeconds(60));
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));
    when(passwordEncoder.encode(anyString())).thenReturn("hash");
    when(orderLineRepository.findByOrder_Id("ord-1")).thenReturn(java.util.List.of());
    when(orderService.toDeliveryPartnerOrderMap(any(), any())).thenReturn(Map.of("id", "ord-1"));
    service.resendDeliveryOtp("ord-1", "partner@carnalysys.local");

    assertThat(order.getDeliveryOtpNonce()).isNotEqualTo("old-nonce");
    assertThat(order.getDeliveryOtpIssuedAt()).isNotNull();
    verify(notificationService)
        .notifyUser(
            eq(order.getUser().getId()),
            eq("order_status"),
            eq("Delivery OTP resent"),
            org.mockito.ArgumentMatchers.contains("Carpharmarcy delivery OTP"),
            eq("order"),
            eq("ord-1"),
            any());
  }

  @Test
  void resendDeliveryOtp_cooldownRejectsSpam() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpIssuedAt(Instant.now());
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));

    assertThatThrownBy(() -> service.resendDeliveryOtp("ord-1", "partner@carnalysys.local"))
        .isInstanceOf(ApiException.class)
        .hasMessageContaining("wait");
  }

  @Test
  void resendDeliveryOtp_unassignedPartnerForbidden() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setAssignedDeliveryAdminEmail("other@carnalysys.local");
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));

    assertThatThrownBy(() -> service.resendDeliveryOtp("ord-1", "partner@carnalysys.local"))
        .isInstanceOf(ApiException.class)
        .hasMessageContaining("not assigned to you");
  }

  @Test
  void verifyDeliveryOtp_expiredOtpRejected() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpExpiresAt(Instant.now().minusSeconds(5));
    order.setDeliveryOtpHash("hash");
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));

    assertThatThrownBy(
            () -> service.verifyDeliveryOtp("ord-1", "partner@carnalysys.local", "123456"))
        .isInstanceOf(ApiException.class)
        .hasMessageContaining("expired");
  }

  @Test
  void verifyDeliveryOtp_succeedsWithLatestIssuedOtp() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpNonce("nonce-2");
    order.setDeliveryOtpExpiresAt(Instant.now().plusSeconds(600));
    order.setDeliveryOtpHash("hash");
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));
    String otp = otpDerivation.deriveOtp("ord-1", "nonce-2");
    when(passwordEncoder.matches(eq(otp), eq("hash"))).thenReturn(true);
    when(orderLineRepository.findByOrder_Id("ord-1")).thenReturn(java.util.List.of());
    when(orderService.toDeliveryPartnerOrderMap(any(), any())).thenReturn(Map.of("id", "ord-1"));

    service.verifyDeliveryOtp("ord-1", "partner@carnalysys.local", otp);

    assertThat(order.getDeliveryOtpVerifiedAt()).isNotNull();
    assertThat(order.getDeliveryOtpNonce()).isNull();
  }

  @Test
  void putDeliveryFields_adminModeOmitsOtpAndOtpPending() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpNonce("nonce-1");

    Map<String, Object> adminMap = new LinkedHashMap<>();
    service.putDeliveryFields(adminMap, order, DeliveryWorkflowService.DeliveryFieldsMode.ADMIN);
    assertThat(adminMap).doesNotContainKey("deliveryOtp");
    assertThat(adminMap).doesNotContainKey("otpPending");
  }

  @Test
  void putDeliveryFields_userModeOmitsProof_adminIncludesProtectedPath() {
    OrderEntity order = assignedOrder();
    order.setProofPhotoUrl("ord-1/pod_abc.jpg");

    Map<String, Object> userMap = new LinkedHashMap<>();
    service.putDeliveryFields(userMap, order, DeliveryWorkflowService.DeliveryFieldsMode.USER);
    assertThat(userMap).doesNotContainKey("proofPhotoUrl");

    Map<String, Object> adminMap = new LinkedHashMap<>();
    service.putDeliveryFields(adminMap, order, DeliveryWorkflowService.DeliveryFieldsMode.ADMIN);
    assertThat(adminMap.get("proofPhotoUrl")).isEqualTo("/api/v1/admin/orders/ord-1/delivery/proof");
  }

  @Test
  void uploadProof_persistsWithoutMarkingDelivered() {
    OrderEntity order = assignedOrder();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOtpVerifiedAt(Instant.now());
    when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));
    when(uploadStorageService.persistDeliveryProofIfDataUrl(eq("ord-1"), anyString()))
        .thenReturn("ord-1/pod_x.jpg");
    when(orderLineRepository.findByOrder_Id("ord-1")).thenReturn(java.util.List.of());
    when(orderService.toDeliveryPartnerOrderMap(any(), any())).thenReturn(Map.of("id", "ord-1"));

    service.uploadDeliveryProof("ord-1", "partner@carnalysys.local", "data:image/jpeg;base64,abc");

    assertThat(order.getProofPhotoUrl()).isEqualTo("ord-1/pod_x.jpg");
    assertThat(order.getDeliveryStage()).isEqualTo(DeliveryStage.otp_pending);
    verify(orderRepository).save(order);
  }

  private static OrderEntity assignedOrder() {
    OrderEntity order = new OrderEntity();
    order.setId("ord-1");
    order.setStatus(OrderStatus.shipped);
    order.setAssignedDeliveryAdminEmail("partner@carnalysys.local");
    UserEntity user = new UserEntity();
    user.setId(UUID.randomUUID());
    user.setPhoneE164("9004027637");
    order.setUser(user);
    return order;
  }
}
