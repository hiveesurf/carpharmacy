package com.carnalysys.util;

import static org.assertj.core.api.Assertions.assertThat;

import com.carnalysys.domain.Product;
import com.carnalysys.domain.ProductType;
import org.junit.jupiter.api.Test;

class ProductStockSupportTest {

  private static final int THRESHOLD = 5;

  @Test
  void vehicleStockZero_isOutOfStock() {
    assertThat(ProductStockSupport.isOutOfStock(0)).isTrue();
    assertThat(ProductStockSupport.isAdminLowStock(0, THRESHOLD)).isFalse();
    assertThat(ProductStockSupport.isInStock(0, THRESHOLD)).isFalse();
  }

  @Test
  void vehicleStockThree_isLowStock() {
    assertThat(ProductStockSupport.isOutOfStock(3)).isFalse();
    assertThat(ProductStockSupport.isAdminLowStock(3, THRESHOLD)).isTrue();
    assertThat(ProductStockSupport.isInStock(3, THRESHOLD)).isFalse();
  }

  @Test
  void vehicleStockFive_isLowStock() {
    assertThat(ProductStockSupport.isAdminLowStock(5, THRESHOLD)).isTrue();
    assertThat(ProductStockSupport.isInStock(5, THRESHOLD)).isFalse();
  }

  @Test
  void vehicleStockSix_isInStock() {
    assertThat(ProductStockSupport.isAdminLowStock(6, THRESHOLD)).isFalse();
    assertThat(ProductStockSupport.isInStock(6, THRESHOLD)).isTrue();
  }

  @Test
  void vehicleStockTen_afterRestock_isInStock() {
    assertThat(ProductStockSupport.isAdminLowStock(10, THRESHOLD)).isFalse();
    assertThat(ProductStockSupport.isInStock(10, THRESHOLD)).isTrue();
  }

  @Test
  void partBelowThreshold_isLowStock() {
    assertThat(ProductStockSupport.isOutOfStock(2)).isFalse();
    assertThat(ProductStockSupport.isAdminLowStock(2, THRESHOLD)).isTrue();
    assertThat(ProductStockSupport.isInStock(2, THRESHOLD)).isFalse();
  }

  @Test
  void partAboveThreshold_isInStock() {
    assertThat(ProductStockSupport.isAdminLowStock(10, THRESHOLD)).isFalse();
    assertThat(ProductStockSupport.isInStock(10, THRESHOLD)).isTrue();
  }

  @Test
  void partZero_isOutOfStock_notLowStock() {
    assertThat(ProductStockSupport.isOutOfStock(0)).isTrue();
    assertThat(ProductStockSupport.isAdminLowStock(0, THRESHOLD)).isFalse();
  }

  @Test
  void vehicleAtOne_isLowStock_viaProductHelper() {
    Product vehicle = new Product();
    vehicle.setType(ProductType.vehicle);
    vehicle.setStockQuantity(1);
    assertThat(ProductStockSupport.isAdminLowStock(vehicle, THRESHOLD)).isTrue();
    assertThat(ProductStockSupport.isInStock(vehicle.getStockQuantity(), THRESHOLD)).isFalse();
  }
}
