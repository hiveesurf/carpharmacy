package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.carnalysys.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RazorpayPaymentServiceTest {

  @Mock private AppProperties appProperties;
  @Mock private AppProperties.Payment paymentProperties;

  private RazorpayPaymentService service;

  @BeforeEach
  void setUp() {
    when(appProperties.payment()).thenReturn(paymentProperties);
    when(paymentProperties.provider()).thenReturn("razorpay");
    when(paymentProperties.razorpayKeySecret()).thenReturn("secret123");
    when(paymentProperties.razorpayKeyId()).thenReturn("rzp_test_123");
    service = new RazorpayPaymentService(appProperties);
  }

  @Test
  void verifyCheckoutSignatureReturnsTrueForMatchingSignature() throws Exception {
    String payload = "order_abc|pay_xyz";
    String signature = hmac(payload, "secret123");

    assertThat(service.verifyCheckoutSignature("order_abc", "pay_xyz", signature)).isTrue();
    assertThat(service.verifyCheckoutSignature("order_abc", "pay_xyz", "bad-signature")).isFalse();
  }

  @Test
  void isEnabledWhenProviderIsRazorpayAndCredentialsExist() {
    assertThat(service.isEnabled()).isTrue();
  }

  private static String hmac(String value, String secret) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
  }
}
