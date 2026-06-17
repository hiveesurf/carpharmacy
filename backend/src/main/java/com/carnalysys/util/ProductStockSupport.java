package com.carnalysys.util;

import com.carnalysys.domain.Product;

/** Admin inventory banding shared by all product types. */
public final class ProductStockSupport {

  private ProductStockSupport() {}

  public static boolean isOutOfStock(int stockQuantity) {
    return stockQuantity <= 0;
  }

  /** Stock in (0, threshold]. */
  public static boolean isAdminLowStock(int stockQuantity, int threshold) {
    return stockQuantity > 0 && stockQuantity <= threshold;
  }

  public static boolean isAdminLowStock(Product product, int threshold) {
    if (product == null) {
      return false;
    }
    return isAdminLowStock(product.getStockQuantity(), threshold);
  }

  public static boolean isInStock(int stockQuantity, int threshold) {
    return stockQuantity > threshold;
  }
}
