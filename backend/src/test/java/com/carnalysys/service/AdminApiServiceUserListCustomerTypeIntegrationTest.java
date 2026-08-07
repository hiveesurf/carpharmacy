package com.carnalysys.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.carnalysys.domain.AddressEntity;
import com.carnalysys.domain.UserEntity;
import com.carnalysys.repo.AddressRepository;
import com.carnalysys.repo.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("local")
class AdminApiServiceUserListCustomerTypeIntegrationTest {

  @DynamicPropertySource
  static void localPostgres(DynamicPropertyRegistry r) {
    String base = System.getProperty("java.io.tmpdir") + "/carpharmacy/user-list-test";
    r.add("spring.datasource.url", () -> "jdbc:postgresql://localhost:5432/carnalysys");
    r.add("spring.flyway.baseline-on-migrate", () -> "false");
    r.add("carnalysys.storage.avatar-dir", () -> base + "/avatars");
    r.add("carnalysys.storage.vehicles-dir", () -> base + "/uploads/vehicles");
    r.add("carnalysys.storage.receipts-dir", () -> base + "/uploads/receipts");
    r.add("carnalysys.storage.logs-dir", () -> base + "/logs");
  }

  @Autowired private AdminApiService adminApiService;
  @Autowired private UserRepository userRepository;
  @Autowired private AddressRepository addressRepository;

  private UUID businessUserId;
  private UUID personalUserId;
  private UUID deletedGstUserId;

  @BeforeEach
  @Transactional
  void seedUsers() {
    long suffix = System.nanoTime();
    businessUserId = saveUser("+9199000" + (suffix % 1_000_000), "Business Buyer").getId();
    personalUserId = saveUser("+9199001" + (suffix % 1_000_000), "Personal Shopper").getId();
    deletedGstUserId = saveUser("+9199002" + (suffix % 1_000_000), "Deleted GST User").getId();

    UserEntity businessUser = userRepository.findById(businessUserId).orElseThrow();
    UserEntity personalUser = userRepository.findById(personalUserId).orElseThrow();
    UserEntity deletedGstUser = userRepository.findById(deletedGstUserId).orElseThrow();

    saveAddress(businessUser, "22AAAAA0000A1Z5", null);
    saveAddress(personalUser, null, null);
    AddressEntity deletedGstAddress = saveAddress(deletedGstUser, "29AAAAA0000A1Z5", null);
    deletedGstAddress.setDeletedAt(Instant.now());
    addressRepository.save(deletedGstAddress);
  }

  @Test
  @Transactional
  void businessFilterIncludesUserWithActiveGstAddress() {
    Map<String, Object> result =
        adminApiService.listUsersPage(0, 50, null, "user", null, null, "business");

    List<String> ids = userIds(result);
    assertThat(ids).contains(businessUserId.toString());
    assertThat(ids).doesNotContain(personalUserId.toString());
    assertThat(ids).doesNotContain(deletedGstUserId.toString());
  }

  @Test
  @Transactional
  void personalFilterExcludesBusinessUsersAndIncludesUsersWithoutGst() {
    Map<String, Object> result =
        adminApiService.listUsersPage(0, 50, null, "user", null, null, "personal");

    List<String> ids = userIds(result);
    assertThat(ids).contains(personalUserId.toString());
    assertThat(ids).contains(deletedGstUserId.toString());
    assertThat(ids).doesNotContain(businessUserId.toString());
  }

  @Test
  @Transactional
  void deletedGstAddressDoesNotClassifyUserAsBusiness() {
    Map<String, Object> result =
        adminApiService.listUsersPage(0, 50, null, "user", null, null, "business");

    List<String> ids = userIds(result);
    assertThat(ids).doesNotContain(deletedGstUserId.toString());
  }

  private UserEntity saveUser(String phone, String name) {
    UserEntity user = new UserEntity();
    user.setPhoneE164(phone);
    user.setDisplayName(name);
    user.setRole("user");
    return userRepository.save(user);
  }

  private AddressEntity saveAddress(UserEntity user, String gstNumber, Instant deletedAt) {
    AddressEntity address = new AddressEntity();
    address.setUser(user);
    address.setLine1("1 Test Street");
    address.setCity("Mumbai");
    address.setPincode("400001");
    address.setGstNumber(gstNumber);
    address.setDeletedAt(deletedAt);
    return addressRepository.save(address);
  }

  @SuppressWarnings("unchecked")
  private static List<String> userIds(Map<String, Object> result) {
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    return items.stream().map(item -> String.valueOf(item.get("id"))).toList();
  }
}
