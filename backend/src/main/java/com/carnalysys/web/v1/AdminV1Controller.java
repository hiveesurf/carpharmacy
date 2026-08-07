package com.carnalysys.web.v1;

import com.carnalysys.api.ApiEnvelope;
import com.carnalysys.service.AdminApiService;
import com.carnalysys.service.AdminReconciliationService;
import com.carnalysys.service.NotificationService;
import com.carnalysys.web.dto.ProductImportReport;
import com.carnalysys.web.support.ApiResponses;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
@RestController
@RequestMapping("/api/v1/admin")
public class AdminV1Controller {

  private final AdminApiService adminApiService;
  private final AdminReconciliationService adminReconciliationService;
  private final NotificationService notificationService;

  public AdminV1Controller(
      AdminApiService adminApiService,
      AdminReconciliationService adminReconciliationService,
      NotificationService notificationService) {
    this.adminApiService = adminApiService;
    this.adminReconciliationService = adminReconciliationService;
    this.notificationService = notificationService;
  }

  @GetMapping("/dashboard")
  public ApiEnvelope<Map<String, Object>> dashboard(HttpServletRequest req) {
    return ApiResponses.ok(req, adminApiService.dashboard());
  }

  @GetMapping("/reconciliation")
  public ApiEnvelope<Map<String, Object>> reconciliation(
      HttpServletRequest req,
      @RequestParam(name = "startDate", required = false) String startDate,
      @RequestParam(name = "endDate", required = false) String endDate,
      @RequestParam(name = "status", defaultValue = "all") String status,
      @RequestParam(name = "search", required = false) String search,
      @RequestParam(name = "page", defaultValue = "0") int page,
      @RequestParam(name = "size", defaultValue = "20") int size) {
    return ApiResponses.ok(
        req,
        adminReconciliationService.getReconciliation(
            startDate, endDate, status, search, page, size));
  }

