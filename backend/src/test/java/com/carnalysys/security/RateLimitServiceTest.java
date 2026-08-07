package com.carnalysys.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.carnalysys.config.RateLimitProperties;
import com.carnalysys.security.RateLimitService.Decision;
import com.carnalysys.security.RateLimitService.TierKind;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RateLimitServiceTest {

  private RateLimitProperties properties;
  private RateLimitService service;

  @BeforeEach
  void setUp() {
    properties = new RateLimitProperties();
    properties.setEnabled(true);
    properties.setAuth(new RateLimitProperties.Tier(3, 60));
    properties.setAuthLockoutAfterViolations(2);
    properties.setAuthLockoutSeconds(60);
    properties.setPublicRead(new RateLimitProperties.Tier(5, 60));
    properties.setPublicWrite(new RateLimitProperties.Tier(2, 60));
    properties.setAdmin(new RateLimitProperties.Tier(4, 60));
    service = new RateLimitService(properties);
  }

  @Test
  void allowsWithinCapacityThenBlocksWithRetryAfter() {
    assertThat(service.tryConsume(TierKind.PUBLIC_WRITE, "ip:1.1.1.1").allowed()).isTrue();
    assertThat(service.tryConsume(TierKind.PUBLIC_WRITE, "ip:1.1.1.1").allowed()).isTrue();
    Decision blocked = service.tryConsume(TierKind.PUBLIC_WRITE, "ip:1.1.1.1");
    assertThat(blocked.allowed()).isFalse();
    assertThat(blocked.retryAfterSeconds()).isGreaterThanOrEqualTo(1L);
  }

  @Test
  void tracksDifferentKeysIndependently() {
    assertThat(service.tryConsume(TierKind.PUBLIC_WRITE, "ip:a").allowed()).isTrue();
    assertThat(service.tryConsume(TierKind.PUBLIC_WRITE, "ip:a").allowed()).isTrue();
    assertThat(service.tryConsume(TierKind.PUBLIC_WRITE, "ip:a").allowed()).isFalse();

    assertThat(service.tryConsume(TierKind.PUBLIC_WRITE, "ip:b").allowed()).isTrue();
  }

  @Test
  void authLockoutTriggersAfterRepeatedViolations() {
    service.tryConsume(TierKind.AUTH, "ip:brute");
    service.tryConsume(TierKind.AUTH, "ip:brute");
    service.tryConsume(TierKind.AUTH, "ip:brute");
    // capacity exhausted
    Decision firstHit = service.tryConsume(TierKind.AUTH, "ip:brute");
    assertThat(firstHit.allowed()).isFalse();
    Decision secondHit = service.tryConsume(TierKind.AUTH, "ip:brute");
    assertThat(secondHit.allowed()).isFalse();
    // lockout after 2 violations — subsequent attempts still blocked with long retry
    Decision locked = service.tryConsume(TierKind.AUTH, "ip:brute");
    assertThat(locked.allowed()).isFalse();
    assertThat(locked.retryAfterSeconds()).isGreaterThanOrEqualTo(1L);
  }

  @Test
  void disabledAlwaysAllows() {
    properties.setEnabled(false);
    for (int i = 0; i < 20; i++) {
      assertThat(service.tryConsume(TierKind.AUTH, "ip:x").allowed()).isTrue();
    }
  }
}
