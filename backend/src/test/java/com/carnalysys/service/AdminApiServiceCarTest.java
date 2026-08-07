package com.carnalysys.service;



import static org.assertj.core.api.Assertions.assertThat;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import static org.mockito.ArgumentMatchers.any;

import static org.mockito.ArgumentMatchers.eq;

import static org.mockito.ArgumentMatchers.isNull;

import static org.mockito.Mockito.lenient;

import static org.mockito.Mockito.never;

import static org.mockito.Mockito.verify;

import static org.mockito.Mockito.when;



import com.carnalysys.api.ApiException;

import com.carnalysys.domain.CarFuelOption;
import com.carnalysys.domain.CarModelEntity;
import com.carnalysys.domain.CarTransmissionOption;
import com.carnalysys.domain.Product;
import com.carnalysys.domain.ProductFitmentCar;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.AddressRepository;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.ArgumentCaptor;

import org.mockito.InjectMocks;

import org.mockito.Mock;

import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.http.HttpStatus;



@ExtendWith(MockitoExtension.class)

class AdminApiServiceCarTest {



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

  @Mock private CustomRoleService customRoleService;

  @InjectMocks private AdminApiService adminApiService;

  @BeforeEach
  void stubCarFuelAndTransmissionCatalog() {
    lenient()
        .when(carFuelOptionRepository.findByLabelIgnoreCase(any()))
        .thenAnswer(
            inv -> {
              String l = inv.getArgument(0, String.class);
              CarFuelOption o = new CarFuelOption();
              o.setLabel(l);
              return Optional.of(o);
            });
    lenient()
        .when(carTransmissionOptionRepository.findByLabelIgnoreCase(any()))
        .thenAnswer(
            inv -> {
              String l = inv.getArgument(0, String.class);
              CarTransmissionOption o = new CarTransmissionOption();
              o.setLabel(l);
              return Optional.of(o);
            });
  }



  @Test

  void createCarAllowsSameMakeDifferentVariantAndFuel() {

    when(carModelRepository.findIdentityMatch(

            eq("audi"), eq("a4"), eq((short) 2022), eq("premium"), eq("petrol"), isNull()))

        .thenReturn(Optional.empty());

    when(carModelRepository.findById("audi-a4-2022-premium-petrol")).thenReturn(Optional.empty());

    when(carModelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));



    Map<String, Object> body = new LinkedHashMap<>();

    body.put("make", "Audi");

    body.put("model", "A4");

    body.put("modelYear", 2022);

    body.put("variant", "Premium");

    body.put("fuel", "Petrol");



    adminApiService.createCar(body);



    ArgumentCaptor<CarModelEntity> captor = ArgumentCaptor.forClass(CarModelEntity.class);

    verify(carModelRepository).save(captor.capture());

    assertThat(captor.getValue().getId()).isEqualTo("audi-a4-2022-premium-petrol");

    assertThat(captor.getValue().getVariant()).isEqualTo("Premium");

