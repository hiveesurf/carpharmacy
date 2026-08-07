package com.carnalysys.service;

import com.carnalysys.api.ApiException;
import com.carnalysys.domain.AdminPageKey;
import com.carnalysys.domain.CustomRole;
import com.carnalysys.domain.CustomRolePermission;
import com.carnalysys.repo.CustomRolePermissionRepository;
import com.carnalysys.repo.CustomRoleRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomRoleService {

  private final CustomRoleRepository customRoleRepository;
  private final CustomRolePermissionRepository customRolePermissionRepository;

  public CustomRoleService(
      CustomRoleRepository customRoleRepository,
      CustomRolePermissionRepository customRolePermissionRepository) {
    this.customRoleRepository = customRoleRepository;
    this.customRolePermissionRepository = customRolePermissionRepository;
  }

  @Transactional(readOnly = true)
  public Optional<CustomRole> findById(UUID id) {
    if (id == null) {
      return Optional.empty();
    }
    return customRoleRepository.findById(id);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listRoles() {
    requireSuperAdmin();
    return customRoleRepository.findAllByOrderByNameAsc().stream()
        .map(this::toRoleMap)
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getRole(UUID id) {
    requireSuperAdmin();
    return toRoleMap(requireRole(id));
  }

  @Transactional
  public Map<String, Object> createRole(Map<String, Object> body, String createdBy) {
    requireSuperAdmin();
    String name = parseName(body == null ? null : body.get("name"));
    Set<String> pageKeys = parsePageKeys(body == null ? null : body.get("pageKeys"));
    String nameKey = toNameKey(name);
    if (customRoleRepository.findByNameKey(nameKey).isPresent()
        || customRoleRepository.findByNameNormalized(name).isPresent()) {
      throw new ApiException(
          HttpStatus.CONFLICT, "CONFLICT", "A custom role with this name already exists");
    }
    CustomRole role = new CustomRole();
    role.setName(name);
    role.setNameKey(nameKey);
    role.setCreatedBy(createdBy);
    role.setCreatedAt(Instant.now());
    role.setUpdatedAt(Instant.now());
    try {
      customRoleRepository.save(role);
    } catch (DataIntegrityViolationException ex) {
      throw new ApiException(
          HttpStatus.CONFLICT, "CONFLICT", "A custom role with this name already exists");
    }
    replacePermissions(role.getId(), pageKeys);
    return toRoleMap(role);
  }

  @Transactional
  public Map<String, Object> replacePermissions(UUID roleId, Map<String, Object> body) {
    requireSuperAdmin();
    CustomRole role = requireRole(roleId);
    Set<String> pageKeys = parsePageKeys(body == null ? null : body.get("pageKeys"));
    replacePermissions(role.getId(), pageKeys);
    role.setUpdatedAt(Instant.now());
    customRoleRepository.save(role);
    return toRoleMap(role);
  }

  /**
   * Resolves an existing role by id, or creates one from {@code name + pageKeys}. Used by employee
   * create when role=custom.
   */
  @Transactional
  public CustomRole resolveOrCreateForEmployee(Map<String, Object> body, String createdBy) {
    if (body == null) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "VALIDATION_ERROR",
          "customRoleId or customRole { name, pageKeys } required");
    }
    Object idRaw = body.get("customRoleId");
    if (idRaw != null && !String.valueOf(idRaw).isBlank() && !"null".equalsIgnoreCase(String.valueOf(idRaw))) {
      try {
        return requireRole(UUID.fromString(String.valueOf(idRaw).trim()));
      } catch (IllegalArgumentException ex) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid customRoleId");
      }
    }
    @SuppressWarnings("unchecked")
    Map<String, Object> nested =
        body.get("customRole") instanceof Map<?, ?> m
            ? (Map<String, Object>) m
            : null;
    if (nested == null) {
      // allow top-level name + pageKeys for convenience
      if (body.containsKey("name") || body.containsKey("pageKeys")) {
        nested = body;
      }
    }
    if (nested == null) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "VALIDATION_ERROR",
          "customRoleId or customRole { name, pageKeys } required");
    }
    String name = parseName(nested.get("name"));
    Set<String> pageKeys = parsePageKeys(nested.get("pageKeys"));
    String nameKey = toNameKey(name);
    var existing = customRoleRepository.findByNameKey(nameKey);
    if (existing.isEmpty()) {
      existing = customRoleRepository.findByNameNormalized(name);
    }
    if (existing.isPresent()) {
      CustomRole role = existing.get();
      // Reuse existing role; optionally refresh permissions when pageKeys provided on create
      if (nested.containsKey("pageKeys")) {
        replacePermissions(role.getId(), pageKeys);
        role.setUpdatedAt(Instant.now());
        customRoleRepository.save(role);
      }
      return role;
    }
    CustomRole role = new CustomRole();
    role.setName(name);
    role.setNameKey(nameKey);
    role.setCreatedBy(createdBy);
    role.setCreatedAt(Instant.now());
    role.setUpdatedAt(Instant.now());
    try {
      customRoleRepository.save(role);
    } catch (DataIntegrityViolationException ex) {
      throw new ApiException(
          HttpStatus.CONFLICT, "CONFLICT", "A custom role with this name already exists");
    }
    replacePermissions(role.getId(), pageKeys);
    return role;
  }

  @Transactional(readOnly = true)
  public List<String> pageKeysForRole(UUID roleId) {
    if (roleId == null) {
      return List.of();
    }
    return customRolePermissionRepository.findByRoleId(roleId).stream()
        .map(CustomRolePermission::getPageKey)
        .sorted()
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> toRoleMap(CustomRole role) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", role.getId().toString());
    m.put("name", role.getName());
    m.put("nameKey", role.getNameKey());
    m.put("pageKeys", pageKeysForRole(role.getId()));
    m.put("createdAt", role.getCreatedAt() != null ? role.getCreatedAt().toString() : null);
    m.put("updatedAt", role.getUpdatedAt() != null ? role.getUpdatedAt().toString() : null);
    m.put("createdBy", role.getCreatedBy());
    return m;
  }

  private void replacePermissions(UUID roleId, Set<String> pageKeys) {
    customRolePermissionRepository.deleteByRoleId(roleId);
    customRolePermissionRepository.flush();
    List<CustomRolePermission> rows = new ArrayList<>();
    for (String key : pageKeys) {
      rows.add(new CustomRolePermission(roleId, key));
    }
    customRolePermissionRepository.saveAll(rows);
  }

  private CustomRole requireRole(UUID id) {
    return customRoleRepository
        .findById(id)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Custom role not found"));
  }

  private static String parseName(Object raw) {
    String name = raw == null ? "" : String.valueOf(raw).trim();
    if (name.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Custom role name required");
    }
    if (name.length() > 80) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Custom role name must be at most 80 characters");
    }
    return name;
  }

  private static Set<String> parsePageKeys(Object raw) {
    if (!(raw instanceof List<?> list) || list.isEmpty()) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "At least one pageKeys entry is required");
    }
    Set<String> keys = new LinkedHashSet<>();
    for (Object item : list) {
      String key = item == null ? "" : String.valueOf(item).trim().toLowerCase(Locale.ROOT);
      AdminPageKey parsed =
          AdminPageKey.parse(key)
              .orElseThrow(
                  () ->
                      new ApiException(
                          HttpStatus.BAD_REQUEST,
                          "VALIDATION_ERROR",
                          "Invalid page key: "
                              + key
                              + " (allowed: analytics, inventory, cars, categories, users, employees, orders, sales_report, reconciliation)"));
      keys.add(parsed.name());
    }
    return keys;
  }

  public static String toNameKey(String name) {
    String key =
        name.trim()
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "_")
            .replaceAll("^_+|_+$", "");
    if (key.isBlank()) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Custom role name must include letters or digits");
    }
    return key;
  }

  private void requireSuperAdmin() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null
        || auth.getAuthorities().stream()
            .noneMatch(g -> "ROLE_SUPER_ADMIN".equals(g.getAuthority()))) {
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Super admin access required");
    }
  }
}
