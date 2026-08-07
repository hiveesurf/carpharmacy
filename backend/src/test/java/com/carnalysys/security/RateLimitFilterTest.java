package com.carnalysys.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.carnalysys.config.RateLimitProperties;
import com.carnalysys.security.RateLimitService.Decision;
import com.carnalysys.security.RateLimitService.TierKind;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {

  @Mock private RateLimitService rateLimitService;

  private RateLimitProperties properties;
  private RateLimitFilter filter;

  @BeforeEach
  void setUp() {
    properties = new RateLimitProperties();
    properties.setEnabled(true);
    properties.setExcludePathPrefixes(
        List.of("/api/v1/payments/webhook", "/api/v1/health", "/actuator/health"));
    filter = new RateLimitFilter(properties, rateLimitService, new ObjectMapper());
  }

  @Test
  void returns429WithRetryAfterWhenLimited() throws Exception {
    when(rateLimitService.tryConsume(eq(TierKind.AUTH), anyString()))
        .thenReturn(Decision.blocked(42));

    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/send-otp");
    request.addHeader("X-Forwarded-For", "203.0.113.10");
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = new MockFilterChain();

    filter.doFilter(request, response, chain);

    assertThat(response.getStatus()).isEqualTo(429);
    assertThat(response.getHeader("Retry-After")).isEqualTo("42");
    assertThat(response.getContentAsString()).contains("RATE_LIMITED");
    verify(rateLimitService).tryConsume(eq(TierKind.AUTH), eq("ip:203.0.113.10"));
  }

  @Test
  void excludesPaymentWebhookFromRateLimiting() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/payments/webhook");
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = new MockFilterChain();

    filter.doFilter(request, response, chain);

    verify(rateLimitService, never()).tryConsume(any(), anyString());
    assertThat(response.getStatus()).isEqualTo(200);
  }

  @Test
  void excludesHealthFromRateLimiting() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
    MockHttpServletResponse response = new MockHttpServletResponse();
    filter.doFilter(request, response, new MockFilterChain());
    verify(rateLimitService, never()).tryConsume(any(), anyString());
  }

  @Test
  void resolveTierMapsAuthAdminAndReadWrite() {
    assertThat(RateLimitFilter.resolveTier("/api/v1/auth/send-otp", "POST"))
        .isEqualTo(TierKind.AUTH);
    assertThat(RateLimitFilter.resolveTier("/api/v1/auth/verify-otp", "POST"))
        .isEqualTo(TierKind.AUTH);
    assertThat(RateLimitFilter.resolveTier("/api/v1/admin/orders", "GET"))
        .isEqualTo(TierKind.ADMIN);
    assertThat(RateLimitFilter.resolveTier("/api/v1/products", "GET"))
        .isEqualTo(TierKind.PUBLIC_READ);
    assertThat(RateLimitFilter.resolveTier("/api/v1/orders", "POST"))
        .isEqualTo(TierKind.PUBLIC_WRITE);
  }

  @Test
  void clientIpResolverPrefersXForwardedFor() {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader("X-Forwarded-For", "198.51.100.7, 10.0.0.1");
    request.setRemoteAddr("10.0.0.1");
    assertThat(ClientIpResolver.resolve(request)).isEqualTo("198.51.100.7");
  }
}
