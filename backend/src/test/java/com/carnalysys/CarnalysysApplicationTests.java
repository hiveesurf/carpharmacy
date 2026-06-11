package com.carnalysys;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.springframework.http.MediaType;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class CarnalysysApplicationTests {

  @Container
  @ServiceConnection
  static PostgreSQLContainer<?> postgres =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("carnalysys")
          .withUsername("carnalysys")
          .withPassword("carnalysys_dev");

  @DynamicPropertySource
  static void flywayCompatible(DynamicPropertyRegistry r) {
    String base = System.getProperty("java.io.tmpdir") + "/carpharmacy/testdata";
    r.add("spring.flyway.baseline-on-migrate", () -> "false");
    r.add("carnalysys.storage.avatar-dir", () -> base + "/avatars");
    r.add("carnalysys.storage.vehicles-dir", () -> base + "/uploads/vehicles");
    r.add("carnalysys.storage.receipts-dir", () -> base + "/uploads/receipts");
    r.add("carnalysys.storage.logs-dir", () -> base + "/logs");
  }

  @Autowired private MockMvc mockMvc;

  @Test
  void contextLoads() {}

  @Test
  void healthReturnsOk() throws Exception {
    mockMvc
        .perform(get("/api/v1/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.status").value("ok"))
        .andExpect(jsonPath("$.data.service").value("carnalysys-api"));
  }

  /** Guards against stale deploys where PaymentV1Controller lacks create-order (NoResourceFound → 500). */
  @Test
  void createOrderEndpointIsMapped() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/payments/create-order")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":1000}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
  }
}
