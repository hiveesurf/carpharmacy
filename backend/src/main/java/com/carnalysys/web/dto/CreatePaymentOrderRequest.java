package com.carnalysys.web.dto;

import jakarta.validation.constraints.Size;

/** amount is in paise; optional when orderId is set (server uses order total). */
public record CreatePaymentOrderRequest(Long amount, @Size(max = 64) String orderId) {}