    assertThat(captor.getValue().getFuel()).isEqualTo("Petrol");

  }



  @Test

  void createCarRejectsCaseInsensitiveDuplicateIdentity() {

    CarModelEntity existing = new CarModelEntity();

    existing.setId("audi-a4-2022-premium-petrol");

    when(carModelRepository.findIdentityMatch(

            eq("audi"), eq("a4"), eq((short) 2022), eq("premium"), eq("petrol"), isNull()))

        .thenReturn(Optional.of(existing));



    Map<String, Object> body =

        Map.of(

            "make", "AUDI",

            "model", "a4",

            "modelYear", 2022,

            "variant", "Premium",

            "fuel", "Petrol");



    assertThatThrownBy(() -> adminApiService.createCar(body))

        .isInstanceOf(ApiException.class)

        .satisfies(

            ex -> {

              ApiException ae = (ApiException) ex;

              assertThat(ae.status()).isEqualTo(HttpStatus.BAD_REQUEST);

              assertThat(ae.getMessage()).contains("make, model, year, variant, and fuel");

            });



    verify(carModelRepository, never()).save(any());

  }



  @Test

  void createCarRejectsExtraSpacesDuplicateIdentity() {

    when(carModelRepository.findIdentityMatch(

            eq("audi"), eq("a4"), eq((short) 2022), eq("premium"), eq("petrol"), isNull()))

        .thenReturn(Optional.of(new CarModelEntity()));



    Map<String, Object> body =

        Map.of(

            "make", "  Audi  ",

            "model", "A4   ",

            "modelYear", 2022,

            "variant", "  Premium",

            "fuel", "Petrol  ");



    assertThatThrownBy(() -> adminApiService.createCar(body)).isInstanceOf(ApiException.class);



    verify(carModelRepository, never()).save(any());

  }



  @Test

  void updateCarChangesOnlySelectedRowAndRejectsDuplicateTarget() {

    CarModelEntity current = new CarModelEntity();

    current.setId("audi-a6-2023-diesel-technology");

    current.setMake("Audi");

    current.setModel("A6");

    current.setModelYear((short) 2023);

    current.setVariant("Technology");

    current.setFuel("Diesel");



    when(carModelRepository.findById("audi-a6-2023-diesel-technology")).thenReturn(Optional.of(current));

    when(carModelRepository.findIdentityMatch(

            eq("audi"), eq("a4"), eq((short) 2022), eq("premium"), eq("petrol"), eq("audi-a6-2023-diesel-technology")))

        .thenReturn(Optional.of(new CarModelEntity()));



    Map<String, Object> body =

        Map.of(

            "make", "Audi",

            "model", "A4",

            "modelYear", 2022,

            "variant", "Premium",

            "fuel", "Petrol");



    assertThatThrownBy(() -> adminApiService.updateCar("audi-a6-2023-diesel-technology", body))

        .isInstanceOf(ApiException.class);



    verify(carModelRepository, never()).save(any());

  }



  @Test

  void updateCarPersistsOnlySelectedRow() {

    CarModelEntity current = new CarModelEntity();

    current.setId("audi-a6-2023-diesel-technology");

    current.setMake("Audi");

    current.setModel("A6");

    current.setModelYear((short) 2023);

    current.setVariant("Technology");

    current.setFuel("Diesel");



    when(carModelRepository.findById("audi-a6-2023-diesel-technology")).thenReturn(Optional.of(current));

    when(carModelRepository.findIdentityMatch(

            eq("audi"), eq("a6"), eq((short) 2023), eq("sport"), eq("diesel"), eq("audi-a6-2023-diesel-technology")))

        .thenReturn(Optional.empty());

    when(carModelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));



    Map<String, Object> body =

        Map.of(

            "make", "Audi",

            "model", "A6",

            "modelYear", 2023,

            "variant", "Sport",

            "fuel", "Diesel");



    adminApiService.updateCar("audi-a6-2023-diesel-technology", body);



    ArgumentCaptor<CarModelEntity> captor = ArgumentCaptor.forClass(CarModelEntity.class);

    verify(carModelRepository).save(captor.capture());

    assertThat(captor.getValue().getId()).isEqualTo("audi-a6-2023-diesel-technology");

    assertThat(captor.getValue().getVariant()).isEqualTo("Sport");

  }



  @Test
  void createCarAcceptsYear1970() {
    when(carModelRepository.findIdentityMatch(
            eq("audi"), eq("a4"), eq((short) 1970), eq("premium"), eq("petrol"), isNull()))
        .thenReturn(Optional.empty());
    when(carModelRepository.findById("audi-a4-1970-premium-petrol")).thenReturn(Optional.empty());
    when(carModelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    Map<String, Object> body =
        Map.of(
            "make", "Audi",
            "model", "A4",
            "modelYear", 1970,
            "variant", "Premium",
            "fuel", "Petrol");

    adminApiService.createCar(body);

    ArgumentCaptor<CarModelEntity> captor = ArgumentCaptor.forClass(CarModelEntity.class);
    verify(carModelRepository).save(captor.capture());
    assertThat(captor.getValue().getModelYear()).isEqualTo((short) 1970);
  }

  @Test
  void createCarAcceptsYear2050() {
    when(carModelRepository.findIdentityMatch(
            eq("audi"), eq("a4"), eq((short) 2050), eq("premium"), eq("petrol"), isNull()))
        .thenReturn(Optional.empty());
    when(carModelRepository.findById("audi-a4-2050-premium-petrol")).thenReturn(Optional.empty());
    when(carModelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    Map<String, Object> body =
        Map.of(
            "make", "Audi",
            "model", "A4",
            "modelYear", 2050,
            "variant", "Premium",
            "fuel", "Petrol");

    adminApiService.createCar(body);

    ArgumentCaptor<CarModelEntity> captor = ArgumentCaptor.forClass(CarModelEntity.class);
    verify(carModelRepository).save(captor.capture());
    assertThat(captor.getValue().getModelYear()).isEqualTo((short) 2050);
  }

  @Test
  void createCarRejectsYearZero() {
    Map<String, Object> body =
        Map.of(
            "make", "Audi",
            "model", "A4",
            "modelYear", 0,
            "variant", "Premium",
            "fuel", "Petrol");

    assertThatThrownBy(() -> adminApiService.createCar(body))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex ->
                assertThat(((ApiException) ex).getMessage())
                    .contains("positive whole number"));

    verify(carModelRepository, never()).save(any());
  }

  @Test
  void createCarRejectsNegativeYear() {
    Map<String, Object> body =
        Map.of(
            "make", "Audi",
            "model", "A4",
            "modelYear", -5,
            "variant", "Premium",
            "fuel", "Petrol");

    assertThatThrownBy(() -> adminApiService.createCar(body)).isInstanceOf(ApiException.class);

    verify(carModelRepository, never()).save(any());
  }

  @Test
  void createCarRejectsDecimalYear() {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("make", "Audi");
    body.put("model", "A4");
    body.put("modelYear", 2022.5);
    body.put("variant", "Premium");
    body.put("fuel", "Petrol");

    assertThatThrownBy(() -> adminApiService.createCar(body)).isInstanceOf(ApiException.class);

    verify(carModelRepository, never()).save(any());
  }

  @Test
  void createCarRejectsNonNumericYearString() {
    Map<String, Object> body =
        Map.of(
            "make", "Audi",
            "model", "A4",
            "modelYear", "abc",
            "variant", "Premium",
            "fuel", "Petrol");

    assertThatThrownBy(() -> adminApiService.createCar(body)).isInstanceOf(ApiException.class);

    verify(carModelRepository, never()).save(any());
  }

  @Test

  void deleteCarRemovesRowPermanently() {

    CarModelEntity current = new CarModelEntity();

    current.setId("audi-a4-2022-premium-petrol");

    when(carModelRepository.findById("audi-a4-2022-premium-petrol")).thenReturn(Optional.of(current));



    adminApiService.deleteCar("audi-a4-2022-premium-petrol");



    verify(carModelRepository).delete(current);

    verify(carModelRepository, never()).save(any());

  }

  @Test
  void getCarPartsSummaryReturnsZerosWhenNoFitment() {
    when(carModelRepository.existsById("car-empty")).thenReturn(true);
    when(fitmentCarRepository.findByCarId("car-empty")).thenReturn(List.of());

    Map<String, Object> summary = adminApiService.getCarPartsSummary("car-empty");

    assertThat(summary.get("carId")).isEqualTo("car-empty");
    assertThat(summary.get("totalParts")).isEqualTo(0);
    assertThat(summary.get("soldPartsCount")).isEqualTo(0L);
    assertThat(summary.get("parts")).isEqualTo(List.of());
  }

  @Test
  void getCarPartsSummaryIncludesFittedPartsAndUnitsSold() {
    when(carModelRepository.existsById("car-1")).thenReturn(true);

    ProductFitmentCar fit1 = new ProductFitmentCar();
    fit1.setProductId("prod-a");
    fit1.setCarId("car-1");
    ProductFitmentCar fit2 = new ProductFitmentCar();
    fit2.setProductId("prod-b");
    fit2.setCarId("car-1");
    when(fitmentCarRepository.findByCarId("car-1")).thenReturn(List.of(fit1, fit2));

    Product pa = new Product();
    pa.setId("prod-a");
    pa.setName("Oil Filter");
    pa.setSku("OF-1");
    pa.setPriceInr(new java.math.BigDecimal("499"));
    Product pb = new Product();
    pb.setId("prod-b");
    pb.setName("Air Filter");
    pb.setSku("AF-1");
    pb.setPriceInr(new java.math.BigDecimal("299"));
    when(productRepository.findAllById(any())).thenReturn(List.of(pa, pb));

    when(orderLineRepository.sumSoldQuantityByProductIdForCar("car-1"))
        .thenReturn(List.of(new Object[] {"prod-a", 3L}, new Object[] {"prod-b", 1L}));

    Map<String, Object> summary = adminApiService.getCarPartsSummary("car-1");

    assertThat(summary.get("totalParts")).isEqualTo(2);
    assertThat(summary.get("soldPartsCount")).isEqualTo(4L);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> parts = (List<Map<String, Object>>) summary.get("parts");
    assertThat(parts).hasSize(2);
    assertThat(parts)
        .anySatisfy(
            row -> {
              assertThat(row.get("productId")).isEqualTo("prod-a");
              assertThat(row.get("unitsSold")).isEqualTo(3L);
              assertThat(row.get("sku")).isEqualTo("OF-1");
            });
  }

  @Test
  void getCarPartsSummaryNotFoundWhenCarMissing() {
    when(carModelRepository.existsById("missing")).thenReturn(false);
    assertThatThrownBy(() -> adminApiService.getCarPartsSummary("missing"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> assertThat(((ApiException) ex).status()).isEqualTo(HttpStatus.NOT_FOUND));
  }

  @Test
  void getCarsPurchasedSummaryReturnsDistinctCount() {
    when(orderLineRepository.countDistinctPurchasedCars()).thenReturn(4L);
    Map<String, Object> summary = adminApiService.getCarsPurchasedSummary();
    assertThat(summary.get("purchasedCarsCount")).isEqualTo(4L);
  }

  @Test
  void getCarsPurchasedSummaryReturnsZeroWhenNone() {
    when(orderLineRepository.countDistinctPurchasedCars()).thenReturn(0L);
    Map<String, Object> summary = adminApiService.getCarsPurchasedSummary();
    assertThat(summary.get("purchasedCarsCount")).isEqualTo(0L);
  }

  @Test
  void listCarsAdminPagePassesPartNameIntoSpecificationQuery() {
    CarModelEntity car = new CarModelEntity();
    car.setId("car-with-oil");
    car.setMake("Toyota");
    car.setModel("Innova");
    when(carModelRepository.findAll(
            any(org.springframework.data.jpa.domain.Specification.class),
            any(org.springframework.data.domain.Pageable.class)))
        .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(car)));

    Map<String, Object> page =
        adminApiService.listCarsAdminPage(false, "Toyota", "oil", 0, 10);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) page.get("items");
    assertThat(items).hasSize(1);
    assertThat(items.get(0).get("id")).isEqualTo("car-with-oil");
    verify(carModelRepository)
        .findAll(
            any(org.springframework.data.jpa.domain.Specification.class),
            any(org.springframework.data.domain.Pageable.class));
  }

}

