package com.carnalysys.testsupport;

import com.carnalysys.config.AppProperties;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Shared beans for controller slices: real {@link AppProperties} (so {@link
 * com.carnalysys.config.WebConfig} can run at refresh) and a minimal {@link SecurityFilterChain}
 * (CSRF off, permit-all) so {@code MockMvc} can use {@code addFilters=true} with Spring Security
 * test {@code RequestPostProcessors} without 403 on POST.
 */
@TestConfiguration
public class WebMvcSliceTestConfiguration {

  @Bean
  @Primary
  AppProperties testAppProperties() {
    return new AppProperties(
        new AppProperties.Jwt("unit-test-jwt-secret-placeholder-32b", 3600),
        new AppProperties.RefreshToken(3600),
        new AppProperties.Otp(300),
        new AppProperties.Delivery(900, 30),
        new AppProperties.Cors("http://localhost:5173"),
        new AppProperties.Payment(
            "mockpay", "rzp_test_key", "rzp_test_secret", "test-webhook-secret", 600, 300000, 30));
  }

  @Bean
  @Order(0)
  SecurityFilterChain sliceTestSecurityFilterChain(HttpSecurity http) throws Exception {
    return http.securityMatcher("/**")
        .csrf(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(a -> a.anyRequest().permitAll())
        .build();
  }
}
