package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.carnalysys.api.ApiException;
import com.carnalysys.domain.AddressEntity;
import com.carnalysys.domain.AdminUser;
import com.carnalysys.domain.OrderEntity;
import com.carnalysys.domain.OrderStatus;
import com.carnalysys.domain.UserEntity;
import com.carnalysys.domain.UserProfile;
import com.carnalysys.repo.AddressRepository;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.CarModelRepository;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

@ExtendWith(MockitoExtension.class)
class AdminApiServiceProfileTest {

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
  @Mock private ProductVehicleSpecRepository vehicleSpecRepository;
  @Mock private CatalogService catalogService;
  @Mock private OrderService orderService;
  @Mock private ObjectMapper objectMapper;
  @Mock private ProductPresenter productPresenter;
  @Mock private UploadStorageService uploadStorageService;
  @Mock private UserAvatarService userAvatarService;
  @Mock private NotificationService notificationService;
  @Mock private ProductExcelParser productExcelParser;
  @Mock private CustomRoleService customRoleService;

  @InjectMocks private AdminApiService adminApiService;

  @AfterEach
  void clearSecurity() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void getUserProfileReturnsCountsAndRecentOrders() {
    asAdmin();
    UUID userId = UUID.randomUUID();
    UserEntity user = new UserEntity();
    user.setId(userId);
    user.setPhoneE164("9876543210");
    user.setDisplayName("Customer");
    user.setRole("user");
    when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    when(userProfileRepository.findById(userId)).thenReturn(Optional.empty());
    when(addressRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(userId))
        .thenReturn(List.of());
    when(orderRepository.countByUser_Id(userId)).thenReturn(5L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.placed)).thenReturn(1L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.processing)).thenReturn(1L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.shipped)).thenReturn(1L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.delivered)).thenReturn(1L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.cancelled)).thenReturn(1L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.refunded)).thenReturn(0L);
    when(orderRepository.countByUser_IdAndPlacedAtGreaterThanEqual(eq(userId), any(Instant.class)))
        .thenReturn(2L);
    when(orderRepository.countByUser_IdAndStatusAndPlacedAtGreaterThanEqual(
            eq(userId), any(OrderStatus.class), any(Instant.class)))
        .thenReturn(0L);
    OrderEntity order = new OrderEntity();
    order.setId("ord_1");
    order.setUser(user);
    order.setStatus(OrderStatus.placed);
    order.setPlacedAt(Instant.parse("2026-05-01T10:00:00Z"));
    order.setTotalInr(new BigDecimal("500"));
    Page<OrderEntity> page = new PageImpl<>(List.of(order));
    when(orderRepository.findByUser_IdOrderByPlacedAtDesc(eq(userId), any(Pageable.class)))
        .thenReturn(page);
    when(orderLineRepository.findByOrder_Id("ord_1")).thenReturn(List.of());

    Map<String, Object> result = adminApiService.getUserProfile(userId.toString());

    assertThat(result).containsKeys("user", "addresses", "orderCounts", "recentOrders");
    @SuppressWarnings("unchecked")
    Map<String, Object> userMap = (Map<String, Object>) result.get("user");
    assertThat(userMap).containsEntry("gstNumber", null);
    @SuppressWarnings("unchecked")
    Map<String, Object> orderCounts = (Map<String, Object>) result.get("orderCounts");
    assertThat(orderCounts).containsEntry("total", 5L);
    assertThat(orderCounts).containsKey("last7Days");
    @SuppressWarnings("unchecked")
    Map<String, Object> last7 = (Map<String, Object>) orderCounts.get("last7Days");
    assertThat(last7).containsEntry("recent", 2L);
    assertThat((List<?>) result.get("recentOrders")).hasSize(1);
  }

  @Test
  void getUserProfileUsesDefaultAddressGstBeforeMostRecent() {
    asAdmin();
    UUID userId = UUID.randomUUID();
    UserEntity user = new UserEntity();
    user.setId(userId);
    user.setPhoneE164("9876543210");
    user.setDisplayName("Customer");
    user.setRole("user");
    when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    when(userProfileRepository.findById(userId)).thenReturn(Optional.empty());

    AddressEntity recentNonDefault = new AddressEntity();
    recentNonDefault.setDefaultAddress(false);
    recentNonDefault.setGstNumber("29newer0000z5x9");

    AddressEntity defaultAddress = new AddressEntity();
    defaultAddress.setDefaultAddress(true);
    defaultAddress.setGstNumber("29abcde1234f2z5");

    when(addressRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(userId))
        .thenReturn(List.of(recentNonDefault, defaultAddress));
    when(orderRepository.countByUser_Id(userId)).thenReturn(0L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.placed)).thenReturn(0L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.processing)).thenReturn(0L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.shipped)).thenReturn(0L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.delivered)).thenReturn(0L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.cancelled)).thenReturn(0L);
    when(orderRepository.countByUser_IdAndStatus(userId, OrderStatus.refunded)).thenReturn(0L);
    when(orderRepository.countByUser_IdAndPlacedAtGreaterThanEqual(eq(userId), any(Instant.class)))
        .thenReturn(0L);
    when(orderRepository.countByUser_IdAndStatusAndPlacedAtGreaterThanEqual(
            eq(userId), any(OrderStatus.class), any(Instant.class)))
        .thenReturn(0L);
    when(orderRepository.findByUser_IdOrderByPlacedAtDesc(eq(userId), any(Pageable.class)))
        .thenReturn(Page.empty());

    Map<String, Object> result = adminApiService.getUserProfile(userId.toString());

    @SuppressWarnings("unchecked")
    Map<String, Object> userMap = (Map<String, Object>) result.get("user");
    assertThat(userMap).containsEntry("gstNumber", "29ABCDE1234F2Z5");
  }

  @Test
  void getEmployeeProfileForbiddenForSales() {
    SecurityContextHolder
        .getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "u", "n/a", List.of(new SimpleGrantedAuthority("ROLE_SALES"))));

    assertThatThrownBy(() -> adminApiService.getEmployeeProfile("9876543210"))
        .isInstanceOf(ApiException.class)
        .satisfies(ex -> assertThat(((ApiException) ex).status()).isEqualTo(HttpStatus.FORBIDDEN));
  }

  @Test
  void getEmployeeProfileReturnsDeliveryCounts() {
    asSuperAdmin();
    AdminUser employee = new AdminUser();
    employee.setPhoneE164("9876543210");
    employee.setEmail("emp_9876543210@carnalysys.local");
    employee.setRole("delivery");
    employee.setFullName("Driver");
    when(adminUserRepository.findByPhoneE164("9876543210")).thenReturn(Optional.of(employee));
    when(orderRepository.countByAssignedDeliveryAdminEmailIgnoreCaseAndStatusIn(
            eq("emp_9876543210@carnalysys.local"), any()))
        .thenReturn(2L);
    when(orderRepository.countByAssignedDeliveryAdminEmailIgnoreCaseAndStatus(
            eq("emp_9876543210@carnalysys.local"), eq(OrderStatus.shipped)))
        .thenReturn(1L);
    when(orderRepository.countByAssignedDeliveryAdminEmailIgnoreCaseAndStatus(
            eq("emp_9876543210@carnalysys.local"), eq(OrderStatus.delivered)))
        .thenReturn(3L);
    when(orderRepository.findByAssignedDeliveryAdminEmailIgnoreCaseOrderByPlacedAtDesc(
            eq("emp_9876543210@carnalysys.local"), any(Pageable.class)))
        .thenReturn(Page.empty());

    Map<String, Object> result = adminApiService.getEmployeeProfile("9876543210");

    @SuppressWarnings("unchecked")
    Map<String, Object> deliveryCounts = (Map<String, Object>) result.get("deliveryCounts");
    assertThat(deliveryCounts)
        .containsEntry("assigned", 2L)
        .containsEntry("shipped", 1L)
        .containsEntry("delivered", 3L);
  }

  private static void asAdmin() {
    SecurityContextHolder
        .getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "u", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
  }

  private static void asSuperAdmin() {
    SecurityContextHolder
        .getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "u", "n/a", List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))));
  }
}
