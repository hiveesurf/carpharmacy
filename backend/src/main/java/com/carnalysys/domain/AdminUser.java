package com.carnalysys.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "admin_users")
public class AdminUser {

  @Id private UUID id = UUID.randomUUID();

  @Column(nullable = false, unique = true)
  private String email;

  /** Legacy column; admin auth uses phone + OTP only. */
  @Column(name = "password_hash")
  private String passwordHash;

  @Column(name = "phone_e164")
  private String phoneE164;

  @Column(nullable = false)
  private String role = "super_admin";

  /** Set only when {@code role = custom}; null for sales/delivery/super_admin. */
  @Column(name = "custom_role_id")
  private UUID customRoleId;

  @Column(name = "full_name")
  private String fullName;

  @Column(name = "photo_url")
  private String photoUrl;

  @Column(name = "last_logout_at")
  private Instant lastLogoutAt;

  @Column(name = "availability_status", nullable = false)
  private String availabilityStatus = "pending";

  @Column(name = "last_login_at")
  private Instant lastLoginAt;

  @Column(name = "onboarding_status", nullable = false)
  private String onboardingStatus = "pending";

  @Column(name = "first_login_at")
  private Instant firstLoginAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "deleted_at")
  private Instant deletedAt;

  @Column(name = "deleted_reason")
  private String deletedReason;

  @Column(name = "deleted_by")
  private String deletedBy;

  public UUID getId() {
    return id;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public void setPasswordHash(String passwordHash) {
    this.passwordHash = passwordHash;
  }

  public String getPhoneE164() {
    return phoneE164;
  }

  public void setPhoneE164(String phoneE164) {
    this.phoneE164 = phoneE164;
  }

  public String getRole() {
    return role;
  }

  public void setRole(String role) {
    this.role = role;
  }

  public UUID getCustomRoleId() {
    return customRoleId;
  }

  public void setCustomRoleId(UUID customRoleId) {
    this.customRoleId = customRoleId;
  }

  public String getFullName() {
    return fullName;
  }

  public void setFullName(String fullName) {
    this.fullName = fullName;
  }

  public String getPhotoUrl() {
    return photoUrl;
  }

  public void setPhotoUrl(String photoUrl) {
    this.photoUrl = photoUrl;
  }

  public Instant getLastLoginAt() {
    return lastLoginAt;
  }

  public void setLastLoginAt(Instant lastLoginAt) {
    this.lastLoginAt = lastLoginAt;
  }

  public Instant getLastLogoutAt() {
    return lastLogoutAt;
  }

  public void setLastLogoutAt(Instant lastLogoutAt) {
    this.lastLogoutAt = lastLogoutAt;
  }

  public String getAvailabilityStatus() {
    return availabilityStatus;
  }

  public void setAvailabilityStatus(String availabilityStatus) {
    this.availabilityStatus = availabilityStatus;
  }

  public String getOnboardingStatus() {
    return onboardingStatus;
  }

  public void setOnboardingStatus(String onboardingStatus) {
    this.onboardingStatus = onboardingStatus;
  }

  public Instant getFirstLoginAt() {
    return firstLoginAt;
  }

  public void setFirstLoginAt(Instant firstLoginAt) {
    this.firstLoginAt = firstLoginAt;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant updatedAt) {
    this.updatedAt = updatedAt;
  }

  public Instant getDeletedAt() {
    return deletedAt;
  }

  public void setDeletedAt(Instant deletedAt) {
    this.deletedAt = deletedAt;
  }

  public String getDeletedReason() {
    return deletedReason;
  }

  public void setDeletedReason(String deletedReason) {
    this.deletedReason = deletedReason;
  }

  public String getDeletedBy() {
    return deletedBy;
  }

  public void setDeletedBy(String deletedBy) {
    this.deletedBy = deletedBy;
  }
}
