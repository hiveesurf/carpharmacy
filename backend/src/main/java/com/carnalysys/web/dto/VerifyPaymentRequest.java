package com.carnalysys.web.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VerifyPaymentRequest(
    @NotBlank @Size(max = 64) String orderId,
    @NotBlank
        @JsonProperty("razorpay_payment_id")
        @JsonAlias("razorpayPaymentId")
        String razorpayPaymentId,
    @NotBlank
        @JsonProperty("razorpay_order_id")
        @JsonAlias("razorpayOrderId")
        String razorpayOrderId,
    @NotBlank
        @JsonProperty("razorpay_signature")
        @JsonAlias("razorpaySignature")
        String razorpaySignature) {}
