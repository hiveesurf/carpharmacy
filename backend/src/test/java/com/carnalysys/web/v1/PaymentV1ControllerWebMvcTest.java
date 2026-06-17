package com.carnalysys.web.v1;

import static com.carnalysys.testsupport.SecurityTestUtils.asUser;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.carnalysys.api.GlobalExceptionHandler;
import com.carnalysys.service.PaymentGatewayService;
import com.carnalysys.service.PaymentWebhookService;
import com.carnalysys.testsupport.ControllerSliceTestBase;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = PaymentV1Controller.class)
@AutoConfigureMockMvc(addFilters = true)
@Import(GlobalExceptionHandler.class)
class PaymentV1ControllerWebMvcTest extends ControllerSliceTestBase {

  private static final UUID USER = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

  @Autowired private MockMvc mockMvc;
  @MockBean private PaymentWebhookService paymentWebhookService;
  @MockBean private PaymentGatewayService paymentGatewayService;

  @Test
  void webhookAccepted() throws Exception {
    when(paymentWebhookService.process(
            eq("abc123"), eq("mockpay"), eq("evt_1"), eq(1710000000L), org.mockito.ArgumentMatchers.any()))
        .thenReturn(Map.of("accepted", true, "paymentStatus", "paid"));

    mockMvc
        .perform(
            post("/api/v1/payments/webhook")
                .header("X-Signature", "abc123")
                .header("X-Provider", "mockpay")
                .header("X-Event-Id", "evt_1")
                .header("X-Event-Timestamp", "1710000000")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"orderId\":\"ord_1\",\"status\":\"paid\",\"transactionId\":\"txn_1\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.accepted").value(true));
  }

  @Test
  void createOrderReturnsRazorpayPayload() throws Exception {
    when(paymentGatewayService.createRazorpayOrder(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(1000L), org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(Map.of("orderId", "order_test_1", "amount", 1000, "currency", "INR", "key", "rzp_test_x"));

    mockMvc
        .perform(
            post("/api/v1/payments/create-order")
                .with(asUser(USER))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":1000}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.orderId").value("order_test_1"))
        .andExpect(jsonPath("$.data.key").value("rzp_test_x"));
  }

  @Test
  void verifyRequiresAuth() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/payments/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"orderId\":\"ord_1\",\"razorpay_order_id\":\"order_x\",\"razorpay_payment_id\":\"pay_x\",\"razorpay_signature\":\"sig_x\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void initiateReturnsGatewayPayload() throws Exception {
    when(paymentGatewayService.initiateRazorpay(org.mockito.ArgumentMatchers.any(), eq("ord_1")))
        .thenReturn(Map.of("provider", "razorpay", "orderId", "ord_1", "status", "created"));

    mockMvc
        .perform(
            post("/api/v1/payments/initiate")
                .with(asUser(USER))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"orderId\":\"ord_1\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.provider").value("razorpay"))
        .andExpect(jsonPath("$.data.orderId").value("ord_1"));
  }

  @Test
  void cancelAttemptRequiresAuth() throws Exception {
    mockMvc
        .perform(post("/api/v1/payments/ord_1/cancel-attempt").contentType(MediaType.APPLICATION_JSON))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void cancelAttemptOk() throws Exception {
    when(paymentGatewayService.cancelRazorpayPaymentAttempt(org.mockito.ArgumentMatchers.any(), eq("ord_1")))
        .thenReturn(Map.of("cancelled", true));

    mockMvc
        .perform(
            post("/api/v1/payments/ord_1/cancel-attempt")
                .with(asUser(USER))
                .contentType(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.cancelled").value(true));
  }
}
