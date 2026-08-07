package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.carnalysys.api.ApiException;
import com.carnalysys.domain.Category;
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
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class AdminApiServiceCategoryDeleteTest {

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
  void deleteCategoryHardDeletesWhenUnused() {
    Category category = new Category();
    category.setSlug("spare");
    category.setName("Spare");
    when(categoryRepository.findById("spare")).thenReturn(Optional.of(category));
    when(productRepository.countByCategory_Slug("spare")).thenReturn(0L);

    Map<String, Object> result = adminApiService.deleteCategory("spare");

    assertThat(result).containsEntry("removed", "spare");
    verify(categoryRepository).delete(category);
    verify(categoryRepository, never()).save(category);
  }

  @Test
  void deleteCategoryBlockedWhenProductsStillReferenceIt() {
    Category category = new Category();
    category.setSlug("brakes");
    category.setName("Brakes");
    when(categoryRepository.findById("brakes")).thenReturn(Optional.of(category));
    when(productRepository.countByCategory_Slug("brakes")).thenReturn(2L);

    assertThatThrownBy(() -> adminApiService.deleteCategory("brakes"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.CONFLICT);
              assertThat(ae.code()).isEqualTo("CATEGORY_IN_USE");
              assertThat(ae.getMessage()).contains("2 product(s) still use this category");
            });

    verify(categoryRepository, never()).delete(category);
    verify(categoryRepository, never()).save(category);
  }

  @Test
  void deleteCategoryNotFound() {
    when(categoryRepository.findById("missing")).thenReturn(Optional.empty());

    assertThatThrownBy(() -> adminApiService.deleteCategory("missing"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.NOT_FOUND);
              assertThat(ae.code()).isEqualTo("NOT_FOUND");
            });
  }
}
