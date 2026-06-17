package com.carnalysys.service;

import com.carnalysys.domain.Product;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.springframework.data.jpa.domain.Specification;

final class AdminProductSpecifications {

  static final int LOW_STOCK_THRESHOLD = 5;

  private AdminProductSpecifications() {}

  static Specification<Product> build(String search, boolean lowStockOnly) {
    Specification<Product> spec = notDeleted().and(searchMatches(search));
    if (lowStockOnly) {
      spec = spec.and(lowStock(LOW_STOCK_THRESHOLD));
    }
    return spec;
  }

  /** Active products with stock in (0, threshold]. */
  static Specification<Product> adminLowStockCount() {
    return notDeleted().and(lowStock(LOW_STOCK_THRESHOLD));
  }

  private static Specification<Product> lowStock(int threshold) {
    return (root, query, cb) ->
        cb.and(
            cb.greaterThan(root.get("stockQuantity"), 0),
            cb.lessThanOrEqualTo(root.get("stockQuantity"), threshold));
  }

  private static Specification<Product> notDeleted() {
    return (root, query, cb) -> cb.isNull(root.get("deletedAt"));
  }

  private static Specification<Product> searchMatches(String searchRaw) {
    if (searchRaw == null || searchRaw.isBlank()) {
      return (root, query, cb) -> cb.conjunction();
    }
    String q = "%" + searchRaw.toLowerCase().trim() + "%";
    return (root, query, cb) ->
        cb.or(
            cb.like(cb.lower(root.get("name")), q),
            cb.like(cb.lower(root.get("sku")), q),
            metadataFieldLike(root, cb, "brand", q),
            metadataFieldLike(root, cb, "partNumber", q));
  }

  private static Predicate metadataFieldLike(
      Root<Product> root,
      jakarta.persistence.criteria.CriteriaBuilder cb,
      String key,
      String pattern) {
    Expression<String> extracted =
        cb.function(
            "jsonb_extract_path_text",
            String.class,
            root.get("metadata"),
            cb.literal(key));
    return cb.like(cb.lower(extracted), pattern);
  }
}
