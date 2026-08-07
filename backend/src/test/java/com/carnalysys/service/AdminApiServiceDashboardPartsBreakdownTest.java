package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

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
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminApiServiceDashboardPartsBreakdownTest {

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
  void dashboardIncludesDynamicPartsBreakdownByCategory() {
    when(userRepository.count()).thenReturn(0L);
    when(orderRepository.findAll()).thenReturn(List.of());
    when(catalogService.listAllForAdmin()).thenReturn(List.of());
    when(catalogService.countLowStockForAdmin()).thenReturn(0L);
    // Includes cancelled/draft rows — same universe as revenueVsPurchases (all placed_at orders).
    when(orderLineRepository.sumSoldByCategory())
        .thenReturn(
            List.of(
                new Object[] {"Electrical", 2L, new BigDecimal("15798.00")},
                new Object[] {"Engine", 1L, new BigDecimal("1599.00")}));

    Map<String, Object> dashboard = adminApiService.dashboard();

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> parts = (List<Map<String, Object>>) dashboard.get("partsBreakdown");
    assertThat(parts).hasSize(2);
    assertThat(parts.get(0))
        .containsEntry("category", "Electrical")
        .containsEntry("count", 2L)
        .containsEntry("revenue", 15798L);
    assertThat(parts.get(1))
        .containsEntry("category", "Engine")
        .containsEntry("count", 1L)
        .containsEntry("revenue", 1599L);
    long pieTotal =
        parts.stream().mapToLong(r -> ((Number) r.get("revenue")).longValue()).sum();
    assertThat(pieTotal).isEqualTo(17397L);
  }
}
