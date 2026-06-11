package com.carnalysys.service;

import com.carnalysys.api.ApiException;
import com.carnalysys.config.AppProperties;
import com.carnalysys.domain.OrderEntity;
import com.carnalysys.domain.OrderStatus;
import com.carnalysys.domain.PaymentEventEntity;
import com.carnalysys.domain.PaymentStatus;
import com.carnalysys.domain.PaymentTransactionEntity;
import com.carnalysys.domain.PaymentTransactionStatus;
import com.carnalysys.repo.OrderRepository;
import com.carnalysys.repo.PaymentEventRepository;
import com.carnalysys.repo.PaymentTransactionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentWebhookService {

  private final AppProperties appProperties;
  private final OrderRepository orderRepository;
  private final OrderService orderService;
  private final PaymentEventRepository paymentEventRepository;
  private final PaymentTransactionRepository paymentTransactionRepository;
  private final ObjectMapper objectMapper;
  private final NotificationService notificationService;

  public PaymentWebhookService(
      AppProperties appProperties,
      OrderRepository orderRepository,
      OrderService orderService,
      PaymentEventRepository paymentEventRepository,
      PaymentTransactionRepository paymentTransactionRepository,
      ObjectMapper objectMapper,
      NotificationService notificationService) {
    this.appProperties = appProperties;
    this.orderRepository = orderRepository;
    this.orderService = orderService;
    this.paymentEventRepository = paymentEventRepository;
    this.paymentTransactionRepository = paymentTransactionRepository;
    this.objectMapper = objectMapper;
    this.notificationService = notificationService;
  }

  @Transactional
  public Map<String, Object> process(
      String signature, String provider, String eventId, long eventTimestamp, Map<String, Object> payload) {
    return processInternal(signature, provider, eventId, eventTimestamp, payload, true);
  }

  @Transactional
  public Map<String, Object> processTrusted(
      String provider, String eventId, long eventTimestamp, Map<String, Object> payload) {
    return processInternal("trusted", provider, eventId, eventTimestamp, payload, false);
  }

  private Map<String, Object> processInternal(
      String signature,
      String provider,
      String eventId,
      long eventTimestamp,
      Map<String, Object> payload,
      boolean verifySignatureAndTimestamp) {
    if (provider == null || provider.isBlank()) {
      provider = appProperties.payment().provider();
    }
    provider = provider.toLowerCase();
    if (eventId == null || eventId.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "eventId required");
    }
    String raw = writeJson(payload);
    if (verifySignatureAndTimestamp) {
      verifyTimestamp(eventTimestamp);
      verifySignature(signature, raw);
    }

    var seen = paymentEventRepository.findByProviderAndProviderEventId(provider, eventId);
    if (seen.isPresent()) {
      return Map.of("accepted", true, "replayed", true);
    }

    ResolvedWebhook webhook = resolveWebhook(provider, payload);
    String orderId = webhook.orderId();
    String statusRaw = webhook.status();
    String txnId = webhook.paymentId();
    if (orderId == null || statusRaw == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "orderId and status required");
    }

    OrderEntity order =
        orderRepository
            .findByIdForUpdate(orderId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));

    PaymentStatus incoming = parseIncomingStatus(statusRaw);
    PaymentTransactionEntity transaction = resolveTransaction(provider, webhook, order);
    PaymentStatus beforePayment = order.getPaymentStatus();
    OrderStatus beforeOrder = order.getStatus();

    // Ensure one-way transitions for payment state.
    if (!isPaymentTransitionAllowed(beforePayment, incoming)) {
      throw new ApiException(HttpStatus.CONFLICT, "INVALID_PAYMENT_TRANSITION", "Invalid payment transition");
    }

    order.setPaymentStatus(incoming);
    if (txnId != null && !txnId.isBlank()) {
      order.setPaymentTxnId(txnId.trim());
    }
    order.setPaymentProvider(provider.toLowerCase());
    order.setPaymentAttemptCount(order.getPaymentAttemptCount() + 1);

    if (incoming == PaymentStatus.paid) {
      order.setPaidAt(Instant.now());
      order.setPaymentLastError(null);
      if (order.getStatus() == OrderStatus.draft) {
        order.setStatus(OrderStatus.placed);
      } else if (order.getStatus() == OrderStatus.placed || order.getStatus() == OrderStatus.cancelled) {
        order.setStatus(OrderStatus.confirmed);
      }
      orderService.applyPaidEffects(order);
      if (beforeOrder == OrderStatus.draft && order.getStatus() == OrderStatus.placed) {
        orderService.notifyOrderPlaced(order, order.getUser().getId());
      }
    } else if (incoming == PaymentStatus.failed || incoming == PaymentStatus.cancelled) {
      order.setPaymentLastError(extractErrorMessage(payload, incoming.name()));
      if (order.getStatus() == OrderStatus.placed) {
        order.setStatus(OrderStatus.cancelled);
      }
    }

    orderRepository.save(order);
    updateTransaction(transaction, incoming, webhook, payload);

    PaymentEventEntity event = new PaymentEventEntity();
    event.setOrder(order);
    event.setTransaction(transaction);
    event.setProvider(provider);
    event.setProviderEventId(eventId);
    event.setEventType("webhook_" + incoming.name());
    event.setPayload(JsonNodeFactory.instance.pojoNode(payload));
    paymentEventRepository.save(event);
    notificationService.notifyUser(
        order.getUser().getId(),
        "payment",
        incoming == PaymentStatus.paid ? "Payment successful" : "Payment update",
        "Order " + order.getId() + " payment is " + incoming.name() + ".",
        "payment_event",
        eventId,
        Map.of("orderId", order.getId(), "paymentStatus", incoming.name(), "orderStatus", order.getStatus().name()));

    orderService.notifyOrderStatusTransitionWhatsappBestEffort(order, beforeOrder, order.getStatus());
    orderService.writeAuditFromPayment(order, beforeOrder, beforePayment, "webhook:" + provider, eventId);
    return Map.of("accepted", true, "paymentStatus", incoming.name(), "orderStatus", order.getStatus().name());
  }

  private void verifyTimestamp(long eventTs) {
    if (eventTs <= 0) return;
    long diff = Math.abs(Duration.between(Instant.ofEpochSecond(eventTs), Instant.now()).toSeconds());
    if (diff > appProperties.payment().webhookReplayWindowSeconds()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "WEBHOOK_REPLAY", "Webhook timestamp expired");
    }
  }

  private void verifySignature(String signature, String raw) {
    if (signature == null || signature.isBlank()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "WEBHOOK_SIGNATURE_INVALID", "Missing signature");
    }
    String expected = hmacSha256(raw, appProperties.payment().webhookSecret());
    if (!safeEqualsHex(expected, signature.trim())) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "WEBHOOK_SIGNATURE_INVALID", "Invalid signature");
    }
  }

  private ResolvedWebhook resolveWebhook(String provider, Map<String, Object> payload) {
    if ("razorpay".equalsIgnoreCase(provider)) {
      return resolveRazorpayWebhook(payload);
    }
    return new ResolvedWebhook(
        asString(payload.get("orderId")),
        asString(payload.get("status")),
        asString(payload.get("transactionId")),
        asString(payload.get("paymentOrderId")));
  }

  private ResolvedWebhook resolveRazorpayWebhook(Map<String, Object> payload) {
    String eventType = asString(payload.get("event"));
    String status =
        switch (eventType != null ? eventType : "") {
          case "payment.authorized" -> "authorized";
          case "payment.captured" -> "paid";
          case "payment.failed" -> "failed";
          case "order.paid" -> "paid";
          default -> asString(payload.get("status"));
        };
    Object topPayload = payload.get("payload");
    if (!(topPayload instanceof Map<?, ?> outerPayload)) {
      return new ResolvedWebhook(
          asString(payload.get("orderId")), status, asString(payload.get("transactionId")), null);
    }
    Map<?, ?> paymentObj = mapAt(outerPayload.get("payment"));
    Map<?, ?> paymentEntity = paymentObj != null ? mapAt(paymentObj.get("entity")) : null;
    String paymentId = paymentEntity != null ? asString(paymentEntity.get("id")) : null;
    String providerOrderId = paymentEntity != null ? asString(paymentEntity.get("order_id")) : null;
    String internalOrderId = null;
    if (paymentEntity != null) {
      Map<?, ?> notes = mapAt(paymentEntity.get("notes"));
      if (notes != null) {
        internalOrderId = asString(notes.get("order_id"));
      }
    }
    if (internalOrderId == null && paymentEntity != null) {
      internalOrderId = asString(paymentEntity.get("receipt"));
    }
    if (internalOrderId == null) {
      Object orderObj = outerPayload.get("order");
      Map<?, ?> orderEntity = mapAt(orderObj != null ? mapAt(orderObj).get("entity") : null);
      if (orderEntity != null) {
        Map<?, ?> notes = mapAt(orderEntity.get("notes"));
        if (notes != null) {
          internalOrderId = asString(notes.get("order_id"));
        }
        if (internalOrderId == null) {
          internalOrderId = asString(orderEntity.get("receipt"));
        }
      }
    }
    return new ResolvedWebhook(internalOrderId, status, paymentId, providerOrderId);
  }

  private PaymentTransactionEntity resolveTransaction(
      String provider, ResolvedWebhook webhook, OrderEntity order) {
    PaymentTransactionEntity transaction = null;
    if (webhook.providerOrderId() != null) {
      transaction =
          paymentTransactionRepository
              .findByProviderAndProviderOrderId(provider, webhook.providerOrderId())
              .orElse(null);
    }
    if (transaction == null && webhook.paymentId() != null) {
      transaction =
          paymentTransactionRepository
              .findByProviderAndProviderPaymentId(provider, webhook.paymentId())
              .orElse(null);
    }
    if (transaction == null) {
      transaction = orderService.createPaymentTransactionForOrder(order.getUser().getId(), order.getId(), provider);
    }
    return transaction;
  }

  private void updateTransaction(
      PaymentTransactionEntity transaction,
      PaymentStatus paymentStatus,
      ResolvedWebhook webhook,
      Map<String, Object> payload) {
    transaction.setStatus(toTransactionStatus(paymentStatus));
    if (webhook.providerOrderId() != null && !webhook.providerOrderId().isBlank()) {
      transaction.setProviderOrderId(webhook.providerOrderId());
    }
    if (webhook.paymentId() != null && !webhook.paymentId().isBlank()) {
      transaction.setProviderPaymentId(webhook.paymentId());
    }
    if (paymentStatus == PaymentStatus.failed || paymentStatus == PaymentStatus.cancelled) {
      transaction.setErrorCode(paymentStatus.name());
      transaction.setErrorMessage(extractErrorMessage(payload, paymentStatus.name()));
    } else if (paymentStatus == PaymentStatus.paid || paymentStatus == PaymentStatus.authorized) {
      transaction.setErrorCode(null);
      transaction.setErrorMessage(null);
    }
    paymentTransactionRepository.save(transaction);
  }

  private static PaymentTransactionStatus toTransactionStatus(PaymentStatus status) {
    return switch (status) {
      case authorized -> PaymentTransactionStatus.authorized;
      case paid -> PaymentTransactionStatus.paid;
      case failed -> PaymentTransactionStatus.failed;
      case cancelled -> PaymentTransactionStatus.cancelled;
      case refunded -> PaymentTransactionStatus.refunded;
      case pending -> PaymentTransactionStatus.created;
    };
  }

  private static Map<?, ?> mapAt(Object obj) {
    if (obj instanceof Map<?, ?> m) {
      return m;
    }
    return null;
  }

  private static PaymentStatus parseIncomingStatus(String status) {
    try {
      return PaymentStatus.valueOf(status.trim().toLowerCase());
    } catch (IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid payment status");
    }
  }

  private static boolean isPaymentTransitionAllowed(PaymentStatus from, PaymentStatus to) {
    if (from == to) return true;
    if (from == PaymentStatus.pending) return to == PaymentStatus.authorized || to == PaymentStatus.paid || to == PaymentStatus.failed || to == PaymentStatus.cancelled;
    if (from == PaymentStatus.authorized) return to == PaymentStatus.paid || to == PaymentStatus.failed || to == PaymentStatus.cancelled;
    if (from == PaymentStatus.paid) return to == PaymentStatus.refunded;
    return false;
  }

  private static String asString(Object value) {
    if (value == null) return null;
    String s = String.valueOf(value).trim();
    return s.isEmpty() ? null : s;
  }

  private static String extractErrorMessage(Map<String, Object> payload, String fallback) {
    if (payload == null) return fallback;
    String topError = asString(payload.get("error"));
    if (topError != null) return topError;
    String message = asString(payload.get("errorMessage"));
    if (message != null) return message;
    String description = asString(payload.get("description"));
    if (description != null) return description;
    return fallback;
  }

  private String writeJson(Map<String, Object> payload) {
    try {
      return objectMapper.writeValueAsString(payload != null ? payload : Map.of());
    } catch (JsonProcessingException e) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_JSON", "Malformed payload");
    }
  }

  private static String hmacSha256(String value, String secret) {
    try {
      Mac hmac = Mac.getInstance("HmacSHA256");
      hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      byte[] out = hmac.doFinal(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(out);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to verify webhook signature", e);
    }
  }

  private static boolean safeEqualsHex(String expectedHex, String gotHex) {
    try {
      byte[] e = HexFormat.of().parseHex(expectedHex);
      byte[] g = HexFormat.of().parseHex(gotHex.toLowerCase());
      return MessageDigest.isEqual(e, g);
    } catch (IllegalArgumentException ex) {
      return false;
    }
  }

  private record ResolvedWebhook(String orderId, String status, String paymentId, String providerOrderId) {}
}
