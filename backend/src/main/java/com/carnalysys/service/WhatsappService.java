package com.carnalysys.service;

import com.carnalysys.domain.OrderStatus;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class WhatsappService {
  private static final Logger log = LoggerFactory.getLogger(WhatsappService.class);
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String DEFAULT_ORDER_DATE_TEXT = "Date to be confirmed";

  private final Environment environment;
  private final HttpClient httpClient = HttpClient.newHttpClient();

  public WhatsappService(Environment environment) {
    this.environment = environment;
  }

  public boolean isEnabled() {
    return bool("WHATSAPP_ENABLED", false) && hasText(env("TWILIO_ACCOUNT_SID")) && hasText(env("TWILIO_AUTH_TOKEN"));
  }

  /**
   * Sends delivery OTP to the customer (transient — not stored in orders table). Best-effort: logs and
   * returns false on failure.
   */
  public boolean sendDeliveryOtpBestEffort(String phoneDigits, String orderId, String otp) {
    if (!isEnabled()) {
      log.info("WhatsApp delivery OTP skipped: WHATSAPP_ENABLED=false or Twilio credentials missing");
      return false;
    }
    if (!hasText(phoneDigits) || !hasText(orderId) || !hasText(otp)) {
      return false;
    }
    String body = deliveryOtpMessage(orderId, otp);
    try {
      String templateSid = trim(env("TWILIO_WHATSAPP_TEMPLATE_DELIVERY_OTP_SID"));
      String to = normalizeTo(phoneDigits);
      if (hasText(templateSid)) {
        sendTemplate(
            to,
            fromNumber(),
            templateSid,
            jsonOf(
                Map.of(
                    "1", orderId.trim(),
                    "2", otp.trim(),
                    "order_id", orderId.trim(),
                    "otp", otp.trim())));
      } else {
        sendText(to, fromNumber(), body);
      }
      log.info("WhatsApp delivery OTP sent: orderId={}, phone={}", orderId, phoneDigits);
      return true;
    } catch (RuntimeException ex) {
      log.error(
          "WhatsApp delivery OTP send failed (ignored): orderId={}, phone={}",
          orderId,
          phoneDigits,
          ex);
      return false;
    }
  }

  public void sendOtp(String phoneDigits, String otp) {
    if (!isEnabled()) return;
    if (!hasText(phoneDigits) || !hasText(otp)) return;
    String templateSid = trim(env("TWILIO_WHATSAPP_TEMPLATE_OTP_SID"));
    String body = "Your login OTP is " + otp + ". It expires in 5 minutes.";
    String to = normalizeTo(phoneDigits);
    try {
      if (hasText(templateSid)) {
        sendTemplate(to, fromNumber(), templateSid, jsonOf(Map.of("1", otp, "otp", otp)));
      } else {
        sendText(to, fromNumber(), body);
      }
      log.info("WhatsApp OTP destination normalized to {}", to);
      log.info("WhatsApp OTP sent successfully to {}", phoneDigits);
    } catch (RuntimeException ex) {
      log.error("WhatsApp OTP send failed for {}", phoneDigits, ex);
      throw ex;
    }
  }

  /**
   * Sends a low-stock alert to {@code ADMIN_WHATSAPP_NUMBER}. Returns Twilio message SID on success,
   * or null when disabled, misconfigured, or failed (errors are logged).
   */
  public String sendLowStockAlertToAdminBestEffort(
      String productName, String sku, int quantity, int threshold) {
    if (!isEnabled()) {
      log.info("WhatsApp low-stock skipped: WHATSAPP_ENABLED=false or Twilio credentials missing");
      return null;
    }
    String adminPhone = trim(env("ADMIN_WHATSAPP_NUMBER"));
    if (!hasText(adminPhone)) {
      log.info("WhatsApp low-stock skipped: ADMIN_WHATSAPP_NUMBER is not configured");
      return null;
    }
    String name = hasText(productName) ? productName.trim() : "Product";
    String skuLabel = hasText(sku) ? sku.trim() : "—";
    String templateSid = trim(env("TWILIO_WHATSAPP_TEMPLATE_LOW_STOCK_SID"));
    String body =
        String.format(
            "Low stock alert: %s (%s) has only %d units left (threshold %d).",
            name, skuLabel, quantity, threshold);
    try {
      String to = normalizeTo(adminPhone);
      String sid;
      if (hasText(templateSid)) {
        sid =
            sendTemplate(
                to,
                fromNumber(),
                templateSid,
                jsonOf(
                    Map.of(
                        "1",
                        name,
                        "2",
                        skuLabel,
                        "3",
                        String.valueOf(quantity),
                        "4",
                        String.valueOf(threshold),
                        "product_name",
                        name,
                        "sku",
                        skuLabel,
                        "quantity",
                        String.valueOf(quantity),
                        "threshold",
                        String.valueOf(threshold))));
      } else {
        sid = sendText(to, fromNumber(), body);
      }
      log.info(
          "WhatsApp low-stock alert sent: sku={}, quantity={}, threshold={}, sid={}",
          skuLabel,
          quantity,
          threshold,
          sid);
      return sid;
    } catch (RuntimeException ex) {
      log.error(
          "WhatsApp low-stock alert failed: sku={}, quantity={}, threshold={}",
          skuLabel,
          quantity,
          threshold,
          ex);
      return null;
    }
  }

  /**
   * Notifies a delivery employee that an order was assigned. Template-only; skipped when
   * {@code TWILIO_WHATSAPP_TEMPLATE_DELIVERY_ASSIGNMENT_SID} is unset.
   */
  public boolean sendDeliveryAssignmentBestEffort(String phoneE164, String orderId) {
    if (!isEnabled()) {
      log.debug("WhatsApp delivery assignment skipped: WHATSAPP_ENABLED=false or Twilio credentials missing");
      return false;
    }
    if (!hasText(phoneE164) || !hasText(orderId)) {
      return false;
    }
    String templateSid = trim(env("TWILIO_WHATSAPP_TEMPLATE_DELIVERY_ASSIGNMENT_SID"));
    if (!hasText(templateSid)) {
      log.warn(
          "WhatsApp delivery assignment skipped: TWILIO_WHATSAPP_TEMPLATE_DELIVERY_ASSIGNMENT_SID not configured");
      return false;
    }
    try {
      String link = deliveryPartnerOrderLink(orderId);
      sendTemplate(
          normalizeTo(phoneE164),
          fromNumber(),
          templateSid,
          jsonOf(
              Map.of(
                  "1", orderId.trim(),
                  "order_id", orderId.trim(),
                  "order_number", orderId.trim(),
                  "order_link", link)));
      log.info("WhatsApp delivery assignment sent: orderId={}, phone={}", orderId, phoneE164);
      return true;
    } catch (RuntimeException ex) {
      log.error(
          "WhatsApp delivery assignment failed (ignored): orderId={}, phone={}",
          orderId,
          phoneE164,
          ex);
      return false;
    }
  }

  public boolean sendOrderStatusUpdateBestEffort(String phoneDigits, String orderId, OrderStatus status) {
    if (!isEnabled()) return false;
    if (!hasText(phoneDigits) || status == null) return false;
    try {
      String sid = orderStatusTemplateSid(status);
      if (status == OrderStatus.refunded) {
        if (!hasText(sid)) {
          log.info(
              "WhatsApp refunded notification skipped: TWILIO_WHATSAPP_TEMPLATE_REFUNDED_SID not configured");
          return false;
        }
        sendTemplate(
            normalizeTo(phoneDigits), fromNumber(), sid, contentVariables(orderId, orderViewLink(orderId)));
        return true;
      }
      String text = orderStatusMessage(orderId, status, orderViewLink(orderId));
      if (!hasText(text)) return false;
      if (hasText(sid)) {
        sendTemplate(normalizeTo(phoneDigits), fromNumber(), sid, contentVariables(orderId, orderViewLink(orderId)));
      } else {
        sendText(normalizeTo(phoneDigits), fromNumber(), text);
      }
      return true;
    } catch (RuntimeException ex) {
      log.error(
          "WhatsApp order status send failed (ignored): phone={}, orderId={}, status={}",
          phoneDigits,
          orderId,
          status.name(),
          ex);
      return false;
    }
  }

  private String sendText(String to, String from, String body) {
    Map<String, String> fields = new LinkedHashMap<>();
    fields.put("To", to);
    fields.put("From", from);
    fields.put("Body", body);
    return twilioMessagePost(fields);
  }

  private String sendTemplate(String to, String from, String contentSid, String contentVariables) {
    Map<String, String> fields = new LinkedHashMap<>();
    fields.put("To", to);
    fields.put("From", from);
    fields.put("ContentSid", contentSid);
    fields.put("ContentVariables", contentVariables);
    log.debug("Sending WhatsApp template payload: contentSid={}, contentVariables={}", contentSid, contentVariables);
    return twilioMessagePost(fields);
  }

  private String twilioMessagePost(Map<String, String> fields) {
    String accountSid = trim(env("TWILIO_ACCOUNT_SID"));
    String authToken = trim(env("TWILIO_AUTH_TOKEN"));
    if (!hasText(accountSid) || !hasText(authToken)) {
      throw new IllegalStateException("Twilio credentials are missing");
    }
    String form = toFormUrlEncoded(fields);
    String auth = Base64.getEncoder().encodeToString((accountSid + ":" + authToken).getBytes(StandardCharsets.UTF_8));
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create("https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json"))
            .header("Authorization", "Basic " + auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form))
            .build();
    try {
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      int code = response.statusCode();
      String responseBody = response.body() != null ? response.body() : "";
      if (code < 200 || code >= 300) {
        throw new IllegalStateException("Twilio API rejected request (" + code + "): " + responseBody);
      }
      return extractTwilioSid(responseBody);
    } catch (IOException | InterruptedException ex) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Twilio API call failed", ex);
    }
  }

  private static String extractTwilioSid(String responseBody) {
    if (!hasText(responseBody)) {
      return null;
    }
    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> json = OBJECT_MAPPER.readValue(responseBody, Map.class);
      Object sid = json.get("sid");
      return sid != null ? String.valueOf(sid) : null;
    } catch (JsonProcessingException ex) {
      int idx = responseBody.indexOf("\"sid\"");
      if (idx < 0) {
        return null;
      }
      int colon = responseBody.indexOf(':', idx);
      int q1 = responseBody.indexOf('"', colon + 1);
      int q2 = responseBody.indexOf('"', q1 + 1);
      if (q1 >= 0 && q2 > q1) {
        return responseBody.substring(q1 + 1, q2);
      }
      return null;
    }
  }

  private String orderStatusTemplateSid(OrderStatus status) {
    return switch (status) {
      case placed -> trim(env("TWILIO_WHATSAPP_TEMPLATE_PLACED_SID"));
      case confirmed -> trim(env("TWILIO_WHATSAPP_TEMPLATE_CONFIRMED_SID"));
      case processing -> trim(env("TWILIO_WHATSAPP_TEMPLATE_PROCESSING_SID"));
      case shipped -> trim(env("TWILIO_WHATSAPP_TEMPLATE_SHIPPED_SID"));
      case delivered -> trim(env("TWILIO_WHATSAPP_TEMPLATE_DELIVERED_SID"));
      case cancelled -> trim(env("TWILIO_WHATSAPP_TEMPLATE_CANCELLED_SID"));
      case refunded -> trim(env("TWILIO_WHATSAPP_TEMPLATE_REFUNDED_SID"));
      default -> "";
    };
  }

  static String deliveryOtpMessage(String orderId, String otp) {
    return String.format(
        "Your Carpharmarcy delivery OTP for order %s is %s. Share it only with the delivery partner when receiving your order.",
        orderId != null ? orderId.trim() : "",
        otp != null ? otp.trim() : "");
  }

  private static String orderStatusMessage(String orderId, OrderStatus status, String orderLink) {
    String oid = hasText(orderId) ? orderId : "your order";
    String link = hasText(orderLink) ? orderLink : "/orders/" + oid;
    return switch (status) {
      case placed ->
          "Order update: placed\nOrder: " + oid + "\nView order: " + link;
      case confirmed ->
          "Order update: confirmed\nOrder: " + oid + "\nView order: " + link;
      case processing ->
          "Order update: processing\nOrder: " + oid + "\nView order: " + link;
      case shipped ->
          "Order update: shipped\nOrder: " + oid + "\nView order: " + link;
      case delivered ->
          "Order update: delivered\nOrder: " + oid + "\nView order: " + link;
      case cancelled ->
          "Order update: cancelled\nOrder: " + oid + "\nView order: " + link;
      case refunded ->
          "Order update: refunded\nOrder: " + oid + "\nView order: " + link;
      default -> null;
    };
  }

  private static String contentVariables(String orderId, String orderLink) {
    String oid = orderId != null ? orderId : "";
    String link = hasText(orderLink) ? orderLink : "/orders/" + oid;
    return jsonOf(Map.of("order_number", oid, "date", DEFAULT_ORDER_DATE_TEXT, "order_link", link));
  }

  private String orderViewLink(String orderId) {
    return publicWebPath("/orders/" + (orderId != null ? orderId.trim() : ""));
  }

  private String deliveryPartnerOrderLink(String orderId) {
    String oid = orderId != null ? orderId.trim() : "";
    return publicWebPath("/admin/deliveries/" + oid);
  }

  private String publicWebPath(String path) {
    String suffix = path != null && path.startsWith("/") ? path : "/" + (path != null ? path : "");
    String base =
        firstNonBlank(
            env("APP_PUBLIC_WEB_URL"),
            env("APP_FRONTEND_BASE_URL"),
            firstCsvValue(env("APP_CORS_ALLOWED_ORIGINS")));
    if (!hasText(base)) {
      return suffix;
    }
    String normalized = trim(base).replaceAll("/+$", "");
    return normalized + suffix;
  }

  private static String firstCsvValue(String csv) {
    if (!hasText(csv)) return "";
    String[] parts = csv.split(",");
    for (String p : parts) {
      if (hasText(p)) return p.trim();
    }
    return "";
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (hasText(v)) return v.trim();
    }
    return "";
  }

  private static String jsonOf(Map<String, String> values) {
    try {
      return OBJECT_MAPPER.writeValueAsString(values);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Failed to serialize WhatsApp content variables", ex);
    }
  }

  private String fromNumber() {
    String from = trim(env("TWILIO_WHATSAPP_FROM"));
    if (!hasText(from)) {
      throw new IllegalStateException("TWILIO_WHATSAPP_FROM is missing");
    }
    return from;
  }

  private String normalizeTo(String phoneDigits) {
    String raw = phoneDigits == null ? "" : phoneDigits.trim();
    if (raw.isBlank()) {
      throw new IllegalArgumentException("Phone number is empty");
    }
    // Accept +91xxxxxxxxxx / 91xxxxxxxxxx / xxxxxxxxxx and normalize to E.164 India.
    String digits = raw.startsWith("+") ? raw.substring(1) : raw;
    digits = digits.replaceAll("\\D", "");
    if (digits.length() == 10) {
      digits = "91" + digits;
    } else if (digits.length() == 12 && digits.startsWith("91")) {
      // Already normalized for India.
    } else {
      throw new IllegalArgumentException("Unsupported phone number format");
    }
    return "whatsapp:+" + digits;
  }

  private String env(String key) {
    String value = environment.getProperty(key);
    if (value == null || value.isBlank()) {
      value = System.getenv(key);
    }
    return value;
  }

  private boolean bool(String key, boolean fallback) {
    String v = env(key);
    if (!hasText(v)) return fallback;
    return "true".equalsIgnoreCase(v.trim()) || "1".equals(v.trim()) || "yes".equalsIgnoreCase(v.trim());
  }

  private static String toFormUrlEncoded(Map<String, String> fields) {
    List<String> pairs = new ArrayList<>();
    for (Map.Entry<String, String> e : fields.entrySet()) {
      String k = URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8);
      String v = URLEncoder.encode(e.getValue() == null ? "" : e.getValue(), StandardCharsets.UTF_8);
      pairs.add(k + "=" + v);
    }
    return String.join("&", pairs);
  }

  private static String trim(String value) {
    return value == null ? "" : value.trim();
  }

  private static boolean hasText(String value) {
    return value != null && !value.trim().isEmpty();
  }
}
