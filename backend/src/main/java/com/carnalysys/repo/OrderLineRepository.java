package com.carnalysys.repo;

import com.carnalysys.domain.OrderLine;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderLineRepository extends JpaRepository<OrderLine, UUID> {

  List<OrderLine> findByOrder_Id(String orderId);

  @Query(
      value =
          """
          SELECT p.category_slug, COALESCE(SUM(ol.line_total_inr), 0)
          FROM order_lines ol
          INNER JOIN products p ON p.id = ol.product_id
          INNER JOIN orders o ON o.id = ol.order_id
          WHERE o.status::text NOT IN ('draft', 'cancelled', 'refunded')
          GROUP BY p.category_slug
          """,
      nativeQuery = true)
  List<Object[]> sumLineTotalsInrByCategorySlug();

  /**
   * Parts by product category for dashboard pie chart.
   * Intentionally matches {@code buildRevenueVsPurchasesSeries}: every order with a placed_at
   * (no status exclusion), so slice revenue totals align with the revenue-vs-items line chart.
   * Uncategorized / missing product rows are bucketed as "Uncategorized".
   */
  @Query(
      value =
          """
          SELECT COALESCE(
                   NULLIF(trim(c.name), ''),
                   NULLIF(trim(p.category_slug), ''),
                   'Uncategorized'
                 ) AS category,
                 COALESCE(SUM(ol.quantity), 0) AS units,
                 COALESCE(SUM(ol.line_total_inr), 0) AS revenue
          FROM order_lines ol
          INNER JOIN orders o ON o.id = ol.order_id
          LEFT JOIN products p ON p.id = ol.product_id
          LEFT JOIN categories c ON c.slug = p.category_slug
          WHERE o.placed_at IS NOT NULL
          GROUP BY COALESCE(
                     NULLIF(trim(c.name), ''),
                     NULLIF(trim(p.category_slug), ''),
                     'Uncategorized'
                   )
          ORDER BY revenue DESC, category ASC
          """,
      nativeQuery = true)
  List<Object[]> sumSoldByCategory();

  @Query(
      value =
          """
          SELECT ol.product_id, COALESCE(SUM(ol.quantity), 0), COALESCE(SUM(ol.line_total_inr), 0)
          FROM order_lines ol
          INNER JOIN orders o ON o.id = ol.order_id
          WHERE o.status::text NOT IN ('draft', 'cancelled', 'refunded')
          GROUP BY ol.product_id
          """,
      nativeQuery = true)
  List<Object[]> sumSoldAndRevenueByProductId();

  @Query(
      value =
          """
          SELECT ol.product_id, COALESCE(SUM(ol.quantity), 0)
          FROM order_lines ol
          INNER JOIN orders o ON o.id = ol.order_id
          INNER JOIN product_fitment_cars pfc ON pfc.product_id = ol.product_id
          WHERE pfc.car_id = :carId
            AND o.status::text NOT IN ('draft', 'cancelled', 'refunded')
          GROUP BY ol.product_id
          """,
      nativeQuery = true)
  List<Object[]> sumSoldQuantityByProductIdForCar(@Param("carId") String carId);

  /**
   * Distinct catalog cars that have at least one sold unit of a fitted product (excludes
   * draft/cancelled/refunded orders — same rule as per-car parts-summary).
   */
  @Query(
      value =
          """
          SELECT COUNT(DISTINCT pfc.car_id)
          FROM product_fitment_cars pfc
          INNER JOIN order_lines ol ON ol.product_id = pfc.product_id
          INNER JOIN orders o ON o.id = ol.order_id
          INNER JOIN car_models cm ON cm.id = pfc.car_id
          WHERE cm.deleted_at IS NULL
            AND o.status::text NOT IN ('draft', 'cancelled', 'refunded')
          """,
      nativeQuery = true)
  long countDistinctPurchasedCars();

  /** Sales report: revenue + units bucketed by UTC day (qualifying orders only). */
  @Query(
      value =
          """
          SELECT to_char(o.placed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS period,
                 COALESCE(SUM(ol.line_total_inr), 0),
                 COALESCE(SUM(ol.quantity), 0)
          FROM order_lines ol
          INNER JOIN orders o ON o.id = ol.order_id
          WHERE o.status::text NOT IN ('draft', 'cancelled', 'refunded')
            AND o.placed_at IS NOT NULL
            AND (CAST(:startAt AS timestamptz) IS NULL OR o.placed_at >= :startAt)
            AND (CAST(:endAt AS timestamptz) IS NULL OR o.placed_at < :endAt)
          GROUP BY period
          ORDER BY period
          """,
      nativeQuery = true)
  List<Object[]> salesReportTimeSeriesDay(
      @Param("startAt") Instant startAt, @Param("endAt") Instant endAt);

  @Query(
      value =
          """
          SELECT to_char(o.placed_at AT TIME ZONE 'UTC', 'YYYY-MM') AS period,
                 COALESCE(SUM(ol.line_total_inr), 0),
                 COALESCE(SUM(ol.quantity), 0)
          FROM order_lines ol
          INNER JOIN orders o ON o.id = ol.order_id
          WHERE o.status::text NOT IN ('draft', 'cancelled', 'refunded')
            AND o.placed_at IS NOT NULL
            AND (CAST(:startAt AS timestamptz) IS NULL OR o.placed_at >= :startAt)
            AND (CAST(:endAt AS timestamptz) IS NULL OR o.placed_at < :endAt)
          GROUP BY period
          ORDER BY period
          """,
      nativeQuery = true)
  List<Object[]> salesReportTimeSeriesMonth(
      @Param("startAt") Instant startAt, @Param("endAt") Instant endAt);

  @Query(
      value =
          """
          SELECT to_char(o.placed_at AT TIME ZONE 'UTC', 'YYYY') AS period,
                 COALESCE(SUM(ol.line_total_inr), 0),
                 COALESCE(SUM(ol.quantity), 0)
          FROM order_lines ol
          INNER JOIN orders o ON o.id = ol.order_id
          WHERE o.status::text NOT IN ('draft', 'cancelled', 'refunded')
            AND o.placed_at IS NOT NULL
            AND (CAST(:startAt AS timestamptz) IS NULL OR o.placed_at >= :startAt)
            AND (CAST(:endAt AS timestamptz) IS NULL OR o.placed_at < :endAt)
          GROUP BY period
          ORDER BY period
          """,
      nativeQuery = true)
  List<Object[]> salesReportTimeSeriesYear(
      @Param("startAt") Instant startAt, @Param("endAt") Instant endAt);

  @Query(
      value =
          """
          SELECT COALESCE(SUM(ol.line_total_inr), 0), COALESCE(SUM(ol.quantity), 0)
          FROM order_lines ol
          INNER JOIN orders o ON o.id = ol.order_id
          WHERE o.status::text NOT IN ('draft', 'cancelled', 'refunded')
            AND o.placed_at IS NOT NULL
            AND (CAST(:startAt AS timestamptz) IS NULL OR o.placed_at >= :startAt)
            AND (CAST(:endAt AS timestamptz) IS NULL OR o.placed_at < :endAt)
          """,
      nativeQuery = true)
  Object[] salesReportSummary(@Param("startAt") Instant startAt, @Param("endAt") Instant endAt);

  @Query(
      value =
          """
          SELECT ol.product_id, COALESCE(SUM(ol.quantity), 0), COALESCE(SUM(ol.line_total_inr), 0)
          FROM order_lines ol
          INNER JOIN orders o ON o.id = ol.order_id
          WHERE o.status::text NOT IN ('draft', 'cancelled', 'refunded')
            AND o.placed_at IS NOT NULL
            AND (CAST(:startAt AS timestamptz) IS NULL OR o.placed_at >= :startAt)
            AND (CAST(:endAt AS timestamptz) IS NULL OR o.placed_at < :endAt)
          GROUP BY ol.product_id
          HAVING COALESCE(SUM(ol.quantity), 0) > 0
          """,
      nativeQuery = true)
  List<Object[]> salesReportByProductInRange(
      @Param("startAt") Instant startAt, @Param("endAt") Instant endAt);
}
