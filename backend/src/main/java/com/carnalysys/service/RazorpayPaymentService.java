package com.carnalysys.service;

import com.carnalysys.api.ApiException;
import com.carnalysys.config.AppProperties;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import java.util.LinkedHashMap;
import java.util.Map;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class RazorpayPaymentService {

  private final AppProperties appProperties;
  private volatile RazorpayClient client;

  public RazorpayPaymentService(AppProperties appProperties) {
    this.appProperties = appProperties;
  }

  public boolean isEnabled() {
    return "razorpay".equalsIgnoreCase(appProperties.payment().provider()) && hasCredentials();
  }

  public String keyId() {
    ensureConfigured();
    return appProperties.payment().razorpayKeyId();
  }

  public Map<String, Object> createOrder(String receiptId, long amountPaise, String currency) {
    ensureConfigured();
    if (amountPaise <= 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "amount must be positive");
    }
    try {
      JSONObject request = new JSONObject();
      request.put("amount", amountPaise);
      request.put("currency", currency != null && !currency.isBlank() ? currency : "INR");
      request.put("receipt", receiptId);
      request.put("payment_capture", 1);
      Order order = client().orders.create(request);
      JSONObject json = order.toJson();
      Map<String, Object> out = new LinkedHashMap<>();
      for (String key : json.keySet()) {
        out.put(key, json.get(key));
      }
      return out;
    } catch (RazorpayException ex) {
      throw new ApiException(
          HttpStatus.BAD_GATEWAY,
          "PAYMENT_PROVIDER_ERROR",
          "Unable to create Razorpay order: " + ex.getMessage());
    }
  }

  public boolean verifyCheckoutSignature(String razorpayOrderId, String razorpayPaymentId, String signature) {
    ensureConfigured();
    if (razorpayOrderId == null
        || razorpayOrderId.isBlank()
        || razorpayPaymentId == null
        || razorpayPaymentId.isBlank()
        || signature == null
        || signature.isBlank()) {
      return false;
    }
    try {
      JSONObject attributes = new JSONObject();
      attributes.put("razorpay_order_id", razorpayOrderId.trim());
      attributes.put("razorpay_payment_id", razorpayPaymentId.trim());
      attributes.put("razorpay_signature", signature.trim());
      return Utils.verifyPaymentSignature(attributes, appProperties.payment().razorpayKeySecret());
    } catch (RazorpayException ex) {
      return false;
    }
  }

  private RazorpayClient client() {
    ensureConfigured();
    if (client == null) {
      synchronized (this) {
        if (client == null) {
          try {
            client =
                new RazorpayClient(
                    appProperties.payment().razorpayKeyId(), appProperties.payment().razorpayKeySecret());
          } catch (RazorpayException ex) {
            throw new ApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "PAYMENT_PROVIDER_MISCONFIGURED",
                "Invalid Razorpay credentials");
          }
        }
      }
    }
    return client;
  }

  private boolean hasCredentials() {
    String keyId = appProperties.payment().razorpayKeyId();
    String keySecret = appProperties.payment().razorpayKeySecret();
    return keyId != null && !keyId.isBlank() && keySecret != null && !keySecret.isBlank();
  }

  private void ensureConfigured() {
    if (!"razorpay".equalsIgnoreCase(appProperties.payment().provider())) {
      throw new ApiException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "PAYMENT_PROVIDER_UNAVAILABLE",
          "Razorpay is not the active payment provider");
    }
    if (!hasCredentials()) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          "PAYMENT_PROVIDER_MISCONFIGURED",
          "Missing Razorpay key id or secret (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)");
    }
  }
}
