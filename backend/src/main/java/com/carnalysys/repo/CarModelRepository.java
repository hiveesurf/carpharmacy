package com.carnalysys.repo;

import com.carnalysys.domain.CarModelEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CarModelRepository
    extends JpaRepository<CarModelEntity, String>, JpaSpecificationExecutor<CarModelEntity> {
  List<CarModelEntity> findByPublishedTrueOrderByMakeAscModelAscModelYearDesc();

  List<CarModelEntity> findByMakeIgnoreCaseOrderByMakeAscModelAscModelYearDesc(String make);

  List<CarModelEntity> findByPublishedTrueAndMakeIgnoreCaseOrderByMakeAscModelAscModelYearDesc(
      String make);

  Page<CarModelEntity> findByMakeIgnoreCase(String make, Pageable pageable);

  List<CarModelEntity> findByDeletedAtIsNullOrderByMakeAscModelAscModelYearDesc();

  List<CarModelEntity> findByPublishedTrueAndDeletedAtIsNullOrderByMakeAscModelAscModelYearDesc();

  List<CarModelEntity> findByMakeIgnoreCaseAndDeletedAtIsNullOrderByMakeAscModelAscModelYearDesc(
      String make);

  List<CarModelEntity>
      findByPublishedTrueAndMakeIgnoreCaseAndDeletedAtIsNullOrderByMakeAscModelAscModelYearDesc(
          String make);

  Page<CarModelEntity> findByMakeIgnoreCaseAndDeletedAtIsNull(String make, Pageable pageable);

  Page<CarModelEntity> findByDeletedAtIsNull(Pageable pageable);

  Page<CarModelEntity> findByDeletedAtIsNullAndMakeIgnoreCase(String make, Pageable pageable);

  Page<CarModelEntity> findByPublishedTrueAndDeletedAtIsNull(Pageable pageable);

  Page<CarModelEntity> findByPublishedTrueAndDeletedAtIsNullAndMakeIgnoreCase(
      String make, Pageable pageable);

  /**
   * Row matching normalized vehicle identity (trim, collapsed whitespace, case-insensitive text).
   * {@code excludeId} skips the current row on update.
   */
  @Query(
      value =
          """
          SELECT * FROM car_models c
          WHERE lower(regexp_replace(trim(c.make), '\\s+', ' ', 'g')) = :makeKey
            AND lower(regexp_replace(trim(c.model), '\\s+', ' ', 'g')) = :modelKey
            AND coalesce(c.model_year, -1::smallint) = coalesce(:modelYear, -1::smallint)
            AND lower(regexp_replace(trim(coalesce(c.variant, '')), '\\s+', ' ', 'g')) = :variantKey
            AND lower(regexp_replace(trim(coalesce(c.fuel, '')), '\\s+', ' ', 'g')) = :fuelKey
            AND (:excludeId IS NULL OR c.id <> :excludeId)
          LIMIT 1
          """,
      nativeQuery = true)
  Optional<CarModelEntity> findIdentityMatch(
      @Param("makeKey") String makeKey,
      @Param("modelKey") String modelKey,
      @Param("modelYear") Short modelYear,
      @Param("variantKey") String variantKey,
      @Param("fuelKey") String fuelKey,
      @Param("excludeId") String excludeId);
}
