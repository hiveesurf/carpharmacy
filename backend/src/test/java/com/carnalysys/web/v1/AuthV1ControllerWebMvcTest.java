package com.carnalysys.web.v1;

import static com.carnalysys.testsupport.SecurityTestUtils.asUser;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.carnalysys.api.GlobalExceptionHandler;
import com.carnalysys.service.AuthService;
import com.carnalysys.service.AuthService.VerifyPayload;
import com.carnalysys.service.CartService;
import com.carnalysys.service.NotificationService;
import com.carnalysys.testsupport.ControllerSliceTestBase;
import com.carnalysys.testsupport.JsonEnvelopeMatchers;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = AuthV1Controller.class)
@AutoConfigureMockMvc(addFilters = true)
@Import(GlobalExceptionHandler.class)
class AuthV1ControllerWebMvcTest extends ControllerSliceTestBase {

  private static final UUID USER = UUID.fromString("11111111-1111-1111-1111-111111111111");
  private static final UUID GUEST_SESSION =
      UUID.fromString("aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

  @Autowired private MockMvc mockMvc;

  @MockBean private AuthService authService;

  @MockBean private CartService cartService;
  @MockBean private NotificationService notificationService;

  @Test
  void meRequiresUser() throws Exception {
    mockMvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
  }

  @Test
  void meOkWithUser() throws Exception {
    when(authService.currentUser(USER)).thenReturn(Map.of("user", Map.of("id", USER.toString())));
    mockMvc
        .perform(get("/api/v1/auth/me").with(asUser(USER)))
        .andExpect(status().isOk())
        .andExpect(JsonEnvelopeMatchers.successTrue());
  }

  @Test
  void sendOtpOk() throws Exception {
    when(authService.sendOtp("9876543210")).thenReturn(Map.of("sent", true));
    mockMvc
        .perform(
            post("/api/v1/auth/send-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9876543210\"}"))
        .andExpect(status().isOk())
        .andExpect(JsonEnvelopeMatchers.successTrue());
  }

  @ParameterizedTest
  @ValueSource(strings = {"{}", "{\"phone\":\"\"}", "{\"phone\":\"   \"}"})
  void sendOtpValidationFails(String body) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/send-otp").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isBadRequest())
        .andExpect(JsonEnvelopeMatchers.errorCode("VALIDATION_ERROR"));
  }

  @Test
  void sendOtpPhoneTooLong() throws Exception {
    String longPhone = "1".repeat(33);
    mockMvc
        .perform(
            post("/api/v1/auth/send-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"" + longPhone + "\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(JsonEnvelopeMatchers.errorCode("VALIDATION_ERROR"));
  }

  @Test
  void verifyOtpOk() throws Exception {
    when(authService.verifyOtp(eq("9876543210"), eq("123456")))
        .thenReturn(
            new VerifyPayload(
                Map.of("accessToken", "at", "user", Map.of()),
                "refresh-raw"));
    mockMvc
        .perform(
            post("/api/v1/auth/verify-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9876543210\",\"otp\":\"123456\"}"))
        .andExpect(status().isOk())
        .andExpect(JsonEnvelopeMatchers.successTrue());
    verify(cartService, never()).mergeGuestCartIntoUser(any(), any());
  }

  @Test
  void verifyOtpMergesGuestCartWhenGuestSessionHeaderPresent() throws Exception {
    when(authService.verifyOtp(eq("9876543210"), eq("123456")))
        .thenReturn(
            new VerifyPayload(
                Map.of(
                    "accessToken",
                    "at",
                    "user",
                    Map.of(
                        "id",
                        USER.toString(),
                        "phone",
                        "9876543210",
                        "name",
                        "T",
                        "role",
                        "user")),
                "refresh-raw"));
    mockMvc
        .perform(
            post("/api/v1/auth/verify-otp")
                .header("X-Guest-Session", GUEST_SESSION.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9876543210\",\"otp\":\"123456\"}"))
        .andExpect(status().isOk())
        .andExpect(JsonEnvelopeMatchers.successTrue());
    verify(cartService).mergeGuestCartIntoUser(USER, GUEST_SESSION);
  }

  @Test
  void verifyOtpBlankOtp() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/verify-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9876543210\",\"otp\":\"\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(JsonEnvelopeMatchers.errorCode("VALIDATION_ERROR"));
  }

  @Test
  void verifyOtpTooShort() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/verify-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9876543210\",\"otp\":\"12\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(JsonEnvelopeMatchers.errorCode("VALIDATION_ERROR"));
  }

  @Test
  void verifyOtpTooLong() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/verify-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9876543210\",\"otp\":\"1234567890123\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(JsonEnvelopeMatchers.errorCode("VALIDATION_ERROR"));
  }

  @Test
  void refreshTokenOk() throws Exception {
    when(authService.refresh(any()))
        .thenReturn(new AuthService.RefreshPayload(Map.of("accessToken", "x"), null));
    mockMvc
        .perform(
            post("/api/v1/auth/refresh-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isOk())
        .andExpect(JsonEnvelopeMatchers.successTrue());
  }

  @Test
  void logoutOk() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/logout")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isOk())
        .andExpect(JsonEnvelopeMatchers.successTrue());
  }
}
