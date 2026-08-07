package com.carnalysys.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "addresses")
public class AddressEntity {

  @Id private UUID id = UUID.randomUUID();

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private UserEntity user;

  @Column(nullable = false)
  private String line1;

  private String line2;

  @Column(nullable = false)
  private String city;

  private String state;

  @Column(nullable = false, length = 12)
  private String pincode;

  @JdbcTypeCode(SqlTypes.CHAR)
  @Column(nullable = false, length = 2)
  private String country = "IN";

  private String label;

  @Column(name = "gst_number", length = 15)
  private String gstNumber;

  @Column(name = "is_default", nullable = false)
  private boolean defaultAddress;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "deleted_at")
  private Instant deletedAt;

  public UUID getId() {
    return id;
  }

  public UserEntity getUser() {
    return user;
  }

  public void setUser(UserEntity user) {
    this.user = user;
  }

  public String getLine1() {
    return line1;
  }

  public void setLine1(String line1) {
    this.line1 = line1;
  }

  public String getLine2() {
    return line2;
  }

  public void setLine2(String line2) {
    this.line2 = line2;
  }

  public String getCity() {
    return city;
  }

  public void setCity(String city) {
    this.city = city;
  }

  public String getState() {
    return state;
  }

  public void setState(String state) {
    this.state = state;
  }

  public String getPincode() {
    return pincode;
  }

  public void setPincode(String pincode) {
    this.pincode = pincode;
  }

  public String getCountry() {
    return country;
  }

  public void setCountry(String country) {
    this.country = country;
  }

  public String getLabel() {
    return label;
  }

  public void setLabel(String label) {
    this.label = label;
  }

  public String getGstNumber() {
    return gstNumber;
  }

  public void setGstNumber(String gstNumber) {
    this.gstNumber = gstNumber;
  }

  public boolean isDefaultAddress() {
    return defaultAddress;
  }

  public void setDefaultAddress(boolean defaultAddress) {
    this.defaultAddress = defaultAddress;
  }

  public Instant getDeletedAt() {
    return deletedAt;
  }

  public void setDeletedAt(Instant deletedAt) {
    this.deletedAt = deletedAt;
  }
}
