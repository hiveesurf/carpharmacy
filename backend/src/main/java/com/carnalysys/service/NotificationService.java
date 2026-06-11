package com.carnalysys.service;

import com.carnalysys.domain.AdminUser;
import com.carnalysys.domain.NotificationEntity;
import com.carnalysys.domain.PushSubscriptionEntity;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.NotificationRepository;
import com.carnalysys.repo.PushSubscriptionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {
  private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

  public static final String RECIPIENT_USER = "user";
  public static final String RECIPIENT_ADMIN = "admin";

  /** In-app alert to super_admin + sales when a customer places an order. */
  public static final String TOPIC_ADMIN_NEW_ORDER = "admin_new_order";

  /** In-app alert to super_admin + sales when an order is marked delivered. */
  public static final String TOPIC_ADMIN_DELIVERY_COMPLETED = "admin_delivery_completed";

  /** In-app alert to super_admin + sales when a delivery employee is assigned to an order. */
  public static final String TOPIC_ADMIN_ORDER_ASSIGNED = "admin_order_assigned";

  /** In-app alert when a product's stock falls to the low-stock threshold. */
  public static final String TOPIC_ADMIN_LOW_STOCK = "admin_low_stock";

  private final NotificationRepository notificationRepository;
  private final PushSubscriptionRepository pushSubscriptionRepository;
  private final AdminUserRepository adminUserRepository;
  private final ObjectMapper objectMapper;

  public NotificationService(
      NotificationRepository notificationRepository,
      PushSubscriptionRepository pushSubscriptionRepository,
      AdminUserRepository adminUserRepository,
      ObjectMapper objectMapper) {
    this.notificationRepository = notificationRepository;
    this.pushSubscriptionRepository = pushSubscriptionRepository;
    this.adminUserRepository = adminUserRepository;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public void notifyUser(
      UUID userId,
      String topic,
      String title,
      String body,
      String sourceType,
      String sourceId,
      Map<String, Object> payload) {
    if (userId == null) return;
    saveNotification(RECIPIENT_USER, userId.toString(), topic, title, body, sourceType, sourceId, payload);
  }

  @Transactional
  public void notifyAdminEmail(
      String adminEmail,
      String topic,
      String title,
      String body,
      String sourceType,
      String sourceId,
      Map<String, Object> payload) {
    if (adminEmail == null || adminEmail.isBlank()) return;
    saveNotification(
        RECIPIENT_ADMIN,
        adminEmail.trim().toLowerCase(),
        topic,
        title,
        body,
        sourceType,
        sourceId,
        payload);
  }

  /**
   * Notifies every super_admin and sales {@link AdminUser} once per (topic, order id) so retries do not
   * duplicate rows.
   */
  @Transactional
  public void notifySuperAdminAndSalesNewOrder(String orderId) {
    if (orderId == null || orderId.isBlank()) return;
    String title = "New order placed";
    String body = "Order " + orderId + " was placed.";
    broadcastToSuperAdminAndSales(
        TOPIC_ADMIN_NEW_ORDER, title, body, "order", orderId, Map.of("orderId", orderId));
  }

  @Transactional(readOnly = true)
  public boolean hasUnreadLowStockForProduct(String productId) {
    if (productId == null || productId.isBlank()) {
      return false;
    }
    return notificationRepository.existsUnreadByTopicAndSource(
        RECIPIENT_ADMIN, TOPIC_ADMIN_LOW_STOCK, "product", productId);
  }

  /**
   * Notifies super_admin and sales when inventory is low. Does not use permanent order-style dedup;
   * callers enforce cross-threshold / cooldown rules.
   */
  @Transactional
  public void notifySuperAdminAndSalesLowStock(
      String productId,
      String productName,
      String sku,
      int currentStock,
      int threshold,
      String severity) {
    notifySuperAdminAndSalesLowStock(
        productId, productName, sku, currentStock, threshold, severity, false);
  }

  @Transactional
  public void notifySuperAdminAndSalesLowStock(
      String productId,
      String productName,
      String sku,
      int currentStock,
      int threshold,
      String severity,
      boolean bypassUnreadDedup) {
    if (productId == null || productId.isBlank()) {
      return;
    }
    String title = "Low stock alert";
    String body =
        String.format(
            "%s (%s) has only %d units left.",
            productName != null ? productName : "Product",
            sku != null ? sku : productId,
            currentStock);
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("type", "LOW_STOCK");
    payload.put("productId", productId);
    payload.put("sku", sku);
    payload.put("currentStock", currentStock);
    payload.put("threshold", threshold);
    payload.put("severity", severity != null ? severity : "warning");
    payload.put("read", false);

    LinkedHashSet<String> emails = new LinkedHashSet<>();
    collectEmailsForRole("super_admin", emails);
    collectEmailsForRole("sales", emails);
    int created = 0;
    int skipped = 0;
    for (String email : emails) {
      String rid = email.trim().toLowerCase();
      if (!bypassUnreadDedup
          && notificationRepository.existsUnreadForRecipientTopicAndSourceId(
              RECIPIENT_ADMIN, rid, TOPIC_ADMIN_LOW_STOCK, productId)) {
        skipped++;
        log.info(
            "Low-stock in-app notification skipped for {} (unread exists): productId={}",
            rid,
            productId);
        continue;
      }
      notifyAdminEmail(
          rid, TOPIC_ADMIN_LOW_STOCK, title, body, "product", productId, payload);
      created++;
      log.info(
          "Low-stock in-app notification created: recipientId={}, productId={}, stock={}",
          rid,
          productId,
          currentStock);
    }
    log.info(
        "Low-stock in-app broadcast done: productId={}, created={}, skipped={}",
        productId,
        created,
        skipped);
  }

  @Transactional
  public void notifySuperAdminAndSalesDeliveryCompleted(String orderId) {
    if (orderId == null || orderId.isBlank()) return;
    String title = "Delivery completed";
    String body = "Order " + orderId + " was marked delivered.";
    broadcastToSuperAdminAndSales(
        TOPIC_ADMIN_DELIVERY_COMPLETED,
        title,
        body,
        "order",
        orderId,
        Map.of("orderId", orderId));
  }

  /**
   * Notifies super_admin and sales when a delivery employee is assigned. Deduped per (topic, order id).
   */
  @Transactional
  public void notifySuperAdminAndSalesOrderAssigned(String orderId, String assigneeLabel) {
    if (orderId == null || orderId.isBlank()) return;
    String who = assigneeLabel != null && !assigneeLabel.isBlank() ? assigneeLabel.trim() : "delivery partner";
    String title = "Order assigned";
    String body = "Order #" + orderId + " assigned to " + who + ".";
    broadcastToSuperAdminAndSales(
        TOPIC_ADMIN_ORDER_ASSIGNED,
        title,
        body,
        "order",
        orderId,
        Map.of("orderId", orderId, "assignee", who));
  }

  private void broadcastToSuperAdminAndSales(
      String topic,
      String title,
      String body,
      String sourceType,
      String sourceId,
      Map<String, Object> payload) {
    LinkedHashSet<String> emails = new LinkedHashSet<>();
    collectEmailsForRole("super_admin", emails);
    collectEmailsForRole("sales", emails);
    for (String email : emails) {
      notifyAdminEmailDedup(email, topic, title, body, sourceType, sourceId, payload);
    }
  }

  private void collectEmailsForRole(String role, LinkedHashSet<String> out) {
    for (AdminUser u : adminUserRepository.findByRoleIgnoreCaseOrderByEmailAsc(role)) {
      if (u.getEmail() != null && !u.getEmail().isBlank()) {
        out.add(u.getEmail().trim().toLowerCase());
      }
    }
  }

  private void notifyAdminEmailDedup(
      String adminEmail,
      String topic,
      String title,
      String body,
      String sourceType,
      String sourceId,
      Map<String, Object> payload) {
    if (adminEmail == null || adminEmail.isBlank()) return;
    String rid = adminEmail.trim().toLowerCase();
    if (sourceId != null
        && !sourceId.isBlank()
        && notificationRepository.existsByRecipientTypeAndRecipientIdAndTopicAndSourceId(
            RECIPIENT_ADMIN, rid, topic, sourceId)) {
      return;
    }
    notifyAdminEmail(rid, topic, title, body, sourceType, sourceId, payload);
  }

  @Transactional(readOnly = true)
  public long unreadCount(String recipientType, String recipientId) {
    if (recipientId == null || recipientId.isBlank()) {
      return 0L;
    }
    return notificationRepository.countByRecipientTypeAndRecipientIdAndReadAtIsNull(
        recipientType, recipientId);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> list(
      String recipientType, String recipientId, Instant cursor, int limit, boolean unreadOnly) {
    int safeLimit = Math.max(1, Math.min(50, limit));
    var page = PageRequest.of(0, safeLimit);
    try {
      List<NotificationEntity> rows = listRowsForRecipient(recipientType, recipientId, cursor, unreadOnly, page);
      List<Map<String, Object>> items = rows.stream().map(this::toMap).toList();
      Instant nextCursor = rows.isEmpty() ? cursor : rows.get(rows.size() - 1).getCreatedAt();
      long unreadCount =
          notificationRepository.countByRecipientTypeAndRecipientIdAndReadAtIsNull(
              recipientType, recipientId);
      return notificationListPayload(items, nextCursor, unreadCount, rows.size() >= safeLimit);
    } catch (RuntimeException ex) {
      log.error(
          "Failed to list notifications: recipientType={}, recipientId={}",
          recipientType,
          recipientId,
          ex);
      return notificationListPayload(List.of(), null, 0L, false);
    }
  }

  private List<NotificationEntity> listRowsForRecipient(
      String recipientType, String recipientId, Instant cursor, boolean unreadOnly, Pageable page) {
    if (cursor == null) {
      if (unreadOnly) {
        return notificationRepository.listForRecipientNoCursorUnreadOnly(recipientType, recipientId, page);
      }
      return notificationRepository.listForRecipientNoCursorIncludingRead(recipientType, recipientId, page);
    }
    if (unreadOnly) {
      return notificationRepository.listForRecipientBeforeCursorUnreadOnly(
          recipientType, recipientId, cursor, page);
    }
    return notificationRepository.listForRecipientBeforeCursorIncludingRead(
        recipientType, recipientId, cursor, page);
  }

  /** Mutable map so {@code nextCursor} may be null ( {@link Map#of} forbids null values). */
  private static Map<String, Object> notificationListPayload(
      List<Map<String, Object>> items, Instant nextCursor, long unreadCount, boolean hasMore) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("items", items);
    m.put("nextCursor", nextCursor != null ? nextCursor.toString() : null);
    m.put("unreadCount", unreadCount);
    m.put("hasMore", hasMore);
    return m;
  }

  @Transactional
  public int markRead(String recipientType, String recipientId, Collection<String> ids, boolean all) {
    if (all) {
      return notificationRepository.markAllRead(recipientType, recipientId, Instant.now());
    }
    List<UUID> parsed =
        ids == null
            ? List.of()
            : ids.stream().map(this::parseUuid).filter(x -> x != null).toList();
    if (parsed.isEmpty()) return 0;
    return notificationRepository.markReadByIds(recipientType, recipientId, parsed, Instant.now());
  }

  @Transactional
  public void upsertPushSubscription(
      String recipientType,
      String recipientId,
      String endpoint,
      String p256dh,
      String auth,
      String userAgent) {
    if (endpoint == null || endpoint.isBlank() || p256dh == null || auth == null) return;
    PushSubscriptionEntity row =
        pushSubscriptionRepository
            .findByRecipientTypeAndRecipientIdAndEndpoint(recipientType, recipientId, endpoint)
            .orElseGet(PushSubscriptionEntity::new);
    row.setRecipientType(recipientType);
    row.setRecipientId(recipientId);
    row.setEndpoint(endpoint.trim());
    row.setP256dh(p256dh.trim());
    row.setAuth(auth.trim());
    row.setUserAgent(userAgent);
    pushSubscriptionRepository.save(row);
  }

  @Transactional
  public long removePushSubscription(String recipientType, String recipientId, String endpoint) {
    if (endpoint == null || endpoint.isBlank()) return 0L;
    return pushSubscriptionRepository.deleteByRecipientTypeAndRecipientIdAndEndpoint(
        recipientType, recipientId, endpoint.trim());
  }

  private void saveNotification(
      String recipientType,
      String recipientId,
      String topic,
      String title,
      String body,
      String sourceType,
      String sourceId,
      Map<String, Object> payload) {
    NotificationEntity n = new NotificationEntity();
    n.setRecipientType(recipientType);
    n.setRecipientId(recipientId);
    n.setTopic(topic != null ? topic : "general");
    n.setTitle(title != null ? title : "Notification");
    n.setBody(body != null ? body : "");
    n.setSourceType(sourceType);
    n.setSourceId(sourceId);
    n.setPayload(
        payload != null
            ? objectMapper.valueToTree(payload)
            : JsonNodeFactory.instance.objectNode());
    notificationRepository.save(n);
    dispatchPushBestEffort(recipientType, recipientId, n);
  }

  private Map<String, Object> toMap(NotificationEntity n) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", n.getId().toString());
    row.put("topic", n.getTopic());
    row.put("title", n.getTitle());
    row.put("body", n.getBody());
    row.put("sourceType", n.getSourceType());
    row.put("sourceId", n.getSourceId());
    row.put("payload", n.getPayload());
    row.put("read", n.getReadAt() != null);
    row.put("readAt", n.getReadAt() != null ? n.getReadAt().toString() : null);
    row.put("createdAt", n.getCreatedAt().toString());
    return row;
  }

  private UUID parseUuid(String raw) {
    try {
      return raw == null ? null : UUID.fromString(raw);
    } catch (IllegalArgumentException ex) {
      return null;
    }
  }

  private void dispatchPushBestEffort(
      String recipientType, String recipientId, NotificationEntity notification) {
    List<PushSubscriptionEntity> subs =
        pushSubscriptionRepository.findByRecipientTypeAndRecipientId(recipientType, recipientId);
    if (subs.isEmpty()) return;
    // Foundation stage: persist subscriptions and emit dispatch intent logs.
    // Actual web-push provider integration can be enabled behind env flags later.
    log.info(
        "Push dispatch queued (foundation): recipientType={}, recipientId={}, subscriptions={}, notificationId={}",
        recipientType,
        recipientId,
        subs.size(),
        notification.getId());
  }
}
