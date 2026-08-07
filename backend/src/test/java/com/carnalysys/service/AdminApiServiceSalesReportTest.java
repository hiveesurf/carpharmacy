package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.carnalysys.domain.Category;
import com.carnalysys.domain.Product;
import com.carnalysys.domain.ProductType;
import com.carnalysys.repo.AddressRepository;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.CarFuelOptionRepository;
import com.carnalysys.repo.CarModelRepository;
import com.carnalysys.repo.CarTransmissionOptionRepository;
import com.carnalysys.repo.CategoryRepository;
import com.carnalysys.repo.OrderLineRepository;
import com.carnalysys.repo.OrderRepository;
import com.carnalysys.repo.OrderStatusAuditRepository;
import com.carnalysys.repo.ProductChangeAuditRepository;
import com.carnalysys.repo.ProductFitmentCarRepository;
import com.carnalysys.repo.ProductFitmentLabelRepository;
import com.carnalysys.repo.ProductRepository;
import com.carnalysys.repo.ProductVehicleSpecRepository;
import com.carnalysys.repo.UserProfileRepository;
import com.carnalysys.repo.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminApiServiceSalesReportTest {

  @Mock private AdminUserRepository adminUserRepository;
  @Mock private UserRepository userRepository;
  @Mock private UserProfileRepository userProfileRepository;
  @Mock private AddressRepository addressRepository;
  @Mock private OrderRepository orderRepository;
  @Mock private CategoryRepository categoryRepository;
  @Mock private OrderLineRepository orderLineRepository;
  @Mock private OrderStatusAuditRepository orderStatusAuditRepository;
  @Mock private ProductRepository productRepository;
  @Mock private ProductChangeAuditRepository productChangeAuditRepository;
  @Mock private ProductFitmentLabelRepository fitmentLabelRepository;
  @Mock private ProductFitmentCarRepository fitmentCarRepository;
  @Mock private CarModelRepository carModelRepository;
  @Mock private CarFuelOptionRepository carFuelOptionRepository;
  @Mock private CarTransmissionOptionRepository carTransmissionOptionRepository;
  @Mock private ProductVehicleSpecRepository vehicleSpecRepository;
  @Mock private CatalogService catalogService;
  @Mock private OrderService orderService;
  @Mock private ObjectMapper objectMapper;
  @Mock private ProductPresenter productPresenter;
  @Mock private UploadStorageService uploadStorageService;
  @Mock private UserAvatarService userAvatarService;
  @Mock private NotificationService notificationService;
  @Mock private ProductExcelParser productExcelParser;
  @Mock private LowStockAlertService lowStockAlertService;
  @Mock private DeliveryWorkflowService deliveryWorkflowService;
  @Mock private WhatsappService whatsappService;
  @Mock private CustomRoleService customRoleService;

  @InjectMocks private AdminApiService adminApiService;

  @Test
  void emptyRangeReturnsZerosNotErrors() {
    when(orderLineRepository.salesReportTimeSeriesMonth(isNull(), isNull())).thenReturn(List.of());
    when(orderLineRepository.salesReportSummary(isNull(), isNull())).thenReturn(new Object[] {0L, 0L});
    when(orderLineRepository.salesReportByProductInRange(isNull(), isNull())).thenReturn(List.of());

    Map<String, Object> report =
        adminApiService.getSalesReport(null, null, "month", "highest", "revenue", false, 0, 20);

    @SuppressWarnings("unchecked")
    Map<String, Object> summary = (Map<String, Object>) report.get("summary");
    assertThat(summary.get("totalRevenue")).isEqualTo(0L);
    assertThat(summary.get("totalUnitsSold")).isEqualTo(0L);
    assertThat(report.get("timeSeries")).isEqualTo(List.of());
    assertThat(report.get("products")).isEqualTo(List.of());
  }

  @Test
  void aggregatesSummaryAndTimeSeriesForDateRange() {
    when(orderLineRepository.salesReportTimeSeriesDay(any(), any()))
        .thenReturn(List.<Object[]>of(new Object[] {"2026-08-01", new BigDecimal("500.00"), 2L}));
    when(orderLineRepository.salesReportSummary(any(), any()))
        .thenReturn(new Object[] {new BigDecimal("500.00"), 2L});
    when(orderLineRepository.salesReportByProductInRange(any(), any()))
        .thenReturn(List.<Object[]>of(new Object[] {"p1", 2L, new BigDecimal("500.00")}));
    when(productRepository.findAllById(Set.of("p1"))).thenReturn(List.of(product("p1", "Widget A", "SKU-A")));
    when(productPresenter.toPublicMap(any(), any(), any(), any(), any()))
        .thenReturn(Map.of("image", "/uploads/widget-a.jpg"));

    Map<String, Object> report =
        adminApiService.getSalesReport("2026-08-01", "2026-08-31", "day", "highest", "revenue", false, 0, 20);

    @SuppressWarnings("unchecked")
    Map<String, Object> summary = (Map<String, Object>) report.get("summary");
    assertThat(summary.get("totalRevenue")).isEqualTo(500L);
    assertThat(summary.get("totalUnitsSold")).isEqualTo(2L);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> timeSeries = (List<Map<String, Object>>) report.get("timeSeries");
    assertThat(timeSeries).hasSize(1);
    assertThat(timeSeries.get(0).get("period")).isEqualTo("2026-08-01");
    assertThat(timeSeries.get(0).get("revenue")).isEqualTo(500L);
    assertThat(timeSeries.get(0).get("unitsSold")).isEqualTo(2L);

    verify(orderLineRepository).salesReportTimeSeriesDay(any(Instant.class), any(Instant.class));
  }

  @Test
  void yearGroupByUsesYearBucketQuery() {
    when(orderLineRepository.salesReportTimeSeriesYear(isNull(), isNull()))
        .thenReturn(List.<Object[]>of(new Object[] {"2026", new BigDecimal("1000.00"), 5L}));
    when(orderLineRepository.salesReportSummary(isNull(), isNull()))
        .thenReturn(new Object[] {new BigDecimal("1000.00"), 5L});
    when(orderLineRepository.salesReportByProductInRange(isNull(), isNull())).thenReturn(List.of());

    Map<String, Object> report =
        adminApiService.getSalesReport(null, null, "year", "highest", "revenue", false, 0, 20);

    verify(orderLineRepository).salesReportTimeSeriesYear(isNull(), isNull());
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> timeSeries = (List<Map<String, Object>>) report.get("timeSeries");
    assertThat(timeSeries.get(0).get("period")).isEqualTo("2026");
  }

  @Test
  void highestSortOrdersProductsByRevenueDescending() {
    when(orderLineRepository.salesReportTimeSeriesMonth(isNull(), isNull())).thenReturn(List.of());
    when(orderLineRepository.salesReportSummary(isNull(), isNull()))
        .thenReturn(new Object[] {new BigDecimal("300.00"), 3L});
    when(orderLineRepository.salesReportByProductInRange(isNull(), isNull()))
        .thenReturn(
            List.<Object[]>of(
                new Object[] {"p-low", 1L, new BigDecimal("100.00")},
                new Object[] {"p-high", 2L, new BigDecimal("200.00")}));
    when(productRepository.findAllById(any()))
        .thenReturn(
            List.of(
                product("p-low", "Low seller", "SKU-L"),
                product("p-high", "Top seller", "SKU-H")));
    when(productPresenter.toPublicMap(any(), any(), any(), any(), any()))
        .thenReturn(Map.of("image", ""));

    Map<String, Object> report =
        adminApiService.getSalesReport(null, null, "month", "highest", "revenue", false, 0, 20);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> products = (List<Map<String, Object>>) report.get("products");
    assertThat(products).hasSize(2);
    assertThat(products.get(0).get("productId")).isEqualTo("p-high");
    assertThat(products.get(1).get("productId")).isEqualTo("p-low");
  }

  @Test
  void lowestSortOrdersProductsByRevenueAscending() {
    when(orderLineRepository.salesReportTimeSeriesMonth(isNull(), isNull())).thenReturn(List.of());
    when(orderLineRepository.salesReportSummary(isNull(), isNull()))
        .thenReturn(new Object[] {new BigDecimal("300.00"), 3L});
    when(orderLineRepository.salesReportByProductInRange(isNull(), isNull()))
        .thenReturn(
            List.<Object[]>of(
                new Object[] {"p-low", 1L, new BigDecimal("100.00")},
                new Object[] {"p-high", 2L, new BigDecimal("200.00")}));
    when(productRepository.findAllById(any()))
        .thenReturn(
            List.of(
                product("p-low", "Low seller", "SKU-L"),
                product("p-high", "Top seller", "SKU-H")));
    when(productPresenter.toPublicMap(any(), any(), any(), any(), any()))
        .thenReturn(Map.of("image", ""));

    Map<String, Object> report =
        adminApiService.getSalesReport(null, null, "month", "lowest", "revenue", false, 0, 20);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> products = (List<Map<String, Object>>) report.get("products");
    assertThat(products.get(0).get("productId")).isEqualTo("p-low");
    assertThat(products.get(1).get("productId")).isEqualTo("p-high");
  }

  @Test
  void highestSortByUnitsSoldOrdersIndependentlyOfRevenue() {
    when(orderLineRepository.salesReportTimeSeriesMonth(isNull(), isNull())).thenReturn(List.of());
    when(orderLineRepository.salesReportSummary(isNull(), isNull()))
        .thenReturn(new Object[] {new BigDecimal("600.00"), 12L});
    when(orderLineRepository.salesReportByProductInRange(isNull(), isNull()))
        .thenReturn(
            List.<Object[]>of(
                new Object[] {"p-units", 10L, new BigDecimal("100.00")},
                new Object[] {"p-rev", 2L, new BigDecimal("500.00")}));
    when(productRepository.findAllById(any()))
        .thenReturn(
            List.of(
                product("p-units", "Volume seller", "SKU-U"),
                product("p-rev", "High ticket", "SKU-R")));
    when(productPresenter.toPublicMap(any(), any(), any(), any(), any()))
        .thenReturn(Map.of("image", ""));

    Map<String, Object> report =
        adminApiService.getSalesReport(null, null, "month", "highest", "unitsSold", false, 0, 20);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> products = (List<Map<String, Object>>) report.get("products");
    assertThat(products).hasSize(2);
    assertThat(products.get(0).get("productId")).isEqualTo("p-units");
    assertThat(products.get(1).get("productId")).isEqualTo("p-rev");
  }

  @Test
  void lowestSortByUnitsSoldOrdersIndependentlyOfRevenue() {
    when(orderLineRepository.salesReportTimeSeriesMonth(isNull(), isNull())).thenReturn(List.of());
    when(orderLineRepository.salesReportSummary(isNull(), isNull()))
        .thenReturn(new Object[] {new BigDecimal("600.00"), 12L});
    when(orderLineRepository.salesReportByProductInRange(isNull(), isNull()))
        .thenReturn(
            List.<Object[]>of(
                new Object[] {"p-units", 10L, new BigDecimal("100.00")},
                new Object[] {"p-rev", 2L, new BigDecimal("500.00")}));
    when(productRepository.findAllById(any()))
        .thenReturn(
            List.of(
                product("p-units", "Volume seller", "SKU-U"),
                product("p-rev", "High ticket", "SKU-R")));
    when(productPresenter.toPublicMap(any(), any(), any(), any(), any()))
        .thenReturn(Map.of("image", ""));

    Map<String, Object> report =
        adminApiService.getSalesReport(null, null, "month", "lowest", "unitsSold", false, 0, 20);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> products = (List<Map<String, Object>>) report.get("products");
    assertThat(products.get(0).get("productId")).isEqualTo("p-rev");
    assertThat(products.get(1).get("productId")).isEqualTo("p-units");
  }

  @Test
  void notSellingReturnsOnlyZeroSaleProductsInRange() {
    when(orderLineRepository.salesReportTimeSeriesMonth(isNull(), isNull())).thenReturn(List.of());
    when(orderLineRepository.salesReportSummary(isNull(), isNull()))
        .thenReturn(new Object[] {new BigDecimal("200.00"), 2L});
    when(orderLineRepository.salesReportByProductInRange(isNull(), isNull()))
        .thenReturn(List.<Object[]>of(new Object[] {"p-sold", 2L, new BigDecimal("200.00")}));
    when(productRepository.findAllActive())
        .thenReturn(
            List.of(
                product("p-sold", "Sold item", "SKU-S"),
                product("p-unsold", "Unsold item", "SKU-U")));
    when(productPresenter.toPublicMap(any(), any(), any(), any(), any()))
        .thenReturn(new LinkedHashMap<>(Map.of("image", "")));

    Map<String, Object> report =
        adminApiService.getSalesReport(null, null, "month", "highest", "revenue", true, 0, 20);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> products = (List<Map<String, Object>>) report.get("products");
    assertThat(products).hasSize(1);
    assertThat(products.get(0).get("productId")).isEqualTo("p-unsold");
    assertThat(products.get(0).get("unitsSold")).isEqualTo(0L);
    assertThat(products.get(0).get("revenue")).isEqualTo(0L);
  }

  @Test
  void notSellingDoesNotAffectTimeSeriesOrSummary() {
    when(orderLineRepository.salesReportTimeSeriesMonth(isNull(), isNull()))
        .thenReturn(List.<Object[]>of(new Object[] {"2026-08", new BigDecimal("500.00"), 2L}));
    when(orderLineRepository.salesReportSummary(isNull(), isNull()))
        .thenReturn(new Object[] {new BigDecimal("500.00"), 2L});
    when(orderLineRepository.salesReportByProductInRange(isNull(), isNull()))
        .thenReturn(List.<Object[]>of(new Object[] {"p-sold", 2L, new BigDecimal("500.00")}));
    when(productRepository.findAllActive())
        .thenReturn(List.of(product("p-unsold", "Unsold", "SKU-U")));
    when(productPresenter.toPublicMap(any(), any(), any(), any(), any()))
        .thenReturn(Map.of("image", ""));

    Map<String, Object> selling =
        adminApiService.getSalesReport(null, null, "month", "highest", "revenue", false, 0, 20);
    Map<String, Object> notSelling =
        adminApiService.getSalesReport(null, null, "month", "highest", "revenue", true, 0, 20);

    assertThat(selling.get("timeSeries")).isEqualTo(notSelling.get("timeSeries"));
    assertThat(selling.get("summary")).isEqualTo(notSelling.get("summary"));
  }

  @Test
  void productRowsIncludeImageUrlFromPresenter() {
    when(orderLineRepository.salesReportTimeSeriesMonth(isNull(), isNull())).thenReturn(List.of());
    when(orderLineRepository.salesReportSummary(isNull(), isNull()))
        .thenReturn(new Object[] {new BigDecimal("99.00"), 1L});
    when(orderLineRepository.salesReportByProductInRange(isNull(), isNull()))
        .thenReturn(List.<Object[]>of(new Object[] {"p1", 1L, new BigDecimal("99.00")}));
    Product p = product("p1", "Brake pad", "BP-1");
    when(productRepository.findAllById(Set.of("p1"))).thenReturn(List.of(p));
    when(productPresenter.toPublicMap(eq(p), any(), any(), any(), any()))
        .thenReturn(Map.of("image", "/api/v1/assets/brake.jpg"));

    Map<String, Object> report =
        adminApiService.getSalesReport(null, null, "month", "highest", "revenue", false, 0, 20);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> products = (List<Map<String, Object>>) report.get("products");
    assertThat(products.get(0).get("imageUrl")).isEqualTo("/api/v1/assets/brake.jpg");
    assertThat(products.get(0).get("name")).isEqualTo("Brake pad");
    assertThat(products.get(0).get("sku")).isEqualTo("BP-1");
  }

  @Test
  void productRowsIncludeImageKeyForCatalogFallback() {
    when(orderLineRepository.salesReportTimeSeriesMonth(isNull(), isNull())).thenReturn(List.of());
    when(orderLineRepository.salesReportSummary(isNull(), isNull()))
        .thenReturn(new Object[] {new BigDecimal("99.00"), 1L});
    when(orderLineRepository.salesReportByProductInRange(isNull(), isNull()))
        .thenReturn(List.<Object[]>of(new Object[] {"p1", 1L, new BigDecimal("99.00")}));
    Product p = product("p1", "Brake pad", "BP-1");
    p.setImageKey("brakes");
    when(productRepository.findAllById(Set.of("p1"))).thenReturn(List.of(p));
    when(productPresenter.toPublicMap(eq(p), any(), any(), any(), any()))
        .thenReturn(Map.of("imageKey", "brake-pads"));

    Map<String, Object> report =
        adminApiService.getSalesReport(null, null, "month", "highest", "revenue", false, 0, 20);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> products = (List<Map<String, Object>>) report.get("products");
    assertThat(products.get(0).get("imageKey")).isEqualTo("brakes");
  }

  @Test
  void dateRangePassedToRepositoryQueries() {
    when(orderLineRepository.salesReportTimeSeriesMonth(any(), any())).thenReturn(List.of());
    when(orderLineRepository.salesReportSummary(any(), any())).thenReturn(new Object[] {0L, 0L});
    when(orderLineRepository.salesReportByProductInRange(any(), any())).thenReturn(List.of());

    adminApiService.getSalesReport("2026-01-15", "2026-02-10", "month", "highest", "revenue", false, 0, 20);

    ArgumentCaptor<Instant> startCaptor = ArgumentCaptor.forClass(Instant.class);
    ArgumentCaptor<Instant> endCaptor = ArgumentCaptor.forClass(Instant.class);
    verify(orderLineRepository).salesReportSummary(startCaptor.capture(), endCaptor.capture());
    assertThat(startCaptor.getValue()).isNotNull();
    assertThat(endCaptor.getValue()).isNotNull();
    assertThat(endCaptor.getValue()).isAfter(startCaptor.getValue());
  }

  private static Product product(String id, String name, String sku) {
    Category cat = new Category();
    cat.setSlug("engine");
    cat.setName("Engine");
    Product p = new Product();
    p.setId(id);
    p.setName(name);
    p.setSku(sku);
    p.setCategory(cat);
    p.setType(ProductType.part);
    p.setPriceInr(new BigDecimal("999.00"));
    return p;
  }
}
