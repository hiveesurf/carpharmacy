package com.carnalysys.security;

import com.carnalysys.config.RateLimitProperties;
import com.carnalysys.config.RateLimitProperties.Tier;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/** In-memory token-bucket rate limiting (single API instance). */
@Service
public class RateLimitService {

  public enum TierKind {
    AUTH,
    PUBLIC_READ,
    PUBLIC_WRITE,
    ADMIN
  }

  public record Decision(boolean allowed, long retryAfterSeconds) {
    public static Decision ok() {
      return new Decision(true, 0L);
    }

    public static Decision blocked(long retryAfterSeconds) {
      return new Decision(false, Math.max(1L, retryAfterSeconds));
    }
  }

  private final RateLimitProperties properties;
  private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, Integer> authViolations = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, Instant> authLockouts = new ConcurrentHashMap<>();

  public RateLimitService(RateLimitProperties properties) {
    this.properties = properties;
  }

  public Decision tryConsume(TierKind tier, String key) {
    if (!properties.isEnabled()) {
      return Decision.ok();
    }
    String bucketKey = tier.name() + ":" + ClientIpResolver.normalizeKeyPart(key);

    if (tier == TierKind.AUTH) {
      Instant lockedUntil = authLockouts.get(bucketKey);
      if (lockedUntil != null) {
        if (Instant.now().isBefore(lockedUntil)) {
          long seconds = Duration.between(Instant.now(), lockedUntil).getSeconds();
          return Decision.blocked(Math.max(1L, seconds));
        }
        authLockouts.remove(bucketKey);
        authViolations.remove(bucketKey);
      }
    }

    Tier cfg = tierConfig(tier);
    Bucket bucket = buckets.computeIfAbsent(bucketKey, k -> newBucket(cfg));
    ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
    if (probe.isConsumed()) {
      if (tier == TierKind.AUTH) {
        authViolations.remove(bucketKey);
      }
      return Decision.ok();
    }

    long nanos = probe.getNanosToWaitForRefill();
    long retryAfter = Math.max(1L, (nanos + 999_999_999L) / 1_000_000_000L);

    if (tier == TierKind.AUTH) {
      int violations = authViolations.merge(bucketKey, 1, Integer::sum);
      if (violations >= Math.max(1, properties.getAuthLockoutAfterViolations())) {
        Instant until = Instant.now().plusSeconds(Math.max(1, properties.getAuthLockoutSeconds()));
        authLockouts.put(bucketKey, until);
        retryAfter = Math.max(retryAfter, properties.getAuthLockoutSeconds());
      }
    }

    return Decision.blocked(retryAfter);
  }

  /** Package-visible for tests. */
  void clear() {
    buckets.clear();
    authViolations.clear();
    authLockouts.clear();
  }

  private Tier tierConfig(TierKind tier) {
    return switch (tier) {
      case AUTH -> properties.getAuth();
      case PUBLIC_READ -> properties.getPublicRead();
      case PUBLIC_WRITE -> properties.getPublicWrite();
      case ADMIN -> properties.getAdmin();
    };
  }

  private static Bucket newBucket(Tier tier) {
    int capacity = Math.max(1, tier.getCapacity());
    int windowSeconds = Math.max(1, tier.getWindowSeconds());
    return Bucket.builder()
        .addLimit(
            limit ->
                limit.capacity(capacity).refillGreedy(capacity, Duration.ofSeconds(windowSeconds)))
        .build();
  }
}
