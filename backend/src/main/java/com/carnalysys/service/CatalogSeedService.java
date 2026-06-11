package com.carnalysys.service;

import com.carnalysys.domain.AdminUser;
import com.carnalysys.domain.Category;
import com.carnalysys.domain.Product;
import com.carnalysys.domain.ProductFitmentLabel;
import com.carnalysys.domain.ProductType;
import com.carnalysys.domain.ProductVehicleSpec;
import com.carnalysys.repo.AdminUserRepository;
import com.carnalysys.repo.CategoryRepository;
import com.carnalysys.repo.ProductFitmentLabelRepository;
import com.carnalysys.repo.ProductRepository;
import com.carnalysys.repo.ProductVehicleSpecRepository;
import com.carnalysys.util.SlugUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class CatalogSeedService {

  private final CategoryRepository categoryRepository;
  private final ProductRepository productRepository;
  private final ProductFitmentLabelRepository fitmentLabelRepository;
  private final ProductVehicleSpecRepository vehicleSpecRepository;
  private final AdminUserRepository adminUserRepository;
  private final ObjectMapper objectMapper;

  /** Seed super-admin phone; must match migration V18 backfill. Login uses real Twilio OTP. */
  private static final String SEED_ADMIN_PHONE = "9876543210";

  public CatalogSeedService(
      CategoryRepository categoryRepository,
      ProductRepository productRepository,
      ProductFitmentLabelRepository fitmentLabelRepository,
      ProductVehicleSpecRepository vehicleSpecRepository,
      AdminUserRepository adminUserRepository,
      ObjectMapper objectMapper) {
    this.categoryRepository = categoryRepository;
    this.productRepository = productRepository;
    this.fitmentLabelRepository = fitmentLabelRepository;
    this.vehicleSpecRepository = vehicleSpecRepository;
    this.adminUserRepository = adminUserRepository;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public void seedIfEmpty() throws IOException {
    if (categoryRepository.count() > 0) {
      seedAdminIfMissing();
      return;
    }
    List<Map<String, Object>> parts =
        objectMapper.readValue(
            new ClassPathResource("seed/parts.json").getInputStream(),
            new TypeReference<>() {});
    List<Map<String, Object>> cars =
        objectMapper.readValue(
            new ClassPathResource("seed/cars.json").getInputStream(),
            new TypeReference<>() {});

    Set<String> catNames = new LinkedHashSet<>();
    for (Map<String, Object> p : parts) {
      catNames.add(String.valueOf(p.get("category")));
    }
    catNames.add("Vehicles");
    int ord = 0;
    for (String name : new TreeSet<>(catNames)) {
      Category c = new Category();
      c.setSlug(SlugUtil.slug(name));
      c.setName(name);
      c.setDisplayOrder(ord++);
      categoryRepository.save(c);
    }

    for (Map<String, Object> row : parts) {
      String id = String.valueOf(row.get("id"));
      String catSlug = SlugUtil.slug(String.valueOf(row.get("category")));
      Category cat = categoryRepository.findById(catSlug).orElseThrow();
      Product p = new Product();
      p.setId(id);
      p.setCategory(cat);
      p.setType(ProductType.part);
      p.setSku(String.valueOf(row.get("sku")));
      p.setName(String.valueOf(row.get("name")));
      p.setPriceInr(BigDecimal.valueOf(((Number) row.get("price")).intValue()));
      p.setStockQuantity(((Number) row.get("totalStock")).intValue());
      p.setPublished(true);
      p.setImageKey(String.valueOf(row.get("imageKey")));
      p.setMetadata(objectMapper.createObjectNode());
      productRepository.save(p);
      @SuppressWarnings("unchecked")
      List<String> carsFit = (List<String>) row.get("compatibleCars");
      if (carsFit != null) {
        for (String label : carsFit) {
          if (label == null || label.isBlank()) continue;
          ProductFitmentLabel f = new ProductFitmentLabel();
          f.setProductId(id);
          f.setLabel(label.trim());
          fitmentLabelRepository.save(f);
        }
      }
    }

    Category vehCat = categoryRepository.findById(SlugUtil.slug("Vehicles")).orElseThrow();
    for (Map<String, Object> row : cars) {
      String id = String.valueOf(row.get("id"));
      Product p = new Product();
      p.setId(id);
      p.setCategory(vehCat);
      p.setType(ProductType.vehicle);
      p.setSku(id);
      p.setName(String.valueOf(row.get("title")));
      p.setPriceInr(BigDecimal.valueOf(((Number) row.get("price")).longValue()));
      p.setStockQuantity(1);
      p.setPublished(true);
      p.setImageKey(null);
      p.setDescription(
          row.get("description") != null ? String.valueOf(row.get("description")) : "");
      p.setMetadata(objectMapper.createObjectNode());
      productRepository.save(p);
      ProductVehicleSpec spec = new ProductVehicleSpec();
      spec.setProductId(id);
      spec.setProduct(p);
      spec.setModelYear(((Number) row.get("year")).shortValue());
      spec.setCondition(String.valueOf(row.get("condition")));
      spec.setOdometerKm(((Number) row.get("km")).intValue());
      spec.setFuel(String.valueOf(row.get("fuel")));
      spec.setTransmission(String.valueOf(row.get("transmission")));
      spec.setLocation(String.valueOf(row.get("location")));
      spec.setPrimaryImageUrl(String.valueOf(row.get("image")));
      spec.setImageAlt(
          row.get("imageAlt") != null ? String.valueOf(row.get("imageAlt")) : null);
      JsonNode gallery =
          row.get("gallery") != null
              ? objectMapper.valueToTree(row.get("gallery"))
              : objectMapper.createArrayNode();
      spec.setGallery(gallery);
      vehicleSpecRepository.save(spec);
    }

    seedAdminIfMissing();
  }

  private void seedAdminIfMissing() {
    String email = "admin@carnalysys.com";
    if (adminUserRepository.findByEmailIgnoreCase(email).isPresent()) {
      return;
    }
    AdminUser a = new AdminUser();
    a.setEmail(email);
    a.setPhoneE164(SEED_ADMIN_PHONE);
    a.setRole("super_admin");
    a.setOnboardingStatus("success");
    adminUserRepository.save(a);
  }
}
