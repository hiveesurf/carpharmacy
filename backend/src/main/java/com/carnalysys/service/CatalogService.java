package com.carnalysys.service;

import com.carnalysys.domain.Product;
import com.carnalysys.domain.ProductFitmentCar;
import com.carnalysys.domain.ProductVehicleSpec;
import com.carnalysys.repo.CarModelRepository;
import com.carnalysys.repo.ProductFitmentCarRepository;
import com.carnalysys.repo.CategoryRepository;
import com.carnalysys.repo.OrderLineRepository;
import com.carnalysys.repo.ProductFitmentLabelRepository;
import com.carnalysys.repo.ProductRepository;
import com.carnalysys.repo.ProductVehicleSpecRepository;
import java.util.ArrayList;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogService {

  private final ProductRepository productRepository;
  private final CategoryRepository categoryRepository;
  private final ProductFitmentLabelRepository fitmentLabelRepository;
  private final ProductFitmentCarRepository fitmentCarRepository;
  private final CarModelRepository carModelRepository;
  private final ProductVehicleSpecRepository vehicleSpecRepository;
  private final OrderLineRepository orderLineRepository;
  private final ProductPresenter productPresenter;

  public CatalogService(
      ProductRepository productRepository,
      CategoryRepository categoryRepository,
      ProductFitmentLabelRepository fitmentLabelRepository,
      ProductFitmentCarRepository fitmentCarRepository,
      CarModelRepository carModelRepository,
      ProductVehicleSpecRepository vehicleSpecRepository,
      OrderLineRepository orderLineRepository,
      ProductPresenter productPresenter) {
    this.productRepository = productRepository;
    this.categoryRepository = categoryRepository;
    this.fitmentLabelRepository = fitmentLabelRepository;
    this.fitmentCarRepository = fitmentCarRepository;
    this.carModelRepository = carModelRepository;
    this.vehicleSpecRepository = vehicleSpecRepository;
    this.orderLineRepository = orderLineRepository;
    this.productPresenter = productPresenter;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listProductsPage(
      String type,
      String category,
      String search,
      String carModel,
      String sort,
      int page,
      int pageSize) {
    return listProductsPage(type, category, search, carModel, null, null, sort, page, pageSize);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listProductsPage(
      String type,
      String category,
      String search,
      String carModel,
      String carId,
      String sort,
      int page,
      int pageSize) {
    return listProductsPage(type, category, search, carModel, carId, null, sort, page, pageSize);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listProductsPage(
      String type,
      String category,
      String search,
      String carModel,
      String carId,
      String partBrand,
      String sort,
      int page,
      int pageSize) {
    int size = Math.min(Math.max(pageSize, 1), 48);
    int p = Math.max(page, 0);
    Sort s =
        "price_desc".equals(sort)
            ? Sort.by("priceInr").descending()
            : "price_asc".equals(sort)
                ? Sort.by("priceInr").ascending()
                : Sort.by("id").ascending();
    Pageable pageable = PageRequest.of(p, size, s);
    Specification<Product> spec =
        CatalogProductSpecifications.build(type, category, search, carModel, carId, partBrand);
    Page<Product> result = productRepository.findAll(spec, pageable);
    List<Map<String, Object>> items = presentAll(result.getContent());
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("items", items);
    out.put("page", result.getNumber());
    out.put("pageSize", result.getSize());
    out.put("total", result.getTotalElements());
    out.put("totalPages", result.getTotalPages());
    return out;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getProduct(String id) {
    Product p =
        productRepository
            .findById(id)
            .filter(product -> product.getDeletedAt() == null)
            .filter(Product::isPublished)
            .orElseThrow(
                () -> new com.carnalysys.api.ApiException(
                    org.springframework.http.HttpStatus.NOT_FOUND,
                    "NOT_FOUND",
                    "Product not found"));
    return presentAll(List.of(p)).get(0);
  }

  private List<Map<String, Object>> presentAll(List<Product> products) {
    if (products.isEmpty()) {
      return List.of();
    }
    List<String> ids = products.stream().map(Product::getId).toList();
    var fitMap =
        fitmentLabelRepository.findByProductIdIn(ids).stream()
            .collect(
                Collectors.groupingBy(
                    com.carnalysys.domain.ProductFitmentLabel::getProductId,
                    Collectors.mapping(
                        com.carnalysys.domain.ProductFitmentLabel::getLabel, Collectors.toList())));
    var fitCarMap =
        fitmentCarRepository.findByProductIdIn(ids).stream()
            .collect(
                Collectors.groupingBy(
                    ProductFitmentCar::getProductId,
                    Collectors.mapping(ProductFitmentCar::getCarId, Collectors.toList())));
    var carMap =
        carModelRepository.findAllById(
                fitCarMap.values().stream().flatMap(List::stream).distinct().toList())
            .stream()
            .collect(Collectors.toMap(c -> c.getId(), c -> c, (a, b) -> a));
    var specMap =
        vehicleSpecRepository.findByProductIdIn(ids).stream()
            .collect(Collectors.toMap(ProductVehicleSpec::getProductId, s -> s, (a, b) -> a));
    List<Map<String, Object>> out = new ArrayList<>();
    for (Product p : products) {
      out.add(
          productPresenter.toPublicMap(
              p,
              fitMap.getOrDefault(p.getId(), List.of()),
              fitCarMap.getOrDefault(p.getId(), List.of()),
              carMap,
              specMap.get(p.getId())));
    }
    return out;
  }

  @Transactional(readOnly = true)
  public List<Map<String, String>> listCategories() {
    return categoryRepository.findAllActive().stream()
        .sorted(Comparator.comparingInt(c -> c.getDisplayOrder()))
        .map(c -> Map.of("id", c.getSlug(), "name", c.getName()))
        .toList();
  }

  /** Distinct OEM/OES part brand labels from published parts (metadata brand → oem → oes → supplier). */
  @Transactional(readOnly = true)
  public List<Map<String, String>> listPartBrands() {
    return productRepository.findDistinctPublishedPartBrandLabels().stream()
        .filter(b -> b != null && !b.isBlank())
        .sorted(String.CASE_INSENSITIVE_ORDER)
        .map(
            label -> {
              String trimmed = label.trim().replaceAll("\\s+", " ");
              String id =
                  trimmed
                      .toLowerCase(java.util.Locale.ROOT)
                      .replaceAll("[^a-z0-9]+", "-")
                      .replaceAll("^-|-$", "");
              if (id.isEmpty()) {
                id = "brand";
              }
              return Map.of("id", id, "name", trimmed);
            })
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> findPublishedProductMap(String id) {
    return productRepository
        .findById(id)
        .filter(product -> product.getDeletedAt() == null)
        .filter(Product::isPublished)
        .map(
            p -> {
              var fits =
                  fitmentLabelRepository.findByProductIdIn(List.of(id)).stream()
                      .map(com.carnalysys.domain.ProductFitmentLabel::getLabel)
                      .toList();
              var fitCarIds =
                  fitmentCarRepository.findByProductIdIn(List.of(id)).stream()
                      .map(ProductFitmentCar::getCarId)
                      .toList();
              var cars =
                  carModelRepository.findAllById(fitCarIds).stream()
                      .collect(Collectors.toMap(c -> c.getId(), c -> c, (a, b) -> a));
              var spec = vehicleSpecRepository.findById(id).orElse(null);
              return productPresenter.toPublicMap(p, fits, fitCarIds, cars, spec);
            })
        .orElse(null);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listProductsPageForAdmin(
      int page, int pageSize, String sort, String search, boolean lowStockOnly) {
    int size = Math.min(Math.max(pageSize, 1), 48);
    int p = Math.max(page, 0);
    Sort s =
        "updated_desc".equals(sort)
            ? Sort.by("updatedAt").descending()
            : Sort.by("createdAt").descending();
    Pageable pageable = PageRequest.of(p, size, s);
    boolean hasSearch = search != null && !search.isBlank();
    boolean useSpec = hasSearch || lowStockOnly;
    Page<Product> result =
        useSpec
            ? productRepository.findAll(
                AdminProductSpecifications.build(search, lowStockOnly), pageable)
            : productRepository.findAll(pageable);
    List<Map<String, Object>> items = toAdminMaps(result.getContent());
    long lowStockCount = productRepository.count(AdminProductSpecifications.adminLowStockCount());
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("items", items);
    out.put("page", result.getNumber());
    out.put("pageSize", result.getSize());
    out.put("total", result.getTotalElements());
    out.put("totalPages", result.getTotalPages());
    out.put("lowStockCount", lowStockCount);
    out.put("lowStockThreshold", AdminProductSpecifications.LOW_STOCK_THRESHOLD);
    return out;
  }

  @Transactional(readOnly = true)
  public long countLowStockForAdmin() {
    return productRepository.count(AdminProductSpecifications.adminLowStockCount());
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listAllForAdmin() {
    List<Product> all = productRepository.findAllActive();
    return toAdminMaps(all);
  }

  private List<Map<String, Object>> toAdminMaps(List<Product> products) {
    if (products.isEmpty()) {
      return List.of();
    }
    List<String> ids = products.stream().map(Product::getId).toList();
    var fitMap =
        fitmentLabelRepository.findByProductIdIn(ids).stream()
            .collect(
                Collectors.groupingBy(
                    com.carnalysys.domain.ProductFitmentLabel::getProductId,
                    Collectors.mapping(
                        com.carnalysys.domain.ProductFitmentLabel::getLabel,
                        Collectors.toList())));
    var fitCarMap =
        fitmentCarRepository.findByProductIdIn(ids).stream()
            .collect(
                Collectors.groupingBy(
                    ProductFitmentCar::getProductId,
                    Collectors.mapping(ProductFitmentCar::getCarId, Collectors.toList())));
    var carMap =
        carModelRepository.findAllById(
                fitCarMap.values().stream().flatMap(List::stream).distinct().toList())
            .stream()
            .collect(Collectors.toMap(c -> c.getId(), c -> c, (a, b) -> a));
    var specMap =
        vehicleSpecRepository.findByProductIdIn(ids).stream()
            .collect(Collectors.toMap(ProductVehicleSpec::getProductId, s -> s, (a, b) -> a));
    Map<String, SoldRevenueStat> soldRevenueByProduct = loadSoldRevenueByProduct();
    return products.stream()
        .map(p -> {
          Map<String, Object> row =
              productPresenter.toAdminMap(
                  p,
                  fitMap.getOrDefault(p.getId(), List.of()),
                  fitCarMap.getOrDefault(p.getId(), List.of()),
                  carMap,
                  specMap.get(p.getId()));
          SoldRevenueStat stat = soldRevenueByProduct.getOrDefault(p.getId(), SoldRevenueStat.ZERO);
          long soldCount = stat.soldCount();
          BigDecimal revenue = stat.revenue();
          BigDecimal purchasePrice = p.getPurchasePriceInr() != null ? p.getPurchasePriceInr() : BigDecimal.ZERO;
          BigDecimal profit = revenue.subtract(purchasePrice.multiply(BigDecimal.valueOf(soldCount)));
          row.put("soldCount", soldCount);
          row.put("profitValue", profit.setScale(0, java.math.RoundingMode.DOWN).longValue());
          return row;
        })
        .toList();
  }

  private Map<String, SoldRevenueStat> loadSoldRevenueByProduct() {
    Map<String, SoldRevenueStat> out = new HashMap<>();
    for (Object[] row : orderLineRepository.sumSoldAndRevenueByProductId()) {
      if (row[0] == null) continue;
      String productId = String.valueOf(row[0]);
      long soldCount = row[1] instanceof Number n ? n.longValue() : 0L;
      BigDecimal revenue = row[2] instanceof BigDecimal b ? b : BigDecimal.ZERO;
      out.put(productId, new SoldRevenueStat(soldCount, revenue));
    }
    return out;
  }

  private record SoldRevenueStat(long soldCount, BigDecimal revenue) {
    private static final SoldRevenueStat ZERO = new SoldRevenueStat(0L, BigDecimal.ZERO);
  }
}
