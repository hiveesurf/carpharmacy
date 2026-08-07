package com.carnalysys.domain;

import java.util.Locale;
import java.util.Optional;

/** Permissionable admin panel pages (matches custom_role_permissions.page_key CHECK). */
public enum AdminPageKey {
  analytics,
  inventory,
  cars,
  categories,
  users,
  employees,
  orders,
  sales_report,
  reconciliation;

  public static Optional<AdminPageKey> parse(String raw) {
    if (raw == null || raw.isBlank()) {
      return Optional.empty();
    }
    try {
      return Optional.of(AdminPageKey.valueOf(raw.trim().toLowerCase(Locale.ROOT)));
    } catch (IllegalArgumentException ex) {
      return Optional.empty();
    }
  }

  public static AdminPageKey require(String raw) {
    return parse(raw)
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    "Invalid page key: "
                        + raw
                        + " (allowed: analytics, inventory, cars, categories, users, employees, orders, sales_report, reconciliation)"));
  }
}
