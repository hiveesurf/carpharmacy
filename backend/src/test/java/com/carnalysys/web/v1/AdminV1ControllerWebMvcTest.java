package com.carnalysys.web.v1;

import static com.carnalysys.testsupport.SecurityTestUtils.asAdmin;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.carnalysys.api.GlobalExceptionHandler;
import com.carnalysys.service.AdminApiService;
import com.carnalysys.service.AdminReconciliationService;
import com.carnalysys.service.NotificationService;
import com.carnalysys.testsupport.ControllerSliceTestBase;
import com.carnalysys.testsupport.JsonEnvelopeMatchers;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = AdminV1Controller.class)
@AutoConfigureMockMvc(addFilters = true)
@Import(GlobalExceptionHandler.class)
class AdminV1ControllerWebMvcTest extends ControllerSliceTestBase {

  @Autowired private MockMvc mockMvc;

  @MockBean private AdminApiService adminApiService;
  @MockBean private AdminReconciliationService adminReconciliationService;
  @MockBean private NotificationService notificationService;

  @Test
  void dashboardOk() throws Exception {
    when(adminApiService.dashboard()).thenReturn(Map.of("ordersToday", 1));
    mockMvc
        .perform(get("/api/v1/admin/dashboard").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.ordersToday").value(1));
  }

  @Test
  void productsListOk() throws Exception {
    when(adminApiService.listProductsPage(0, 20, "created_desc", null, false))
        .thenReturn(Map.of("items", List.of(), "page", 0));
    mockMvc
        .perform(get("/api/v1/admin/products").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items").isArray());
  }

  @Test
  void productGetOk() throws Exception {
    when(adminApiService.getProductAdmin("p1")).thenReturn(Map.of("id", "p1"));
    mockMvc
        .perform(get("/api/v1/admin/products/p1").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("p1"));
  }

  @Test
  void createProductOk() throws Exception {
    when(adminApiService.upsertProduct(any(), isNull())).thenReturn(Map.of("id", "new"));
    mockMvc
        .perform(
            post("/api/v1/admin/products")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"N\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("new"));
  }

  @Test
  void updateProductOk() throws Exception {
    when(adminApiService.upsertProduct(any(), eq("p1"))).thenReturn(Map.of("id", "p1"));
    mockMvc
        .perform(
            put("/api/v1/admin/products/p1")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"U\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("p1"));
  }

  @Test
  void deleteProductOk() throws Exception {
    when(adminApiService.deleteProduct("p1")).thenReturn(Map.of("removed", "p1"));
    mockMvc
        .perform(delete("/api/v1/admin/products/p1").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(JsonEnvelopeMatchers.successTrue());
  }

  @Test
  void publishOk() throws Exception {
    when(adminApiService.patchPublish("p1", true)).thenReturn(Map.of("id", "p1", "published", true));
    mockMvc
        .perform(
            patch("/api/v1/admin/products/p1/publish")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"published\":true}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.published").value(true));
  }

  @Test
  void categoriesOk() throws Exception {
    when(adminApiService.listCategoriesPage(0, 5))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "page",
                0,
                "size",
                5,
                "hasMore",
                false,
                "nextPage",
                0));
    mockMvc
        .perform(get("/api/v1/admin/categories").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items").isArray());
  }

  @Test
  void categoriesOverviewOk() throws Exception {
    when(adminApiService.categoriesOverview()).thenReturn(Map.of("total", 3));
    mockMvc
        .perform(get("/api/v1/admin/categories/overview").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.total").value(3));
  }

  @Test
  void createCategoryOk() throws Exception {
    when(adminApiService.createCategory("Parts")).thenReturn(Map.of("id", "c1"));
    mockMvc
        .perform(
            post("/api/v1/admin/categories")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Parts\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("c1"));
  }

  @Test
  void updateCategoryOk() throws Exception {
    when(adminApiService.updateCategory(eq("c1"), any())).thenReturn(Map.of("id", "c1"));
    mockMvc
        .perform(
            put("/api/v1/admin/categories/c1")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"X\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("c1"));
  }

  @Test
  void deleteCategoryOk() throws Exception {
    when(adminApiService.deleteCategory("c1")).thenReturn(Map.of("removed", "c1"));
    mockMvc
        .perform(delete("/api/v1/admin/categories/c1").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(JsonEnvelopeMatchers.successTrue());
  }

  @Test
  void ordersOk() throws Exception {
    when(adminApiService.listOrdersAdminPage(null, 0, 5))
        .thenReturn(Map.of("items", List.of(), "page", 0, "size", 5, "hasMore", false, "nextPage", 0));
    mockMvc
        .perform(get("/api/v1/admin/orders").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items").isArray())
        .andExpect(jsonPath("$.data.size").value(5))
        .andExpect(jsonPath("$.data.hasMore").value(false));
  }

  @Test
  void orderByIdOk() throws Exception {
    when(adminApiService.getOrderAdmin("ord_1"))
        .thenReturn(Map.of("order", Map.of("id", "ord_1", "status", "placed")));
    mockMvc
        .perform(get("/api/v1/admin/orders/ord_1").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.order.id").value("ord_1"));
  }

  @Test
  void orderStatusOk() throws Exception {
    when(adminApiService.patchOrderStatus("ord_1", "confirmed"))
        .thenReturn(Map.of("order", Map.of("id", "ord_1")));
    mockMvc
        .perform(
            patch("/api/v1/admin/orders/ord_1/status")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"confirmed\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.order.id").value("ord_1"));
  }

  @Test
  void usersOk() throws Exception {
    when(adminApiService.listUsersPage(
            anyInt(),
            anyInt(),
            nullable(String.class),
            nullable(String.class),
            nullable(String.class),
            nullable(String.class),
            nullable(String.class)))
        .thenReturn(Map.of("items", List.of(), "page", 0, "size", 5, "hasMore", false, "nextPage", 0));
    mockMvc
        .perform(get("/api/v1/admin/users").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items").isArray());
  }

  @Test
  void usersForwardsCustomerTypeFilter() throws Exception {
    when(adminApiService.listUsersPage(
            eq(0),
            eq(5),
            isNull(),
            isNull(),
            isNull(),
            isNull(),
            eq("business")))
        .thenReturn(Map.of("items", List.of(), "page", 0, "size", 5, "hasMore", false, "nextPage", 0));
    mockMvc
        .perform(get("/api/v1/admin/users").with(asAdmin()).param("customerType", "business"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items").isArray());
  }

  @Test
  void carsListOkWithBrandFilter() throws Exception {
    when(adminApiService.listCarsAdminPage(eq(false), eq("Toyota"), nullable(String.class), eq(0), eq(5)))
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("id", "car_1")),
                "page",
                0,
                "size",
                5,
                "hasMore",
                false,
                "nextPage",
                0));
    mockMvc
        .perform(get("/api/v1/admin/cars").with(asAdmin()).param("brand", "Toyota"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items[0].id").value("car_1"));
  }

  @Test
  void carFormOptionsOk() throws Exception {
    when(adminApiService.listCarFormOptionCatalog())
        .thenReturn(
            Map.of(
                "fuels",
                List.of(Map.of("label", "Petrol")),
                "transmissions",
                List.of(Map.of("label", "Manual"))));
    mockMvc
        .perform(get("/api/v1/admin/cars/form-options").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.fuels[0].label").value("Petrol"))
        .andExpect(jsonPath("$.data.transmissions[0].label").value("Manual"));
  }

  @Test
  void getCarOk() throws Exception {
    when(adminApiService.getCarAdmin("car_1")).thenReturn(Map.of("id", "car_1"));
    mockMvc
        .perform(get("/api/v1/admin/cars/car_1").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("car_1"));
  }

  @Test
  void carPartsSummaryOk() throws Exception {
    when(adminApiService.getCarPartsSummary("car_1"))
        .thenReturn(
            Map.of(
                "carId",
                "car_1",
                "totalParts",
                2,
                "soldPartsCount",
                5,
                "parts",
                List.of()));
    mockMvc
        .perform(get("/api/v1/admin/cars/car_1/parts-summary").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.carId").value("car_1"))
        .andExpect(jsonPath("$.data.totalParts").value(2))
        .andExpect(jsonPath("$.data.soldPartsCount").value(5));
  }

  @Test
  void carsPurchasedSummaryOk() throws Exception {
    when(adminApiService.getCarsPurchasedSummary()).thenReturn(Map.of("purchasedCarsCount", 7));
    mockMvc
        .perform(get("/api/v1/admin/cars/purchased-summary").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.purchasedCarsCount").value(7));
  }

  @Test
  void carsListForwardsPartNameFilter() throws Exception {
    when(adminApiService.listCarsAdminPage(eq(false), isNull(), eq("oil filter"), eq(0), eq(5)))
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("id", "car_oil")),
                "page",
                0,
                "size",
                5,
                "hasMore",
                false,
                "nextPage",
                0));
    mockMvc
        .perform(get("/api/v1/admin/cars").with(asAdmin()).param("partName", "oil filter"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items[0].id").value("car_oil"));
  }

  @Test
  void createCarOk() throws Exception {
    when(adminApiService.createCar(any())).thenReturn(Map.of("car", Map.of("id", "car_2")));
    mockMvc
        .perform(
            post("/api/v1/admin/cars")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"brandName\":\"Toyota\",\"model\":\"Innova\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.car.id").value("car_2"));
  }

  @Test
  void updateCarOk() throws Exception {
    when(adminApiService.updateCar(eq("car_1"), any())).thenReturn(Map.of("car", Map.of("id", "car_1")));
    mockMvc
        .perform(
            put("/api/v1/admin/cars/car_1")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"brandName\":\"Toyota\",\"model\":\"Fortuner\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.car.id").value("car_1"));
  }

  @Test
  void deleteCarOk() throws Exception {
    when(adminApiService.deleteCar("car_1")).thenReturn(Map.of("removed", "car_1"));
    mockMvc
        .perform(delete("/api/v1/admin/cars/car_1").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.removed").value("car_1"));
  }

  @Test
  void assignDeliveryOk() throws Exception {
    when(adminApiService.assignDelivery("ord_1", "delivery@test.dev"))
        .thenReturn(Map.of("assigned", true, "orderId", "ord_1"));
    mockMvc
        .perform(
            patch("/api/v1/admin/orders/ord_1/assign-delivery")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"deliveryAdminEmail\":\"delivery@test.dev\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.assigned").value(true));
  }

  @Test
  void deliveryOrdersOk() throws Exception {
    when(adminApiService.listDeliveryOrdersForCurrent(null, null, null))
        .thenReturn(List.of(Map.of("id", "ord_1")));
    mockMvc
        .perform(get("/api/v1/admin/delivery/orders").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items[0].id").value("ord_1"));
  }

  @Test
  void deliveryMeSummaryOk() throws Exception {
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("deliveriesDone", 3L);
    summary.put("availability", "busy");
    summary.put("lastLoginAt", "2026-05-01T10:00:00Z");
    summary.put("lastLogoutAt", null);
    when(adminApiService.deliveryPartnerSummaryForCurrent()).thenReturn(summary);
    mockMvc
        .perform(get("/api/v1/admin/delivery/me/summary").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.deliveriesDone").value(3))
        .andExpect(jsonPath("$.data.availability").value("busy"));
  }

  @Test
  void employeesListOk() throws Exception {
    when(adminApiService.listEmployeesPage(0, 5, null))
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("phone", "+911234567890")),
                "page",
                0,
                "size",
                5,
                "hasMore",
                false,
                "nextPage",
                0));
    mockMvc
        .perform(get("/api/v1/admin/employees").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items[0].phone").value("+911234567890"));
  }

  @Test
  void createEmployeeOk() throws Exception {
    when(adminApiService.createEmployee(any())).thenReturn(Map.of("employee", Map.of("phone", "1234567890")));
    mockMvc
        .perform(
            post("/api/v1/admin/employees")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"1234567890\",\"role\":\"sales\",\"name\":\"A\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.employee.phone").value("1234567890"));
  }

  @Test
  void getEmployeeOk() throws Exception {
    when(adminApiService.getEmployee("1234567890"))
        .thenReturn(Map.of("employee", Map.of("phone", "1234567890", "role", "sales")));
    mockMvc
        .perform(get("/api/v1/admin/employees/1234567890").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.employee.role").value("sales"));
  }

  @Test
  void updateEmployeeOk() throws Exception {
    when(adminApiService.updateEmployee(eq("1234567890"), any()))
        .thenReturn(Map.of("employee", Map.of("phone", "9123456789")));
    mockMvc
        .perform(
            put("/api/v1/admin/employees/1234567890")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9123456789\",\"role\":\"delivery\",\"name\":\"B\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.employee.phone").value("9123456789"));
  }

  @Test
  void deleteEmployeeOk() throws Exception {
    when(adminApiService.deleteEmployee("1234567890", "Left")).thenReturn(Map.of("removed", "1234567890"));
    mockMvc
        .perform(
            delete("/api/v1/admin/employees/1234567890")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Left\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.removed").value("1234567890"));
  }

  @Test
  void setEmployeeAvailabilityOk() throws Exception {
    when(adminApiService.setEmployeeAvailability("+911234567890", "online"))
        .thenReturn(Map.of("id", "emp_1", "availability", "online"));
    mockMvc
        .perform(
            patch("/api/v1/admin/employees/+911234567890/availability")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"availability\":\"online\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.availability").value("online"));
  }

  @Test
  void employeeDeliveryOrdersOk() throws Exception {
    Map<String, Object> summary =
        Map.of("assignedCount", 2L, "shippedCount", 1L, "deliveredCount", 1L, "deliverySuccessRate", 50.0);
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("orderId", "ord1");
    row.put("customerName", "A");
    row.put("orderDate", "2026-05-01T10:00:00Z");
    row.put("amount", 100L);
    row.put("status", "shipped");
    row.put("deliveredDate", null);
    when(adminApiService.getEmployeeDeliveryOrders(
            eq("1234567890"), eq("2026-05-01"), eq("2026-05-31"), eq("a1"), eq(0), eq(20)))
        .thenReturn(
            Map.of(
                "summary", summary,
                "orders", List.of(row),
                "page", 0,
                "size", 20,
                "totalElements", 1L,
                "totalPages", 1,
                "hasNext", false));
    mockMvc
        .perform(
            get("/api/v1/admin/employees/1234567890/delivery-orders")
                .queryParam("fromDate", "2026-05-01")
                .queryParam("toDate", "2026-05-31")
                .queryParam("search", "a1")
                .with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.summary.assignedCount").value(2))
        .andExpect(jsonPath("$.data.orders[0].orderId").value("ord1"));
  }

  @Test
  void productAuditOk() throws Exception {
    when(adminApiService.productAuditHistory("p1"))
        .thenReturn(List.of(Map.of("action", "updated", "actorName", "sales@test.dev")));
    mockMvc
        .perform(get("/api/v1/admin/products/p1/audit").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items[0].action").value("updated"));
  }

  @Test
  void userOk() throws Exception {
    when(adminApiService.getUserAdmin("u1")).thenReturn(Map.of("id", "u1"));
    mockMvc
        .perform(get("/api/v1/admin/users/u1").with(asAdmin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("u1"));
  }
}
