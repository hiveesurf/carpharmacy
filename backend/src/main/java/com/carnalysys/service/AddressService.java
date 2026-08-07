package com.carnalysys.service;

import com.carnalysys.api.ApiException;
import com.carnalysys.domain.AddressEntity;
import com.carnalysys.domain.UserEntity;
import com.carnalysys.repo.AddressRepository;
import com.carnalysys.repo.UserRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AddressService {

  private final AddressRepository addressRepository;
  private final UserRepository userRepository;

  public AddressService(AddressRepository addressRepository, UserRepository userRepository) {
    this.addressRepository = addressRepository;
    this.userRepository = userRepository;
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> list(UUID userId) {
    return addressRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(userId).stream()
        .map(this::toMap)
        .toList();
  }

  @Transactional
  public Map<String, Object> create(UUID userId, Map<String, Object> body) {
    UserEntity user = userRepository.getReferenceById(userId);
    AddressEntity a = new AddressEntity();
    a.setUser(user);
    apply(a, body);
    addressRepository.save(a);
    return Map.of("address", toMap(a));
  }

  @Transactional
  public Map<String, Object> update(UUID userId, UUID id, Map<String, Object> body) {
    AddressEntity a =
        addressRepository
            .findById(id)
            .filter(x -> x.getDeletedAt() == null && x.getUser().getId().equals(userId))
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Address not found"));
    apply(a, body);
    addressRepository.save(a);
    return Map.of("address", toMap(a));
  }

  @Transactional
  public Map<String, Object> delete(UUID userId, UUID id) {
    addressRepository
        .findById(id)
        .filter(x -> x.getDeletedAt() == null && x.getUser().getId().equals(userId))
        .ifPresent(
            address -> {
              address.setDeletedAt(Instant.now());
              addressRepository.save(address);
            });
    return Map.of("removed", id.toString());
  }

  private void apply(AddressEntity a, Map<String, Object> body) {
    if (body.containsKey("line1")) a.setLine1(String.valueOf(body.get("line1")));
    if (body.containsKey("line2")) a.setLine2(strOrNull(body.get("line2")));
    if (body.containsKey("city")) a.setCity(String.valueOf(body.get("city")));
    if (body.containsKey("state")) a.setState(strOrNull(body.get("state")));
    if (body.containsKey("pincode")) a.setPincode(String.valueOf(body.get("pincode")));
    if (body.containsKey("country")) a.setCountry(normalizeCountry(body.get("country")));
    if (body.containsKey("label")) a.setLabel(strOrNull(body.get("label")));
    if (body.containsKey("gstNumber")) a.setGstNumber(normalizeGstNumber(body.get("gstNumber")));
    if (body.containsKey("isDefault")) a.setDefaultAddress(Boolean.TRUE.equals(body.get("isDefault")));
    if (a.getLine1() == null || a.getLine1().isBlank()) a.setLine1("");
    if (a.getCity() == null || a.getCity().isBlank()) a.setCity("");
    if (a.getPincode() == null) a.setPincode("");
  }

  private static String strOrNull(Object o) {
    return o == null ? null : String.valueOf(o);
  }

  /** Blank/null → null; otherwise trimmed uppercase (format validated client-side). */
  private static String normalizeGstNumber(Object raw) {
    if (raw == null) return null;
    String t = String.valueOf(raw).trim().toUpperCase();
    return t.isEmpty() ? null : t;
  }

  private static String normalizeCountry(Object raw) {
    if (raw == null) return "IN";
    String t = String.valueOf(raw).trim();
    if (t.isEmpty()) return "IN";
    String lower = t.toLowerCase();
    if ("india".equals(lower) || "in".equals(lower)) return "IN";
    if (t.length() == 2) return t.toUpperCase();
    return t.length() > 2 ? t.substring(0, 2).toUpperCase() : t.toUpperCase();
  }

  private Map<String, Object> toMap(AddressEntity a) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", a.getId().toString());
    m.put("line1", a.getLine1());
    m.put("line2", a.getLine2());
    m.put("city", a.getCity());
    m.put("state", a.getState());
    m.put("pincode", a.getPincode());
    m.put("country", a.getCountry());
    m.put("label", a.getLabel());
    m.put("gstNumber", a.getGstNumber());
    m.put("isDefault", a.isDefaultAddress());
    return m;
  }
}