  @GetMapping(value = "/reconciliation/export", produces = "text/csv")
  public ResponseEntity<byte[]> reconciliationExport(
      @RequestParam(name = "startDate", required = false) String startDate,
      @RequestParam(name = "endDate", required = false) String endDate,
      @RequestParam(name = "status", defaultValue = "all") String status,
      @RequestParam(name = "search", required = false) String search) {
    String csv =
        adminReconciliationService.exportReconciliationCsv(startDate, endDate, status, search);
    byte[] body = csv.getBytes(StandardCharsets.UTF_8);
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"reconciliation.csv\"")
        .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
        .body(body);
  }

  @GetMapping("/sales-report")
  public ApiEnvelope<Map<String, Object>> salesReport(
      HttpServletRequest req,
      @RequestParam(name = "startDate", required = false) String startDate,
      @RequestParam(name = "endDate", required = false) String endDate,
      @RequestParam(name = "groupBy", defaultValue = "month") String groupBy,
      @RequestParam(name = "sort", defaultValue = "highest") String sort,
      @RequestParam(name = "sortBy", defaultValue = "revenue") String sortBy,
      @RequestParam(name = "notSelling", defaultValue = "false") boolean notSelling,
      @RequestParam(name = "page", defaultValue = "0") int page,
      @RequestParam(name = "size", defaultValue = "20") int size) {
    return ApiResponses.ok(
        req,
        adminApiService.getSalesReport(
            startDate, endDate, groupBy, sort, sortBy, notSelling, page, size));
  }

  @GetMapping("/me")
  public ApiEnvelope<Map<String, Object>> me(HttpServletRequest req) {
    return ApiResponses.ok(req, adminApiService.getCurrentAdminMe());
  }

  @GetMapping("/custom-roles")
  public ApiEnvelope<Map<String, Object>> listCustomRoles(HttpServletRequest req) {
    return ApiResponses.ok(req, Map.of("items", adminApiService.listCustomRoles()));
  }

  @PostMapping("/custom-roles")
  public ApiEnvelope<Map<String, Object>> createCustomRole(
      HttpServletRequest req, @RequestBody Map<String, Object> body) {
    return ApiResponses.ok(req, Map.of("role", adminApiService.createCustomRole(body)));
  }

  @PutMapping("/custom-roles/{id}/permissions")
  public ApiEnvelope<Map<String, Object>> updateCustomRolePermissions(
      HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
    return ApiResponses.ok(
        req, Map.of("role", adminApiService.updateCustomRolePermissions(id, body)));
  }

  @GetMapping("/products")
  public ApiEnvelope<Map<String, Object>> products(
      HttpServletRequest req,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String sort,
      @RequestParam(required = false) String search,
      @RequestParam(name = "lowStockOnly", required = false) Boolean lowStockOnly) {
    int p = page != null ? page : 0;
    int size = pageSize != null ? pageSize : 20;
    String s = sort != null && !sort.isBlank() ? sort : "created_desc";
    boolean lowStock = Boolean.TRUE.equals(lowStockOnly);
    return ApiResponses.ok(req, adminApiService.listProductsPage(p, size, s, search, lowStock));
  }

  @GetMapping("/cars")
  public ApiEnvelope<Map<String, Object>> cars(
      HttpServletRequest req,
      @RequestParam(name = "published", required = false) Boolean published,
      @RequestParam(name = "brand", required = false) String brand,
      @RequestParam(name = "partName", required = false) String partName,
      @RequestParam(name = "page", defaultValue = "0") Integer page,
      @RequestParam(name = "size", defaultValue = "5") Integer size) {
    boolean onlyPublished = Boolean.TRUE.equals(published);
    return ApiResponses.ok(
        req, adminApiService.listCarsAdminPage(onlyPublished, brand, partName, page, size));
  }

  @GetMapping("/cars/purchased-summary")
  public ApiEnvelope<Map<String, Object>> carsPurchasedSummary(HttpServletRequest req) {
    return ApiResponses.ok(req, adminApiService.getCarsPurchasedSummary());
  }

  @GetMapping("/cars/form-options")
  public ApiEnvelope<Map<String, Object>> carFormOptions(HttpServletRequest req) {
    return ApiResponses.ok(req, adminApiService.listCarFormOptionCatalog());
  }

  @GetMapping("/cars/{id}")
  public ApiEnvelope<Map<String, Object>> getCar(HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.getCarAdmin(id));
  }

  @GetMapping("/cars/{id}/parts-summary")
  public ApiEnvelope<Map<String, Object>> carPartsSummary(
      HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.getCarPartsSummary(id));
  }

  @PostMapping("/cars")
  public ApiEnvelope<Map<String, Object>> createCar(
      HttpServletRequest req, @RequestBody Map<String, Object> body) {
    return ApiResponses.ok(req, adminApiService.createCar(body));
  }

  @PutMapping("/cars/{id}")
  public ApiEnvelope<Map<String, Object>> updateCar(
      HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
    return ApiResponses.ok(req, adminApiService.updateCar(id, body));
  }

  @DeleteMapping("/cars/{id}")
  public ApiEnvelope<Map<String, Object>> deleteCar(HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.deleteCar(id));
  }

  @GetMapping("/products/{id}")
  public ApiEnvelope<Map<String, Object>> getProduct(
      HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.getProductAdmin(id));
  }

  @PostMapping("/products")
  public ApiEnvelope<Map<String, Object>> createProduct(
      HttpServletRequest req, @RequestBody Map<String, Object> body) {
    return ApiResponses.ok(req, adminApiService.upsertProduct(body, null));
  }

  @PutMapping("/products/{id}")
  public ApiEnvelope<Map<String, Object>> updateProduct(
      HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
    return ApiResponses.ok(req, adminApiService.upsertProduct(body, id));
  }

  @DeleteMapping("/products/{id}")
  public ApiEnvelope<Map<String, Object>> deleteProduct(HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.deleteProduct(id));
  }

  @PatchMapping("/products/{id}/publish")
  public ApiEnvelope<Map<String, Object>> publish(
      HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
    boolean published = body == null || body.get("published") == null || Boolean.TRUE.equals(body.get("published"));
    return ApiResponses.ok(req, adminApiService.patchPublish(id, published));
  }

  @GetMapping("/categories")
  public ApiEnvelope<Map<String, Object>> categories(
      HttpServletRequest req,
      @RequestParam(name = "page", defaultValue = "0") Integer page,
      @RequestParam(name = "size", defaultValue = "5") Integer size) {
    return ApiResponses.ok(req, adminApiService.listCategoriesPage(page, size));
  }

  @GetMapping("/categories/overview")
  public ApiEnvelope<Map<String, Object>> categoriesOverview(HttpServletRequest req) {
    return ApiResponses.ok(req, adminApiService.categoriesOverview());
  }

  @PostMapping("/categories")
  public ApiEnvelope<Map<String, Object>> createCategory(
      HttpServletRequest req, @RequestBody Map<String, Object> body) {
    String name = body != null ? String.valueOf(body.get("name")) : "";
    return ApiResponses.ok(req, adminApiService.createCategory(name));
  }

  @PutMapping("/categories/{id}")
  public ApiEnvelope<Map<String, Object>> updateCategory(
      HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
    return ApiResponses.ok(req, adminApiService.updateCategory(id, body));
  }

  @DeleteMapping("/categories/{id}")
  public ApiEnvelope<Map<String, Object>> deleteCategory(HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.deleteCategory(id));
  }

  @GetMapping("/orders")
  public ApiEnvelope<Map<String, Object>> orders(
      HttpServletRequest req,
      @RequestParam(required = false) String phone,
      @RequestParam(name = "page", defaultValue = "0") Integer page,
      @RequestParam(name = "size", defaultValue = "5") Integer size) {
    return ApiResponses.ok(req, adminApiService.listOrdersAdminPage(phone, page, size));
  }

  @GetMapping("/orders/{id}")
  public ApiEnvelope<Map<String, Object>> order(HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.getOrderAdmin(id));
  }

  @PatchMapping("/orders/{id}/status")
  public ApiEnvelope<Map<String, Object>> orderStatus(
      HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
    String status = String.valueOf(body.getOrDefault("status", ""));
    return ApiResponses.ok(req, adminApiService.patchOrderStatus(id, status));
  }

  @PatchMapping("/orders/{id}/assign-delivery")
  public ApiEnvelope<Map<String, Object>> assignDelivery(
      HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
    String email = body == null ? "" : String.valueOf(body.getOrDefault("deliveryAdminEmail", ""));
    return ApiResponses.ok(req, adminApiService.assignDelivery(id, email));
  }

  @PostMapping("/orders/{id}/delivery/accept")
  public ApiEnvelope<Map<String, Object>> deliveryAccept(HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.deliveryAcceptAssignment(id));
  }

  @PostMapping("/orders/{id}/delivery/out-for-delivery")
  public ApiEnvelope<Map<String, Object>> deliveryOutForDelivery(
      HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.deliveryMarkOutForDelivery(id));
  }

  @PostMapping("/orders/{id}/delivery/resend-otp")
  public ApiEnvelope<Map<String, Object>> deliveryResendOtp(
      HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.deliveryResendOtp(id));
  }

  @PostMapping("/orders/{id}/delivery/verify-otp")
  public ApiEnvelope<Map<String, Object>> deliveryVerifyOtp(
      HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
    String otp = body == null ? "" : String.valueOf(body.getOrDefault("otp", ""));
    return ApiResponses.ok(req, adminApiService.deliveryVerifyOtp(id, otp));
  }

  @PostMapping("/orders/{id}/delivery/proof")
  public ApiEnvelope<Map<String, Object>> deliveryUploadProof(
      HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
    String proof =
        body != null && body.get("proofPhotoUrl") != null
            ? String.valueOf(body.get("proofPhotoUrl"))
            : "";
    return ApiResponses.ok(req, adminApiService.deliveryUploadProof(id, proof));
  }

  @GetMapping("/orders/{id}/delivery/proof")
  public ResponseEntity<byte[]> deliveryProof(HttpServletRequest req, @PathVariable String id) {
    return adminApiService.getOrderDeliveryProof(id);
  }

  @PostMapping("/orders/{id}/delivery/delivered")
  public ApiEnvelope<Map<String, Object>> deliveryDelivered(
      HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.deliveryMarkDelivered(id));
  }

  @PostMapping("/orders/{id}/delivery/failed")
  public ApiEnvelope<Map<String, Object>> deliveryFailed(
      HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
    String reason = body == null ? "" : String.valueOf(body.getOrDefault("reason", ""));
    String note = body == null ? "" : String.valueOf(body.getOrDefault("note", ""));
    return ApiResponses.ok(req, adminApiService.deliveryMarkFailed(id, reason, note));
  }

  @GetMapping("/delivery/me/summary")
  public ApiEnvelope<Map<String, Object>> deliveryMeSummary(HttpServletRequest req) {
    return ApiResponses.ok(req, adminApiService.deliveryPartnerSummaryForCurrent());
  }

  @GetMapping("/delivery/orders")
  public ApiEnvelope<Map<String, Object>> deliveryOrders(
      HttpServletRequest req,
      @RequestParam(required = false) String from,
      @RequestParam(required = false) String to,
      @RequestParam(required = false) String month) {
    return ApiResponses.ok(
        req, Map.of("items", adminApiService.listDeliveryOrdersForCurrent(from, to, month)));
  }

  @PatchMapping("/delivery/me/availability")
  public ApiEnvelope<Map<String, Object>> setMyDeliveryAvailability(
      HttpServletRequest req, @RequestBody Map<String, Object> body) {
    String value = body == null ? "" : String.valueOf(body.getOrDefault("availability", ""));
    return ApiResponses.ok(req, adminApiService.setCurrentDeliveryAvailability(value));
  }

  @GetMapping("/users")
  public ApiEnvelope<Map<String, Object>> users(
      HttpServletRequest req,
      @RequestParam(name = "page", defaultValue = "0") Integer page,
      @RequestParam(name = "size", defaultValue = "5") Integer size,
      @RequestParam(name = "phone", required = false) String phone,
      @RequestParam(name = "role", required = false) String role,
      @RequestParam(name = "createdFrom", required = false) String createdFrom,
      @RequestParam(name = "createdTo", required = false) String createdTo,
      @RequestParam(name = "customerType", required = false) String customerType) {
    return ApiResponses.ok(
        req,
        adminApiService.listUsersPage(
            page, size, phone, role, createdFrom, createdTo, customerType));
  }

  @GetMapping("/users/{id}")
  public ApiEnvelope<Map<String, Object>> user(HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.getUserAdmin(id));
  }

  @GetMapping("/users/{id}/profile")
  public ApiEnvelope<Map<String, Object>> userProfile(HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, adminApiService.getUserProfile(id));
  }

  @GetMapping("/employees")
  public ApiEnvelope<Map<String, Object>> employees(
      HttpServletRequest req,
      @RequestParam(name = "page", defaultValue = "0") Integer page,
      @RequestParam(name = "size", defaultValue = "5") Integer size,
      @RequestParam(name = "deleted", required = false) Boolean deleted) {
    return ApiResponses.ok(req, adminApiService.listEmployeesPage(page, size, deleted));
  }

  @GetMapping("/employees/summary")
  public ApiEnvelope<Map<String, Object>> employeesSummary(HttpServletRequest req) {
    return ApiResponses.ok(req, adminApiService.getEmployeesSummary());
  }

  @GetMapping("/employees/{phone}")
  public ApiEnvelope<Map<String, Object>> employee(
      HttpServletRequest req, @PathVariable String phone) {
    return ApiResponses.ok(req, adminApiService.getEmployee(phone));
  }

  @GetMapping("/employees/{phone}/profile")
  public ApiEnvelope<Map<String, Object>> employeeProfile(
      HttpServletRequest req, @PathVariable String phone) {
    return ApiResponses.ok(req, adminApiService.getEmployeeProfile(phone));
  }

  @GetMapping("/employees/{employeeId}/delivery-orders")
  public ApiEnvelope<Map<String, Object>> employeeDeliveryOrders(
      HttpServletRequest req,
      @PathVariable String employeeId,
      @RequestParam(name = "fromDate", required = false) String fromDate,
      @RequestParam(name = "toDate", required = false) String toDate,
      @RequestParam(name = "search", required = false) String search,
      @RequestParam(name = "page", defaultValue = "0") int page,
      @RequestParam(name = "size", defaultValue = "20") int size) {
    return ApiResponses.ok(
        req,
        adminApiService.getEmployeeDeliveryOrders(employeeId, fromDate, toDate, search, page, size));
  }

  @PostMapping("/employees")
  public ApiEnvelope<Map<String, Object>> createEmployee(
      HttpServletRequest req, @RequestBody Map<String, Object> body) {
    return ApiResponses.ok(req, adminApiService.createEmployee(body));
  }

  @PutMapping("/employees/{phone}")
  public ApiEnvelope<Map<String, Object>> updateEmployee(
      HttpServletRequest req, @PathVariable String phone, @RequestBody Map<String, Object> body) {
    return ApiResponses.ok(req, adminApiService.updateEmployee(phone, body));
  }

  @DeleteMapping("/employees/{phone}")
  public ApiEnvelope<Map<String, Object>> deleteEmployee(
      HttpServletRequest req, @PathVariable String phone, @RequestBody(required = false) Map<String, Object> body) {
    String reason = body == null ? "" : String.valueOf(body.getOrDefault("reason", ""));
    return ApiResponses.ok(req, adminApiService.deleteEmployee(phone, reason));
  }

  @PostMapping("/employees/{phone}/restore")
  public ApiEnvelope<Map<String, Object>> restoreEmployee(
      HttpServletRequest req, @PathVariable String phone) {
    return ApiResponses.ok(req, adminApiService.restoreEmployee(phone));
  }

  @PatchMapping("/employees/{phone}/availability")
  public ApiEnvelope<Map<String, Object>> setAvailability(
      HttpServletRequest req, @PathVariable String phone, @RequestBody Map<String, Object> body) {
    String value = body == null ? "" : String.valueOf(body.getOrDefault("availability", ""));
    return ApiResponses.ok(req, adminApiService.setEmployeeAvailability(phone, value));
  }

  @PostMapping(value = "/products/import-excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiEnvelope<ProductImportReport> importExcel(
      HttpServletRequest req,
      @RequestPart("file") MultipartFile file,
      @RequestParam(name = "category", required = false) String category) {
    return ApiResponses.ok(req, adminApiService.bulkImportProducts(file, category));
  }

  @GetMapping("/products/{id}/audit")
  public ApiEnvelope<Map<String, Object>> productAudit(HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, Map.of("items", adminApiService.productAuditHistory(id)));
  }

  @GetMapping("/notifications/unread-count")
  public ApiEnvelope<Map<String, Object>> notificationsUnreadCount(HttpServletRequest req) {
    String recipientId = resolveAdminNotificationRecipientId();
    long count =
        notificationService.unreadCount(NotificationService.RECIPIENT_ADMIN, recipientId);
    return ApiResponses.ok(req, Map.of("unreadCount", count));
  }

  @GetMapping("/notifications")
  public ApiEnvelope<Map<String, Object>> notifications(
      HttpServletRequest req,
      @RequestParam(name = "cursor", required = false) String cursor,
      @RequestParam(name = "limit", defaultValue = "20") int limit,
      @RequestParam(name = "unreadOnly", defaultValue = "false") boolean unreadOnly) {
    String recipientId = resolveAdminNotificationRecipientId();
    java.time.Instant c = null;
    if (cursor != null && !cursor.isBlank()) {
      try {
        c = java.time.Instant.parse(cursor.trim());
      } catch (java.time.format.DateTimeParseException ignored) {
        c = null;
      }
    }
    try {
      return ApiResponses.ok(
          req,
          notificationService.list(
              NotificationService.RECIPIENT_ADMIN, recipientId, c, limit, unreadOnly));
    } catch (RuntimeException ex) {
      Map<String, Object> empty = new java.util.LinkedHashMap<>();
      empty.put("items", java.util.List.of());
      empty.put("nextCursor", null);
      empty.put("unreadCount", 0L);
      empty.put("hasMore", false);
      return ApiResponses.ok(req, empty);
    }
  }

  @PostMapping("/notifications/read")
  public ApiEnvelope<Map<String, Object>> markRead(
      HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    return ApiResponses.ok(req, markNotificationsRead(body));
  }

  @PatchMapping("/notifications/read-all")
  public ApiEnvelope<Map<String, Object>> markAllReadPatch(HttpServletRequest req) {
    return ApiResponses.ok(req, markNotificationsRead(Map.of("all", true)));
  }

  @PatchMapping("/notifications/{id}/read")
  public ApiEnvelope<Map<String, Object>> markOneReadPatch(
      HttpServletRequest req, @PathVariable String id) {
    return ApiResponses.ok(req, markNotificationsRead(Map.of("ids", java.util.List.of(id))));
  }

  private Map<String, Object> markNotificationsRead(Map<String, Object> body) {
    String recipientId = resolveAdminNotificationRecipientId();
    boolean all = body != null && Boolean.TRUE.equals(body.get("all"));
    @SuppressWarnings("unchecked")
    java.util.List<String> ids =
        body != null && body.get("ids") instanceof java.util.List<?> list
            ? list.stream().map(String::valueOf).toList()
            : java.util.List.of();
    int changed =
        notificationService.markRead(
            NotificationService.RECIPIENT_ADMIN, recipientId, ids, all);
    return Map.of("updated", changed);
  }

  @PostMapping("/notifications/push/subscribe")
  public ApiEnvelope<Map<String, Object>> subscribePush(
      HttpServletRequest req,
      @RequestBody(required = false) Map<String, Object> body,
      @RequestHeader(name = "User-Agent", required = false) String userAgent) {
    String recipientId = resolveAdminNotificationRecipientId();
    Map<String, Object> b = body != null ? body : Map.of();
    String endpoint = b.get("endpoint") != null ? String.valueOf(b.get("endpoint")) : null;
    @SuppressWarnings("unchecked")
    Map<String, Object> keys =
        b.get("keys") instanceof Map<?, ?> km
            ? (Map<String, Object>) km
            : Map.of();
    String p256dh = keys.get("p256dh") != null ? String.valueOf(keys.get("p256dh")) : null;
    String auth = keys.get("auth") != null ? String.valueOf(keys.get("auth")) : null;
    notificationService.upsertPushSubscription(
        NotificationService.RECIPIENT_ADMIN, recipientId, endpoint, p256dh, auth, userAgent);
    return ApiResponses.ok(req, Map.of("subscribed", true));
  }

  @PostMapping("/notifications/push/unsubscribe")
  public ApiEnvelope<Map<String, Object>> unsubscribePush(
      HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    String recipientId = resolveAdminNotificationRecipientId();
    String endpoint = body != null && body.get("endpoint") != null ? String.valueOf(body.get("endpoint")) : null;
    long removed =
        notificationService.removePushSubscription(
            NotificationService.RECIPIENT_ADMIN, recipientId, endpoint);
    return ApiResponses.ok(req, Map.of("removed", removed));
  }

  /** Same {@code admin_users.email} key as {@link NotificationService#notifyAdminEmail} recipients. */
  private String resolveAdminNotificationRecipientId() {
    return adminApiService.currentAdminNotificationRecipientId();
  }
}
