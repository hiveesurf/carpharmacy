package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.carnalysys.config.AppProperties;
import org.junit.jupiter.api.Test;

class DeliveryOtpDerivationServiceTest {

  @Test
  void deriveOtp_isDeterministicSixDigits() {
    var props =
        new AppProperties(
            new AppProperties.Jwt("test-secret-for-delivery-otp", 900),
            new AppProperties.RefreshToken(604800),
            new AppProperties.Otp(900),
            new AppProperties.Delivery(900, 30),
            new AppProperties.Cors(""),
            new AppProperties.Payment("mockpay", null, null, null, 600, 300000, 30));
    var service = new DeliveryOtpDerivationService(props);

    String otp1 = service.deriveOtp("ord-1", "nonce-abc");
    String otp2 = service.deriveOtp("ord-1", "nonce-abc");
    String otpOther = service.deriveOtp("ord-2", "nonce-abc");

    assertThat(otp1).isEqualTo(otp2).matches("\\d{6}");
    assertThat(otpOther).isNotEqualTo(otp1);
  }
}
