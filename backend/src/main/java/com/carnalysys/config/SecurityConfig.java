package com.carnalysys.config;

import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.CustomRolePermissionRepository;
import com.carnalysys.repo.UserRepository;
import com.carnalysys.security.AdminAuthorizationFilter;
import com.carnalysys.security.JwtAuthenticationFilter;
import com.carnalysys.security.JwtService;
import com.carnalysys.security.RateLimitFilter;
import com.carnalysys.security.RateLimitService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Bean
  JwtAuthenticationFilter jwtAuthenticationFilter(JwtService jwtService) {
    return new JwtAuthenticationFilter(jwtService);
  }

  @Bean
  RateLimitFilter rateLimitFilter(
      RateLimitProperties rateLimitProperties,
      RateLimitService rateLimitService,
      ObjectMapper objectMapper) {
    return new RateLimitFilter(rateLimitProperties, rateLimitService, objectMapper);
  }

  @Bean
  @Order(1)
  SecurityFilterChain adminChain(
      HttpSecurity http,
      AdminUserRepository adminUserRepository,
      UserRepository userRepository,
      CustomRolePermissionRepository customRolePermissionRepository,
      ObjectMapper objectMapper,
      JwtAuthenticationFilter jwtAuthenticationFilter,
      RateLimitFilter rateLimitFilter)
      throws Exception {
    var adminFilter =
        new AdminAuthorizationFilter(
            objectMapper, adminUserRepository, userRepository, customRolePermissionRepository);
    return http.securityMatcher("/api/v1/admin/**")
        .csrf(AbstractHttpConfigurer::disable)
        .cors(Customizer.withDefaults())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers("/api/v1/admin/delivery/me/availability")
                    .hasRole("DELIVERY")
                    .requestMatchers("/api/v1/admin/employees/**")
                    .hasRole("SUPER_ADMIN")
                    .requestMatchers("/api/v1/admin/custom-roles/**")
                    .hasRole("SUPER_ADMIN")
                    .requestMatchers("/api/v1/admin/orders/*/assign-delivery")
                    .hasRole("SUPER_ADMIN")
                    .requestMatchers("/api/v1/admin/products/**")
                    .hasAnyRole("SUPER_ADMIN", "SALES", "CUSTOM")
                    .requestMatchers("/api/v1/admin/orders/**")
                    .hasAnyRole("SUPER_ADMIN", "SALES", "DELIVERY", "CUSTOM")
                    .anyRequest()
                    .hasAnyRole("SUPER_ADMIN", "SALES", "DELIVERY", "CUSTOM"))
        .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
        .addFilterAfter(rateLimitFilter, JwtAuthenticationFilter.class)
        .addFilterAfter(adminFilter, RateLimitFilter.class)
        .build();
  }

  @Bean
  @Order(2)
  SecurityFilterChain apiChain(
      HttpSecurity http,
      JwtAuthenticationFilter jwtAuthenticationFilter,
      RateLimitFilter rateLimitFilter)
      throws Exception {
    return http.csrf(AbstractHttpConfigurer::disable)
        .cors(Customizer.withDefaults())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(a -> a.anyRequest().permitAll())
        .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
        .addFilterAfter(rateLimitFilter, JwtAuthenticationFilter.class)
        .build();
  }
}
