package com.carnalysys.repo;

import com.carnalysys.domain.OrderEntity;
import com.carnalysys.domain.OrderStatus;
import com.carnalysys.domain.PaymentStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<OrderEntity, String> {

  List<OrderEntity> findByUser_IdOrderByPlacedAtDesc(UUID userId);
  Page<OrderEntity> findByUser_IdOrderByPlacedAtDesc(UUID userId, Pageable pageable);

  Optional<OrderEntity> findByIdAndUser_Id(String id, UUID userId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select o from OrderEntity o where o.id = :id")
  Optional<OrderEntity> findByIdForUpdate(@Param("id") String id);

  List<OrderEntity> findByUser_PhoneE164OrderByPlacedAtDesc(String phoneE164);
  Page<OrderEntity> findByUser_PhoneE164OrderByPlacedAtDesc(String phoneE164, Pageable pageable);

  List<OrderEntity> findByPaymentStatusAndPlacedAtBeforeOrderByPlacedAtAsc(
      PaymentStatus paymentStatus, Instant placedAt);

  List<OrderEntity> findByAssignedDeliveryAdminEmailOrderByPlacedAtDesc(String assignedDeliveryAdminEmail);

  List<OrderEntity> findByAssignedDeliveryAdminEmailIgnoreCase(String assignedDeliveryAdminEmail);

  List<OrderEntity> findByAssignedDeliveryAdminEmailIgnoreCaseAndStatusInOrderByUpdatedAtDesc(
      String assignedDeliveryAdminEmail, Collection<OrderStatus> statuses);

  long countByAssignedDeliveryAdminEmailIgnoreCaseAndStatus(
      String assignedDeliveryAdminEmail, OrderStatus status);

  long countByUser_Id(UUID userId);

  long countByUser_IdAndStatus(UUID userId, OrderStatus status);

  long countByUser_IdAndPlacedAtGreaterThanEqual(UUID userId, Instant placedAt);

  long countByUser_IdAndStatusAndPlacedAtGreaterThanEqual(
      UUID userId, OrderStatus status, Instant placedAt);

  Page<OrderEntity> findByAssignedDeliveryAdminEmailIgnoreCaseOrderByPlacedAtDesc(
      String assignedDeliveryAdminEmail, Pageable pageable);

  Page<OrderEntity> findByAssignedDeliveryAdminEmailIgnoreCaseAndUser_PhoneE164OrderByPlacedAtDesc(
      String assignedDeliveryAdminEmail, String phoneE164, Pageable pageable);

  @Query(
      """
      SELECT COUNT(o) FROM OrderEntity o
      WHERE lower(o.assignedDeliveryAdminEmail) = lower(:email)
        AND o.status IN :statuses
      """)
  long countByAssignedDeliveryAdminEmailIgnoreCaseAndStatusIn(
      @Param("email") String email, @Param("statuses") Collection<OrderStatus> statuses);

  Page<OrderEntity> findAllByOrderByPlacedAtDesc(Pageable pageable);

  @Query(
      """
      SELECT o FROM OrderEntity o
      WHERE (:startAt IS NULL OR o.placedAt >= :startAt)
        AND (:endAt IS NULL OR o.placedAt < :endAt)
      ORDER BY o.placedAt DESC
      """)
  List<OrderEntity> findForReconciliation(
      @Param("startAt") Instant startAt, @Param("endAt") Instant endAt);

  @Query(
      """
      SELECT COUNT(o) FROM OrderEntity o
      WHERE lower(o.assignedDeliveryAdminEmail) = lower(:email)
        AND o.placedAt >= :startInclusive
        AND o.placedAt < :endExclusive
        AND o.status IN :statuses
      """)
  long countAssignedOrdersPlacedBetweenWithStatuses(
      @Param("email") String email,
      @Param("startInclusive") Instant startInclusive,
      @Param("endExclusive") Instant endExclusive,
      @Param("statuses") Collection<OrderStatus> statuses);

  @Query(
      """
      SELECT o FROM OrderEntity o
      JOIN o.user u
      LEFT JOIN UserProfile p ON p.userId = u.id
      WHERE lower(o.assignedDeliveryAdminEmail) = lower(:email)
        AND o.placedAt >= :startInclusive
        AND o.placedAt < :endExclusive
        AND o.status IN :visibleStatuses
        AND (
          lower(o.id) LIKE :searchPat
          OR lower(coalesce(u.displayName, '')) LIKE :searchPat
          OR lower(coalesce(p.fullName, '')) LIKE :searchPat
        )
      ORDER BY o.placedAt DESC
      """)
  Page<OrderEntity> findEmployeeAssignedOrdersPlacedBetween(
      @Param("email") String email,
      @Param("startInclusive") Instant startInclusive,
      @Param("endExclusive") Instant endExclusive,
      @Param("visibleStatuses") Collection<OrderStatus> visibleStatuses,
      @Param("searchPat") String searchPat,
      Pageable pageable);

}
