package com.carnalysys.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.carnalysys.domain.AdminPageKey;
import org.junit.jupiter.api.Test;

class AdminPageAccessTest {

  @Test
  void allowList_notificationsAndMe() {
    assertThat(AdminPageAccess.resolve("/api/v1/admin/me").decision())
        .isEqualTo(AdminPageAccess.Decision.ALLOW_WITHOUT_PAGE_CHECK);
    assertThat(AdminPageAccess.resolve("/api/v1/admin/notifications").decision())
        .isEqualTo(AdminPageAccess.Decision.ALLOW_WITHOUT_PAGE_CHECK);
    assertThat(AdminPageAccess.resolve("/api/v1/admin/notifications/unread-count").decision())
        .isEqualTo(AdminPageAccess.Decision.ALLOW_WITHOUT_PAGE_CHECK);
  }

  @Test
  void knownPrefixes_requirePageKeys() {
    assertThat(AdminPageAccess.resolve("/api/v1/admin/dashboard"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.analytics));
    assertThat(AdminPageAccess.resolve("/api/v1/admin/products/import-excel"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.inventory));
    assertThat(AdminPageAccess.resolve("/api/v1/admin/cars/some-id/parts-summary"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.cars));
    assertThat(AdminPageAccess.resolve("/api/v1/admin/cars/purchased-summary"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.cars));
    assertThat(AdminPageAccess.resolve("/api/v1/admin/categories"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.categories));
    assertThat(AdminPageAccess.resolve("/api/v1/admin/sales-report"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.sales_report));
    assertThat(AdminPageAccess.resolve("/api/v1/admin/reconciliation"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.reconciliation));
    assertThat(AdminPageAccess.resolve("/api/v1/admin/reconciliation/export"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.reconciliation));
    assertThat(AdminPageAccess.resolve("/api/v1/admin/users/1/profile"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.users));
    assertThat(AdminPageAccess.resolve("/api/v1/admin/employees"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.employees));
    assertThat(AdminPageAccess.resolve("/api/v1/admin/custom-roles"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.employees));
    assertThat(AdminPageAccess.resolve("/api/v1/admin/orders/abc/status"))
        .isEqualTo(AdminPageAccess.Resolution.require(AdminPageKey.orders));
  }

  @Test
  void unmappedPaths_defaultDeny_includingDeliveryAndFutureEndpoints() {
    assertThat(AdminPageAccess.resolve("/api/v1/admin/delivery/orders").decision())
        .isEqualTo(AdminPageAccess.Decision.DENY);
    assertThat(AdminPageAccess.resolve("/api/v1/admin/delivery/me/summary").decision())
        .isEqualTo(AdminPageAccess.Decision.DENY);
    assertThat(AdminPageAccess.resolve("/api/v1/admin/brand-new-feature").decision())
        .isEqualTo(AdminPageAccess.Decision.DENY);
    assertThat(AdminPageAccess.resolve("/api/v1/admin").decision())
        .isEqualTo(AdminPageAccess.Decision.DENY);
  }
}
