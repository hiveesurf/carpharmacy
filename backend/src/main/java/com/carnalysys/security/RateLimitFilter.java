package com.carnalysys.security;

import com.carnalysys.api.ApiErrorEnvelope;
import com.carnalysys.api.ApiMeta;
import com.carnalysys.api.RequestIdFilter;
import com.carnalysys.config.RateLimitProperties;
import com.carnalysys.security.RateLimitService.Decision;
import com.carnalysys.security.RateLimitService.TierKind;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Applies token-bucket rate limits before controllers. Runs after JWT auth so authenticated keys
 * can use the principal when present.
 */
public class RateLimitFilter extends OncePerRequestFilter {

  private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

  private final RateLimitProperties properties;
  private final RateLimitService rateLimitService;
  private final ObjectMapper objectMapper;

  public RateLimitFilter(
      RateLimitProperties properties, RateLimitService rateLimitService, ObjectMapper objectMapper) {
    this.properties = properties;
    this.rateLimitService = rateLimitService;
    this.objectMapper = objectMapper;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    if (!properties.isEnabled()) {
      return true;
    }
    String path = path(request);
    if (path == null || path.isBlank()) {
      return true;
    }
    for (String prefix : properties.getExcludePathPrefixes()) {
      if (prefix != null && !prefix.isBlank() && path.startsWith(prefix.trim())) {
        return true;
      }
    }
    return !path.startsWith("/api/") && !path.startsWith("/actuator/");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String path = path(request);
    String method =
        request.getMethod() != null ? request.getMethod().toUpperCase(Locale.ROOT) : "GET";
    TierKind tier = resolveTier(path, method);
    String key = resolveKey(request, tier);

    Decision decision = rateLimitService.tryConsume(tier, key);
    if (!decision.allowed()) {
      log.warn(
          "RATE_LIMITED tier={} key={} method={} path={} retryAfterSeconds={}",
          tier,
          redactKey(key),
          method,
          path,
          decision.retryAfterSeconds());
      writeTooManyRequests(request, response, decision.retryAfterSeconds());
      return;
    }
    filterChain.doFilter(request, response);
  }

  static TierKind resolveTier(String path, String method) {
    if (path.startsWith("/api/v1/auth/send-otp")
        || path.startsWith("/api/v1/auth/verify-otp")
        || path.startsWith("/api/v1/auth/refresh-token")) {
      return TierKind.AUTH;
    }
    if (path.startsWith("/api/v1/admin/")) {
      return TierKind.ADMIN;
    }
    if ("GET".equals(method) || "HEAD".equals(method) || "OPTIONS".equals(method)) {
      return TierKind.PUBLIC_READ;
    }
    return TierKind.PUBLIC_WRITE;
  }

  private String resolveKey(HttpServletRequest request, TierKind tier) {
    String ip = ClientIpResolver.resolve(request);
    if (tier == TierKind.AUTH) {
      return "ip:" + ip;
    }
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.isAuthenticated() && auth.getPrincipal() != null) {
      String principal = String.valueOf(auth.getPrincipal());
      if (!principal.isBlank() && !"anonymousUser".equalsIgnoreCase(principal)) {
        if (tier == TierKind.ADMIN || isAdminAuthority(auth)) {
          return "admin:" + principal;
        }
        return "user:" + principal;
      }
    }
    return "ip:" + ip;
  }

  private static boolean isAdminAuthority(Authentication auth) {
    for (GrantedAuthority a : auth.getAuthorities()) {
      String role = a.getAuthority();
      if (role != null
          && (role.contains("ADMIN")
              || role.contains("SUPER_ADMIN")
              || role.contains("SALES")
              || role.contains("DELIVERY")
              || role.contains("CUSTOM"))) {
        return true;
      }
    }
    return false;
  }

  private void writeTooManyRequests(
      HttpServletRequest request, HttpServletResponse response, long retryAfterSeconds)
      throws IOException {
    response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
    response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    String rid = (String) request.getAttribute(RequestIdFilter.ATTR);
    Map<String, Object> details = new LinkedHashMap<>();
    details.put("retryAfterSeconds", retryAfterSeconds);
    ApiErrorEnvelope body =
        ApiErrorEnvelope.of(
            "RATE_LIMITED",
            "Too many requests, please try again later.",
            details,
            ApiMeta.of(rid));
    objectMapper.writeValue(response.getOutputStream(), body);
  }

  private static String path(HttpServletRequest request) {
    String uri = request.getRequestURI();
    if (uri == null) return "";
    String ctx = request.getContextPath();
    if (ctx != null && !ctx.isEmpty() && uri.startsWith(ctx)) {
      return uri.substring(ctx.length());
    }
    return uri;
  }

  private static String redactKey(String key) {
    if (key == null) return "unknown";
    int colon = key.indexOf(':');
    if (colon < 0) return "***";
    String prefix = key.substring(0, colon + 1);
    String rest = key.substring(colon + 1);
    if (rest.length() <= 4) return prefix + "***";
    return prefix + rest.substring(0, Math.min(4, rest.length())) + "***";
  }
}
