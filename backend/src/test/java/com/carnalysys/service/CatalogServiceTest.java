package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.carnalysys.api.ApiException;
import com.carnalysys.domain.Category;
import com.carnalysys.domain.Product;
import com.carnalysys.repo.CarModelRepository;
import com.carnalysys.repo.CategoryRepository;
import com.carnalysys.repo.OrderLineRepository;
import com.carnalysys.repo.ProductFitmentCarRepository;
import com.carnalysys.repo.ProductFitmentLabelRepository;
import com.carnalysys.repo.ProductRepository;
import com.carnalysys.repo.ProductVehicleSpecRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class CatalogServiceTest {

  @Mock private ProductRepository productRepository;
  @Mock private CategoryRepository categoryRepository;
  @Mock private ProductFitmentLabelRepository fitmentLabelRepository;
  @Mock private ProductFitmentCarRepository fitmentCarRepository;
  @Mock private CarModelRepository carModelRepository;
  @Mock private ProductVehicleSpecRepository vehicleSpecRepository;
  @Mock private OrderLineRepository orderLineRepository;
  @Mock private ProductPresenter productPresenter;

  @InjectMocks private CatalogService catalogService;

  @Test
  void listProductsPageReturnsPagedShape() {
    Product p = new Product();
    p.setId("p1");
    p.setName("Brake Pad");
    p.setSku("BP-1");
    p.setPriceInr(new BigDecimal("999"));
    p.setPublished(true);
    when(productRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
        .thenReturn(new PageImpl<>(List.of(p)));
    when(fitmentLabelRepository.findByProductIdIn(List.of("p1"))).thenReturn(List.of());
    when(fitmentCarRepository.findByProductIdIn(List.of("p1"))).thenReturn(List.of());
    when(carModelRepository.findAllById(List.of())).thenReturn(List.of());
    when(vehicleSpecRepository.findByProductIdIn(List.of("p1"))).thenReturn(List.of());
    when(productPresenter.toPublicMap(any(), any(), any(), any(), any()))
        .thenReturn(Map.of("id", "p1", "name", "Brake Pad"));

    Map<String, Object> result =
        catalogService.listProductsPage("part", null, "brake", null, null, null, "price_asc", 0, 20);

    assertThat(result).containsEntry("page", 0).containsEntry("pageSize", 1);
    assertThat(result).containsKey("items");
  }

  @Test
  void getProductThrowsNotFoundWhenUnpublished() {
    Product p = new Product();
    p.setId("p1");
    p.setPublished(false);
    when(productRepository.findById("p1")).thenReturn(Optional.of(p));

    assertThatThrownBy(() -> catalogService.getProduct("p1"))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException ae = (ApiException) ex;
              assertThat(ae.status()).isEqualTo(HttpStatus.NOT_FOUND);
              assertThat(ae.code()).isEqualTo("NOT_FOUND");
            });
  }

  @Test
  void listCategoriesSortsByDisplayOrder() {
    Category second = new Category();
    second.setSlug("engine");
    second.setName("Engine");
    second.setDisplayOrder(2);
    Category first = new Category();
    first.setSlug("body");
    first.setName("Body");
    first.setDisplayOrder(1);
    when(categoryRepository.findAllActive()).thenReturn(List.of(second, first));

    List<Map<String, String>> categories = catalogService.listCategories();

    assertThat(categories).hasSize(2);
    assertThat(categories.get(0)).containsEntry("id", "body");
    assertThat(categories.get(1)).containsEntry("id", "engine");
  }

  @Test
  void countLowStockForAdmin_usesAdminLowStockSpecification() {
    when(productRepository.count(any(org.springframework.data.jpa.domain.Specification.class)))
        .thenReturn(2L);

    long count = catalogService.countLowStockForAdmin();

    assertThat(count).isEqualTo(2L);
    verify(productRepository).count(any(org.springframework.data.jpa.domain.Specification.class));
  }
}
