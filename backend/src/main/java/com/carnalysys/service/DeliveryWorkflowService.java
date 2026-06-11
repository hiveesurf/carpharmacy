package com.carnalysys.service;

import com.carnalysys.api.ApiException;
import com.carnalysys.config.AppProperties;
import com.carnalysys.domain.AdminUser;
import com.carnalysys.domain.DeliveryFailedReason;
import com.carnalysys.domain.DeliveryStage;
import com.carnalysys.domain.OrderEntity;
import com.carnalysys.domain.OrderLine;
import com.carnalysys.domain.OrderStatus;
import com.carnalysys.domain.UserEntity;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.OrderLineRepository;
import com.carnalysys.repo.OrderRepository;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DeliveryWorkflowService {

  private static final Logger log = LoggerFactory.getLogger(DeliveryWorkflowService.class);

  private static final SecureRandom OTP_RANDOM = new SecureRandom();
  private static final String OTP_EXPIRED_MESSAGE =
      "Delivery OTP expired. Ask delivery partner to resend OTP.";

  static String deliveryOtpCustomerMessage(String orderId, String otp) {
    return WhatsappService.deliveryOtpMessage(orderId, otp);
  }

  public enum DeliveryFieldsMode {
    /** Storefront user: delivery stage, partner, OTP when pending — no proof photo. */
    USER,
    /** Admin / assigned delivery partner: timeline + protected proof URL — no OTP. */
    ADMIN
  }

  private final OrderRepository orderRepository;
  private final OrderLineRepository orderLineRepository;
  private final AdminUserRepository adminUserRepository;
  private final OrderService orderService;
  private final NotificationService notificationService;
  private final WhatsappService whatsappService;
  private final PasswordEncoder passwordEncoder;
  private final AppProperties appProperties;
  private final UploadStorageService uploadStorageService;
  private final DeliveryOtpDerivationService deliveryOtpDerivationService;

  public DeliveryWorkflowService(
      OrderRepository orderRepository,
      OrderLineRepository orderLineRepository,
      AdminUserRepository adminUserRepository,
      @Lazy OrderService orderService,
      NotificationService notificationService,
      WhatsappService whatsappService,
      PasswordEncoder passwordEncoder,
      AppProperties appProperties,
      UploadStorageService uploadStorageService,
      DeliveryOtpDerivationService deliveryOtpDerivationService) {
    this.orderRepository = orderRepository;
    this.orderLineRepository = orderLineRepository;
    this.adminUserRepository = adminUserRepository;
    this.orderService = orderService;
    this.notificationService = notificationService;
    this.whatsappService = whatsappService;
    this.passwordEncoder = passwordEncoder;
    this.appProperties = appProperties;
    this.uploadStorageService = uploadStorageService;
    this.deliveryOtpDerivationService = deliveryOtpDerivationService;
  }

  @PostConstruct
  void logDeliveryOtpMode() {
    log.info("Delivery OTP: HMAC-derived mode (no demo/fixed OTP)");
  }

  @Transactional
  public void initializeAssignedStage(OrderEntity order) {
    if (order.getAssignedDeliveryAdminEmail() == null
        || order.getAssignedDeliveryAdminEmail().isBlank()) {
      return;
    }
    if (order.getDeliveryStage() == null) {
      order.setDeliveryStage(DeliveryStage.assigned);
      order.setUpdatedAt(Instant.now());
      orderRepository.save(order);
    }
  }

  @Transactional
  public Map<String, Object> acceptAssignment(String orderId, String deliveryAdminEmail) {
    OrderEntity order = requireAssignedOrder(orderId, deliveryAdminEmail);
    requireStage(order, DeliveryStage.assigned);
    order.setDeliveryStage(DeliveryStage.accepted);
    order.setDeliveryAcceptedAt(Instant.now());
    order.setUpdatedAt(Instant.now());
    orderRepository.save(order);
    notifyUserDeliveryUpdate(order, "Delivery partner accepted your order.");
    return responseForDeliveryPartner(order);
  }

  @Transactional
  public Map<String, Object> markOutForDelivery(String orderId, String deliveryAdminEmail) {
    OrderEntity order = requireAssignedOrder(orderId, deliveryAdminEmail);
    requireStage(order, DeliveryStage.accepted);
    OrderStatus beforeStatus = order.getStatus();
    Instant now = Instant.now();
    order.setDeliveryStage(DeliveryStage.otp_pending);
    order.setDeliveryOutForDeliveryAt(now);
    issueDeliveryOtp(order);
    order.setProofPhotoUrl(null);
    order.setUpdatedAt(now);
    boolean becameShipped = false;
    if (order.getStatus() != OrderStatus.delivered
        && order.getStatus() != OrderStatus.cancelled
        && order.getStatus() != OrderStatus.refunded
        && order.getStatus() != OrderStatus.shipped) {
      order.setStatus(OrderStatus.shipped);
      becameShipped = true;
    }
    orderRepository.save(order);
    if (becameShipped) {
      orderService.notifyCustomerOrderStatusBestEffort(order, beforeStatus, OrderStatus.shipped);
    }
    notifyCustomerDeliveryOtp(order, false);
    return responseForDeliveryPartner(order);
  }

  @Transactional
  public Map<String, Object> resendDeliveryOtp(String orderId, String deliveryAdminEmail) {
    OrderEntity order = requireAssignedOrder(orderId, deliveryAdminEmail);
    if (!isOtpResendEligibleStage(order)) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "INVALID_DELIVERY_STAGE",
          "OTP can only be resent while delivery is in progress");
    }
    if (order.getDeliveryOtpVerifiedAt() != null) {
      throw new ApiException(
          HttpStatus.CONFLICT, "OTP_ALREADY_VERIFIED", "Delivery OTP is already verified");
    }
    assertResendCooldown(order);
    issueDeliveryOtp(order);
    order.setUpdatedAt(Instant.now());
    orderRepository.save(order);
    notifyCustomerDeliveryOtp(order, true);
    return responseForDeliveryPartner(order);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> customerDeliveryOtpView(OrderEntity order) {
    return buildCustomerDeliveryOtpResponse(order);
  }

  @Transactional
  public Map<String, Object> verifyDeliveryOtp(
      String orderId, String deliveryAdminEmail, String otpRaw) {
    OrderEntity order = requireAssignedOrder(orderId, deliveryAdminEmail);
    if (order.getDeliveryStage() != DeliveryStage.otp_pending
        && order.getDeliveryStage() != DeliveryStage.out_for_delivery) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "INVALID_DELIVERY_STAGE",
          "OTP verification is only available while delivery is in progress");
    }
    if (order.getDeliveryOtpVerifiedAt() != null) {
      return responseForDeliveryPartner(order);
    }
    String otp = otpRaw == null ? "" : otpRaw.trim();
    if (otp.length() != 6) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "OTP must be 6 digits");
    }
    if (order.getDeliveryOtpExpiresAt() != null
        && order.getDeliveryOtpExpiresAt().isBefore(Instant.now())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_EXPIRED", "Delivery OTP has expired");
    }
    if (!matchesDeliveryOtp(order, otp)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "Invalid delivery OTP");
    }
    order.setDeliveryOtpVerifiedAt(Instant.now());
    order.setDeliveryOtpNonce(null);
    order.setDeliveryOtpHash(null);
    order.setUpdatedAt(Instant.now());
    orderRepository.save(order);
    notifyUserDeliveryUpdate(order, "Delivery OTP verified successfully.");
    return responseForDeliveryPartner(order);
  }

  @Transactional
  public Map<String, Object> uploadDeliveryProof(
      String orderId, String deliveryAdminEmail, String proofPhotoDataUrl) {
    OrderEntity order = requireAssignedOrder(orderId, deliveryAdminEmail);
    if (order.getDeliveryStage() != DeliveryStage.otp_pending) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "INVALID_DELIVERY_STAGE",
          "Proof photo can only be uploaded while order is out for delivery");
    }
    if (order.getDeliveryOtpVerifiedAt() == null) {
      throw new ApiException(
          HttpStatus.CONFLICT, "OTP_NOT_VERIFIED", "Verify delivery OTP before uploading proof");
    }
    if (proofPhotoDataUrl == null || proofPhotoDataUrl.isBlank()) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Proof photo is required");
    }
    order.setProofPhotoUrl(
        uploadStorageService.persistDeliveryProofIfDataUrl(order.getId(), proofPhotoDataUrl));
    order.setUpdatedAt(Instant.now());
    orderRepository.save(order);
    return responseForDeliveryPartner(order);
  }

  @Transactional
  public Map<String, Object> markDelivered(String orderId, String deliveryAdminEmail) {
    OrderEntity order = requireAssignedOrder(orderId, deliveryAdminEmail);
    if (order.getDeliveryStage() != DeliveryStage.otp_pending) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "INVALID_DELIVERY_STAGE",
          "Order must be out for delivery with OTP pending before marking delivered");
    }
    if (order.getDeliveryOtpVerifiedAt() == null) {
      throw new ApiException(
          HttpStatus.CONFLICT, "OTP_NOT_VERIFIED", "Verify delivery OTP before marking delivered");
    }
    if (order.getProofPhotoUrl() == null || order.getProofPhotoUrl().isBlank()) {
      throw new ApiException(
          HttpStatus.CONFLICT, "PROOF_REQUIRED", "Upload proof photo before marking delivered");
    }
    Instant now = Instant.now();
    order.setDeliveryStage(DeliveryStage.delivered);
    order.setDeliveryDeliveredAt(now);
    order.setDeliveryOtpNonce(null);
    order.setDeliveryOtpHash(null);
    order.setUpdatedAt(now);
    orderRepository.save(order);
    if (order.getStatus() != OrderStatus.delivered) {
      orderService.patchStatusAsDeliveryPartner(orderId, "delivered", deliveryAdminEmail);
      order =
          orderRepository
              .findById(orderId)
              .orElseThrow(
                  () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    }
    return responseForDeliveryPartner(order);
  }

  @Transactional
  public Map<String, Object> markDeliveryFailed(
      String orderId, String deliveryAdminEmail, String reasonRaw, String noteRaw) {
    OrderEntity order = requireAssignedOrder(orderId, deliveryAdminEmail);
    DeliveryStage stage = order.getDeliveryStage();
    if (stage != DeliveryStage.otp_pending && stage != DeliveryStage.out_for_delivery) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "INVALID_DELIVERY_STAGE",
          "Delivery can only be marked failed while out for delivery");
    }
    DeliveryFailedReason reason;
    try {
      reason = DeliveryFailedReason.fromApi(reasonRaw);
    } catch (IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid failure reason");
    }
    String note = noteRaw == null ? "" : noteRaw.trim();
    if (reason == DeliveryFailedReason.other && note.isBlank()) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Note is required when reason is Other");
    }
    Instant now = Instant.now();
    order.setDeliveryStage(DeliveryStage.delivery_failed);
    order.setDeliveryFailedAt(now);
    order.setDeliveryFailedReason(reason);
    order.setDeliveryFailedReasonNote(note.isBlank() ? null : note);
    order.setDeliveryOtpNonce(null);
    order.setDeliveryOtpHash(null);
    order.setUpdatedAt(now);
    orderRepository.save(order);
    notifyUserDeliveryUpdate(
        order,
        "Delivery attempt failed: "
            + reason.displayLabel()
            + (note.isBlank() ? "." : " — " + note));
    return responseForDeliveryPartner(order);
  }

  @Transactional(readOnly = true)
  public byte[] readDeliveryProofForOrder(OrderEntity order) {
    String stored = order.getProofPhotoUrl();
    if (stored == null || stored.isBlank()) {
      throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Proof photo not found");
    }
    return uploadStorageService.readDeliveryProofAsset(
        uploadStorageService.normalizeDeliveryProofStorageKey(stored));
  }

  @Transactional(readOnly = true)
  public String deliveryProofMediaType(OrderEntity order) {
    String stored = order.getProofPhotoUrl();
    if (stored == null || stored.isBlank()) {
      return "application/octet-stream";
    }
    return uploadStorageService.mediaTypeForPath(
        uploadStorageService.normalizeDeliveryProofStorageKey(stored));
  }

  public void putDeliveryFields(
      Map<String, Object> target, OrderEntity order, DeliveryFieldsMode mode) {
    DeliveryStage stage = resolveEffectiveStage(order);
    target.put("deliveryStage", stage != null ? stage.name() : null);
    target.put(
        "assignedDeliveryAt",
        order.getAssignedDeliveryAt() != null ? order.getAssignedDeliveryAt().toString() : null);
    target.put(
        "deliveryAcceptedAt",
        order.getDeliveryAcceptedAt() != null ? order.getDeliveryAcceptedAt().toString() : null);
    target.put(
        "deliveryOutForDeliveryAt",
        order.getDeliveryOutForDeliveryAt() != null
            ? order.getDeliveryOutForDeliveryAt().toString()
            : null);
    target.put(
        "deliveryDeliveredAt",
        order.getDeliveryDeliveredAt() != null
            ? order.getDeliveryDeliveredAt().toString()
            : (order.getStatus() == OrderStatus.delivered && order.getUpdatedAt() != null
                ? order.getUpdatedAt().toString()
                : null));
    target.put(
        "deliveryFailedAt",
        order.getDeliveryFailedAt() != null ? order.getDeliveryFailedAt().toString() : null);
    target.put(
        "deliveryFailedReason",
        order.getDeliveryFailedReason() != null ? order.getDeliveryFailedReason().name() : null);
    target.put(
        "deliveryFailedReasonLabel",
        order.getDeliveryFailedReason() != null
            ? order.getDeliveryFailedReason().displayLabel()
            : null);
    target.put("deliveryFailedReasonNote", order.getDeliveryFailedReasonNote());
    target.put("deliveryOtpVerified", order.getDeliveryOtpVerifiedAt() != null);
    target.put(
        "deliveryOtpVerifiedAt",
        order.getDeliveryOtpVerifiedAt() != null
            ? order.getDeliveryOtpVerifiedAt().toString()
            : null);
    target.put("deliveryPartner", buildDeliveryPartnerMap(order));
    if (mode == DeliveryFieldsMode.USER) {
      Map<String, Object> otpView = buildCustomerDeliveryOtpResponse(order);
      target.put("otpPending", otpView.get("otpPending"));
      target.put("otpExpired", otpView.get("otpExpired"));
      target.put("otpExpiresAt", otpView.get("otpExpiresAt"));
      target.put("deliveryOtp", otpView.get("deliveryOtp"));
      if (otpView.get("message") != null) {
        target.put("message", otpView.get("message"));
      }
    } else if (mode == DeliveryFieldsMode.ADMIN) {
      target.put("proofPhotoUrl", adminProofPhotoApiPath(order));
    }
  }

  public static String adminProofPhotoApiPath(OrderEntity order) {
    if (order.getProofPhotoUrl() == null || order.getProofPhotoUrl().isBlank()) {
      return null;
    }
    return "/api/v1/admin/orders/" + order.getId() + "/delivery/proof";
  }

  public Map<String, Object> buildCustomerDeliveryOtpResponse(OrderEntity order) {
    Map<String, Object> m = new LinkedHashMap<>();
    DeliveryStage stage = order.getDeliveryStage();
    m.put("deliveryStage", stage != null ? stage.name() : null);
    boolean verified = order.getDeliveryOtpVerifiedAt() != null;
    boolean eligible = isOtpCustomerEligibleStage(stage) && !verified;
    boolean expired = eligible && isDeliveryOtpExpired(order);
    String otp = eligible && !expired ? userVisibleOtp(order) : null;
    m.put("otpPending", eligible && !expired && otp != null);
    m.put("otpExpired", expired);
    m.put(
        "otpExpiresAt",
        order.getDeliveryOtpExpiresAt() != null
            ? order.getDeliveryOtpExpiresAt().toString()
            : null);
    m.put("deliveryOtp", otp);
    if (expired) {
      m.put("message", OTP_EXPIRED_MESSAGE);
    }
    return m;
  }

  private void issueDeliveryOtp(OrderEntity order) {
    String orderId = order.getId();
    String nonce = deliveryOtpDerivationService.newNonce();
    String otp = resolveDeliveryOtp(orderId, nonce);
    Instant now = Instant.now();
    order.setDeliveryOtpNonce(nonce);
    order.setDeliveryOtpHash(passwordEncoder.encode(otp));
    order.setDeliveryOtpExpiresAt(now.plusSeconds(deliveryOtpTtlSeconds()));
    order.setDeliveryOtpVerifiedAt(null);
    order.setDeliveryOtpIssuedAt(now);
  }

  private void assertResendCooldown(OrderEntity order) {
    Instant issued = order.getDeliveryOtpIssuedAt();
    if (issued == null) {
      return;
    }
    int cooldown = deliveryOtpResendCooldownSeconds();
    Instant nextAllowed = issued.plusSeconds(cooldown);
    if (Instant.now().isBefore(nextAllowed)) {
      long waitSec = nextAllowed.getEpochSecond() - Instant.now().getEpochSecond();
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "OTP_RESEND_COOLDOWN",
          "Please wait " + Math.max(1, waitSec) + " seconds before resending OTP");
    }
  }

  private static boolean isOtpCustomerEligibleStage(DeliveryStage stage) {
    return stage == DeliveryStage.otp_pending || stage == DeliveryStage.out_for_delivery;
  }

  private static boolean isOtpResendEligibleStage(OrderEntity order) {
    return isOtpCustomerEligibleStage(order.getDeliveryStage());
  }

  private static boolean isDeliveryOtpExpired(OrderEntity order) {
    return order.getDeliveryOtpExpiresAt() != null
        && order.getDeliveryOtpExpiresAt().isBefore(Instant.now());
  }

  private String userVisibleOtp(OrderEntity order) {
    if (order.getDeliveryOtpVerifiedAt() != null) {
      return null;
    }
    DeliveryStage stage = order.getDeliveryStage();
    if (stage != DeliveryStage.otp_pending && stage != DeliveryStage.out_for_delivery) {
      return null;
    }
    if (order.getDeliveryOtpExpiresAt() != null
        && order.getDeliveryOtpExpiresAt().isBefore(Instant.now())) {
      return null;
    }
    String nonce = order.getDeliveryOtpNonce();
    if (nonce == null || nonce.isBlank()) {
      return null;
    }
    return deliveryOtpDerivationService.deriveOtp(order.getId(), nonce);
  }

  private boolean matchesDeliveryOtp(OrderEntity order, String otp) {
    return order.getDeliveryOtpHash() != null && passwordEncoder.matches(otp, order.getDeliveryOtpHash());
  }

  private String resolveDeliveryOtp(String orderId, String nonce) {
    return DeliveryOtpPolicy.resolveOtp(deliveryOtpDerivationService, orderId, nonce);
  }

  private Map<String, Object> buildDeliveryPartnerMap(OrderEntity order) {
    String email = order.getAssignedDeliveryAdminEmail();
    if (email == null || email.isBlank()) {
      return null;
    }
    return adminUserRepository
        .findByEmailIgnoreCase(email.trim())
        .map(this::toPartnerMap)
        .orElse(Map.of("email", email.trim().toLowerCase()));
  }

  private Map<String, Object> toPartnerMap(AdminUser admin) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("email", admin.getEmail() != null ? admin.getEmail().trim().toLowerCase() : null);
    m.put("name", admin.getFullName());
    m.put("phone", admin.getPhoneE164());
    return m;
  }

  private DeliveryStage resolveEffectiveStage(OrderEntity order) {
    if (order.getDeliveryStage() != null) {
      return order.getDeliveryStage();
    }
    if (order.getAssignedDeliveryAdminEmail() != null
        && !order.getAssignedDeliveryAdminEmail().isBlank()) {
      return DeliveryStage.assigned;
    }
    return null;
  }

  private OrderEntity requireAssignedOrder(String orderId, String deliveryAdminEmail) {
    OrderEntity order =
        orderRepository
            .findById(Objects.requireNonNull(orderId, "orderId"))
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    String assigned = order.getAssignedDeliveryAdminEmail();
    if (assigned == null || assigned.isBlank()) {
      throw new ApiException(
          HttpStatus.FORBIDDEN, "FORBIDDEN", "Order is not assigned for delivery");
    }
    String deliveryKey =
        deliveryAdminEmail == null ? "" : deliveryAdminEmail.trim().toLowerCase();
    if (!assigned.trim().equalsIgnoreCase(deliveryKey)) {
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Order is not assigned to you");
    }
    return order;
  }

  private static void requireStage(OrderEntity order, DeliveryStage expected) {
    DeliveryStage current =
        order.getDeliveryStage() != null ? order.getDeliveryStage() : DeliveryStage.assigned;
    if (current != expected) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "INVALID_DELIVERY_STAGE",
          "Expected delivery stage " + expected.name() + " but was " + current.name());
    }
  }

  private Map<String, Object> responseForDeliveryPartner(OrderEntity order) {
    List<OrderLine> lines = orderLineRepository.findByOrder_Id(order.getId());
    return Map.of("order", orderService.toDeliveryPartnerOrderMap(order, lines));
  }

  private void notifyUserDeliveryUpdate(OrderEntity order, String body) {
    notificationService.notifyUser(
        order.getUser().getId(),
        "order_status",
        "Delivery update",
        body,
        "order",
        order.getId(),
        Map.of(
            "deliveryStage",
            order.getDeliveryStage() != null ? order.getDeliveryStage().name() : null));
  }

  /**
   * In-app + WhatsApp alert with the transient OTP (never included in admin/delivery API responses).
   */
  private void notifyCustomerDeliveryOtp(OrderEntity order, boolean resent) {
    String otp = transientOtpForCustomerNotification(order);
    if (otp == null || otp.isBlank()) {
      return;
    }
    String orderId = order.getId();
    String body = deliveryOtpCustomerMessage(orderId, otp);
    String title = resent ? "Delivery OTP resent" : "Delivery OTP";
    notificationService.notifyUser(
        order.getUser().getId(),
        "order_status",
        title,
        body,
        "order",
        orderId,
        Map.of(
            "deliveryStage",
            order.getDeliveryStage() != null ? order.getDeliveryStage().name() : null,
            "deliveryOtpEvent",
            resent ? "resend" : "issue"));
    UserEntity user = order.getUser();
    String phone = user != null ? user.getPhoneE164() : null;
    if (phone != null && !phone.isBlank()) {
      whatsappService.sendDeliveryOtpBestEffort(phone, orderId, otp);
    }
  }

  /** Derives the same OTP shown on GET /orders/{id}/delivery-otp (not persisted as plaintext). */
  private String transientOtpForCustomerNotification(OrderEntity order) {
    if (order.getDeliveryOtpVerifiedAt() != null) {
      return null;
    }
    String nonce = order.getDeliveryOtpNonce();
    if (nonce == null || nonce.isBlank()) {
      return null;
    }
    if (order.getDeliveryOtpExpiresAt() != null
        && order.getDeliveryOtpExpiresAt().isBefore(Instant.now())) {
      return null;
    }
    return resolveDeliveryOtp(order.getId(), nonce);
  }

  private int deliveryOtpTtlSeconds() {
    int ttl = appProperties.delivery().otpTtlSeconds();
    return ttl > 0 ? ttl : 900;
  }

  private int deliveryOtpResendCooldownSeconds() {
    int cooldown = appProperties.delivery().otpResendCooldownSeconds();
    return cooldown > 0 ? cooldown : 30;
  }
}
