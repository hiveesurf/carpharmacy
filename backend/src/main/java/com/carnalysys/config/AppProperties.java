package com.carnalysys.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
    Jwt jwt,
    RefreshToken refreshToken,
    Otp otp,
    Delivery delivery,
    Cors cors,
    Payment payment) {

  public record Jwt(String secret, int accessTtlSeconds) {}

  public record RefreshToken(int ttlSeconds) {}

  /** Login OTP challenge TTL (seconds). */
  public record Otp(int ttlSeconds) {}

  /** Customer delivery OTP timing (separate from login OTP challenge TTL). */
  public record Delivery(int otpTtlSeconds, int otpResendCooldownSeconds) {}

  public record Cors(String allowedOrigins) {
    public List<String> originList() {
      return Arrays.stream(allowedOrigins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
  }

  public record Payment(
      String provider,
      String razorpayKeyId,
      String razorpayKeySecret,
      String webhookSecret,
      long webhookReplayWindowSeconds,
      long reconciliationMs,
      int pendingTimeoutMinutes) {}
}
