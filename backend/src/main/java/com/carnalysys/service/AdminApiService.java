package com.carnalysys.service;

import com.carnalysys.api.ApiException;
import com.carnalysys.domain.AddressEntity;
import com.carnalysys.domain.Category;
import com.carnalysys.domain.CarFuelOption;
import com.carnalysys.domain.CarModelEntity;
import com.carnalysys.domain.CarTransmissionOption;
import com.carnalysys.domain.AdminUser;
import com.carnalysys.domain.CustomRole;
import com.carnalysys.domain.OrderEntity;
import com.carnalysys.domain.OrderStatus;
import com.carnalysys.domain.Product;
import com.carnalysys.domain.ProductChangeAuditEntity;
import com.carnalysys.domain.ProductFitmentCar;
import com.carnalysys.domain.ProductFitmentLabel;
import com.carnalysys.domain.ProductType;
import com.carnalysys.domain.ProductVehicleSpec;
import com.carnalysys.domain.UserEntity;
import com.carnalysys.domain.UserProfile;
import com.carnalysys.domain.UserRole;
import com.carnalysys.web.dto.ProductImportReport;
import com.carnalysys.web.dto.ProductImportRowResult;
import com.carnalysys.repo.CategoryRepository;
import com.carnalysys.repo.CarFuelOptionRepository;
import com.carnalysys.repo.CarModelRepository;
import com.carnalysys.repo.CarTransmissionOptionRepository;
import com.carnalysys.repo.OrderRepository;
import com.carnalysys.repo.OrderStatusAuditRepository;
import com.carnalysys.repo.ProductChangeAuditRepository;
import com.carnalysys.repo.ProductFitmentCarRepository;
import com.carnalysys.repo.ProductFitmentLabelRepository;
import com.carnalysys.repo.ProductRepository;
import com.carnalysys.repo.ProductVehicleSpecRepository;
import com.carnalysys.repo.AddressRepository;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.UserProfileRepository;
import com.carnalysys.repo.UserRepository;
import com.carnalysys.repo.OrderLineRepository;
import com.carnalysys.util.CarIdentityNormalizer;
import com.carnalysys.util.EmployeeAvailability;
import com.carnalysys.util.SlugUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminApiService {

  private static final Set<String> USER_LIST_ROLE_FILTERS =
      Set.of("user", "super_admin", "sales", "delivery");

  private static final Set<String> USER_LIST_CUSTOMER_TYPE_FILTERS =
      Set.of("personal", "business");

  /** Assigned orders visible in delivery partner "My deliveries" (excludes draft, cancelled, refunded). */
  private static final List<OrderStatus> DELIVERY_PARTNER_LIST_STATUSES =
      List.of(
          OrderStatus.placed,
          OrderStatus.confirmed,
          OrderStatus.processing,
          OrderStatus.shipped,
          OrderStatus.delivered);

  /** In-progress delivery pipeline (excludes delivered terminal state). */
  private static final List<OrderStatus> EMPLOYEE_ASSIGNED_PIPELINE_STATUSES =
      List.of(
          OrderStatus.placed,
          OrderStatus.confirmed,
          OrderStatus.processing,
          OrderStatus.shipped);

  /** Orders shown in employee delivery performance (excludes draft, cancelled, refunded). */
  private static final Set<OrderStatus> EMPLOYEE_DELIVERY_PAGE_STATUSES =
      Set.copyOf(DELIVERY_PARTNER_LIST_STATUSES);

  private static final DateTimeFormatter EMPLOYEE_DELIVERY_ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

  private final AdminUserRepository adminUserRepository;
  private final UserRepository userRepository;
  private final UserProfileRepository userProfileRepository;
  private final AddressRepository addressRepository;
  private final OrderRepository orderRepository;
  private final CategoryRepository categoryRepository;
  private final OrderLineRepository orderLineRepository;
  private final OrderStatusAuditRepository orderStatusAuditRepository;
  private final ProductRepository productRepository;
  private final ProductChangeAuditRepository productChangeAuditRepository;
  private final ProductFitmentLabelRepository fitmentLabelRepository;
  private final ProductFitmentCarRepository fitmentCarRepository;
  private final CarModelRepository carModelRepository;
  private final CarFuelOptionRepository carFuelOptionRepository;
  private final CarTransmissionOptionRepository carTransmissionOptionRepository;
  private final ProductVehicleSpecRepository vehicleSpecRepository;
  private final CatalogService catalogService;
  private final OrderService orderService;
  private final ObjectMapper objectMapper;
  private final ProductPresenter productPresenter;
  private final UploadStorageService uploadStorageService;
  private final UserAvatarService userAvatarService;
  private final NotificationService notificationService;
  private final ProductExcelParser productExcelParser;
  private final LowStockAlertService lowStockAlertService;
  private final DeliveryWorkflowService deliveryWorkflowService;
  private final WhatsappService whatsappService;
  private final CustomRoleService customRoleService;

  public AdminApiService(
      AdminUserRepository adminUserRepository,
      UserRepository userRepository,
      UserProfileRepository userProfileRepository,
      AddressRepository addressRepository,
      OrderRepository orderRepository,
      CategoryRepository categoryRepository,
      OrderLineRepository orderLineRepository,
      OrderStatusAuditRepository orderStatusAuditRepository,
      ProductRepository productRepository,
      ProductChangeAuditRepository productChangeAuditRepository,
      ProductFitmentLabelRepository fitmentLabelRepository,
      ProductFitmentCarRepository fitmentCarRepository,
      CarModelRepository carModelRepository,
      CarFuelOptionRepository carFuelOptionRepository,
      CarTransmissionOptionRepository carTransmissionOptionRepository,
      ProductVehicleSpecRepository vehicleSpecRepository,
      CatalogService catalogService,
      OrderService orderService,
      ObjectMapper objectMapper,
      ProductPresenter productPresenter,
      UploadStorageService uploadStorageService,
      UserAvatarService userAvatarService,
      NotificationService notificationService,
      ProductExcelParser productExcelParser,
      LowStockAlertService lowStockAlertService,
      DeliveryWorkflowService deliveryWorkflowService,
      WhatsappService whatsappService,
      CustomRoleService customRoleService) {
    this.adminUserRepository = adminUserRepository;
    this.userRepository = userRepository;
    this.userProfileRepository = userProfileRepository;
    this.addressRepository = addressRepository;
    this.orderRepository = orderRepository;
    this.categoryRepository = categoryRepository;
    this.orderLineRepository = orderLineRepository;
    this.orderStatusAuditRepository = orderStatusAuditRepository;
    this.productRepository = productRepository;
    this.productChangeAuditRepository = productChangeAuditRepository;
    this.fitmentLabelRepository = fitmentLabelRepository;
    this.fitmentCarRepository = fitmentCarRepository;
    this.carModelRepository = carModelRepository;
    this.carFuelOptionRepository = carFuelOptionRepository;
    this.carTransmissionOptionRepository = carTransmissionOptionRepository;
    this.vehicleSpecRepository = vehicleSpecRepository;
    this.catalogService = catalogService;
    this.orderService = orderService;
    this.objectMapper = objectMapper;
    this.productPresenter = productPresenter;
    this.uploadStorageService = uploadStorageService;
    this.userAvatarService = userAvatarService;
    this.notificationService = notificationService;
    this.productExcelParser = productExcelParser;
    this.lowStockAlertService = lowStockAlertService;
    this.deliveryWorkflowService = deliveryWorkflowService;
    this.whatsappService = whatsappService;
    this.customRoleService = customRoleService;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> dashboard() {
    long users = userRepository.count();
    var orders = orderRepository.findAll();
    long totalOrders = orders.size();
    BigDecimal revenueAmount =
        orders.stream()
            .map(o -> o.getTotalInr())
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    long revenue = revenueAmount.longValue();
    long purchaseCount = totalOrders;
    long purchaseValue = revenue;
    var top = catalogService.listAllForAdmin().stream().filter(m -> Boolean.TRUE.equals(m.get("published"))).limit(5).toList();
    var revenueVsPurchases = buildRevenueVsPurchasesSeries(orders);
    var partsBreakdown = buildPartsBreakdown();
    Map<String, Object> d = new LinkedHashMap<>();
    d.put("totalUsers", users);
    d.put("totalOrders", totalOrders);
    d.put("revenue", revenue);
    d.put("purchaseCount", purchaseCount);
    d.put("purchaseValue", purchaseValue);
    d.put("revenueVsPurchases", revenueVsPurchases);
    d.put("partsBreakdown", partsBreakdown);
    d.put("topProducts", top);
    d.put("salesPerformance", listSalesPerformance());
    d.put("lowStockCount", catalogService.countLowStockForAdmin());
    d.put("lowStockThreshold", AdminProductSpecifications.LOW_STOCK_THRESHOLD);
    return d;
  }

  private List<Map<String, Object>> buildRevenueVsPurchasesSeries(List<OrderEntity> orders) {
    Map<String, BigDecimal> revenueByMonth = new LinkedHashMap<>();
    Map<String, Long> purchasesByMonth = new LinkedHashMap<>();
    DateTimeFormatter monthKeyFmt = DateTimeFormatter.ofPattern("yyyy-MM");

    for (var order : orders) {
      if (order.getPlacedAt() == null) continue;
      String monthKey = monthKeyFmt.format(order.getPlacedAt().atOffset(ZoneOffset.UTC));
      revenueByMonth.merge(monthKey, order.getTotalInr() != null ? order.getTotalInr() : BigDecimal.ZERO, BigDecimal::add);
      purchasesByMonth.put(monthKey, purchasesByMonth.getOrDefault(monthKey, 0L) + 1L);
    }

    List<String> keys = revenueByMonth.keySet().stream().sorted().toList();
    List<Map<String, Object>> series = new ArrayList<>();
    for (String key : keys) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("period", key);
      row.put("periodEndUtc", key + "-01T00:00:00Z");
      row.put("revenue", revenueByMonth.getOrDefault(key, BigDecimal.ZERO).longValue());
      row.put("purchases", purchasesByMonth.getOrDefault(key, 0L));
      series.add(row);
    }
    return series;
  }

  /** Parts revenue by category — same order set as revenueVsPurchases (all with placed_at). */
  private List<Map<String, Object>> buildPartsBreakdown() {
    List<Map<String, Object>> series = new ArrayList<>();
    for (Object[] row : orderLineRepository.sumSoldByCategory()) {
      if (row == null || row[0] == null) continue;
      String category = String.valueOf(row[0]).trim();
      if (category.isEmpty()) {
        category = "Uncategorized";
      }
      long count =
          row[1] instanceof Number n ? n.longValue() : Long.parseLong(String.valueOf(row[1]));
      long revenue =
          row[2] instanceof BigDecimal bd
              ? bd.longValue()
              : row[2] instanceof Number n ? n.longValue() : 0L;
      if (count <= 0 && revenue <= 0) continue;
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("category", category);
      item.put("count", count);
      item.put("revenue", revenue);
      series.add(item);
    }
    return series;
  }

  /**
   * Admin sales report: time series, product rankings, and non-selling products for a date range.
   * Order lines count only when order status is not draft/cancelled/refunded (same rule as catalog
   * purchased summaries).
   */
  @Transactional(readOnly = true)
  public Map<String, Object> getSalesReport(
      String startDate,
      String endDate,
      String groupBy,
      String sort,
      String sortBy,
      boolean notSelling,
      int page,
      int size) {
    CreatedAtRange range = parseOptionalCreatedAtRange(startDate, endDate);
    Instant startAt = range != null ? range.startInclusive() : null;
    Instant endAt = range != null ? range.endExclusive() : null;

    String bucket = groupBy == null ? "month" : groupBy.trim().toLowerCase(Locale.ROOT);
    if (!bucket.equals("day") && !bucket.equals("month") && !bucket.equals("year")) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "groupBy must be day, month, or year");
    }

    String sortField = sortBy == null ? "revenue" : sortBy.trim().toLowerCase(Locale.ROOT);
    if (!sortField.equals("revenue") && !sortField.equals("unitssold")) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "sortBy must be revenue or unitsSold");
    }
    boolean sortByUnits = sortField.equals("unitssold");

    List<Object[]> tsRows =
        switch (bucket) {
          case "day" -> orderLineRepository.salesReportTimeSeriesDay(startAt, endAt);
          case "year" -> orderLineRepository.salesReportTimeSeriesYear(startAt, endAt);
          default -> orderLineRepository.salesReportTimeSeriesMonth(startAt, endAt);
        };
    List<Map<String, Object>> timeSeries = new ArrayList<>();
    for (Object[] row : tsRows) {
      if (row == null || row[0] == null) continue;
      Map<String, Object> point = new LinkedHashMap<>();
      point.put("period", String.valueOf(row[0]));
      point.put("revenue", toLong(row[1]));
      point.put("unitsSold", toLong(row[2]));
      timeSeries.add(point);
    }

    Object[] summaryRow = orderLineRepository.salesReportSummary(startAt, endAt);
    long totalRevenue = summaryRow != null && summaryRow.length > 0 ? toLong(summaryRow[0]) : 0L;
    long totalUnitsSold = summaryRow != null && summaryRow.length > 1 ? toLong(summaryRow[1]) : 0L;

    Map<String, Long> unitsByProduct = new HashMap<>();
    Map<String, Long> revenueByProduct = new HashMap<>();
    for (Object[] row : orderLineRepository.salesReportByProductInRange(startAt, endAt)) {
      if (row == null || row[0] == null) continue;
      String pid = String.valueOf(row[0]);
      unitsByProduct.put(pid, toLong(row[1]));
      revenueByProduct.put(pid, toLong(row[2]));
    }

    List<Map<String, Object>> productRows;
    if (notSelling) {
      productRows = buildNonSellingProductRows(unitsByProduct);
    } else {
      boolean lowest = "lowest".equalsIgnoreCase(String.valueOf(sort).trim());
      productRows = buildSellingProductRows(unitsByProduct, revenueByProduct, lowest, sortByUnits);
    }

    int safePage = Math.max(0, page);
    int safeSize = Math.max(1, Math.min(50, size));
    int totalElements = productRows.size();
    int fromIndex = Math.min(safePage * safeSize, totalElements);
    int toIndex = Math.min(fromIndex + safeSize, totalElements);
    List<Map<String, Object>> pagedProducts = productRows.subList(fromIndex, toIndex);

    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("totalRevenue", totalRevenue);
    summary.put("totalUnitsSold", totalUnitsSold);

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("summary", summary);
    body.put("timeSeries", timeSeries);
    body.put("products", pagedProducts);
    body.put("page", safePage);
    body.put("size", safeSize);
    body.put("totalElements", totalElements);
    body.put("hasMore", toIndex < totalElements);
    body.put("nextPage", toIndex < totalElements ? safePage + 1 : safePage);
    return body;
  }

  private List<Map<String, Object>> buildSellingProductRows(
      Map<String, Long> unitsByProduct,
      Map<String, Long> revenueByProduct,
      boolean lowest,
      boolean sortByUnits) {
    if (revenueByProduct.isEmpty()) {
      return List.of();
    }
    List<Product> products = productRepository.findAllById(revenueByProduct.keySet());
    List<Map<String, Object>> rows = new ArrayList<>();
    for (Product p : products) {
      if (p == null || p.getDeletedAt() != null) continue;
      long units = unitsByProduct.getOrDefault(p.getId(), 0L);
      long revenue = revenueByProduct.getOrDefault(p.getId(), 0L);
      if (units <= 0 && revenue <= 0) continue;
      rows.add(toSalesReportProductRow(p, units, revenue));
    }
    String sortKey = sortByUnits ? "unitsSold" : "revenue";
    Comparator<Map<String, Object>> byMetric =
        Comparator.comparingLong(r -> ((Number) r.get(sortKey)).longValue());
    rows.sort(lowest ? byMetric : byMetric.reversed());
    return rows;
  }

  private List<Map<String, Object>> buildNonSellingProductRows(Map<String, Long> unitsByProduct) {
    List<Product> active = productRepository.findAllActive();
    List<Map<String, Object>> rows = new ArrayList<>();
    for (Product p : active) {
      if (p.getDeletedAt() != null) continue;
      if (unitsByProduct.getOrDefault(p.getId(), 0L) > 0) continue;
      rows.add(toSalesReportProductRow(p, 0L, 0L));
    }
    rows.sort(
        Comparator.comparing(
            r -> String.valueOf(r.get("name")), String.CASE_INSENSITIVE_ORDER));
    return rows;
  }

  private Map<String, Object> toSalesReportProductRow(Product p, long unitsSold, long revenue) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("productId", p.getId());
    row.put("name", p.getName());
    row.put("sku", p.getSku());
    row.put("category", p.getCategory() != null ? p.getCategory().getName() : "");
    row.put(
        "price",
        p.getPriceInr() != null ? p.getPriceInr().setScale(0, RoundingMode.DOWN).longValue() : 0L);
    row.put("imageKey", p.getImageKey());
    String imageUrl = resolveProductImageUrlForReport(p);
    row.put("imageUrl", imageUrl);
    if (imageUrl != null) {
      row.put("image", imageUrl);
    }
    row.put("unitsSold", unitsSold);
    row.put("revenue", revenue);
    return row;
  }

  private String resolveProductImageUrlForReport(Product p) {
    Map<String, Object> pub =
        productPresenter.toPublicMap(p, List.of(), List.of(), Map.of(), null);
    Object img = pub.get("image");
    if (img != null && !String.valueOf(img).isBlank()) {
      return String.valueOf(img);
    }
    return null;
  }

  private static long toLong(Object value) {
    if (value == null) return 0L;
    if (value instanceof BigDecimal bd) return bd.longValue();
    if (value instanceof Number n) return n.longValue();
    try {
      return Long.parseLong(String.valueOf(value));
    } catch (NumberFormatException ex) {
      return 0L;
    }
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listUsers() {
    return userRepository.findAll().stream()
        .map(
            u -> {
              Map<String, Object> m = new LinkedHashMap<>();
              m.put("id", u.getId().toString());
              m.put("phone", u.getPhoneE164());
              m.put("name", u.getDisplayName());
              m.put("role", u.getRole() != null ? u.getRole() : "user");
              m.put(
                  "avatarUrl",
                  userAvatarService.hasAvatar(u.getId())
                      ? userAvatarService.publicAvatarUrl(u.getId())
                      : "");
              m.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : null);
              return m;
            })
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listUsersPage(
      int page,
      int size,
      String phone,
      String role,
      String createdFrom,
      String createdTo,
      String customerType) {
    Pageable pageable =
        PageRequest.of(
            Math.max(0, page),
            Math.max(1, Math.min(50, size)),
            Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
    String phoneFilter = phone == null || phone.isBlank() ? null : phone.trim();
    String roleFilter = normalizeUserListRoleParam(role);
    String customerTypeFilter = normalizeUserListCustomerTypeParam(customerType);
    CreatedAtRange joined = parseOptionalCreatedAtRange(createdFrom, createdTo);
    Specification<UserEntity> spec =
        userListSpecification(phoneFilter, roleFilter, joined, customerTypeFilter);
    Page<UserEntity> result = userRepository.findAll(spec, pageable);
    List<Map<String, Object>> items = result.getContent().stream().map(this::toUserMap).toList();
    return pagedResponse(items, result.getNumber(), result.getSize(), result.hasNext());
  }

  private static String normalizeUserListRoleParam(String role) {
    if (role == null || role.isBlank()) {
      return null;
    }
    String r = role.trim().toLowerCase();
    return USER_LIST_ROLE_FILTERS.contains(r) ? r : null;
  }

  private static String normalizeUserListCustomerTypeParam(String customerType) {
    if (customerType == null || customerType.isBlank()) {
      return null;
    }
    String value = customerType.trim().toLowerCase();
    return USER_LIST_CUSTOMER_TYPE_FILTERS.contains(value) ? value : null;
  }

  private static String escapeLikePattern(String raw) {
    return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
  }

  private record CreatedAtRange(Instant startInclusive, Instant endExclusive) {}

  /**
   * Optional join-date filter. Calendar days are interpreted in UTC.
   *
   * <ul>
   *   <li>Both blank → no date filter
   *   <li>Only one set → that single calendar day (inclusive)
   *   <li>Both set → inclusive from day through inclusive to day ({@code [from, to+1day)})
   * </ul>
   */
  private CreatedAtRange parseOptionalCreatedAtRange(String createdFrom, String createdTo) {
    String from = createdFrom != null ? createdFrom.trim() : "";
    String to = createdTo != null ? createdTo.trim() : "";
    if (from.isEmpty() && to.isEmpty()) {
      return null;
    }
    if (from.isEmpty()) {
      from = to;
    } else if (to.isEmpty()) {
      to = from;
    }
    LocalDate fromD;
    LocalDate toD;
    try {
      fromD = LocalDate.parse(from, EMPLOYEE_DELIVERY_ISO_DATE);
      toD = LocalDate.parse(to, EMPLOYEE_DELIVERY_ISO_DATE);
    } catch (java.time.format.DateTimeParseException ex) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "VALIDATION_ERROR",
          "createdFrom and createdTo must be YYYY-MM-DD");
    }
    if (toD.isBefore(fromD)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "VALIDATION_ERROR",
          "createdTo must be on or after createdFrom");
    }
    Instant start = fromD.atStartOfDay(ZoneOffset.UTC).toInstant();
    Instant end = toD.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    return new CreatedAtRange(start, end);
  }

  private static Specification<UserEntity> userListSpecification(
      String phone, String role, CreatedAtRange joined, String customerType) {
    return (root, query, cb) -> {
      List<Predicate> predicates = new ArrayList<>();
      if (phone != null) {
        String escaped = escapeLikePattern(phone).toLowerCase();
        predicates.add(cb.like(cb.lower(root.get("phoneE164")), "%" + escaped + "%", '\\'));
      }
      if (role != null) {
        predicates.add(cb.equal(root.get("role"), role));
      }
      if (joined != null) {
        predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), joined.startInclusive()));
        predicates.add(cb.lessThan(root.get("createdAt"), joined.endExclusive()));
      }
      if ("business".equals(customerType)) {
        predicates.add(hasActiveBusinessGstAddress(root, query, cb));
      } else if ("personal".equals(customerType)) {
        predicates.add(cb.not(hasActiveBusinessGstAddress(root, query, cb)));
      }
      if (predicates.isEmpty()) {
        return cb.conjunction();
      }
      return cb.and(predicates.toArray(Predicate[]::new));
    };
  }

  /** User has at least one non-deleted address with a non-blank GST number. */
  private static Predicate hasActiveBusinessGstAddress(
      Root<UserEntity> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
    Subquery<UUID> sub = query.subquery(UUID.class);
    Root<AddressEntity> addr = sub.from(AddressEntity.class);
    sub.select(addr.get("id"));
    sub.where(
        cb.equal(addr.get("user").get("id"), root.get("id")),
        cb.isNull(addr.get("deletedAt")),
        cb.isNotNull(addr.get("gstNumber")),
        cb.notEqual(cb.trim(addr.get("gstNumber")), ""));
    return cb.exists(sub);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getUserAdmin(String userId) {
    UUID id = UUID.fromString(userId);
    UserEntity u =
        userRepository
            .findById(id)
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "User not found"));
    var prof =
        userProfileRepository
            .findById(id)
            .map(
                p -> {
                  Map<String, Object> m = new LinkedHashMap<>();
                  m.put("name", p.getFullName());
                  m.put("email", p.getEmail());
                  m.put("phone", p.getPhone());
                  return m;
                })
            .orElse(Map.of());
    Map<String, Object> um = new LinkedHashMap<>();
    um.put("id", u.getId().toString());
    um.put("phone", u.getPhoneE164());
    um.put("name", u.getDisplayName());
    um.put("role", u.getRole() != null ? u.getRole() : "user");
    um.put(
        "avatarUrl",
        userAvatarService.hasAvatar(u.getId()) ? userAvatarService.publicAvatarUrl(u.getId()) : "");
    return Map.of("user", um, "profile", prof);
  }

  private static final int PROFILE_RECENT_ORDERS_LIMIT = 50;

  @Transactional(readOnly = true)
  public Map<String, Object> getUserProfile(String userId) {
    requireAdminAccess();
    UUID id = UUID.fromString(userId);
    UserEntity u =
        userRepository
            .findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "User not found"));
    UserProfile profile = userProfileRepository.findById(id).orElse(null);

    Map<String, Object> user = new LinkedHashMap<>();
    user.put("id", u.getId().toString());
    user.put("phone", u.getPhoneE164());
    user.put(
        "name",
        profile != null && profile.getFullName() != null && !profile.getFullName().isBlank()
            ? profile.getFullName().trim()
            : u.getDisplayName());
    user.put("email", profile != null ? profile.getEmail() : null);
    user.put("role", u.getRole() != null ? u.getRole() : "user");
    user.put(
        "avatarUrl",
        userAvatarService.hasAvatar(u.getId()) ? userAvatarService.publicAvatarUrl(u.getId()) : "");

    List<AddressEntity> addressRows =
        addressRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(id);
    List<Map<String, Object>> addresses = addressRows.stream().map(this::toAddressMap).toList();
    user.put("gstNumber", resolveProfileGstNumber(addressRows));

    Map<String, Object> orderCounts = buildCustomerOrderCounts(id);
    List<Map<String, Object>> recentOrders =
        orderRepository
            .findByUser_IdOrderByPlacedAtDesc(
                id, PageRequest.of(0, PROFILE_RECENT_ORDERS_LIMIT, Sort.by("placedAt").descending()))
            .getContent()
            .stream()
            .map(o -> toCustomerProfileOrderRow(o, orderLineRepository.findByOrder_Id(o.getId())))
            .toList();

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("user", user);
    body.put("addresses", addresses);
    body.put("orderCounts", orderCounts);
    body.put("recentOrders", recentOrders);
    return body;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getEmployeeProfile(String phone) {
    requireSuperAdmin();
    AdminUser employee = requireWorkforceEmployee(phone);
    Map<String, Object> orderCounts = buildEmployeeDeliveryCounts(employee.getEmail());
    List<Map<String, Object>> recentOrders =
        orderRepository
            .findByAssignedDeliveryAdminEmailIgnoreCaseOrderByPlacedAtDesc(
                employee.getEmail(),
                PageRequest.of(0, PROFILE_RECENT_ORDERS_LIMIT, Sort.by("placedAt").descending()))
            .getContent()
            .stream()
            .map(
                o ->
                    toEmployeeProfileOrderRow(
                        o,
                        orderLineRepository.findByOrder_Id(o.getId()),
                        userProfileRepository
                            .findById(o.getUser().getId())
                            .orElse(null),
                        o.getUser()))
            .toList();

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("employee", toEmployeeMap(employee));
    body.put("deliveryCounts", orderCounts);
    body.put("recentOrders", recentOrders);
    return body;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getEmployeeDeliveryOrders(
      String employeeId,
      String fromDate,
      String toDate,
      String search,
      int page,
      int size) {
    requireSuperAdmin();
    AdminUser employee = requireWorkforceEmployeeByPathId(employeeId);
    String email = resolveWorkforceEmployeeEmail(employee);
    EmployeeDeliveryDateRange range = parseEmployeeDeliveryDateRange(fromDate, toDate);

    long assignedCount =
        orderRepository.countAssignedOrdersPlacedBetweenWithStatuses(
            email, range.startInclusive(), range.endExclusive(), EMPLOYEE_ASSIGNED_PIPELINE_STATUSES);
    long shippedCount =
        orderRepository.countAssignedOrdersPlacedBetweenWithStatuses(
            email, range.startInclusive(), range.endExclusive(), List.of(OrderStatus.shipped));
    long deliveredCount =
        orderRepository.countAssignedOrdersPlacedBetweenWithStatuses(
            email, range.startInclusive(), range.endExclusive(), List.of(OrderStatus.delivered));
    long totalForRate =
        orderRepository.countAssignedOrdersPlacedBetweenWithStatuses(
            email, range.startInclusive(), range.endExclusive(), EMPLOYEE_DELIVERY_PAGE_STATUSES);
    double deliverySuccessRate =
        totalForRate > 0 ? Math.round((deliveredCount * 1000.0) / totalForRate) / 10.0 : 0.0;

    String searchPat = normalizeEmployeeOrderSearchPattern(search);

    Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(50, size)));
    Page<OrderEntity> result =
        orderRepository.findEmployeeAssignedOrdersPlacedBetween(
            email,
            range.startInclusive(),
            range.endExclusive(),
            EMPLOYEE_DELIVERY_PAGE_STATUSES,
            searchPat,
            pageable);

    List<String> ids = result.getContent().stream().map(OrderEntity::getId).toList();
    Map<String, Instant> deliveredAtByOrderId = loadFirstDeliveredAtByOrderIds(ids);

    List<Map<String, Object>> orders = new ArrayList<>();
    for (OrderEntity o : result.getContent()) {
      UserEntity customer = o.getUser();
      UserProfile profile = userProfileRepository.findById(customer.getId()).orElse(null);
      orders.add(
          toEmployeeDeliveryOrderAdminRow(
              o,
              orderLineRepository.findByOrder_Id(o.getId()),
              profile,
              customer,
              deliveredAtByOrderId.get(o.getId())));
    }

    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("assignedCount", assignedCount);
    summary.put("shippedCount", shippedCount);
    summary.put("deliveredCount", deliveredCount);
    summary.put("deliverySuccessRate", deliverySuccessRate);

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("summary", summary);
    body.put("orders", orders);
    body.put("page", result.getNumber());
    body.put("size", result.getSize());
    body.put("totalElements", result.getTotalElements());
    body.put("totalPages", result.getTotalPages());
    body.put("hasNext", result.hasNext());
    return body;
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listCategories() {
    return categoryRepository.findAllActive().stream()
        .map(
            c -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("id", c.getSlug());
              row.put("name", c.getName());
              row.put("createdByAdminEmail", c.getCreatedByAdminEmail());
              row.put("deleted", false);
              row.put("deletedAt", null);
              return row;
            })
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listCategoriesPage(int page, int size) {
    Pageable pageable =
        PageRequest.of(Math.max(0, page), Math.max(1, Math.min(50, size)), Sort.by("name").ascending());
    // Active categories only — soft-deleted leftovers are ignored going forward (hard delete is the model).
    Page<Category> result = categoryRepository.findByDeletedAtIsNull(pageable);
    List<Map<String, Object>> items =
        result.getContent().stream()
            .map(
                c -> {
                  Map<String, Object> row = new LinkedHashMap<>();
                  row.put("id", c.getSlug());
                  row.put("name", c.getName());
                  row.put("createdByAdminEmail", c.getCreatedByAdminEmail());
                  row.put("deleted", false);
                  row.put("deletedAt", null);
                  return row;
                })
            .toList();
    return pagedResponse(items, result.getNumber(), result.getSize(), result.hasNext());
  }

  @Transactional(readOnly = true)
  public Map<String, Object> categoriesOverview() {
    List<Product> allProducts =
        productRepository.findAllWithCategory().stream()
            .filter(p -> p.getDeletedAt() == null)
            .filter(p -> p.getCategory() != null && p.getCategory().getDeletedAt() == null)
            .toList();
    Map<String, List<Product>> bySlug =
        allProducts.stream().collect(Collectors.groupingBy(p -> p.getCategory().getSlug()));

    Map<String, BigDecimal> revenueBySlug = new HashMap<>();
    for (Object[] row : orderLineRepository.sumLineTotalsInrByCategorySlug()) {
      if (row[0] == null) continue;
      revenueBySlug.put(String.valueOf(row[0]), (BigDecimal) row[1]);
    }

    BigDecimal totalPurchased =
        revenueBySlug.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

    List<Category> cats =
        categoryRepository.findAllActive().stream()
            .sorted(Comparator.comparing(Category::getName, String.CASE_INSENSITIVE_ORDER))
            .toList();

    List<Map<String, Object>> items = new ArrayList<>();
    for (Category c : cats) {
      List<Product> plist = bySlug.getOrDefault(c.getSlug(), List.of());
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", c.getSlug());
      m.put("name", c.getName());
      m.put("createdByAdminEmail", c.getCreatedByAdminEmail());
      m.put("productCount", plist.size());
      m.put(
          "purchasedValueInr",
          revenueBySlug.getOrDefault(c.getSlug(), BigDecimal.ZERO).longValue());
      m.put("products", plist.stream().map(this::productBriefForOverview).toList());
      items.add(m);
    }

    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("totalCategories", cats.size());
    summary.put("totalProducts", allProducts.size());
    summary.put("totalPurchasedValueInr", totalPurchased.longValue());

    return Map.of("summary", summary, "categories", items);
  }

  private Map<String, Object> productBriefForOverview(Product p) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", p.getId());
    m.put("name", p.getName());
    m.put("sku", p.getSku());
    m.put("priceInr", p.getPriceInr().longValue());
    m.put("published", p.isPublished());
    return m;
  }

  private String currentAdminEmailOrNull() {
    try {
      String email = resolveCurrentAdminUser().getEmail();
      return email != null && !email.isBlank() ? email.trim() : null;
    } catch (ApiException ex) {
      return null;
    }
  }

  @Transactional
  public Map<String, Object> createCategory(String name) {
    if (name == null || name.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "name required");
    }
    String slug = SlugUtil.slug(name);
    Category c;
    var existing = categoryRepository.findById(slug).orElse(null);
    if (existing != null) {
      if (existing.getDeletedAt() == null) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Category exists");
      }
      existing.setDeletedAt(null);
      existing.setName(name.trim());
      existing.setCreatedByAdminEmail(currentAdminEmailOrNull());
      c = categoryRepository.save(existing);
    } else {
      c = new Category();
      c.setSlug(slug);
      c.setName(name.trim());
      c.setCreatedByAdminEmail(currentAdminEmailOrNull());
      int maxOrder =
          categoryRepository.findAll().stream().mapToInt(Category::getDisplayOrder).max().orElse(0);
      c.setDisplayOrder(maxOrder + 1);
      categoryRepository.save(c);
    }
    Map<String, Object> catPayload = new LinkedHashMap<>();
    catPayload.put("id", slug);
    catPayload.put("name", c.getName());
    catPayload.put("createdByAdminEmail", c.getCreatedByAdminEmail());
    return Map.of("category", catPayload);
  }

  @Transactional
  public Map<String, Object> updateCategory(String id, Map<String, Object> body) {
    Category c =
        categoryRepository
            .findById(id)
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Not found"));
    if (body.containsKey("name")) c.setName(String.valueOf(body.get("name")));
    categoryRepository.save(c);
    return Map.of("category", Map.of("id", c.getSlug(), "name", c.getName()));
  }

  @Transactional
  public Map<String, Object> deleteCategory(String id) {
    Category c =
        categoryRepository
            .findById(id)
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Category not found"));
    long productCount = productRepository.countByCategory_Slug(id);
    if (productCount > 0) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "CATEGORY_IN_USE",
          "Cannot delete category: "
              + productCount
              + " product(s) still use this category.");
    }
    categoryRepository.delete(c);
    return Map.of("removed", id);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listProductsPage(
      int page, int pageSize, String sort, String search, boolean lowStockOnly) {
    return catalogService.listProductsPageForAdmin(page, pageSize, sort, search, lowStockOnly);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getProductAdmin(String id) {
    Product p =
        productRepository
            .findById(id)
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Product not found"));
    var fits =
        fitmentLabelRepository.findByProductIdIn(List.of(id)).stream()
            .map(ProductFitmentLabel::getLabel)
            .toList();
    var fitCarIds =
        fitmentCarRepository.findByProductIdIn(List.of(id)).stream()
            .map(ProductFitmentCar::getCarId)
            .toList();
    var carsById =
        carModelRepository.findAllById(fitCarIds).stream()
            .collect(Collectors.toMap(CarModelEntity::getId, c -> c, (a, b) -> a));
    var spec = vehicleSpecRepository.findById(id).orElse(null);
    return productPresenter.toAdminMap(p, fits, fitCarIds, carsById, spec);
  }

  @Transactional(rollbackFor = Exception.class)
  public Map<String, Object> upsertProduct(Map<String, Object> body, String idOrNull) {
    String id =
        idOrNull != null
            ? idOrNull
            : (body.get("id") != null ? String.valueOf(body.get("id")) : "prd_" + UUID.randomUUID());
    boolean isNew = !productRepository.existsById(id);
    Product p = productRepository.findById(id).orElseGet(Product::new);
    int previousStock = isNew ? LowStockAlertService.NO_PRIOR_STOCK : p.getStockQuantity();
    p.setId(id);
    String catName = String.valueOf(body.getOrDefault("category", "Misc"));
    Category cat = resolveOrCreateCategoryForProduct(catName);
    p.setCategory(cat);
    String typeStr = String.valueOf(body.getOrDefault("type", "part"));
    p.setType(ProductType.valueOf(typeStr));
    p.setSku(String.valueOf(body.getOrDefault("sku", p.getSku() != null ? p.getSku() : id)));
    p.setName(String.valueOf(body.getOrDefault("name", p.getName() != null ? p.getName() : "Product")));
    int price = intFrom(body.get("price"), 0);
    p.setPriceInr(BigDecimal.valueOf(price));
    int purchasePrice = intFrom(body.get("purchasePrice"), 0);
    p.setPurchasePriceInr(BigDecimal.valueOf(purchasePrice));
    Integer discountedPrice = intFrom(body.get("discountedPrice"), (Integer) null);
    p.setDiscountedPriceInr(discountedPrice != null ? BigDecimal.valueOf(discountedPrice) : null);
    int stock = intFrom(body.get("totalStock"), intFrom(body.get("stock_quantity"), 1));
    p.setStockQuantity(stock);
    if (body.containsKey("published")) {
      p.setPublished(Boolean.TRUE.equals(body.get("published")));
    } else if (isNew) {
      p.setPublished(true);
    }
    if (body.containsKey("imageKey")) p.setImageKey(strOrNull(body.get("imageKey")));
    if (body.containsKey("description")) p.setDescription(strOrNull(body.get("description")));
    if (p.getType() == ProductType.part) {
      p.setMetadata(mergePartImageMetadata(p.getMetadata(), body));
    } else if (body.get("metadata") instanceof Map<?, ?> vehicleMd) {
      p.setMetadata(mergeVehicleProductMetadata(p.getMetadata(), vehicleMd));
    } else if (p.getMetadata() == null) {
      p.setMetadata(objectMapper.createObjectNode());
    }
    Product savedProduct = productRepository.save(p);
    p = savedProduct;
    if (p.getType() == ProductType.part) {
      if (body.containsKey("compatibleCars") || body.containsKey("fitmentLabels")) {
        fitmentLabelRepository.deleteByProductId(p.getId());
        // Legacy free-text list
        if (body.containsKey("compatibleCars")) {
          @SuppressWarnings("unchecked")
          List<String> cars = (List<String>) body.get("compatibleCars");
          if (cars != null) {
            for (String label : cars) {
              if (label == null || label.isBlank()) continue;
              ProductFitmentLabel f = new ProductFitmentLabel();
              f.setProductId(p.getId());
              f.setLabel(label.trim());
              fitmentLabelRepository.save(f);
            }
          }
        }
        // Structured fitment labels from single-add form (Excel-style)
        if (body.containsKey("fitmentLabels")) {
          @SuppressWarnings("unchecked")
          List<Map<String, String>> fitmentLabels = (List<Map<String, String>>) body.get("fitmentLabels");
          if (fitmentLabels != null) {
            for (Map<String, String> entry : fitmentLabels) {
              String lv = entry == null ? null : entry.get("labelValue");
              if (lv == null || lv.isBlank()) continue;
              ProductFitmentLabel f = new ProductFitmentLabel();
              f.setProductId(p.getId());
              f.setLabel(lv.trim());
              fitmentLabelRepository.save(f);
            }
          }
        }
      }
      if (body.containsKey("compatibleCarIds")) {
        fitmentCarRepository.deleteByProductId(p.getId());
        @SuppressWarnings("unchecked")
        List<String> carIds = (List<String>) body.get("compatibleCarIds");
        if (carIds != null) {
          for (String carId : carIds) {
            if (carId == null || carId.isBlank() || !carModelRepository.existsById(carId.trim())) continue;
            ProductFitmentCar fc = new ProductFitmentCar();
            fc.setProductId(p.getId());
            fc.setCarId(carId.trim());
            fitmentCarRepository.save(fc);
          }
        }
      }
      vehicleSpecRepository.findById(p.getId()).ifPresent(vehicleSpecRepository::delete);
    } else {
      fitmentLabelRepository.deleteByProductId(p.getId());
      ProductVehicleSpec spec = vehicleSpecRepository.findById(savedProduct.getId()).orElse(null);
      if (spec == null) {
        spec = new ProductVehicleSpec();
        // @MapsId uses the Product id as PK; avoid setting detached ids manually.
        spec.setProduct(savedProduct);
      } else {
        spec.setProduct(savedProduct);
      }
      @SuppressWarnings("unchecked")
      Map<String, Object> meta = (Map<String, Object>) body.get("carMeta");
      if (meta != null) {
        if (meta.get("year") != null) spec.setModelYear(Short.valueOf(String.valueOf(meta.get("year"))));
        if (meta.get("condition") != null) spec.setCondition(String.valueOf(meta.get("condition")));
        if (meta.get("km") != null) spec.setOdometerKm(intFrom(meta.get("km"), null));
        if (meta.get("fuel") != null) spec.setFuel(String.valueOf(meta.get("fuel")));
        if (meta.get("transmission") != null) spec.setTransmission(String.valueOf(meta.get("transmission")));
        if (meta.get("location") != null) spec.setLocation(String.valueOf(meta.get("location")));
      }
      if (body.get("image") != null) {
        spec.setPrimaryImageUrl(
            uploadStorageService.persistVehicleImageIfDataUrl(
                p.getId(), String.valueOf(body.get("image"))));
      }
      if (body.get("imageAlt") != null) spec.setImageAlt(String.valueOf(body.get("imageAlt")));
      if (body.containsKey("gallery") && body.get("gallery") instanceof List<?> galleryRaw) {
        List<Object> persistedGallery =
            uploadStorageService.persistGalleryIfDataUrls(
                p.getId(), galleryRaw.stream().map(x -> (Object) x).toList());
        spec.setGallery(objectMapper.valueToTree(persistedGallery));
      }
      if (spec.getCondition() == null) spec.setCondition("second-hand");
      vehicleSpecRepository.save(spec);
    }
    Product saved = productRepository.findById(p.getId()).orElseThrow();
    lowStockAlertService.onStockChanged(saved, previousStock, saved.getStockQuantity());
    var fits =
        fitmentLabelRepository.findByProductIdIn(List.of(saved.getId())).stream()
            .map(ProductFitmentLabel::getLabel)
            .toList();
    var fitCarIds =
        fitmentCarRepository.findByProductIdIn(List.of(saved.getId())).stream()
            .map(ProductFitmentCar::getCarId)
            .toList();
    var carsById =
        carModelRepository.findAllById(fitCarIds).stream()
            .collect(Collectors.toMap(CarModelEntity::getId, c -> c, (a, b) -> a));
    var spec = vehicleSpecRepository.findById(saved.getId()).orElse(null);
    recordProductAudit(saved.getId(), isNew ? "created" : "updated");
    return Map.of("product", productPresenter.toAdminMap(saved, fits, fitCarIds, carsById, spec));
  }

  /** Preserves existing JSON; stores optional primary image URL + gallery for catalog parts. Also merges part detail fields. */
  private ObjectNode mergePartImageMetadata(JsonNode existing, Map<String, Object> body) {
    ObjectNode meta =
        existing != null && existing.isObject()
            ? (ObjectNode) existing.deepCopy()
            : objectMapper.createObjectNode();
    if (body.containsKey("primaryImageUrl")) {
      String u = strOrNull(body.get("primaryImageUrl"));
      if (u != null && !u.isBlank()) {
        meta.put("primaryImageUrl", uploadStorageService.persistVehicleImageIfDataUrl("parts", u));
      } else {
        meta.remove("primaryImageUrl");
      }
    } else if (body.containsKey("image")) {
      String u = strOrNull(body.get("image"));
      if (u != null && !u.isBlank()) {
        meta.put("primaryImageUrl", u);
      }
    }
    if (body.containsKey("galleryExtras")) {
      List<Object> persistedGallery =
          body.get("galleryExtras") instanceof List<?> galleryRaw
              ? uploadStorageService.persistGalleryIfDataUrls(
                  "parts", galleryRaw.stream().map(x -> (Object) x).toList())
              : List.of();
      meta.set("galleryExtras", objectMapper.valueToTree(persistedGallery));
    }
    // Extra part detail fields from single-add / Excel format
    for (String key : List.of("partNumber", "brand", "unitVolume", "supplierName")) {
      if (body.containsKey(key)) {
        String v = strOrNull(body.get(key));
        if (v != null && !v.isBlank()) meta.put(key, v);
        else meta.remove(key);
      }
    }
    mergeStockCountersFromRequestMetadata(meta, body);
    return meta;
  }

  /**
   * Merges {@code stockIn}, {@code stockOut}, and {@code openingStock} from {@code body.metadata}
   * (Add Product) without replacing unrelated metadata keys. Excel import sets these directly on
   * the entity and does not use this path.
   */
  private void mergeStockCountersFromRequestMetadata(ObjectNode meta, Map<String, Object> body) {
    if (!body.containsKey("metadata")) {
      return;
    }
    Object raw = body.get("metadata");
    if (!(raw instanceof Map<?, ?> md)) {
      return;
    }
    for (String key : List.of("stockIn", "stockOut", "openingStock")) {
      if (!md.containsKey(key)) {
        continue;
      }
      Object v = md.get(key);
      if (v == null) {
        meta.remove(key);
        continue;
      }
      Integer n = intFrom(v, (Integer) null);
      if (n == null) {
        continue;
      }
      meta.put(key, Math.max(0, n));
    }
  }

  private ObjectNode mergeVehicleProductMetadata(JsonNode existing, Map<?, ?> fromBody) {
    ObjectNode meta =
        existing != null && existing.isObject()
            ? (ObjectNode) existing.deepCopy()
            : objectMapper.createObjectNode();
    for (Map.Entry<?, ?> e : fromBody.entrySet()) {
      if (e.getKey() == null) continue;
      String key = String.valueOf(e.getKey());
      Object v = e.getValue();
      if (v == null) {
        meta.remove(key);
      } else if (v instanceof String s) {
        meta.put(key, s);
      } else {
        meta.set(key, objectMapper.valueToTree(v));
      }
    }
    return meta;
  }

  private static Integer intFrom(Object o, Integer def) {
    if (o == null) return def;
    if (o instanceof Number n) return n.intValue();
    try {
      return Integer.parseInt(String.valueOf(o));
    } catch (NumberFormatException e) {
      return def;
    }
  }

  private static int intFrom(Object o, int def) {
    Integer x = intFrom(o, (Integer) null);
    return x != null ? x : def;
  }

  private static String strOrNull(Object o) {
    return o == null ? null : String.valueOf(o);
  }

  /**
   * Match existing category by slug or case-insensitive name; otherwise insert a new row (same
   * transaction as product save).
   */
  private Category resolveOrCreateCategoryForProduct(String catName) {
    String trimmed =
        catName == null || catName.isBlank() ? "Misc" : catName.trim();
    String slug = SlugUtil.slug(trimmed);
    Category category =
        categoryRepository
        .findById(slug)
        .or(
            () ->
                categoryRepository.findAll().stream()
                    .filter(c -> c.getName().equalsIgnoreCase(trimmed))
                    .findFirst())
        .orElseGet(() -> createCategoryRow(trimmed, slug));
    if (category.getDeletedAt() != null) {
      category.setDeletedAt(null);
      category = categoryRepository.save(category);
    }
    return category;
  }

  private Category createCategoryRow(String displayName, String slug) {
    Category c = new Category();
    c.setSlug(slug);
    c.setName(displayName);
    c.setCreatedByAdminEmail(currentAdminEmailOrNull());
    int maxOrder =
        categoryRepository.findAll().stream().mapToInt(Category::getDisplayOrder).max().orElse(0);
    c.setDisplayOrder(maxOrder + 1);
    return categoryRepository.save(c);
  }

  @Transactional(rollbackFor = Exception.class)
  public ProductImportReport bulkImportProducts(MultipartFile file, String categoryName) {
    // Step 1: parse Excel
    List<ProductExcelParser.ParsedRow> parsed = productExcelParser.parse(file);

    if (parsed.isEmpty()) {
      return new ProductImportReport(0, 0, 0, List.of(), List.of("No importable rows found in file"));
    }

    // Step 2: collect all final SKUs and pre-check against active DB products
    List<String> allSkus = parsed.stream().map(ProductExcelParser.ParsedRow::sku).toList();
    List<String> conflicts = productRepository.findBySkuInAndDeletedAtIsNull(allSkus)
        .stream().map(Product::getSku).toList();
    if (!conflicts.isEmpty()) {
      throw new ApiException(HttpStatus.CONFLICT, "SKU_CONFLICT",
          "SKUs already exist: " + String.join(", ", conflicts));
    }

    // Step 3: resolve/create category
    String catName = (categoryName != null && !categoryName.isBlank()) ? categoryName : "Service Parts";
    Category category = resolveOrCreateCategoryForProduct(catName);

    // Step 4: save products and fitment labels
    List<ProductImportRowResult> rowResults = new ArrayList<>();
    int created = 0;

    for (ProductExcelParser.ParsedRow row : parsed) {
      String productId = "prd_" + UUID.randomUUID();
      Product p = new Product();
      p.setId(productId);
      p.setCategory(category);
      p.setType(ProductType.part);
      p.setSku(row.sku());
      p.setName(row.partName());
      p.setPriceInr(row.sellingPrice().compareTo(BigDecimal.ZERO) > 0
          ? row.sellingPrice() : BigDecimal.ZERO);
      p.setPurchasePriceInr(row.purchasePrice().compareTo(BigDecimal.ZERO) > 0
          ? row.purchasePrice() : BigDecimal.ZERO);
      p.setStockQuantity(row.currentStock());
      p.setPublished(!row.partName().isBlank() && row.currentStock() > 0);
      p.setImageKey("brakes");

      ObjectNode meta = objectMapper.createObjectNode();
      if (!row.partNumber().isBlank()) meta.put("partNumber", row.partNumber());
      if (!row.brand().isBlank()) meta.put("brand", row.brand());
      if (!row.unitVolume().isBlank()) meta.put("unitVolume", row.unitVolume());
      if (!row.supplierName().isBlank()) meta.put("supplierName", row.supplierName());
      meta.put("openingStock", row.openingStock());
      meta.put("stockIn", row.stockIn());
      meta.put("stockOut", row.stockOut());
      ObjectNode importedFrom = objectMapper.createObjectNode();
      importedFrom.put("rowNumber", row.rowNumber());
      importedFrom.put("file", file.getOriginalFilename());
      meta.set("importedFrom", importedFrom);
      p.setMetadata(meta);

      productRepository.save(p);
      lowStockAlertService.onStockChanged(p, LowStockAlertService.NO_PRIOR_STOCK, p.getStockQuantity());

      // Fitment labels
      for (Map.Entry<String, String> fitment : Map.of(
          "vehicle_model", row.vehicleModel(),
          "year", row.year(),
          "vehicle_make", row.vehicleMake(),
          "vehicle_variant", row.vehicleVariant(),
          "vehicle_fuel", row.vehicleFuel()
      ).entrySet()) {
        String val = fitment.getValue();
        if (val == null || val.isBlank()) continue;
        ProductFitmentLabel lbl = new ProductFitmentLabel();
        lbl.setProductId(productId);
        lbl.setLabel(val);
        fitmentLabelRepository.save(lbl);
      }

      rowResults.add(new ProductImportRowResult(row.rowNumber(), row.sku(), row.partName(), "CREATED", null));
      created++;
    }

    return new ProductImportReport(parsed.size(), created, 0, rowResults, List.of());
  }

  @Transactional(rollbackFor = Exception.class)
  public Map<String, Object> deleteProduct(String id) {
    Product p =
        productRepository
            .findById(id)
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Product not found"));
    p.setDeletedAt(Instant.now());
    p.setPublished(false);
    productRepository.save(p);
    recordProductAudit(id, "deleted");
    return Map.of("removed", id);
  }

  @Transactional(rollbackFor = Exception.class)
  public Map<String, Object> patchPublish(String id, boolean published) {
    Product p =
        productRepository
            .findById(id)
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Not found"));
    p.setPublished(published);
    productRepository.save(p);
    var fits =
        fitmentLabelRepository.findByProductIdIn(List.of(id)).stream()
            .map(ProductFitmentLabel::getLabel)
            .toList();
    var fitCarIds =
        fitmentCarRepository.findByProductIdIn(List.of(id)).stream()
            .map(ProductFitmentCar::getCarId)
            .toList();
    var carsById =
        carModelRepository.findAllById(fitCarIds).stream()
            .collect(Collectors.toMap(CarModelEntity::getId, c -> c, (a, b) -> a));
    var spec = vehicleSpecRepository.findById(id).orElse(null);
    recordProductAudit(id, published ? "published" : "unpublished");
    return Map.of("product", productPresenter.toAdminMap(p, fits, fitCarIds, carsById, spec));
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getOrderAdmin(String orderId) {
    requireAdminAccess();
    String id = orderId == null ? "" : orderId.trim();
    if (id.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "orderId required");
    }
    OrderEntity order =
        orderRepository
            .findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    List<com.carnalysys.domain.OrderLine> lines = orderLineRepository.findByOrder_Id(order.getId());
    AdminUser admin = resolveCurrentAdminUser();
    if ("delivery".equalsIgnoreCase(admin.getRole())) {
      String assigned = order.getAssignedDeliveryAdminEmail();
      if (assigned == null
          || !assigned.trim().equalsIgnoreCase(admin.getEmail().trim())) {
        throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Order is not assigned to you");
      }
      return Map.of("order", orderService.toDeliveryPartnerOrderMap(order, lines));
    }
    return Map.of("order", orderService.toAdminOrderMap(order, lines));
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listOrdersAdminPage(String phone, int page, int size) {
    AdminUser admin = resolveCurrentAdminUser();
    if ("delivery".equalsIgnoreCase(admin.getRole())) {
      return listOrdersForDeliveryPartner(admin.getEmail(), phone, page, size);
    }
    int safePage = Math.max(0, page);
    int safeSize = Math.max(1, Math.min(50, size));
    if (phone != null && !phone.isBlank()) {
      return orderService.listAllAdminByPhonePage(phone, safePage, safeSize);
    }
    var pageResult = orderRepository.findAllByOrderByPlacedAtDesc(PageRequest.of(safePage, safeSize));
    List<Map<String, Object>> rows =
        pageResult.getContent().stream()
            .map(
                o ->
                    orderService.toAdminOrderMap(
                        o, orderLineRepository.findByOrder_Id(o.getId())))
            .toList();
    return Map.of(
        "items", rows,
        "page", safePage,
        "size", safeSize,
        "hasMore", pageResult.hasNext(),
        "nextPage", pageResult.hasNext() ? safePage + 1 : safePage);
  }

  private Map<String, Object> listOrdersForDeliveryPartner(
      String deliveryEmail, String phone, int page, int size) {
    int safePage = Math.max(0, page);
    int safeSize = Math.max(1, Math.min(50, size));
    Pageable pageable = PageRequest.of(safePage, safeSize);
    Page<OrderEntity> pageResult;
    if (phone != null && !phone.isBlank()) {
      String normalized = orderService.normalizePhoneForAdminListing(phone);
      pageResult =
          orderRepository.findByAssignedDeliveryAdminEmailIgnoreCaseAndUser_PhoneE164OrderByPlacedAtDesc(
              deliveryEmail, normalized, pageable);
    } else {
      pageResult =
          orderRepository.findByAssignedDeliveryAdminEmailIgnoreCaseOrderByPlacedAtDesc(
              deliveryEmail, pageable);
    }
    List<Map<String, Object>> rows =
        pageResult.getContent().stream()
            .map(
                o ->
                    orderService.toDeliveryPartnerOrderMap(
                        o, orderLineRepository.findByOrder_Id(o.getId())))
            .toList();
    return Map.of(
        "items", rows,
        "page", safePage,
        "size", safeSize,
        "hasMore", pageResult.hasNext(),
        "nextPage", pageResult.hasNext() ? safePage + 1 : safePage);
  }

  @Transactional
  public Map<String, Object> patchOrderStatus(String id, String status) {
    AdminUser admin = resolveCurrentAdminUser();
    if ("delivery".equalsIgnoreCase(admin.getRole())) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "VALIDATION_ERROR",
          "Use delivery workflow endpoints to update assigned orders");
    }
    return orderService.patchStatusAdmin(id, status);
  }

  @Transactional
  public Map<String, Object> deliveryAcceptAssignment(String orderId) {
    AdminUser admin = resolveCurrentDeliveryAdminUser();
    return deliveryWorkflowService.acceptAssignment(orderId, admin.getEmail());
  }

  @Transactional
  public Map<String, Object> deliveryMarkOutForDelivery(String orderId) {
    AdminUser admin = resolveCurrentDeliveryAdminUser();
    return deliveryWorkflowService.markOutForDelivery(orderId, admin.getEmail());
  }

  @Transactional
  public Map<String, Object> deliveryResendOtp(String orderId) {
    AdminUser admin = resolveCurrentDeliveryAdminUser();
    return deliveryWorkflowService.resendDeliveryOtp(orderId, admin.getEmail());
  }

  @Transactional
  public Map<String, Object> deliveryVerifyOtp(String orderId, String otp) {
    AdminUser admin = resolveCurrentDeliveryAdminUser();
    return deliveryWorkflowService.verifyDeliveryOtp(orderId, admin.getEmail(), otp);
  }

  @Transactional
  public Map<String, Object> deliveryUploadProof(String orderId, String proofPhotoDataUrl) {
    AdminUser admin = resolveCurrentDeliveryAdminUser();
    return deliveryWorkflowService.uploadDeliveryProof(orderId, admin.getEmail(), proofPhotoDataUrl);
  }

  @Transactional
  public Map<String, Object> deliveryMarkDelivered(String orderId) {
    AdminUser admin = resolveCurrentDeliveryAdminUser();
    return deliveryWorkflowService.markDelivered(orderId, admin.getEmail());
  }

  @Transactional(readOnly = true)
  public org.springframework.http.ResponseEntity<byte[]> getOrderDeliveryProof(String orderId) {
    requireAdminAccess();
    String id = orderId == null ? "" : orderId.trim();
    if (id.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "orderId required");
    }
    OrderEntity order =
        orderRepository
            .findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    AdminUser admin = resolveCurrentAdminUser();
    if ("delivery".equalsIgnoreCase(admin.getRole())) {
      String assigned = order.getAssignedDeliveryAdminEmail();
      if (assigned == null
          || !assigned.trim().equalsIgnoreCase(admin.getEmail().trim())) {
        throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Order is not assigned to you");
      }
    }
    byte[] body = deliveryWorkflowService.readDeliveryProofForOrder(order);
    String mediaType = deliveryWorkflowService.deliveryProofMediaType(order);
    return org.springframework.http.ResponseEntity.ok()
        .header(
            org.springframework.http.HttpHeaders.CONTENT_TYPE,
            mediaType)
        .body(body);
  }

  @Transactional
  public Map<String, Object> deliveryMarkFailed(String orderId, String reason, String note) {
    AdminUser admin = resolveCurrentDeliveryAdminUser();
    return deliveryWorkflowService.markDeliveryFailed(orderId, admin.getEmail(), reason, note);
  }

  @Transactional
  public Map<String, Object> assignDelivery(String orderId, String deliveryAdminEmail) {
    String email = deliveryAdminEmail == null ? "" : deliveryAdminEmail.trim().toLowerCase();
    if (email.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "deliveryAdminEmail required");
    }
    var delivery =
        adminUserRepository
            .findByEmailIgnoreCase(email)
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Delivery admin not found"));
    if (!"delivery".equalsIgnoreCase(delivery.getRole())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Assignee must be delivery role");
    }
    if (delivery.getDeletedAt() != null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Delivery employee is deleted");
    }
    OrderEntity order =
        orderRepository
            .findById(orderId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Order not found"));
    boolean alreadyAssignedToOrder = email.equalsIgnoreCase(order.getAssignedDeliveryAdminEmail());
    if (!alreadyAssignedToOrder
        && !EmployeeAvailability.isStoredOnline(delivery.getAvailabilityStatus())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Delivery admin is not online");
    }
    order.setAssignedDeliveryAdminEmail(email);
    order.setAssignedDeliveryAt(Instant.now());
    orderRepository.save(order);
    deliveryWorkflowService.initializeAssignedStage(order);
    if (!"busy".equalsIgnoreCase(delivery.getAvailabilityStatus())) {
      delivery.setAvailabilityStatus("busy");
      adminUserRepository.save(delivery);
    }
    notificationService.notifyAdminEmail(
        email,
        "admin_alerts",
        "Order assigned",
        "Order " + orderId + " has been assigned to you.",
        "order",
        orderId,
        Map.of("orderId", orderId));
    String assigneeLabel = deliveryAssigneeLabel(delivery);
    notificationService.notifySuperAdminAndSalesOrderAssigned(orderId, assigneeLabel);
    whatsappService.sendDeliveryAssignmentBestEffort(delivery.getPhoneE164(), orderId);
    return Map.of("assigned", true, "orderId", orderId, "deliveryAdminEmail", email);
  }

  private static String deliveryAssigneeLabel(AdminUser delivery) {
    if (delivery.getFullName() != null && !delivery.getFullName().isBlank()) {
      return delivery.getFullName().trim();
    }
    if (delivery.getPhoneE164() != null && !delivery.getPhoneE164().isBlank()) {
      return delivery.getPhoneE164().trim();
    }
    return delivery.getEmail();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> deliveryPartnerSummaryForCurrent() {
    AdminUser admin = resolveCurrentDeliveryAdminUser();
    long deliveriesDone =
        orderRepository.countByAssignedDeliveryAdminEmailIgnoreCaseAndStatus(
            admin.getEmail(), OrderStatus.delivered);
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("deliveriesDone", deliveriesDone);
    m.put("availability", effectiveAvailabilityForAdmin(admin));
    m.put("availabilityStatus", admin.getAvailabilityStatus());
    m.put("lastLoginAt", admin.getLastLoginAt() != null ? admin.getLastLoginAt().toString() : null);
    m.put("lastLogoutAt", admin.getLastLogoutAt() != null ? admin.getLastLogoutAt().toString() : null);
    return m;
  }

  private AdminUser resolveCurrentDeliveryAdminUser() {
    AdminUser admin = resolveCurrentAdminUser();
    if (!"delivery".equalsIgnoreCase(admin.getRole())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Delivery role required");
    }
    return admin;
  }

  /**
   * Lowercase {@code admin_users.email} for in-app admin notifications (list / mark-read / push keys).
   * Matches {@link NotificationService#notifyAdminEmail} and uses the same operator resolution as
   * {@link #resolveCurrentAdminUser()} (Bearer JWT subject = user UUID, linked by {@code users.phone_e164}
   * to {@code admin_users.phone_e164} after phone OTP sign-in).
   */
  @Transactional(readOnly = true)
  public String currentAdminNotificationRecipientId() {
    return resolveCurrentAdminUser().getEmail().trim().toLowerCase();
  }

  private static final class DeliveryDateWindow {
    private final Instant startInclusive;
    private final Instant endExclusive;

    DeliveryDateWindow(Instant startInclusive, Instant endExclusive) {
      this.startInclusive = startInclusive;
      this.endExclusive = endExclusive;
    }

    boolean matchesUpdatedAt(Instant updatedAt) {
      if (updatedAt == null) {
        return false;
      }
      if (startInclusive != null && updatedAt.isBefore(startInclusive)) {
        return false;
      }
      if (endExclusive != null && !updatedAt.isBefore(endExclusive)) {
        return false;
      }
      return true;
    }
  }

  private static DeliveryDateWindow parseDeliveryDateWindow(String from, String to, String month) {
    String mo = month != null ? month.trim() : "";
    if (!mo.isBlank()) {
      YearMonth ym = YearMonth.parse(mo);
      Instant start = ym.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
      Instant end = ym.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
      return new DeliveryDateWindow(start, end);
    }
    String fs = from != null ? from.trim() : "";
    String ts = to != null ? to.trim() : "";
    Instant startInc = null;
    Instant endExc = null;
    if (!fs.isBlank()) {
      startInc = LocalDate.parse(fs).atStartOfDay(ZoneOffset.UTC).toInstant();
    }
    if (!ts.isBlank()) {
      endExc = LocalDate.parse(ts).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }
    return new DeliveryDateWindow(startInc, endExc);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listDeliveryOrdersForCurrent(String from, String to, String month) {
    AdminUser admin = resolveCurrentDeliveryAdminUser();
    DeliveryDateWindow window = parseDeliveryDateWindow(from, to, month);
    List<OrderEntity> orders =
        orderRepository.findByAssignedDeliveryAdminEmailIgnoreCaseAndStatusInOrderByUpdatedAtDesc(
            admin.getEmail(), DELIVERY_PARTNER_LIST_STATUSES);
    return orders.stream()
        .filter(o -> window.matchesUpdatedAt(o.getUpdatedAt()))
        .map(
            o ->
                orderService.toDeliveryPartnerOrderMap(
                    o, orderLineRepository.findByOrder_Id(o.getId())))
        .toList();
  }

  private static final List<String> WORKFORCE_ROLES = List.of("sales", "delivery", "custom");

  @Transactional(readOnly = true)
  public Map<String, Object> getCurrentAdminMe() {
    AdminUser admin = resolveCurrentAdminUser();
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", admin.getId().toString());
    m.put("phone", admin.getPhoneE164());
    m.put("email", admin.getEmail());
    m.put("name", admin.getFullName());
    m.put("role", admin.getRole());
    if (admin.getCustomRoleId() != null) {
      List<String> pageKeys = customRoleService.pageKeysForRole(admin.getCustomRoleId());
      Map<String, Object> customRole = new LinkedHashMap<>();
      customRole.put("id", admin.getCustomRoleId().toString());
      customRole.put(
          "name",
          customRoleService
              .findById(admin.getCustomRoleId())
              .map(CustomRole::getName)
              .orElse(null));
      customRole.put("pageKeys", pageKeys);
      m.put("customRole", customRole);
      m.put("pageKeys", pageKeys);
    } else {
      m.put("customRole", null);
      m.put("pageKeys", List.of());
    }
    return m;
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listCustomRoles() {
    return customRoleService.listRoles();
  }

  @Transactional
  public Map<String, Object> createCustomRole(Map<String, Object> body) {
    AdminUser actor = resolveCurrentAdminUser();
    return customRoleService.createRole(body, formatWorkforceActorLabel(actor));
  }

  @Transactional
  public Map<String, Object> updateCustomRolePermissions(String id, Map<String, Object> body) {
    UUID roleId;
    try {
      roleId = UUID.fromString(id == null ? "" : id.trim());
    } catch (IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid custom role id");
    }
    return customRoleService.replacePermissions(roleId, body);
  }

  @Transactional
  public List<Map<String, Object>> listEmployees(Boolean deleted) {
    requireSuperAdmin();
    Sort sort = Sort.by("phoneE164").ascending();
    List<AdminUser> rows =
        Boolean.TRUE.equals(deleted)
            ? adminUserRepository.findByRoleInAndDeletedAtIsNotNull(WORKFORCE_ROLES, sort)
            : adminUserRepository.findByRoleInAndDeletedAtIsNull(WORKFORCE_ROLES, sort);
    return rows.stream()
        .peek(this::reconcileStoredDeliveryAvailability)
        .map(this::toEmployeeMap)
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getEmployeesSummary() {
    requireSuperAdmin();
    long total = adminUserRepository.countByRoleInAndDeletedAtIsNull(WORKFORCE_ROLES);
    long active =
        adminUserRepository.countByRoleInAndDeletedAtIsNullAndOnboardingStatus(WORKFORCE_ROLES, "success");
    long inactive =
        adminUserRepository.countByRoleInAndDeletedAtIsNullAndOnboardingStatus(WORKFORCE_ROLES, "pending");
    Instant monthStart =
        YearMonth.now(ZoneOffset.UTC).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    long joinedThisMonth =
        adminUserRepository.countByRoleInAndDeletedAtIsNullAndCreatedAtGreaterThanEqual(
            WORKFORCE_ROLES, monthStart);
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("total", total);
    summary.put("active", active);
    summary.put("inactive", inactive);
    summary.put("joinedThisMonth", joinedThisMonth);
    return summary;
  }

  @Transactional
  public Map<String, Object> listEmployeesPage(int page, int size, Boolean deleted) {
    requireSuperAdmin();
    Pageable pageable =
        PageRequest.of(
            Math.max(0, page), Math.max(1, Math.min(50, size)), Sort.by("createdAt").descending());
    Page<AdminUser> result =
        Boolean.TRUE.equals(deleted)
            ? adminUserRepository.findByRoleInAndDeletedAtIsNotNull(WORKFORCE_ROLES, pageable)
            : adminUserRepository.findByRoleInAndDeletedAtIsNull(WORKFORCE_ROLES, pageable);
    List<Map<String, Object>> items =
        result.getContent().stream()
            .peek(this::reconcileStoredDeliveryAvailability)
            .map(this::toEmployeeMap)
            .toList();
    return pagedResponse(items, result.getNumber(), result.getSize(), result.hasNext());
  }

  @Transactional
  public Map<String, Object> getEmployee(String phone) {
    requireSuperAdmin();
    AdminUser employee = requireWorkforceEmployee(phone);
    reconcileStoredDeliveryAvailability(employee);
    return Map.of("employee", toEmployeeMap(employee));
  }

  @Transactional
  public Map<String, Object> createEmployee(Map<String, Object> body) {
    requireSuperAdmin();
    String phone = parseEmployeePhone(body.get("phone"));
    UserRole role = parseCreateEmployeeRole(body.get("role"));
    String name = parseEmployeeName(body.get("name"));
    Optional<AdminUser> existingPhone = adminUserRepository.findByPhoneE164(phone);
    if (existingPhone.isPresent()) {
      if (existingPhone.get().getDeletedAt() != null) {
        throw new ApiException(
            HttpStatus.BAD_REQUEST,
            "VALIDATION_ERROR",
            "Employee was deleted. Restore them from the deleted employees list.");
      }
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Employee already exists");
    }
    AdminUser a = new AdminUser();
    a.setEmail(workforceEmail(phone));
    a.setPhoneE164(phone);
    a.setRole(role.name());
    a.setFullName(name);
    applyEmployeePhoto(a, body);
    a.setOnboardingStatus("pending");
    a.setCustomRoleId(null);
    if (role == UserRole.custom) {
      AdminUser actor = resolveCurrentAdminUser();
      CustomRole customRole =
          customRoleService.resolveOrCreateForEmployee(body, formatWorkforceActorLabel(actor));
      a.setCustomRoleId(customRole.getId());
    }
    // New employees stay pending until first successful login.
    a.setAvailabilityStatus("pending");
    adminUserRepository.save(a);
    return Map.of("employee", toEmployeeMap(a));
  }

  @Transactional
  public Map<String, Object> updateEmployee(String phone, Map<String, Object> body) {
    requireSuperAdmin();
    AdminUser employee = requireWorkforceEmployee(phone);
    String newPhone = parseEmployeePhone(body.get("phone"));
    String name = parseEmployeeName(body.get("name"));
    if (!newPhone.equals(employee.getPhoneE164())) {
      Optional<AdminUser> phoneTaken = adminUserRepository.findByPhoneE164(newPhone);
      if (phoneTaken.isPresent() && !phoneTaken.get().getId().equals(employee.getId())) {
        if (phoneTaken.get().getDeletedAt() != null) {
          throw new ApiException(
              HttpStatus.BAD_REQUEST,
              "VALIDATION_ERROR",
              "Phone belongs to a deleted employee. Restore them first.");
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Employee already exists");
      }
    }
    String previousRole = employee.getRole();
    String oldEmail = employee.getEmail();
    String newEmail = workforceEmail(newPhone);
    employee.setPhoneE164(newPhone);
    employee.setEmail(newEmail);
    employee.setFullName(name);
    applyEmployeePhoto(employee, body);

    if ("custom".equalsIgnoreCase(previousRole)) {
      UserRole requested = UserRole.from(String.valueOf(body.get("role") == null ? "custom" : body.get("role")));
      if (requested == UserRole.sales || requested == UserRole.delivery) {
        employee.setRole(requested.name());
        employee.setCustomRoleId(null);
        if (!EmployeeAvailability.isPending(employee.getAvailabilityStatus())) {
          if (requested == UserRole.delivery) {
            employee.setAvailabilityStatus("online");
          } else {
            employee.setAvailabilityStatus("busy");
          }
        }
      } else if (requested == UserRole.custom) {
        employee.setRole("custom");
        AdminUser actor = resolveCurrentAdminUser();
        CustomRole customRole =
            customRoleService.resolveOrCreateForEmployee(body, formatWorkforceActorLabel(actor));
        employee.setCustomRoleId(customRole.getId());
      } else {
        throw new ApiException(
            HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "role must be sales, delivery, or custom");
      }
    } else {
      UserRole role = parseWorkforceRole(body.get("role"));
      employee.setRole(role.name());
      employee.setCustomRoleId(null);
      if (!EmployeeAvailability.isPending(employee.getAvailabilityStatus())) {
        if (role == UserRole.delivery && !"delivery".equalsIgnoreCase(previousRole)) {
          employee.setAvailabilityStatus("online");
        } else if (role == UserRole.sales && "delivery".equalsIgnoreCase(previousRole)) {
          employee.setAvailabilityStatus("busy");
        }
      }
    }

    adminUserRepository.save(employee);
    if (oldEmail != null && !oldEmail.equalsIgnoreCase(newEmail)) {
      reassignDeliveryOrdersEmail(oldEmail, newEmail);
    }
    return Map.of("employee", toEmployeeMap(employee));
  }

  @Transactional
  public Map<String, Object> deleteEmployee(String phone, String reason) {
    requireSuperAdmin();
    String trimmedReason = reason == null ? "" : reason.trim();
    if (trimmedReason.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Deletion reason is required");
    }
    AdminUser employee = requireWorkforceEmployee(phone);
    AdminUser current = resolveCurrentAdminUser();
    if (employee.getId().equals(current.getId())
        || (employee.getPhoneE164() != null
            && employee.getPhoneE164().equals(current.getPhoneE164()))) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Cannot delete your own admin account");
    }
    clearDeliveryAssignments(employee.getEmail());
    Instant deletedAt = Instant.now();
    employee.setDeletedAt(deletedAt);
    employee.setDeletedReason(trimmedReason);
    employee.setDeletedBy(formatWorkforceActorLabel(current));
    employee.setAvailabilityStatus("offline");
    adminUserRepository.save(employee);
    return Map.of(
        "removed",
        employee.getPhoneE164(),
        "deletedAt",
        deletedAt.toString(),
        "deletedReason",
        trimmedReason,
        "deletedBy",
        employee.getDeletedBy());
  }

  @Transactional
  public Map<String, Object> restoreEmployee(String phone) {
    requireSuperAdmin();
    String normalized = normalizePhoneKey(phone);
    AdminUser employee =
        adminUserRepository
            .findByPhoneE164(normalized)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Employee not found"));
    if (!isWorkforceRole(employee.getRole())) {
      throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Employee not found");
    }
    if (employee.getDeletedAt() == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Employee is already active");
    }
    employee.setDeletedAt(null);
    employee.setDeletedReason(null);
    employee.setDeletedBy(null);
    UserRole role = UserRole.from(employee.getRole());
    employee.setAvailabilityStatus(role == UserRole.delivery ? "online" : "busy");
    adminUserRepository.save(employee);
    return Map.of("employee", toEmployeeMap(employee));
  }

  @Transactional
  public Map<String, Object> setEmployeeAvailability(String phone, String availability) {
    requireSuperAdmin();
    String normalizedPhone = normalizePhoneKey(phone);
    String value = availability == null ? "" : availability.trim().toLowerCase();
    if (normalizedPhone.length() != 10) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "phone must be 10 digits");
    }
    if (!(value.equals("online") || value.equals("busy") || value.equals("offline"))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "availability must be online/busy/offline");
    }
    AdminUser a = loadWorkforceEmployeeByPhone(normalizedPhone);
    ensureActiveWorkforce(a);
    a.setAvailabilityStatus(value);
    adminUserRepository.save(a);
    notificationService.notifyAdminEmail(
        a.getEmail(),
        "admin_alerts",
        "Availability updated",
        "Your availability is now " + value + ".",
        "employee",
        a.getId().toString(),
        Map.of("availability", value));
    return Map.of("employee", toEmployeeMap(a));
  }

  @Transactional
  public Map<String, Object> setCurrentDeliveryAvailability(String availability) {
    String value = availability == null ? "" : availability.trim().toLowerCase();
    if (!("offline".equals(value) || "online".equals(value))) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "VALIDATION_ERROR",
          "availability must be online or offline");
    }
    AdminUser current = resolveCurrentAdminUser();
    if (!"delivery".equalsIgnoreCase(current.getRole())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only delivery users can update this status");
    }
    current.setAvailabilityStatus(value);
    adminUserRepository.save(current);
    return Map.of("employee", toEmployeeMap(current));
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> productAuditHistory(String productId) {
    return productChangeAuditRepository.findByProductIdOrderByCreatedAtDesc(productId).stream()
        .map(
            a -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("id", a.getId().toString());
              row.put("action", a.getAction());
              row.put("actorRole", a.getActorRole());
              row.put("actorId", a.getActorId());
              row.put("actorName", a.getActorName());
              row.put("createdAt", a.getCreatedAt().toString());
              return row;
            })
        .toList();
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listCarsAdmin(boolean onlyPublished, String brand) {
    String b = brand != null ? brand.trim() : "";
    List<CarModelEntity> rows =
        !b.isBlank()
            ? (onlyPublished
                ? carModelRepository
                    .findByPublishedTrueAndMakeIgnoreCaseAndDeletedAtIsNullOrderByMakeAscModelAscModelYearDesc(
                        b)
                : carModelRepository.findByMakeIgnoreCaseOrderByMakeAscModelAscModelYearDesc(b))
            : (onlyPublished
                ? carModelRepository.findByPublishedTrueAndDeletedAtIsNullOrderByMakeAscModelAscModelYearDesc()
                : carModelRepository.findAll().stream()
                    .sorted(
                        Comparator.comparing(CarModelEntity::getMake, String.CASE_INSENSITIVE_ORDER)
                            .thenComparing(CarModelEntity::getModel, String.CASE_INSENSITIVE_ORDER)
                            .thenComparing(c -> c.getModelYear() == null ? 0 : -c.getModelYear()))
                    .toList());
    return rows.stream().map(this::toCarMap).toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listCarsAdminPage(
      boolean onlyPublished, String brand, String partName, int page, int size) {
    String b = brand != null ? brand.trim() : "";
    String part = partName != null ? partName.trim() : "";
    Pageable pageable =
        PageRequest.of(
            Math.max(0, page),
            Math.max(1, Math.min(50, size)),
            Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
    Specification<CarModelEntity> spec = carListSpecification(onlyPublished, b, part);
    Page<CarModelEntity> result = carModelRepository.findAll(spec, pageable);
    List<Map<String, Object>> items = result.getContent().stream().map(this::toCarMap).toList();
    return pagedResponse(items, result.getNumber(), result.getSize(), result.hasNext());
  }

  /** Distinct cars with ≥1 sold fitted part (non-draft/cancelled/refunded orders). */
  @Transactional(readOnly = true)
  public Map<String, Object> getCarsPurchasedSummary() {
    long count = orderLineRepository.countDistinctPurchasedCars();
    return Map.of("purchasedCarsCount", count);
  }

  private static Specification<CarModelEntity> carListSpecification(
      boolean onlyPublished, String brand, String partName) {
    return (root, query, cb) -> {
      List<Predicate> predicates = new ArrayList<>();
      predicates.add(cb.isNull(root.get("deletedAt")));
      if (onlyPublished) {
        predicates.add(cb.isTrue(root.get("published")));
      }
      if (brand != null && !brand.isBlank()) {
        predicates.add(cb.equal(cb.lower(root.get("make")), brand.toLowerCase()));
      }
      if (partName != null && !partName.isBlank()) {
        String pattern = "%" + escapeLikePattern(partName.toLowerCase()) + "%";
        Subquery<String> sub = query.subquery(String.class);
        Root<ProductFitmentCar> pfc = sub.from(ProductFitmentCar.class);
        jakarta.persistence.criteria.Join<ProductFitmentCar, Product> product =
            pfc.join("product");
        sub.select(pfc.get("carId"));
        sub.where(
            cb.equal(pfc.get("carId"), root.get("id")),
            cb.isNull(product.get("deletedAt")),
            cb.or(
                cb.like(cb.lower(product.get("name")), pattern, '\\'),
                cb.like(cb.lower(product.get("sku")), pattern, '\\')));
        predicates.add(cb.exists(sub));
      }
      return cb.and(predicates.toArray(Predicate[]::new));
    };
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listCarFormOptionCatalog() {
    List<Map<String, String>> fuels =
        carFuelOptionRepository.findAllByOrderBySortOrderAscLabelAsc().stream()
            .map(o -> Map.of("label", o.getLabel()))
            .toList();
    List<Map<String, String>> transmissions =
        carTransmissionOptionRepository.findAllByOrderBySortOrderAscLabelAsc().stream()
            .map(o -> Map.of("label", o.getLabel()))
            .toList();
    return Map.of("fuels", fuels, "transmissions", transmissions);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getCarAdmin(String id) {
    CarModelEntity c =
        carModelRepository
            .findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Car not found"));
    return Map.of("car", toCarMap(c));
  }

  /**
   * Parts fitted to a car (via {@code product_fitment_cars}) plus units sold from non-draft
   * order lines.
   */
  @Transactional(readOnly = true)
  public Map<String, Object> getCarPartsSummary(String id) {
    if (id == null || id.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "car id required");
    }
    String carId = id.trim();
    if (!carModelRepository.existsById(carId)) {
      throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Car not found");
    }

    List<ProductFitmentCar> fitments = fitmentCarRepository.findByCarId(carId);
    List<String> productIds =
        fitments.stream().map(ProductFitmentCar::getProductId).distinct().toList();

    Map<String, Long> unitsSoldByProduct = new HashMap<>();
    if (!productIds.isEmpty()) {
      for (Object[] row : orderLineRepository.sumSoldQuantityByProductIdForCar(carId)) {
        if (row[0] == null) continue;
        unitsSoldByProduct.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
      }
    }

    List<Map<String, Object>> parts = new ArrayList<>();
    long soldPartsCount = 0L;
    if (!productIds.isEmpty()) {
      Map<String, Product> productsById = new HashMap<>();
      for (Product p : productRepository.findAllById(productIds)) {
        if (p.getDeletedAt() == null) {
          productsById.put(p.getId(), p);
        }
      }
      for (String productId : productIds) {
        Product p = productsById.get(productId);
        if (p == null) continue;
        long unitsSold = unitsSoldByProduct.getOrDefault(productId, 0L);
        soldPartsCount += unitsSold;
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("productId", p.getId());
        row.put("name", p.getName());
        row.put("sku", p.getSku());
        row.put("unitsSold", unitsSold);
        row.put("price", p.getPriceInr() != null ? p.getPriceInr().longValue() : 0L);
        parts.add(row);
      }
      parts.sort(
          Comparator.comparing(
              (Map<String, Object> m) -> String.valueOf(m.getOrDefault("name", "")),
              String.CASE_INSENSITIVE_ORDER));
    }

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("carId", carId);
    body.put("totalParts", parts.size());
    body.put("soldPartsCount", soldPartsCount);
    body.put("parts", parts);
    return body;
  }

  @Transactional
  public Map<String, Object> createCar(Map<String, Object> body) {
    CarDraft draft = parseCarDraft(body);
    assertNoDuplicateCarIdentity(draft, null);

    String slugId = buildCarSlugId(draft);
    if (carModelRepository.findById(slugId).isPresent()) {
      throw duplicateCarIdentityException();
    }
    CarModelEntity c = new CarModelEntity();
    c.setId(slugId);
    applyCarDraft(c, draft);
    if (body.containsKey("image")) {
      c.setImageUrl(strOrNull(body.get("image")));
    }
    if (body.containsKey("brandLogo")) {
      c.setBrandLogoUrl(strOrNull(body.get("brandLogo")));
    }
    if (draft.published() == null) {
      c.setPublished(true);
    }
    carModelRepository.save(c);
    return Map.of("car", toCarMap(c));
  }

  @Transactional
  public Map<String, Object> updateCar(String id, Map<String, Object> body) {
    if (id == null || id.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "car id required");
    }
    CarModelEntity c =
        carModelRepository
            .findById(id.trim())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Car not found"));
    CarDraft draft = parseCarDraft(body);
    assertNoDuplicateCarIdentity(draft, c.getId());
    applyCarDraft(c, draft);
    if (body.containsKey("image")) {
      c.setImageUrl(strOrNull(body.get("image")));
    }
    if (body.containsKey("brandLogo")) {
      c.setBrandLogoUrl(strOrNull(body.get("brandLogo")));
    }
    carModelRepository.save(c);
    return Map.of("car", toCarMap(c));
  }

  private record CarDraft(
      String make,
      String model,
      Short modelYear,
      String variant,
      String fuel,
      String transmission,
      Integer engineCc,
      String notes,
      Boolean published) {}

  private CarDraft parseCarDraft(Map<String, Object> body) {
    String make =
        CarIdentityNormalizer.normalizeBrand(
            strOrNull(body.containsKey("brandName") ? body.get("brandName") : body.get("make")));
    String model = CarIdentityNormalizer.normalizeIdentityField(strOrNull(body.get("model")));
    if (make == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "make is required");
    }
    if (model == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "model is required");
    }
    String variant = CarIdentityNormalizer.normalizeIdentityField(strOrNull(body.get("variant")));
    if (variant == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "variant is required");
    }
    String fuelInput = CarIdentityNormalizer.normalizeDisplayText(strOrNull(body.get("fuel")));
    if (fuelInput == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "fuel is required");
    }
    String fuel =
        carFuelOptionRepository
            .findByLabelIgnoreCase(fuelInput)
            .map(CarFuelOption::getLabel)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "VALIDATION_ERROR",
                        "fuel must match a catalog value (see GET /api/v1/admin/cars/form-options)"));
    String transmissionInput =
        CarIdentityNormalizer.normalizeDisplayText(strOrNull(body.get("transmission")));
    String transmission = null;
    if (transmissionInput != null) {
      transmission =
          carTransmissionOptionRepository
              .findByLabelIgnoreCase(transmissionInput)
              .map(CarTransmissionOption::getLabel)
              .orElseThrow(
                  () ->
                      new ApiException(
                          HttpStatus.BAD_REQUEST,
                          "VALIDATION_ERROR",
                          "transmission must match a catalog value or be omitted (see GET /api/v1/admin/cars/form-options)"));
    }
    Short modelYear = parseCarModelYear(body.get("modelYear"));
    return new CarDraft(
        make,
        model,
        modelYear,
        variant,
        fuel,
        transmission,
        intFrom(body.get("engineCc"), (Integer) null),
        strOrNull(body.get("notes")),
        body.containsKey("published") ? Boolean.TRUE.equals(body.get("published")) : null);
  }

  /** Required positive whole number; fits {@link CarModelEntity} {@code SMALLINT} column. */
  private static Short parseCarModelYear(Object raw) {
    if (raw == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "modelYear is required");
    }
    if (raw instanceof String s && s.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "modelYear is required");
    }
    Integer year = null;
    if (raw instanceof Number n) {
      double d = n.doubleValue();
      if (d % 1 == 0 && d >= 1 && d <= Short.MAX_VALUE) {
        year = (int) d;
      }
    } else {
      String s = String.valueOf(raw).trim();
      if (s.matches("\\d+")) {
        try {
          long parsed = Long.parseLong(s);
          if (parsed >= 1 && parsed <= Short.MAX_VALUE) {
            year = (int) parsed;
          }
        } catch (NumberFormatException ignored) {
          // fall through to invalid
        }
      }
    }
    if (year == null) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "modelYear must be a positive whole number");
    }
    return year.shortValue();
  }

  private static String buildCarSlugId(CarDraft draft) {
    return SlugUtil.slug(
        draft.make()
            + " "
            + draft.model()
            + " "
            + (draft.modelYear() != null ? draft.modelYear() : "")
            + " "
            + (draft.variant() != null ? draft.variant() : "")
            + " "
            + (draft.fuel() != null ? draft.fuel() : ""));
  }

  private void assertNoDuplicateCarIdentity(CarDraft draft, String excludeId) {
    CarIdentityNormalizer.IdentityKeys keys =
        CarIdentityNormalizer.keys(draft.make(), draft.model(), draft.variant(), draft.fuel());
    if (carModelRepository
        .findIdentityMatch(
            keys.make(),
            keys.model(),
            draft.modelYear(),
            keys.variant(),
            keys.fuel(),
            excludeId)
        .isPresent()) {
      throw duplicateCarIdentityException();
    }
  }

  private static ApiException duplicateCarIdentityException() {
    return new ApiException(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "A car with this make, model, year, variant, and fuel already exists");
  }

  private void applyCarDraft(CarModelEntity c, CarDraft draft) {
    c.setMake(draft.make());
    c.setModel(draft.model());
    c.setVariant(draft.variant());
    c.setModelYear(draft.modelYear());
    c.setFuel(draft.fuel());
    c.setTransmission(draft.transmission());
    c.setEngineCc(draft.engineCc());
    if (draft.notes() != null) {
      c.setNotes(draft.notes());
    }
    if (draft.published() != null) {
      c.setPublished(draft.published());
    }
  }

  @Transactional
  public Map<String, Object> deleteCar(String id) {
    CarModelEntity c =
        carModelRepository
            .findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Car not found"));
    carModelRepository.delete(c);
    return Map.of("removed", id);
  }

  private Map<String, Object> toCarMap(CarModelEntity c) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", c.getId());
    m.put("make", c.getMake());
    m.put("brandName", c.getMake());
    m.put("model", c.getModel());
    m.put("variant", c.getVariant());
    m.put("modelYear", c.getModelYear());
    m.put("fuel", c.getFuel());
    m.put("transmission", c.getTransmission());
    m.put("engineCc", c.getEngineCc());
    m.put("image", c.getImageUrl());
    m.put("brandLogo", c.getBrandLogoUrl());
    m.put("notes", c.getNotes());
    m.put("published", c.isPublished());
    m.put("deleted", c.getDeletedAt() != null);
    m.put("deletedAt", c.getDeletedAt() != null ? c.getDeletedAt().toString() : null);
    m.put("createdAt", c.getCreatedAt() != null ? c.getCreatedAt().toString() : null);
    m.put("updatedAt", c.getUpdatedAt() != null ? c.getUpdatedAt().toString() : null);
    return m;
  }

  private void recordProductAudit(String productId, String action) {
    ProductChangeAuditEntity a = new ProductChangeAuditEntity();
    a.setProductId(productId);
    a.setAction(action);
    String role = "super_admin";
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null) {
      if (auth.getAuthorities().stream().anyMatch(g -> "ROLE_SALES".equals(g.getAuthority()))) {
        role = "sales";
      } else if (auth.getAuthorities().stream().anyMatch(g -> "ROLE_DELIVERY".equals(g.getAuthority()))) {
        role = "delivery";
      }
      a.setActorId(auth.getName());
      a.setActorName(auth.getName());
    }
    a.setActorRole(role);
    productChangeAuditRepository.save(a);
  }

  /** Aligns stored busy/online with active assigned orders; never overrides admin/delivery offline. */
  private void reconcileStoredDeliveryAvailability(AdminUser admin) {
    if (admin == null || !"delivery".equalsIgnoreCase(admin.getRole())) {
      return;
    }
    String stored =
        admin.getAvailabilityStatus() == null || admin.getAvailabilityStatus().isBlank()
            ? "offline"
            : admin.getAvailabilityStatus().trim().toLowerCase();
    // Do not auto-promote pending (never logged in) or override intentional offline.
    if ("offline".equals(stored) || "pending".equals(stored)) {
      return;
    }
    boolean hasActive =
        admin.getEmail() != null
            && !admin.getEmail().isBlank()
            && hasActiveAssignedDeliveryOrders(admin.getEmail());
    String target = hasActive ? "busy" : "online";
    if (!target.equalsIgnoreCase(stored)) {
      admin.setAvailabilityStatus(target);
      adminUserRepository.save(admin);
    }
  }

  private String effectiveAvailabilityForAdmin(AdminUser admin) {
    if (admin == null) {
      return "offline";
    }
    boolean hasActive =
        "delivery".equalsIgnoreCase(admin.getRole())
            && admin.getEmail() != null
            && !admin.getEmail().isBlank()
            && hasActiveAssignedDeliveryOrders(admin.getEmail());
    return EmployeeAvailability.effectiveStatus(admin.getAvailabilityStatus(), hasActive);
  }

  private boolean hasActiveAssignedDeliveryOrders(String deliveryEmail) {
    return orderRepository.findByAssignedDeliveryAdminEmailOrderByPlacedAtDesc(deliveryEmail).stream()
        .anyMatch(o -> EmployeeAvailability.isActiveDeliveryOrderStatus(o.getStatus()));
  }

  private Map<String, Object> toEmployeeMap(AdminUser a) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", a.getId().toString());
    m.put("email", a.getEmail());
    m.put("phone", a.getPhoneE164());
    m.put("role", a.getRole());
    m.put("name", a.getFullName());
    m.put("photoUrl", a.getPhotoUrl());
    m.put("status", a.getOnboardingStatus());
    m.put("availability", effectiveAvailabilityForAdmin(a));
    m.put("availabilityStatus", a.getAvailabilityStatus());
    m.put("lastLoginAt", a.getLastLoginAt() != null ? a.getLastLoginAt().toString() : null);
    m.put("lastLogoutAt", a.getLastLogoutAt() != null ? a.getLastLogoutAt().toString() : null);
    m.put("firstLoginAt", a.getFirstLoginAt() != null ? a.getFirstLoginAt().toString() : null);
    m.put("createdAt", a.getCreatedAt() != null ? a.getCreatedAt().toString() : null);
    m.put("deleted", a.getDeletedAt() != null);
    m.put("deletedAt", a.getDeletedAt() != null ? a.getDeletedAt().toString() : null);
    m.put("deletedReason", a.getDeletedReason());
    m.put("deletedBy", a.getDeletedBy());
    if (a.getCustomRoleId() != null) {
      List<String> pageKeys = customRoleService.pageKeysForRole(a.getCustomRoleId());
      Map<String, Object> customRole = new LinkedHashMap<>();
      customRole.put("id", a.getCustomRoleId().toString());
      customRole.put(
          "name",
          customRoleService.findById(a.getCustomRoleId()).map(CustomRole::getName).orElse(null));
      customRole.put("pageKeys", pageKeys);
      m.put("customRole", customRole);
      m.put("pageKeys", pageKeys);
    } else {
      m.put("customRole", null);
      m.put("pageKeys", List.of());
    }
    return m;
  }

  private static String formatWorkforceActorLabel(AdminUser admin) {
    if (admin == null) {
      return null;
    }
    if (admin.getFullName() != null && !admin.getFullName().isBlank()) {
      return admin.getFullName().trim();
    }
    if (admin.getEmail() != null && !admin.getEmail().isBlank()) {
      return admin.getEmail().trim();
    }
    return admin.getPhoneE164();
  }

  private Map<String, Object> toUserMap(UserEntity u) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", u.getId().toString());
    m.put("phone", u.getPhoneE164());
    m.put("name", u.getDisplayName());
    m.put("role", u.getRole() != null ? u.getRole() : "user");
    m.put(
        "avatarUrl",
        userAvatarService.hasAvatar(u.getId()) ? userAvatarService.publicAvatarUrl(u.getId()) : "");
    m.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : null);
    return m;
  }

  private void requireAdminAccess() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null
        || auth.getAuthorities().stream().noneMatch(g -> "ROLE_ADMIN".equals(g.getAuthority()))) {
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Admin access required");
    }
  }

  private Map<String, Object> buildCustomerOrderCounts(UUID userId) {
    Map<String, Object> counts = new LinkedHashMap<>();
    counts.put("total", orderRepository.countByUser_Id(userId));
    counts.put("placed", orderRepository.countByUser_IdAndStatus(userId, OrderStatus.placed));
    counts.put("processing", orderRepository.countByUser_IdAndStatus(userId, OrderStatus.processing));
    counts.put("shipped", orderRepository.countByUser_IdAndStatus(userId, OrderStatus.shipped));
    counts.put("delivered", orderRepository.countByUser_IdAndStatus(userId, OrderStatus.delivered));
    counts.put("cancelled", orderRepository.countByUser_IdAndStatus(userId, OrderStatus.cancelled));
    counts.put("refunded", orderRepository.countByUser_IdAndStatus(userId, OrderStatus.refunded));
    counts.put("last7Days", buildCustomerOrderCountsLast7Days(userId));
    return counts;
  }

  private Map<String, Object> buildCustomerOrderCountsLast7Days(UUID userId) {
    Instant since = Instant.now().minus(7, java.time.temporal.ChronoUnit.DAYS);
    Map<String, Object> counts = new LinkedHashMap<>();
    counts.put("recent", orderRepository.countByUser_IdAndPlacedAtGreaterThanEqual(userId, since));
    counts.put("placed", countUserOrdersSince(userId, OrderStatus.placed, since));
    counts.put("pending", countUserOrdersSince(userId, OrderStatus.draft, since));
    counts.put("confirmed", countUserOrdersSince(userId, OrderStatus.confirmed, since));
    counts.put("processing", countUserOrdersSince(userId, OrderStatus.processing, since));
    counts.put("shipped", countUserOrdersSince(userId, OrderStatus.shipped, since));
    counts.put("delivered", countUserOrdersSince(userId, OrderStatus.delivered, since));
    counts.put("cancelled", countUserOrdersSince(userId, OrderStatus.cancelled, since));
    counts.put("refunded", countUserOrdersSince(userId, OrderStatus.refunded, since));
    return counts;
  }

  private long countUserOrdersSince(UUID userId, OrderStatus status, Instant since) {
    return orderRepository.countByUser_IdAndStatusAndPlacedAtGreaterThanEqual(userId, status, since);
  }

  private Map<String, Object> buildEmployeeDeliveryCounts(String email) {
    if (email == null || email.isBlank()) {
      return Map.of("assigned", 0L, "shipped", 0L, "delivered", 0L);
    }
    long assigned =
        orderRepository.countByAssignedDeliveryAdminEmailIgnoreCaseAndStatusIn(
            email,
            List.of(
                OrderStatus.placed,
                OrderStatus.confirmed,
                OrderStatus.processing,
                OrderStatus.shipped));
    long shipped =
        orderRepository.countByAssignedDeliveryAdminEmailIgnoreCaseAndStatus(
            email, OrderStatus.shipped);
    long delivered =
        orderRepository.countByAssignedDeliveryAdminEmailIgnoreCaseAndStatus(
            email, OrderStatus.delivered);
    Map<String, Object> counts = new LinkedHashMap<>();
    counts.put("assigned", assigned);
    counts.put("shipped", shipped);
    counts.put("delivered", delivered);
    return counts;
  }

  private Map<String, Object> toAddressMap(AddressEntity a) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", a.getId().toString());
    m.put("line1", a.getLine1());
    m.put("line2", a.getLine2());
    m.put("city", a.getCity());
    m.put("state", a.getState());
    m.put("pincode", a.getPincode());
    m.put("country", a.getCountry());
    m.put("label", a.getLabel());
    m.put("gstNumber", a.getGstNumber());
    m.put("isDefault", a.isDefaultAddress());
    return m;
  }

  /**
   * GST is stored per address; for profile overview prefer default address GST, else fall back to
   * most recent address GST (addresses are loaded newest-first).
   */
  private static String resolveProfileGstNumber(List<AddressEntity> addresses) {
    if (addresses == null || addresses.isEmpty()) return null;
    for (AddressEntity address : addresses) {
      if (address == null || !address.isDefaultAddress()) continue;
      String gst = normalizeOptionalUpper(address.getGstNumber());
      if (gst != null) return gst;
    }
    for (AddressEntity address : addresses) {
      if (address == null) continue;
      String gst = normalizeOptionalUpper(address.getGstNumber());
      if (gst != null) return gst;
    }
    return null;
  }

  private static String normalizeOptionalUpper(String value) {
    if (value == null) return null;
    String trimmed = value.trim();
    if (trimmed.isEmpty()) return null;
    return trimmed.toUpperCase();
  }

  private Map<String, Object> toCustomerProfileOrderRow(
      OrderEntity o, List<com.carnalysys.domain.OrderLine> lines) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", o.getId());
    m.put("date", o.getPlacedAt() != null ? o.getPlacedAt().toString() : null);
    m.put("amount", orderTotalInr(lines, o.getTotalInr()));
    m.put("status", o.getStatus() != null ? o.getStatus().name() : null);
    m.put("paymentMethod", o.getPaymentMethod() != null ? o.getPaymentMethod().name() : null);
    int itemCount = 0;
    for (com.carnalysys.domain.OrderLine line : lines) {
      itemCount += line.getQuantity();
    }
    m.put("itemCount", itemCount);
    return m;
  }

  private Map<String, Object> toEmployeeProfileOrderRow(
      OrderEntity o,
      List<com.carnalysys.domain.OrderLine> lines,
      UserProfile profile,
      UserEntity customer) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", o.getId());
    String customerName =
        profile != null && profile.getFullName() != null && !profile.getFullName().isBlank()
            ? profile.getFullName().trim()
            : customer.getDisplayName();
    m.put("customerName", customerName);
    m.put("date", o.getPlacedAt() != null ? o.getPlacedAt().toString() : null);
    m.put("amount", orderTotalInr(lines, o.getTotalInr()));
    m.put("status", o.getStatus() != null ? o.getStatus().name() : null);
    return m;
  }

  private Map<String, Object> toEmployeeDeliveryOrderAdminRow(
      OrderEntity o,
      List<com.carnalysys.domain.OrderLine> lines,
      UserProfile profile,
      UserEntity customer,
      Instant deliveredAt) {
    Map<String, Object> src = toEmployeeProfileOrderRow(o, lines, profile, customer);
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("orderId", src.get("id"));
    m.put("customerName", src.get("customerName"));
    m.put("orderDate", src.get("date"));
    m.put("amount", src.get("amount"));
    m.put("status", src.get("status"));
    m.put("deliveredDate", deliveredAt != null ? deliveredAt.toString() : null);
    return m;
  }

  private Map<String, Instant> loadFirstDeliveredAtByOrderIds(List<String> orderIds) {
    if (orderIds == null || orderIds.isEmpty()) {
      return Map.of();
    }
    List<Object[]> rows =
        orderStatusAuditRepository.findFirstDeliveredAtByOrderIdIn(orderIds, OrderStatus.delivered);
    Map<String, Instant> m = new HashMap<>();
    for (Object[] row : rows) {
      if (row[0] != null && row[1] != null) {
        m.put(String.valueOf(row[0]), (Instant) row[1]);
      }
    }
    return m;
  }

  private static String normalizeEmployeeOrderSearchPattern(String search) {
    String q = search == null ? "" : search.trim().toLowerCase();
    if (q.isEmpty()) {
      return "%";
    }
    return "%" + q + "%";
  }

  private record EmployeeDeliveryDateRange(Instant startInclusive, Instant endExclusive) {}

  private EmployeeDeliveryDateRange parseEmployeeDeliveryDateRange(String fromDate, String toDate) {
    String from = fromDate != null ? fromDate.trim() : "";
    String to = toDate != null ? toDate.trim() : "";
    if (from.isEmpty() && to.isEmpty()) {
      YearMonth ym = YearMonth.now(ZoneOffset.UTC);
      Instant start = ym.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
      Instant end = ym.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
      return new EmployeeDeliveryDateRange(start, end);
    }
    if (from.isEmpty() || to.isEmpty()) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "fromDate and toDate are required together");
    }
    LocalDate fromD;
    LocalDate toD;
    try {
      fromD = LocalDate.parse(from, EMPLOYEE_DELIVERY_ISO_DATE);
      toD = LocalDate.parse(to, EMPLOYEE_DELIVERY_ISO_DATE);
    } catch (java.time.format.DateTimeParseException ex) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "fromDate and toDate must be YYYY-MM-DD");
    }
    if (toD.isBefore(fromD)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "toDate must be on or after fromDate");
    }
    Instant start = fromD.atStartOfDay(ZoneOffset.UTC).toInstant();
    Instant end = toD.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    return new EmployeeDeliveryDateRange(start, end);
  }

  private static long orderTotalInr(List<com.carnalysys.domain.OrderLine> lines, BigDecimal orderTotal) {
    if (lines != null && !lines.isEmpty()) {
      long sum = 0;
      for (var line : lines) {
        if (line.getLineTotalInr() != null) {
          sum += line.getLineTotalInr().setScale(0, java.math.RoundingMode.DOWN).longValue();
        }
      }
      if (sum > 0) {
        return sum;
      }
    }
    return orderTotal != null ? orderTotal.setScale(0, java.math.RoundingMode.DOWN).longValue() : 0L;
  }

  private void requireSuperAdmin() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null
        || auth.getAuthorities().stream()
            .noneMatch(g -> "ROLE_SUPER_ADMIN".equals(g.getAuthority()))) {
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Super admin access required");
    }
  }

  private static boolean isWorkforceRole(String role) {
    if (role == null) {
      return false;
    }
    String r = role.trim().toLowerCase();
    return "sales".equals(r) || "delivery".equals(r) || "custom".equals(r);
  }

  private AdminUser requireWorkforceEmployeeByPathId(String employeeId) {
    if (employeeId == null || employeeId.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "employeeId required");
    }
    String key = employeeId.trim();
    try {
      UUID id = UUID.fromString(key);
      AdminUser u =
          adminUserRepository
              .findById(id)
              .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Employee not found"));
      if (!isWorkforceRole(u.getRole())) {
        throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Employee not found");
      }
      ensureActiveWorkforce(u);
      return u;
    } catch (IllegalArgumentException ex) {
      return requireWorkforceEmployee(key);
    }
  }

  private AdminUser requireWorkforceEmployee(String phone) {
    AdminUser employee = loadWorkforceEmployeeByPhone(phone);
    ensureActiveWorkforce(employee);
    return employee;
  }

  private AdminUser loadWorkforceEmployeeByPhone(String phone) {
    String normalized = normalizePhoneKey(phone);
    AdminUser employee =
        adminUserRepository
            .findByPhoneE164(normalized)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Employee not found"));
    if (!isWorkforceRole(employee.getRole())) {
      throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Employee not found");
    }
    return employee;
  }

  private static void ensureActiveWorkforce(AdminUser employee) {
    if (employee.getDeletedAt() != null) {
      throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Employee not found");
    }
  }

  private static String workforceEmail(String phone) {
    return "emp_" + phone + "@carnalysys.local";
  }

  /** Assigned-order queries key on admin email; fall back to canonical workforce email when blank. */
  private static String resolveWorkforceEmployeeEmail(AdminUser employee) {
    String email = employee.getEmail();
    if (email != null && !email.isBlank()) {
      return email.trim();
    }
    String phone = employee.getPhoneE164();
    if (phone != null && !phone.isBlank()) {
      return workforceEmail(normalizePhoneKey(phone));
    }
    throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Employee email is missing");
  }

  private static String parseEmployeePhone(Object raw) {
    String phone = normalizePhoneKey(String.valueOf(raw == null ? "" : raw));
    if (phone.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "phone required");
    }
    if (phone.length() != 10) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "phone must be 10 digits");
    }
    return phone;
  }

  private static UserRole parseWorkforceRole(Object raw) {
    UserRole role = UserRole.from(String.valueOf(raw == null ? "" : raw));
    if (role != UserRole.sales && role != UserRole.delivery) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "role must be sales or delivery");
    }
    return role;
  }

  private static UserRole parseCreateEmployeeRole(Object raw) {
    UserRole role = UserRole.from(String.valueOf(raw == null ? "" : raw));
    if (role != UserRole.sales && role != UserRole.delivery && role != UserRole.custom) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "role must be sales, delivery, or custom");
    }
    return role;
  }

  private static String parseEmployeeName(Object raw) {
    String name = raw == null ? "" : String.valueOf(raw).trim();
    if (name.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "name required");
    }
    return name;
  }

  private void applyEmployeePhoto(AdminUser employee, Map<String, Object> body) {
    if (!body.containsKey("photo")) {
      return;
    }
    String photoDataUrl = strOrNull(body.get("photo"));
    if (photoDataUrl == null || photoDataUrl.isBlank()) {
      employee.setPhotoUrl(null);
      return;
    }
    employee.setPhotoUrl(uploadStorageService.persistVehicleImageIfDataUrl("employees", photoDataUrl));
  }

  private void reassignDeliveryOrdersEmail(String oldEmail, String newEmail) {
    if (oldEmail == null || oldEmail.isBlank() || oldEmail.equalsIgnoreCase(newEmail)) {
      return;
    }
    for (OrderEntity order : orderRepository.findByAssignedDeliveryAdminEmailIgnoreCase(oldEmail)) {
      order.setAssignedDeliveryAdminEmail(newEmail);
      orderRepository.save(order);
    }
  }

  private void clearDeliveryAssignments(String email) {
    if (email == null || email.isBlank()) {
      return;
    }
    for (OrderEntity order : orderRepository.findByAssignedDeliveryAdminEmailIgnoreCase(email)) {
      order.setAssignedDeliveryAdminEmail(null);
      order.setAssignedDeliveryAt(null);
      orderRepository.save(order);
    }
  }

  private static String normalizePhoneKey(String phoneInput) {
    String digits = phoneInput == null ? "" : phoneInput.replaceAll("\\D", "");
    if (digits.startsWith("91") && digits.length() == 12) {
      return digits.substring(2);
    }
    if (digits.length() > 10) {
      return digits.substring(digits.length() - 10);
    }
    return digits;
  }

  /** Resolves {@code admin_users} for the authenticated storefront user (JWT subject = user UUID). */
  private AdminUser resolveCurrentAdminUser() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Not authenticated");
    }

    try {
      UUID userId = UUID.fromString(String.valueOf(auth.getName()).trim());
      UserEntity user =
          userRepository
              .findById(userId)
              .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "User not found"));
      return adminUserRepository
          .findByPhoneE164(user.getPhoneE164())
          .orElseThrow(
              () ->
                  new ApiException(
                      HttpStatus.NOT_FOUND,
                      "NOT_FOUND",
                      "No admin account is linked to this phone number"));
    } catch (IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid principal");
    }
  }

  private Map<String, Object> pagedResponse(
      List<Map<String, Object>> items, int page, int size, boolean hasNext) {
    return Map.of(
        "items", items,
        "page", page,
        "size", size,
        "hasMore", hasNext,
        "nextPage", hasNext ? page + 1 : page);
  }

  private List<Map<String, Object>> listSalesPerformance() {
    Map<String, long[]> stats = new HashMap<>();
    for (Object[] row : orderStatusAuditRepository.salesOrderAndUnitsByAdminEmail()) {
      String email = row[0] == null ? "" : String.valueOf(row[0]);
      if (email.isBlank()) continue;
      long ordersCount = row[1] instanceof Number n ? n.longValue() : 0L;
      long unitsSold = row[2] instanceof Number n ? n.longValue() : 0L;
      stats.put(email, new long[] {ordersCount, unitsSold});
    }
    return adminUserRepository.findByRoleIgnoreCaseOrderByEmailAsc("sales").stream()
        .map(
            s -> {
              long[] v = stats.getOrDefault(s.getEmail(), new long[] {0L, 0L});
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("email", s.getEmail());
              row.put("name", s.getFullName());
              row.put("ordersCount", v[0]);
              row.put("unitsSold", v[1]);
              return row;
            })
        .toList();
  }
}
