package com.carnalysys.security;

import com.carnalysys.api.ApiErrorEnvelope;
import com.carnalysys.api.ApiMeta;
import com.carnalysys.domain.AdminPageKey;
import com.carnalysys.domain.AdminUser;
import com.carnalysys.domain.CustomRolePermission;
import com.carnalysys.domain.UserEntity;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.CustomRolePermissionRepository;
import com.carnalysys.repo.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Protects {@code /api/v1/admin/**}: requires a valid storefront JWT whose user phone matches an
 * {@code admin_users.phone_e164} row. Roles are taken from {@code admin_users.role} on each request.
 *
 * <p>For {@code role=custom}, applies fail-safe page ACL via {@link AdminPageAccess}: allow-list,
 * known page_key, or default DENY for unmapped paths (including future endpoints).
 */
public class AdminAuthorizationFilter extends OncePerRequestFilter {

  public static final String ATTR_PAGE_KEYS = "admin.pageKeys";

  private final ObjectMapper objectMapper;
  private final AdminUserRepository adminUserRepository;
  private final UserRepository userRepository;
  private final CustomRolePermissionRepository customRolePermissionRepository;

  public AdminAuthorizationFilter(
      ObjectMapper objectMapper,
      AdminUserRepository adminUserRepository,
      UserRepository userRepository,
      CustomRolePermissionRepository customRolePermissionRepository) {
    this.objectMapper = objectMapper;
    this.adminUserRepository = adminUserRepository;
    this.userRepository = userRepository;
    this.customRolePermissionRepository = customRolePermissionRepository;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    try {
      var existing = SecurityContextHolder.getContext().getAuthentication();
      if (existing == null || !existing.isAuthenticated() || !hasAdminAuthority(existing.getAuthorities())) {
        forbidden(response, "Admin access requires sign-in with a phone number linked to an admin account");
        return;
      }

      UUID userId;
      try {
        userId = UUID.fromString(String.valueOf(existing.getName()).trim());
      } catch (IllegalArgumentException ex) {
        forbidden(response, "Admin access requires sign-in with a phone number linked to an admin account");
        return;
      }

      UserEntity user = userRepository.findById(userId).orElse(null);
      if (user == null || user.getPhoneE164() == null || user.getPhoneE164().isBlank()) {
        forbidden(response, "Admin access requires sign-in with a phone number linked to an admin account");
        return;
      }

      var adminOpt = adminUserRepository.findByPhoneE164(user.getPhoneE164().trim());
      if (adminOpt.isEmpty() || adminOpt.get().getDeletedAt() != null) {
        forbidden(response, "Admin access requires sign-in with a phone number linked to an admin account");
        return;
      }

      AdminUser admin = adminOpt.get();
      String role = admin.getRole();
      SecurityContextHolder.getContext()
          .setAuthentication(
              new UsernamePasswordAuthenticationToken(
                  userId.toString(), null, authoritiesFor(role)));

      if (isCustomRole(role)) {
        Set<String> pageKeys = loadPageKeys(admin);
        request.setAttribute(ATTR_PAGE_KEYS, pageKeys);
        if (!allowsCustomPageAccess(request, pageKeys)) {
          forbidden(response, "You do not have permission to access this admin resource");
          return;
        }
      }

      filterChain.doFilter(request, response);
    } finally {
      SecurityContextHolder.clearContext();
    }
  }

  private boolean allowsCustomPageAccess(HttpServletRequest request, Set<String> pageKeys) {
    String path = request.getRequestURI();
    // Prefer servlet path when behind a context path
    String servletPath = request.getServletPath();
    String uriForResolve =
        (servletPath != null && servletPath.startsWith("/api/v1/admin"))
            ? servletPath
            : path;

    AdminPageAccess.Resolution resolution = AdminPageAccess.resolve(uriForResolve);
    return switch (resolution.decision()) {
      case ALLOW_WITHOUT_PAGE_CHECK -> true;
      case DENY -> false;
      case REQUIRE_PAGE -> {
        AdminPageKey required = resolution.pageKey();
        yield required != null && pageKeys.contains(required.name());
      }
    };
  }

  private Set<String> loadPageKeys(AdminUser admin) {
    if (admin.getCustomRoleId() == null) {
      return Set.of();
    }
    return customRolePermissionRepository.findByRoleId(admin.getCustomRoleId()).stream()
        .map(CustomRolePermission::getPageKey)
        .filter(k -> k != null && !k.isBlank())
        .map(k -> k.trim().toLowerCase(Locale.ROOT))
        .collect(Collectors.toCollection(HashSet::new));
  }

  private static boolean isCustomRole(String role) {
    return role != null && "custom".equalsIgnoreCase(role.trim());
  }

  private static boolean hasAdminAuthority(Iterable<? extends GrantedAuthority> authorities) {
    for (GrantedAuthority g : authorities) {
      if ("ROLE_ADMIN".equals(g.getAuthority())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Maps {@code admin_users.role} to Spring authorities. Unknown roles get {@code ROLE_ADMIN}
   * only — never {@code ROLE_SUPER_ADMIN}.
   */
  static List<SimpleGrantedAuthority> authoritiesFor(String role) {
    String r = role == null ? "" : role.trim().toLowerCase(Locale.ROOT);
    return switch (r) {
      case "sales" ->
          List.of(
              new SimpleGrantedAuthority("ROLE_ADMIN"),
              new SimpleGrantedAuthority("ROLE_SALES"));
      case "delivery" ->
          List.of(
              new SimpleGrantedAuthority("ROLE_ADMIN"),
              new SimpleGrantedAuthority("ROLE_DELIVERY"));
      case "custom" ->
          List.of(
              new SimpleGrantedAuthority("ROLE_ADMIN"),
              new SimpleGrantedAuthority("ROLE_CUSTOM"));
      case "super_admin" ->
          List.of(
              new SimpleGrantedAuthority("ROLE_ADMIN"),
              new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
      default -> List.of(new SimpleGrantedAuthority("ROLE_ADMIN"));
    };
  }

  private void forbidden(HttpServletResponse response, String message) throws IOException {
    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
    response.setContentType("application/json;charset=UTF-8");
    objectMapper.writeValue(
        response.getOutputStream(),
        ApiErrorEnvelope.of("FORBIDDEN", message, null, ApiMeta.of(null)));
  }
}
