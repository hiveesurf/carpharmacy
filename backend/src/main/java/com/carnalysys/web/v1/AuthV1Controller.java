package com.carnalysys.web.v1;

import com.carnalysys.api.ApiEnvelope;
import com.carnalysys.config.AppProperties;
import com.carnalysys.service.AuthService;
import com.carnalysys.service.AuthService.VerifyPayload;
import com.carnalysys.service.CartService;
import com.carnalysys.service.NotificationService;
import com.carnalysys.web.dto.SendOtpRequest;
import com.carnalysys.web.dto.VerifyOtpRequest;
import com.carnalysys.web.support.ApiResponses;
import com.carnalysys.web.support.AuthSupport;
import com.carnalysys.web.support.GuestRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.WebUtils;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthV1Controller {

  private static final Logger log = LoggerFactory.getLogger(AuthV1Controller.class);

  private final AuthService authService;
  private final AppProperties appProperties;
  private final CartService cartService;
  private final NotificationService notificationService;

  public AuthV1Controller(
      AuthService authService,
      AppProperties appProperties,
      CartService cartService,
      NotificationService notificationService) {
    this.authService = authService;
    this.appProperties = appProperties;
    this.cartService = cartService;
    this.notificationService = notificationService;
  }

  /** Current profile from DB (role, name) — use after promoting user to admin so UI updates without re-OTP. */
  @GetMapping("/me")
  public ApiEnvelope<Map<String, Object>> me(HttpServletRequest req) {
    UUID uid = AuthSupport.requireUser();
    return ApiResponses.ok(req, authService.currentUser(uid));
  }

  @PostMapping("/send-otp")
  public ApiEnvelope<Map<String, Object>> sendOtp(
      HttpServletRequest req, @Valid @RequestBody SendOtpRequest body) {
    return ApiResponses.ok(req, authService.sendOtp(body.digitsOnly()));
  }

  @PostMapping("/verify-otp")
  public ApiEnvelope<Map<String, Object>> verifyOtp(
      HttpServletRequest req,
      HttpServletResponse resp,
      @Valid @RequestBody VerifyOtpRequest body) {
    var guestId = GuestRequest.guestId(req);
    VerifyPayload result = authService.verifyOtp(body.phoneDigits(), body.otp());
    attachRefreshCookie(resp, result.refreshTokenRaw());
    if (guestId.isPresent()) {
      UUID uid = parseUserIdFromVerifyPayload(result.data());
      if (uid != null) {
        try {
          cartService.mergeGuestCartIntoUser(uid, guestId.get());
          clearGuestSessionCookie(resp);
        } catch (RuntimeException ex) {
          log.warn("Guest cart merge failed after login for user {}", uid, ex);
        }
      }
    }
    return ApiResponses.ok(req, result.data());
  }

  private static UUID parseUserIdFromVerifyPayload(Map<String, Object> data) {
    if (data == null) {
      return null;
    }
    Object userObj = data.get("user");
    if (!(userObj instanceof Map<?, ?> um)) {
      return null;
    }
    Object id = um.get("id");
    if (id == null) {
      return null;
    }
    try {
      return UUID.fromString(String.valueOf(id));
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  @PostMapping("/refresh-token")
  public ApiEnvelope<Map<String, Object>> refresh(
      HttpServletRequest req, HttpServletResponse resp, @RequestBody(required = false) Map<String, Object> body) {
    String raw = null;
    var c = WebUtils.getCookie(req, "refreshToken");
    if (c != null && c.getValue() != null && !c.getValue().isBlank()) {
      raw = c.getValue();
    }
    if (raw == null && body != null && body.get("refreshToken") != null) {
      raw = String.valueOf(body.get("refreshToken"));
    }
    var payload = authService.refresh(raw);
    if (payload.newRefreshTokenRaw() != null && !payload.newRefreshTokenRaw().isBlank()) {
      attachRefreshCookie(resp, payload.newRefreshTokenRaw());
    }
    return ApiResponses.ok(req, payload.data());
  }

  @PostMapping("/logout")
  public ApiEnvelope<Map<String, Object>> logout(
      HttpServletRequest req, HttpServletResponse resp, @RequestBody(required = false) Map<String, Object> body) {
    String raw = null;
    var c = WebUtils.getCookie(req, "refreshToken");
    if (c != null) raw = c.getValue();
    if (raw == null && body != null && body.get("refreshToken") != null) {
      raw = String.valueOf(body.get("refreshToken"));
    }
    authService.logout(raw);
    clearCookie(resp, "refreshToken");
    return ApiResponses.ok(req, Map.of("loggedOut", true));
  }

  @GetMapping("/notifications")
  public ApiEnvelope<Map<String, Object>> notifications(
      HttpServletRequest req,
      @org.springframework.web.bind.annotation.RequestParam(name = "cursor", required = false)
          String cursor,
      @org.springframework.web.bind.annotation.RequestParam(name = "limit", defaultValue = "20") int limit,
      @org.springframework.web.bind.annotation.RequestParam(name = "unreadOnly", defaultValue = "false")
          boolean unreadOnly) {
    UUID uid = AuthSupport.requireUser();
    java.time.Instant c = null;
    if (cursor != null && !cursor.isBlank()) {
      try {
        c = java.time.Instant.parse(cursor.trim());
      } catch (java.time.format.DateTimeParseException ignored) {
        c = null;
      }
    }
    try {
      return ApiResponses.ok(
          req,
          notificationService.list(
              NotificationService.RECIPIENT_USER, uid.toString(), c, limit, unreadOnly));
    } catch (RuntimeException ex) {
      Map<String, Object> empty = new LinkedHashMap<>();
      empty.put("items", List.of());
      empty.put("nextCursor", null);
      empty.put("unreadCount", 0L);
      empty.put("hasMore", false);
      return ApiResponses.ok(req, empty);
    }
  }

  @PostMapping("/notifications/read")
  public ApiEnvelope<Map<String, Object>> markRead(
      HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    UUID uid = AuthSupport.requireUser();
    boolean all = body != null && Boolean.TRUE.equals(body.get("all"));
    @SuppressWarnings("unchecked")
    java.util.List<String> ids =
        body != null && body.get("ids") instanceof java.util.List<?> list
            ? list.stream().map(String::valueOf).toList()
            : java.util.List.of();
    int changed =
        notificationService.markRead(
            NotificationService.RECIPIENT_USER, uid.toString(), ids, all);
    return ApiResponses.ok(req, Map.of("updated", changed));
  }

  @PostMapping("/notifications/push/subscribe")
  public ApiEnvelope<Map<String, Object>> subscribePush(
      HttpServletRequest req,
      @RequestBody(required = false) Map<String, Object> body,
      @org.springframework.web.bind.annotation.RequestHeader(name = "User-Agent", required = false)
          String userAgent) {
    UUID uid = AuthSupport.requireUser();
    Map<String, Object> b = body != null ? body : Map.of();
    String endpoint = b.get("endpoint") != null ? String.valueOf(b.get("endpoint")) : null;
    @SuppressWarnings("unchecked")
    Map<String, Object> keys =
        b.get("keys") instanceof Map<?, ?> km
            ? (Map<String, Object>) km
            : Map.of();
    String p256dh = keys.get("p256dh") != null ? String.valueOf(keys.get("p256dh")) : null;
    String auth = keys.get("auth") != null ? String.valueOf(keys.get("auth")) : null;
    notificationService.upsertPushSubscription(
        NotificationService.RECIPIENT_USER, uid.toString(), endpoint, p256dh, auth, userAgent);
    return ApiResponses.ok(req, Map.of("subscribed", true));
  }

  @PostMapping("/notifications/push/unsubscribe")
  public ApiEnvelope<Map<String, Object>> unsubscribePush(
      HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    UUID uid = AuthSupport.requireUser();
    String endpoint = body != null && body.get("endpoint") != null ? String.valueOf(body.get("endpoint")) : null;
    long removed =
        notificationService.removePushSubscription(
            NotificationService.RECIPIENT_USER, uid.toString(), endpoint);
    return ApiResponses.ok(req, Map.of("removed", removed));
  }

  private void attachRefreshCookie(HttpServletResponse resp, String refreshRaw) {
    ResponseCookie cookie =
        ResponseCookie.from("refreshToken", refreshRaw)
            .httpOnly(true)
            .sameSite("Lax")
            .path("/")
            .maxAge(appProperties.refreshToken().ttlSeconds())
            .build();
    resp.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }

  private static void clearCookie(HttpServletResponse resp, String name) {
    ResponseCookie cookie =
        ResponseCookie.from(name, "")
            .httpOnly(true)
            .sameSite("Lax")
            .path("/")
            .maxAge(0)
            .build();
    resp.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }

  private static void clearGuestSessionCookie(HttpServletResponse resp) {
    clearCookie(resp, "guestSession");
  }
}
