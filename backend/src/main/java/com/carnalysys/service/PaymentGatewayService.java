package com.carnalysys.service;

import com.carnalysys.api.ApiException;
import com.carnalysys.domain.PaymentTransactionEntity;
import com.carnalysys.web.dto.VerifyPaymentRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentGatewayService {

  private final OrderService orderService;
  private final RazorpayPaymentService razorpayPaymentService;
  private final PaymentWebhookService paymentWebhookService;

  public PaymentGatewayService(
      OrderService orderService,
      RazorpayPaymentService razorpayPaymentService,
      PaymentWebhookService paymentWebhookService) {
    this.orderService = orderService;
    this.razorpayPaymentService = razorpayPaymentService;
    this.paymentWebhookService = paymentWebhookService;
  }

  @Transactional
  public Map<String, Object> createRazorpayOrder(UUID userId, Long amountPaise, String internalOrderId) {
    long requestedAmount = amountPaise != null ? amountPaise : 0L;
    PaymentTransactionEntity transaction = null;
    long resolvedAmountPaise = requestedAmount;
    String receiptId;

    if (internalOrderId != null && !internalOrderId.isBlank()) {
      transaction = orderService.createPaymentTransactionForOrder(userId, internalOrderId, "razorpay");
      long expectedPaise =
          transaction
              .getAmountInr()
              .multiply(BigDecimal.valueOf(100))
              .setScale(0, RoundingMode.HALF_UP)
              .longValue();
      if (requestedAmount > 0 && requestedAmount != expectedPaise) {
        throw new ApiException(
            HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "amount does not match order total");
      }
      resolvedAmountPaise = expectedPaise;
      receiptId = internalOrderId.trim();
    } else {
      if (requestedAmount <= 0) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "amount is required");
      }
      receiptId = "rcp_" + UUID.randomUUID();
    }

    Map<String, Object> providerOrder =
        razorpayPaymentService.createOrder(receiptId, resolvedAmountPaise, "INR");
    String razorpayOrderId = asString(providerOrder.get("id"));
    if (razorpayOrderId == null) {
      throw new ApiException(
          HttpStatus.BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR", "Razorpay response missing order id");
    }
    if (transaction != null) {
      orderService.attachProviderOrderToTransaction(
          transaction, razorpayOrderId, "rzp_order_" + transaction.getId());
    }

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("orderId", razorpayOrderId);
    response.put("amount", resolvedAmountPaise);
    response.put("currency", providerOrder.getOrDefault("currency", "INR"));
    response.put("key", razorpayPaymentService.keyId());
    if (internalOrderId != null && !internalOrderId.isBlank()) {
      response.put("internalOrderId", internalOrderId.trim());
      response.put("transactionId", transaction.getId().toString());
    }
    return response;
  }

  @Transactional
  public Map<String, Object> initiateRazorpay(UUID userId, String orderId) {
    Map<String, Object> created = createRazorpayOrder(userId, 0L, orderId);
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("provider", "razorpay");
    response.put("orderId", orderId);
    response.put("transactionId", created.get("transactionId"));
    response.put("razorpayOrderId", created.get("orderId"));
    response.put("amount", created.get("amount"));
    response.put("currency", created.get("currency"));
    response.put("keyId", created.get("key"));
    response.put("key", created.get("key"));
    response.put("status", "created");
    return response;
  }

  @Transactional
  public Map<String, Object> verifyRazorpayCheckout(UUID userId, VerifyPaymentRequest request) {
    return verifyRazorpayCheckout(
        userId,
        request.orderId(),
        request.razorpayOrderId(),
        request.razorpayPaymentId(),
        request.razorpaySignature());
  }

  @Transactional
  public Map<String, Object> confirmRazorpayCheckout(UUID userId, Map<String, Object> body) {
    String orderId = firstNonBlank(body, "orderId");
    String razorpayOrderId = firstNonBlank(body, "razorpayOrderId", "razorpay_order_id");
    String razorpayPaymentId = firstNonBlank(body, "razorpayPaymentId", "razorpay_payment_id");
    String razorpaySignature = firstNonBlank(body, "razorpaySignature", "razorpay_signature");
    return verifyRazorpayCheckout(userId, orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature);
  }

  private Map<String, Object> verifyRazorpayCheckout(
      UUID userId,
      String orderId,
      String razorpayOrderId,
      String razorpayPaymentId,
      String razorpaySignature) {
    if (orderId == null || razorpayOrderId == null || razorpayPaymentId == null || razorpaySignature == null) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "VALIDATION_ERROR",
          "orderId, razorpay_order_id, razorpay_payment_id and razorpay_signature are required");
    }
    orderService.getMine(userId, orderId);
    if (!razorpayPaymentService.verifyCheckoutSignature(
        razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
      throw new ApiException(
          HttpStatus.UNAUTHORIZED, "PAYMENT_SIGNATURE_INVALID", "Razorpay signature verification failed");
    }
    Map<String, Object> internalPayload =
        Map.of(
            "orderId", orderId,
            "status", "paid",
            "transactionId", razorpayPaymentId,
            "paymentOrderId", razorpayOrderId);
    long now = System.currentTimeMillis() / 1000;
    return paymentWebhookService.processTrusted(
        "razorpay", "checkout_" + razorpayPaymentId, now, internalPayload);
  }

  private static String asString(Object value) {
    if (value == null) return null;
    String str = String.valueOf(value).trim();
    return str.isEmpty() ? null : str;
  }

  private static String firstNonBlank(Map<String, Object> body, String... keys) {
    for (String key : keys) {
      String value = asString(body.get(key));
      if (value != null) {
        return value;
      }
    }
    return null;
  }
}
