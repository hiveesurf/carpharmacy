package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.carnalysys.config.AppProperties;
import org.junit.jupiter.api.Test;

class DeliveryOtpPolicyTest {

  private static AppProperties props() {
    return new AppProperties(
        new AppProperties.Jwt("test-secret-for-delivery-otp", 900),
        new AppProperties.RefreshToken(604800),
        new AppProperties.Otp(20),
        new AppProperties.Delivery(900, 30),
        new AppProperties.Cors(""),
        new AppProperties.Payment("mockpay", null, null, null, 600, 300000, 30));
  }

  @Test
  void resolveOtp_alwaysReturnsDerivedSixDigits() {
    var derivation = new DeliveryOtpDerivationService(props());
    String otp = DeliveryOtpPolicy.resolveOtp(derivation, "ord-1", "nonce-1");
    assertThat(otp).matches("\\d{6}");
    assertThat(otp).isEqualTo(derivation.deriveOtp("ord-1", "nonce-1"));
  }

  @Test
  void resolveOtp_differsPerNonce() {
    var derivation = new DeliveryOtpDerivationService(props());
    String a = DeliveryOtpPolicy.resolveOtp(derivation, "ord-1", "nonce-a");
    String b = DeliveryOtpPolicy.resolveOtp(derivation, "ord-1", "nonce-b");
    assertThat(a).isNotEqualTo(b);
  }
}
