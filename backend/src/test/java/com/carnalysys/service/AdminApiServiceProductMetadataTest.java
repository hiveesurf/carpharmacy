package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AdminApiServiceProductMetadataTest {

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
  @Mock private ProductPresenter productPresenter;
  @Mock private UploadStorageService uploadStorageService;
  @Mock private UserAvatarService userAvatarService;
  @Mock private NotificationService notificationService;
  @Mock private ProductExcelParser productExcelParser;
  @Mock private LowStockAlertService lowStockAlertService;
  @Mock private CustomRoleService customRoleService;

  private final ObjectMapper objectMapper = new ObjectMapper();

  @InjectMocks private AdminApiService adminApiService;

  @BeforeEach
  void useRealObjectMapper() {
    ReflectionTestUtils.setField(adminApiService, "objectMapper", objectMapper);
  }

  @Test
  void mergePartImageMetadata_mergesStockInOutFromNestedBodyMetadata() {
    Map<String, Object> body = Map.of("metadata", Map.of("stockIn", 12, "stockOut", 5));

    JsonNode meta =
        (JsonNode)
            ReflectionTestUtils.invokeMethod(
                adminApiService, "mergePartImageMetadata", null, body);

    assertThat(meta.get("stockIn").asInt()).isEqualTo(12);
    assertThat(meta.get("stockOut").asInt()).isEqualTo(5);
  }

  @Test
  void mergePartImageMetadata_preservesExistingKeysWhenBodyMetadataPartial() {
    JsonNode existing = objectMapper.createObjectNode().put("brand", "BMW");
    Map<String, Object> body = Map.of("metadata", Map.of("stockIn", 3));

    JsonNode meta =
        (JsonNode)
            ReflectionTestUtils.invokeMethod(
                adminApiService, "mergePartImageMetadata", existing, body);

    assertThat(meta.get("brand").asText()).isEqualTo("BMW");
    assertThat(meta.get("stockIn").asInt()).isEqualTo(3);
    assertThat(meta.has("stockOut")).isFalse();
  }

  @Test
  void upsertProduct_persistsStockInOutInMetadataForAddProductPayload() {
    Category category = new Category();
    category.setSlug("brakes");
    category.setName("Brakes");
    when(categoryRepository.findById("brakes")).thenReturn(Optional.of(category));
    when(productRepository.existsById(anyString())).thenReturn(false);
    final Product[] savedHolder = new Product[1];
    when(productRepository.save(any(Product.class)))
        .thenAnswer(
            inv -> {
              Product saved = inv.getArgument(0);
              saved.setId("prd_test");
              savedHolder[0] = saved;
              return saved;
            });
    when(productRepository.findById(anyString()))
        .thenAnswer(inv -> Optional.ofNullable(savedHolder[0]));
    when(fitmentLabelRepository.findByProductIdIn(any())).thenReturn(List.of());
    when(fitmentCarRepository.findByProductIdIn(any())).thenReturn(List.of());
    when(carModelRepository.findAllById(any())).thenReturn(List.of());
    when(vehicleSpecRepository.findById(anyString())).thenReturn(Optional.empty());
    lenient()
        .when(productPresenter.toAdminMap(any(), anyList(), anyList(), anyMap(), isNull()))
        .thenReturn(Map.of("id", "prd_test"));

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("type", "part");
    body.put("category", "Brakes");
    body.put("sku", "TEST-001");
    body.put("name", "Filter");
    body.put("price", 100);
    body.put("purchasePrice", 50);
    body.put("totalStock", 7);
    body.put("published", true);
    body.put("metadata", Map.of("stockIn", 10, "stockOut", 3));

    adminApiService.upsertProduct(body, null);

    assertThat(savedHolder[0]).isNotNull();
    JsonNode md = savedHolder[0].getMetadata();
    assertThat(md.get("stockIn").asInt()).isEqualTo(10);
    assertThat(md.get("stockOut").asInt()).isEqualTo(3);
    assertThat(savedHolder[0].getStockQuantity()).isEqualTo(7);
  }

  @Test
  void upsertProduct_allowsVehicleStockAboveOne() {
    Category category = new Category();
    category.setSlug("vehicles");
    category.setName("Vehicles");
    when(categoryRepository.findById("vehicles")).thenReturn(Optional.of(category));

    Product existing = new Product();
    existing.setId("veh-thar-24");
    existing.setType(ProductType.vehicle);
    existing.setStockQuantity(5);
    existing.setPriceInr(BigDecimal.ONE);
    when(productRepository.existsById("veh-thar-24")).thenReturn(true);
    when(productRepository.findById("veh-thar-24")).thenReturn(Optional.of(existing));
    final Product[] savedHolder = new Product[1];
    when(productRepository.save(any(Product.class)))
        .thenAnswer(
            inv -> {
              Product saved = inv.getArgument(0);
              savedHolder[0] = saved;
              return saved;
            });
    when(productRepository.findById("veh-thar-24"))
        .thenAnswer(inv -> Optional.ofNullable(savedHolder[0]));
    when(fitmentLabelRepository.findByProductIdIn(any())).thenReturn(List.of());
    when(fitmentCarRepository.findByProductIdIn(any())).thenReturn(List.of());
    when(carModelRepository.findAllById(any())).thenReturn(List.of());
    when(vehicleSpecRepository.findById("veh-thar-24")).thenReturn(Optional.empty());
    when(vehicleSpecRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    lenient()
        .when(productPresenter.toAdminMap(any(), anyList(), anyList(), anyMap(), any()))
        .thenReturn(Map.of("id", "veh-thar-24", "totalStock", 10));

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("type", "vehicle");
    body.put("category", "Vehicles");
    body.put("sku", "VEH-THAR");
    body.put("name", "Thar");
    body.put("price", 100);
    body.put("purchasePrice", 80);
    body.put("totalStock", 10);

    adminApiService.upsertProduct(body, "veh-thar-24");

    assertThat(savedHolder[0]).isNotNull();
    assertThat(savedHolder[0].getStockQuantity()).isEqualTo(10);
  }
}
