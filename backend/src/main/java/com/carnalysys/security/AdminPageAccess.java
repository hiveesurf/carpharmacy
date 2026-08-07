package com.carnalysys.security;

import com.carnalysys.domain.AdminPageKey;
import java.util.Locale;

/**
 * Resolves {@code /api/v1/admin/**} URIs for custom-role page ACL.
 *
 * <p><b>Fail-safe default-deny for {@code role=custom}:</b>
 *
 * <ol>
 *   <li>Paths on the explicit allow-list bypass page checks (any authenticated admin).
 *   <li>Known resource prefixes map to one of the 7 {@link AdminPageKey}s and are checked.
 *   <li>Anything else is {@link Decision#DENY} — including future endpoints nobody mapped yet.
 * </ol>
 *
 * <p>Sales / delivery / super_admin never consult this resolver for authorization.
 */
public final class AdminPageAccess {

  public enum Decision {
    /** Explicit allow-list: skip page_key check. */
    ALLOW_WITHOUT_PAGE_CHECK,
    /** Must hold the given page_key. */
    REQUIRE_PAGE,
    /** Unmapped path: deny custom roles by default. */
    DENY
  }

  public record Resolution(Decision decision, AdminPageKey pageKey) {
    public static Resolution allowListed() {
      return new Resolution(Decision.ALLOW_WITHOUT_PAGE_CHECK, null);
    }

    public static Resolution require(AdminPageKey pageKey) {
      return new Resolution(Decision.REQUIRE_PAGE, pageKey);
    }

    public static Resolution deny() {
      return new Resolution(Decision.DENY, null);
    }
  }

  private static final String ADMIN_API_PREFIX = "/api/v1/admin";

  private AdminPageAccess() {}

  /**
   * @param requestUri servlet path or request URI (query string ignored)
   */
  public static Resolution resolve(String requestUri) {
    String relative = relativeAdminPath(requestUri);
    if (relative == null) {
      return Resolution.deny();
    }
    if (isAllowListed(relative)) {
      return Resolution.allowListed();
    }
    AdminPageKey pageKey = mapFirstSegmentToPageKey(relative);
    if (pageKey != null) {
      return Resolution.require(pageKey);
    }
    // delivery/**, unknown future endpoints, etc. → default DENY for custom
    return Resolution.deny();
  }

  /** Strip to path under /api/v1/admin, no leading slash, lowercase. Empty string = admin root. */
  static String relativeAdminPath(String requestUri) {
    if (requestUri == null || requestUri.isBlank()) {
      return null;
    }
    String path = requestUri.trim();
    int q = path.indexOf('?');
    if (q >= 0) {
      path = path.substring(0, q);
    }
    path = path.toLowerCase(Locale.ROOT);
    if (!path.startsWith(ADMIN_API_PREFIX)) {
      // allow callers that already pass a relative admin path
      if (path.startsWith("/")) {
        path = path.substring(1);
      }
      return path;
    }
    String rest = path.substring(ADMIN_API_PREFIX.length());
    if (rest.startsWith("/")) {
      rest = rest.substring(1);
    }
    return rest;
  }

  /**
   * Only these paths bypass page ACL for custom roles. Keep this list short and explicit.
   * Future admin endpoints must NOT be added here unless intentionally global.
   */
  static boolean isAllowListed(String relativeAdminPath) {
    if (relativeAdminPath == null) {
      return false;
    }
    if (relativeAdminPath.isEmpty()) {
      return false;
    }
    // GET /api/v1/admin/me (+ subpaths if any)
    if (relativeAdminPath.equals("me") || relativeAdminPath.startsWith("me/")) {
      return true;
    }
    // /api/v1/admin/notifications/**
    if (relativeAdminPath.equals("notifications")
        || relativeAdminPath.startsWith("notifications/")) {
      return true;
    }
    return false;
  }

  static AdminPageKey mapFirstSegmentToPageKey(String relativeAdminPath) {
    if (relativeAdminPath == null || relativeAdminPath.isEmpty()) {
      return null;
    }
    int slash = relativeAdminPath.indexOf('/');
    String segment =
        slash < 0 ? relativeAdminPath : relativeAdminPath.substring(0, slash);
    return switch (segment) {
      case "dashboard" -> AdminPageKey.analytics;
      case "products" -> AdminPageKey.inventory;
      case "cars" -> AdminPageKey.cars;
      case "categories" -> AdminPageKey.categories;
      case "users" -> AdminPageKey.users;
      case "employees", "custom-roles" -> AdminPageKey.employees;
      case "orders" -> AdminPageKey.orders;
      case "sales-report" -> AdminPageKey.sales_report;
      case "reconciliation" -> AdminPageKey.reconciliation;
      default -> null;
    };
  }
}
