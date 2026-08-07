package com.carnalysys.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "custom_role_permissions")
@IdClass(CustomRolePermission.Pk.class)
public class CustomRolePermission {

  @Id
  @Column(name = "role_id", nullable = false)
  private UUID roleId;

  @Id
  @Column(name = "page_key", nullable = false)
  private String pageKey;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public CustomRolePermission() {}

  public CustomRolePermission(UUID roleId, String pageKey) {
    this.roleId = roleId;
    this.pageKey = pageKey;
    this.createdAt = Instant.now();
  }

  public UUID getRoleId() {
    return roleId;
  }

  public void setRoleId(UUID roleId) {
    this.roleId = roleId;
  }

  public String getPageKey() {
    return pageKey;
  }

  public void setPageKey(String pageKey) {
    this.pageKey = pageKey;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }

  public static class Pk implements Serializable {
    private UUID roleId;
    private String pageKey;

    public Pk() {}

    public Pk(UUID roleId, String pageKey) {
      this.roleId = roleId;
      this.pageKey = pageKey;
    }

    public UUID getRoleId() {
      return roleId;
    }

    public void setRoleId(UUID roleId) {
      this.roleId = roleId;
    }

    public String getPageKey() {
      return pageKey;
    }

    public void setPageKey(String pageKey) {
      this.pageKey = pageKey;
    }

    @Override
    public boolean equals(Object o) {
      if (this == o) {
        return true;
      }
      if (!(o instanceof Pk pk)) {
        return false;
      }
      return Objects.equals(roleId, pk.roleId) && Objects.equals(pageKey, pk.pageKey);
    }

    @Override
    public int hashCode() {
      return Objects.hash(roleId, pageKey);
    }
  }
}
