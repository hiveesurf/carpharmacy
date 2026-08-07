package com.carnalysys.domain;

public enum UserRole {
  user,
  super_admin,
  sales,
  delivery,
  custom;

  public static UserRole from(String raw) {
    if (raw == null || raw.isBlank()) return user;
    try {
      return UserRole.valueOf(raw.trim().toLowerCase());
    } catch (Exception ignored) {
      return user;
    }
  }
}
