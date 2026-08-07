package com.carnalysys.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Rate-limit tiers for {@link com.carnalysys.security.RateLimitFilter}. Tunable via {@code
 * app.rate-limit.*} / env without code changes.
 */
@ConfigurationProperties(prefix = "app.rate-limit")
public class RateLimitProperties {

  private boolean enabled = true;

  /** Auth (OTP send/verify): capacity tokens per windowSeconds. */
  private Tier auth = new Tier(5, 60);

  /** Temporary IP lockout after this many consecutive auth rate-limit hits. */
  private int authLockoutAfterViolations = 3;

  /** Auth lockout duration in seconds. */
  private int authLockoutSeconds = 900;

  private Tier publicRead = new Tier(120, 60);
  private Tier publicWrite = new Tier(20, 60);
  private Tier admin = new Tier(200, 60);

  /** Paths that skip rate limiting (prefix match). */
  private List<String> excludePathPrefixes =
      new ArrayList<>(
          List.of(
              "/api/v1/payments/webhook",
              "/api/v1/health",
              "/actuator/health",
              "/actuator/info"));

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public Tier getAuth() {
    return auth;
  }

  public void setAuth(Tier auth) {
    this.auth = auth;
  }

  public int getAuthLockoutAfterViolations() {
    return authLockoutAfterViolations;
  }

  public void setAuthLockoutAfterViolations(int authLockoutAfterViolations) {
    this.authLockoutAfterViolations = authLockoutAfterViolations;
  }

  public int getAuthLockoutSeconds() {
    return authLockoutSeconds;
  }

  public void setAuthLockoutSeconds(int authLockoutSeconds) {
    this.authLockoutSeconds = authLockoutSeconds;
  }

  public Tier getPublicRead() {
    return publicRead;
  }

  public void setPublicRead(Tier publicRead) {
    this.publicRead = publicRead;
  }

  public Tier getPublicWrite() {
    return publicWrite;
  }

  public void setPublicWrite(Tier publicWrite) {
    this.publicWrite = publicWrite;
  }

  public Tier getAdmin() {
    return admin;
  }

  public void setAdmin(Tier admin) {
    this.admin = admin;
  }

  public List<String> getExcludePathPrefixes() {
    return excludePathPrefixes;
  }

  public void setExcludePathPrefixes(List<String> excludePathPrefixes) {
    this.excludePathPrefixes = excludePathPrefixes;
  }

  public static class Tier {
    /** Max requests allowed in each window. */
    private int capacity = 60;

    /** Sliding/refill window length in seconds. */
    private int windowSeconds = 60;

    public Tier() {}

    public Tier(int capacity, int windowSeconds) {
      this.capacity = capacity;
      this.windowSeconds = windowSeconds;
    }

    public int getCapacity() {
      return capacity;
    }

    public void setCapacity(int capacity) {
      this.capacity = capacity;
    }

    public int getWindowSeconds() {
      return windowSeconds;
    }

    public void setWindowSeconds(int windowSeconds) {
      this.windowSeconds = windowSeconds;
    }
  }
}
