package com.carnalysys.service;

import com.carnalysys.api.ApiException;
import com.carnalysys.config.AppProperties;
import com.carnalysys.domain.AdminUser;
import com.carnalysys.domain.OtpChallenge;
import com.carnalysys.domain.RefreshTokenEntity;
import com.carnalysys.domain.UserEntity;
import com.carnalysys.domain.UserProfile;
import com.carnalysys.repo.OtpChallengeRepository;
import com.carnalysys.repo.RefreshTokenRepository;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.UserProfileRepository;
import com.carnalysys.repo.UserRepository;
import com.carnalysys.security.JwtService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  public record VerifyPayload(Map<String, Object> data, String refreshTokenRaw) {}

  /** Access payload + new refresh raw (rotated on each refresh). */
  public record RefreshPayload(Map<String, Object> data, String newRefreshTokenRaw) {}

  private final AppProperties appProperties;
  private final UserRepository userRepository;
  private final UserProfileRepository userProfileRepository;
  private final OtpChallengeRepository otpChallengeRepository;
  private final RefreshTokenRepository refreshTokenRepository;
  private final AdminUserRepository adminUserRepository;
  private final JwtService jwtService;
  private final PasswordEncoder passwordEncoder;
  private final NotificationService notificationService;
  private final WhatsappService whatsappService;
  private final SecureRandom random = new SecureRandom();

  public AuthService(
      AppProperties appProperties,
      UserRepository userRepository,
      UserProfileRepository userProfileRepository,
      OtpChallengeRepository otpChallengeRepository,
      RefreshTokenRepository refreshTokenRepository,
      AdminUserRepository adminUserRepository,
      JwtService jwtService,
      PasswordEncoder passwordEncoder,
      NotificationService notificationService,
      WhatsappService whatsappService) {
    this.appProperties = appProperties;
    this.userRepository = userRepository;
    this.userProfileRepository = userProfileRepository;
    this.otpChallengeRepository = otpChallengeRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.adminUserRepository = adminUserRepository;
    this.jwtService = jwtService;
    this.passwordEncoder = passwordEncoder;
    this.notificationService = notificationService;
    this.whatsappService = whatsappService;
  }

  /** Sends login OTP via Twilio WhatsApp; stores bcrypt hash for verify. No demo/fixed OTP. */
  @Transactional
  public Map<String, Object> sendOtp(String phoneDigits) {
    String phoneKey = normalizePhoneKey(phoneDigits);
    if (phoneKey.length() != 10) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid phone");
    }
    if (!whatsappService.isEnabled()) {
      throw new ApiException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "OTP_PROVIDER_UNAVAILABLE",
          "Login OTP is unavailable. Configure WHATSAPP_ENABLED and Twilio credentials.");
    }
    String otp = String.format("%06d", random.nextInt(1_000_000));
    OtpChallenge ch = new OtpChallenge();
    ch.setPhoneE164(phoneKey);
    ch.setCodeHash(passwordEncoder.encode(otp));
    ch.setExpiresAt(Instant.now().plusSeconds(appProperties.otp().ttlSeconds()));
    otpChallengeRepository.save(ch);

    UserEntity existingUser = userRepository.findByPhoneE164(phoneKey).orElse(null);
    if (existingUser != null) {
      notificationService.notifyUser(
          existingUser.getId(),
          "auth_security",
          "OTP sent",
          "A login OTP was requested for your account.",
          "auth",
          ch.getId().toString(),
          Map.of("phone", phoneKey));
    }

    try {
      whatsappService.sendOtp(phoneKey, otp);
    } catch (RuntimeException ex) {
      throw new ApiException(
          HttpStatus.BAD_GATEWAY,
          "OTP_SEND_FAILED",
          "Could not send OTP via WhatsApp. Check Twilio configuration and try again.");
    }

    Map<String, Object> data = new LinkedHashMap<>();
    data.put("sent", true);
    data.put("ttlSeconds", appProperties.otp().ttlSeconds());
    return data;
  }

  @Transactional
  public VerifyPayload verifyOtp(String phoneDigits, String otp) {
    String phoneKey = normalizePhoneKey(phoneDigits);
    if (phoneKey.length() != 10) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid phone");
    }
    var row =
        otpChallengeRepository
            .findTopByPhoneE164AndConsumedAtIsNullOrderByCreatedAtDesc(phoneKey)
            .orElseThrow(
                () -> new ApiException(HttpStatus.BAD_REQUEST, "OTP_EXPIRED", "Request a new OTP"));
    if (row.getExpiresAt().isBefore(Instant.now())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_EXPIRED", "Request a new OTP");
    }
    if (!passwordEncoder.matches(otp, row.getCodeHash())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "Wrong OTP");
    }
    row.setConsumedAt(Instant.now());
    otpChallengeRepository.save(row);
    return loginWithVerifiedPhone(phoneKey);
  }

  @Transactional
  public VerifyPayload loginWithVerifiedPhone(String phoneRaw) {
    String phoneKey = normalizePhoneKey(phoneRaw);
    if (phoneKey.length() != 10) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid phone");
    }

    UserEntity user =
        userRepository
            .findByPhoneE164(phoneKey)
            .orElseGet(
                () -> {
                  UserEntity u = new UserEntity();
                  u.setPhoneE164(phoneKey);
                  u.setDisplayName("User " + phoneKey.substring(Math.max(0, phoneKey.length() - 4)));
                  userRepository.saveAndFlush(u);
                  UserProfile prof = new UserProfile();
                  prof.setUser(u);
                  prof.setFullName(u.getDisplayName());
                  prof.setEmail(null);
                  prof.setPhone(phoneKey);
                  userProfileRepository.save(prof);
                  return userRepository
                      .findById(u.getId())
                      .orElseThrow(() -> new IllegalStateException("user not persisted"));
                });

    promoteRoleAndActivateEmployeeIfMatched(user, phoneKey);

    String accessToken = jwtService.createAccessToken(user.getId(), user.getRole());
    String refreshRaw = newRefreshRaw();
    RefreshTokenEntity rt = new RefreshTokenEntity();
    rt.setUser(userRepository.getReferenceById(user.getId()));
    rt.setTokenHash(sha256Hex(refreshRaw));
    rt.setExpiresAt(Instant.now().plusSeconds(appProperties.refreshToken().ttlSeconds()));
    refreshTokenRepository.save(rt);

    Map<String, Object> data = new LinkedHashMap<>();
    data.put("accessToken", accessToken);
    data.put("user", userToMap(user));
    data.put("expiresInSeconds", appProperties.jwt().accessTtlSeconds());
    notificationService.notifyUser(
        user.getId(),
        "auth_security",
        "Login successful",
        "You signed in successfully.",
        "auth",
        user.getId().toString(),
        Map.of("phone", phoneKey, "provider", "twilio_otp"));
    return new VerifyPayload(data, refreshRaw);
  }

  @Transactional
  public RefreshPayload refresh(String refreshRaw) {
    if (refreshRaw == null || refreshRaw.isBlank()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "NO_REFRESH", "No refresh token");
    }
    String hash = sha256Hex(refreshRaw.trim());
    RefreshTokenEntity row =
        refreshTokenRepository
            .findByTokenHashAndRevokedAtIsNull(hash)
            .orElseThrow(
                () ->
                    new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_INVALID", "Refresh expired"));
    if (row.getExpiresAt().isBefore(Instant.now())) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_INVALID", "Refresh expired");
    }
    row.setRevokedAt(Instant.now());
    refreshTokenRepository.save(row);

    UserEntity user = row.getUser();
    String accessToken = jwtService.createAccessToken(user.getId(), user.getRole());
    String newRefreshRaw = newRefreshRaw();
    RefreshTokenEntity next = new RefreshTokenEntity();
    next.setUser(user);
    next.setTokenHash(sha256Hex(newRefreshRaw));
    next.setExpiresAt(Instant.now().plusSeconds(appProperties.refreshToken().ttlSeconds()));
    refreshTokenRepository.save(next);

    Map<String, Object> data = new LinkedHashMap<>();
    data.put("accessToken", accessToken);
    data.put("user", userToMap(user));
    data.put("expiresInSeconds", appProperties.jwt().accessTtlSeconds());
    notificationService.notifyUser(
        user.getId(),
        "auth_security",
        "Session refreshed",
        "Your session token was refreshed.",
        "auth",
        row.getId().toString(),
        Map.of());
    return new RefreshPayload(data, newRefreshRaw);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> currentUser(UUID userId) {
    UserEntity u =
        userRepository
            .findById(userId)
            .orElseThrow(
                () ->
                    new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "User not found"));
    Map<String, Object> m = userToMap(u);
    userProfileRepository
        .findById(userId)
        .ifPresent(
            p -> {
              if (p.getAvatarStorageKey() != null && !p.getAvatarStorageKey().isBlank()) {
                m.put("avatarUrl", UserAvatarService.PUBLIC_AVATAR_PREFIX + userId);
              }
              if (p.getSecondaryPhone() != null && !p.getSecondaryPhone().isBlank()) {
                m.put("secondaryPhone", p.getSecondaryPhone());
              }
            });
    return m;
  }

  @Transactional
  public void logout(String refreshRaw) {
    if (refreshRaw != null && !refreshRaw.isBlank()) {
      refreshTokenRepository
          .findByTokenHashAndRevokedAtIsNull(sha256Hex(refreshRaw.trim()))
          .ifPresent(
              r -> {
                UserEntity user = r.getUser();
                r.setRevokedAt(Instant.now());
                refreshTokenRepository.save(r);
                if (user != null && user.getId() != null) {
                  notificationService.notifyUser(
                      user.getId(),
                      "auth_security",
                      "Logged out",
                      "You logged out from your account.",
                      "auth",
                      r.getId().toString(),
                      Map.of());
                }
                markDeliveryEmployeeOffline(user);
              });
    }
  }

  private static Map<String, Object> userToMap(UserEntity u) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", u.getId().toString());
    m.put("phone", u.getPhoneE164());
    m.put("name", u.getDisplayName());
    m.put("role", u.getRole() != null ? u.getRole() : "user");
    return m;
  }

  private String newRefreshRaw() {
    byte[] b = new byte[32];
    random.nextBytes(b);
    return "rt_" + HexFormat.of().formatHex(b);
  }

  private static String sha256Hex(String s) {
    try {
      byte[] d =
          MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(d);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  private void promoteRoleAndActivateEmployeeIfMatched(UserEntity user, String phoneDigits) {
    AdminUser employee = adminUserRepository.findByPhoneE164(phoneDigits).orElse(null);
    if (employee == null || employee.getDeletedAt() != null) {
      return;
    }

    String role = employee.getRole();
    if (role == null || role.isBlank()) {
      return;
    }
    String normalizedRole = role.trim().toLowerCase();
    if (!normalizedRole.equalsIgnoreCase(user.getRole())) {
      user.setRole(normalizedRole);
      userRepository.save(user);
    }

    if (!"success".equalsIgnoreCase(employee.getOnboardingStatus())) {
      employee.setOnboardingStatus("success");
      if (employee.getFirstLoginAt() == null) {
        employee.setFirstLoginAt(Instant.now());
      }
      employee.setLastLoginAt(Instant.now());
      if ("delivery".equalsIgnoreCase(employee.getRole())) {
        employee.setAvailabilityStatus("online");
      }
      adminUserRepository.save(employee);
    } else {
      employee.setLastLoginAt(Instant.now());
      if ("delivery".equalsIgnoreCase(employee.getRole())) {
        employee.setAvailabilityStatus("online");
      }
      adminUserRepository.save(employee);
    }
  }

  private void markDeliveryEmployeeOffline(UserEntity user) {
    if (user == null) return;
    String phone = user.getPhoneE164();
    if (phone == null || phone.isBlank()) return;
    AdminUser employee = adminUserRepository.findByPhoneE164(phone).orElse(null);
    if (employee == null || !"delivery".equalsIgnoreCase(employee.getRole())) return;
    employee.setAvailabilityStatus("offline");
    employee.setLastLogoutAt(Instant.now());
    adminUserRepository.save(employee);
  }

  private static String normalizePhoneKey(String phoneInput) {
    String digits = phoneInput == null ? "" : phoneInput.replaceAll("\\D", "");
    if (digits.startsWith("91") && digits.length() == 12) {
      return digits.substring(2);
    }
    if (digits.length() > 10) {
      return digits.substring(digits.length() - 10);
    }
    return digits;
  }

}
