package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.carnalysys.api.ApiException;
import com.carnalysys.config.AppProperties;
import com.carnalysys.domain.AdminUser;
import com.carnalysys.domain.OtpChallenge;
import com.carnalysys.domain.RefreshTokenEntity;
import com.carnalysys.domain.UserEntity;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.OtpChallengeRepository;
import com.carnalysys.repo.RefreshTokenRepository;
import com.carnalysys.repo.UserProfileRepository;
import com.carnalysys.repo.UserRepository;
import com.carnalysys.security.JwtService;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

  @Mock private AppProperties appProperties;
  @Mock private AppProperties.Otp otpProperties;
  @Mock private AppProperties.Jwt jwtProperties;
  @Mock private AppProperties.RefreshToken refreshTokenProperties;
  @Mock private UserRepository userRepository;
  @Mock private UserProfileRepository userProfileRepository;
  @Mock private OtpChallengeRepository otpChallengeRepository;
  @Mock private RefreshTokenRepository refreshTokenRepository;
  @Mock private AdminUserRepository adminUserRepository;
  @Mock private JwtService jwtService;
  @Mock private PasswordEncoder passwordEncoder;
  @Mock private NotificationService notificationService;
  @Mock private WhatsappService whatsappService;

  @InjectMocks private AuthService authService;

  @Test
  void sendOtpGeneratesRandomOtpAndSendsViaWhatsApp() {
    when(appProperties.otp()).thenReturn(otpProperties);
    when(otpProperties.ttlSeconds()).thenReturn(300);
    when(whatsappService.isEnabled()).thenReturn(true);
    when(passwordEncoder.encode(any())).thenAnswer(inv -> "encoded-" + inv.getArgument(0));

    Map<String, Object> result = authService.sendOtp("9876543210");

    assertThat(result).containsEntry("sent", true).containsEntry("ttlSeconds", 300);
    assertThat(result).doesNotContainKey("demoOtp");
    ArgumentCaptor<OtpChallenge> challengeCaptor = ArgumentCaptor.forClass(OtpChallenge.class);
    verify(otpChallengeRepository).save(challengeCaptor.capture());
    assertThat(challengeCaptor.getValue().getPhoneE164()).isEqualTo("9876543210");
    ArgumentCaptor<String> otpCaptor = ArgumentCaptor.forClass(String.class);
    verify(whatsappService).sendOtp(eq("9876543210"), otpCaptor.capture());
    assertThat(otpCaptor.getValue()).matches("\\d{6}");
  }

  @Test
  void sendOtpFailsWhenWhatsAppNotConfigured() {
    when(whatsappService.isEnabled()).thenReturn(false);

    assertThatThrownBy(() -> authService.sendOtp("9876543210"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
              assertThat(ae.code()).isEqualTo("OTP_PROVIDER_UNAVAILABLE");
            });
    verify(otpChallengeRepository, never()).save(any());
    verify(whatsappService, never()).sendOtp(any(), any());
  }

  @Test
  void verifyOtpRejects123456WhenNotIssued() {
    OtpChallenge challenge = new OtpChallenge();
    challenge.setPhoneE164("9876543210");
    challenge.setCodeHash("hash");
    challenge.setExpiresAt(Instant.now().plusSeconds(600));
    when(otpChallengeRepository.findTopByPhoneE164AndConsumedAtIsNullOrderByCreatedAtDesc("9876543210"))
        .thenReturn(Optional.of(challenge));
    when(passwordEncoder.matches("123456", "hash")).thenReturn(false);

    assertThatThrownBy(() -> authService.verifyOtp("9876543210", "123456"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(ae.code()).isEqualTo("OTP_INVALID");
            });
  }

  @Test
  void verifyOtpRejectsExpiredChallenge() {
    OtpChallenge challenge = new OtpChallenge();
    challenge.setPhoneE164("9876543210");
    challenge.setCodeHash("hash");
    challenge.setExpiresAt(Instant.now().minusSeconds(5));
    when(otpChallengeRepository.findTopByPhoneE164AndConsumedAtIsNullOrderByCreatedAtDesc("9876543210"))
        .thenReturn(Optional.of(challenge));

    assertThatThrownBy(() -> authService.verifyOtp("9876543210", "482901"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(ae.code()).isEqualTo("OTP_EXPIRED");
            });
    verify(passwordEncoder, never()).matches(any(), any());
  }

  @Test
  void refreshFailsForBlankToken() {
    assertThatThrownBy(() -> authService.refresh("   "))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.UNAUTHORIZED);
              assertThat(ae.code()).isEqualTo("NO_REFRESH");
            });
  }

  @Test
  void logoutRevokesRefreshTokenWhenFound() {
    RefreshTokenEntity refresh = new RefreshTokenEntity();
    refresh.setExpiresAt(Instant.now().plusSeconds(60));
    when(refreshTokenRepository.findByTokenHashAndRevokedAtIsNull(any())).thenReturn(Optional.of(refresh));

    authService.logout("rt_token");

    verify(refreshTokenRepository).save(refresh);
    assertThat(refresh.getRevokedAt()).isNotNull();
  }

  @Test
  void verifyOtpPromotesEmployeeRoleAndMarksOnboardingSuccess() {
    UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    OtpChallenge challenge = new OtpChallenge();
    challenge.setPhoneE164("9876543210");
    challenge.setCodeHash("hash");
    challenge.setExpiresAt(Instant.now().plusSeconds(600));
    UserEntity user = new UserEntity();
    user.setId(userId);
    user.setPhoneE164("9876543210");
    user.setRole("user");
    AdminUser employee = new AdminUser();
    employee.setPhoneE164("9876543210");
    employee.setRole("sales");
    employee.setOnboardingStatus("pending");

    when(otpChallengeRepository.findTopByPhoneE164AndConsumedAtIsNullOrderByCreatedAtDesc("9876543210"))
        .thenReturn(Optional.of(challenge));
    when(passwordEncoder.matches("482901", "hash")).thenReturn(true);
    when(userRepository.findByPhoneE164("9876543210")).thenReturn(Optional.of(user));
    when(adminUserRepository.findByPhoneE164("9876543210")).thenReturn(Optional.of(employee));
    when(userRepository.getReferenceById(userId)).thenReturn(user);
    when(jwtService.createAccessToken(userId, "sales")).thenReturn("access-token");
    when(appProperties.refreshToken()).thenReturn(refreshTokenProperties);
    when(refreshTokenProperties.ttlSeconds()).thenReturn(1200);
    when(appProperties.jwt()).thenReturn(jwtProperties);
    when(jwtProperties.accessTtlSeconds()).thenReturn(900);

    AuthService.VerifyPayload payload = authService.verifyOtp("9876543210", "482901");

    assertThat(payload.data()).containsEntry("accessToken", "access-token");
    assertThat(user.getRole()).isEqualTo("sales");
    assertThat(employee.getOnboardingStatus()).isEqualTo("success");
    assertThat(employee.getFirstLoginAt()).isNotNull();
    verify(adminUserRepository).save(employee);
    verify(refreshTokenRepository).save(any(RefreshTokenEntity.class));
  }
}
