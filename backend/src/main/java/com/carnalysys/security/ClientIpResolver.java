package com.carnalysys.security;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

/** Resolves client IP, preferring proxy-forwarded headers when present. */
public final class ClientIpResolver {

  private ClientIpResolver() {}

  public static String resolve(HttpServletRequest request) {
    String forwarded = firstNonBlank(request.getHeader("X-Forwarded-For"));
    if (forwarded != null) {
      // X-Forwarded-For: client, proxy1, proxy2 — leftmost is original client
      String first = forwarded.split(",")[0].trim();
      if (!first.isEmpty() && !"unknown".equalsIgnoreCase(first)) {
        return first;
      }
    }
    String realIp = firstNonBlank(request.getHeader("X-Real-IP"));
    if (realIp != null && !"unknown".equalsIgnoreCase(realIp)) {
      return realIp;
    }
    String remote = request.getRemoteAddr();
    return remote != null && !remote.isBlank() ? remote : "unknown";
  }

  private static String firstNonBlank(String value) {
    if (value == null) return null;
    String t = value.trim();
    return t.isEmpty() ? null : t;
  }

  public static String normalizeKeyPart(String raw) {
    if (raw == null || raw.isBlank()) return "unknown";
    return raw.trim().toLowerCase(Locale.ROOT);
  }
}
