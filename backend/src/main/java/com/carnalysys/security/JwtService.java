package com.carnalysys.security;

import com.carnalysys.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

  private static final String CLAIM_ROLE = "role";

  private final AppProperties appProperties;
  private final SecretKey key;

  public JwtService(AppProperties appProperties) {
    this.appProperties = appProperties;
    byte[] bytes;
    try {
      bytes =
          MessageDigest.getInstance("SHA-256")
              .digest(appProperties.jwt().secret().getBytes(StandardCharsets.UTF_8));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
    this.key = Keys.hmacShaKeyFor(bytes);
  }

  public String createAccessToken(UUID userId, String role) {
    long now = System.currentTimeMillis();
    long exp = now + appProperties.jwt().accessTtlSeconds() * 1000L;
    String r = normalizeRole(role);
    return Jwts.builder()
        .subject(userId.toString())
        .claim(CLAIM_ROLE, r)
        .issuedAt(new Date(now))
        .expiration(new Date(exp))
        .signWith(key)
        .compact();
  }

  /**
   * Legacy tokens without {@code role} claim are treated as {@code user}.
   */
  public Optional<UsernamePasswordAuthenticationToken> parseBearerToken(String token) {
    if (token == null || token.isBlank()) {
      return Optional.empty();
    }
    try {
      Claims claims =
          Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
      UUID uid = UUID.fromString(claims.getSubject());
      String role = normalizeRole(claims.get(CLAIM_ROLE, String.class));
      var authorities = toAuthorities(role);
      return Optional.of(new UsernamePasswordAuthenticationToken(uid.toString(), null, authorities));
    } catch (Exception e) {
      return Optional.empty();
    }
  }

  /** @deprecated Use {@link #parseBearerToken(String)} */
  @Deprecated
  public Optional<UUID> parseUserId(String token) {
    return parseBearerToken(token).map(t -> UUID.fromString(t.getName()));
  }

  private static String normalizeRole(String role) {
    if (role == null || role.isBlank()) {
      return "user";
    }
    String r = role.trim().toLowerCase();
    return switch (r) {
      case "super_admin", "sales", "delivery", "custom", "user" -> r;
      case "admin" -> "super_admin";
      default -> "user";
    };
  }

  private static List<SimpleGrantedAuthority> toAuthorities(String role) {
    return switch (normalizeRole(role)) {
      case "super_admin" ->
          List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
      case "sales" ->
          List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("ROLE_SALES"));
      case "delivery" ->
          List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("ROLE_DELIVERY"));
      case "custom" ->
          List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("ROLE_CUSTOM"));
      default -> List.of(new SimpleGrantedAuthority("ROLE_USER"));
    };
  }
}
