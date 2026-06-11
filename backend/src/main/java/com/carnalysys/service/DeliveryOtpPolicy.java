package com.carnalysys.service;

/** Rules for customer delivery OTP (HMAC-derived from order id + nonce). */
public final class DeliveryOtpPolicy {

  private DeliveryOtpPolicy() {}

  public static String resolveOtp(
      DeliveryOtpDerivationService derivationService, String orderId, String nonce) {
    return derivationService.deriveOtp(orderId, nonce);
  }
}
