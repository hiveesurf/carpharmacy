package com.carnalysys.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class AdminAuthorizationFilterAuthoritiesTest {

  @Test
  void customNeverGetsSuperAdmin() {
    assertThat(AdminAuthorizationFilter.authoritiesFor("custom"))
        .extracting(SimpleGrantedAuthority::getAuthority)
        .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_CUSTOM")
        .doesNotContain("ROLE_SUPER_ADMIN");
  }

  @Test
  void unknownRoleNeverGetsSuperAdmin() {
    assertThat(AdminAuthorizationFilter.authoritiesFor("something_else"))
        .extracting(SimpleGrantedAuthority::getAuthority)
        .containsExactly("ROLE_ADMIN")
        .doesNotContain("ROLE_SUPER_ADMIN");
  }

  @Test
  void nullRoleNeverGetsSuperAdmin() {
    assertThat(AdminAuthorizationFilter.authoritiesFor(null))
        .extracting(SimpleGrantedAuthority::getAuthority)
        .containsExactly("ROLE_ADMIN")
        .doesNotContain("ROLE_SUPER_ADMIN");
  }

  @Test
  void salesAndDeliveryUnchanged() {
    assertThat(AdminAuthorizationFilter.authoritiesFor("sales"))
        .extracting(SimpleGrantedAuthority::getAuthority)
        .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_SALES");
    assertThat(AdminAuthorizationFilter.authoritiesFor("delivery"))
        .extracting(SimpleGrantedAuthority::getAuthority)
        .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_DELIVERY");
    assertThat(AdminAuthorizationFilter.authoritiesFor("super_admin"))
        .extracting(SimpleGrantedAuthority::getAuthority)
        .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_SUPER_ADMIN");
  }
}
