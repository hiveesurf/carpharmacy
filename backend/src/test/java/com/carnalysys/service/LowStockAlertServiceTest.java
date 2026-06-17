package com.carnalysys.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.carnalysys.domain.Product;
import com.carnalysys.domain.ProductType;
import com.carnalysys.repo.ProductLowStockAlertStateRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LowStockAlertServiceTest {

  @Mock private NotificationService notificationService;
  @Mock private WhatsappService whatsappService;
  @Mock private ProductLowStockAlertStateRepository alertStateRepository;

  @InjectMocks private LowStockAlertService lowStockAlertService;

  @Test
  void onStockChanged_vehicleCrossingIntoLow_notifies() {
    Product vehicle = vehicleProduct("veh-1", 3);

    lowStockAlertService.onStockChanged(vehicle, 6, 3);

    verify(notificationService)
        .notifySuperAdminAndSalesLowStock(
            eq("veh-1"),
            eq("Thar"),
            eq("VEH-SKU"),
            eq(3),
            eq(AdminProductSpecifications.LOW_STOCK_THRESHOLD),
            eq("warning"),
            eq(true));
    verify(alertStateRepository).save(any());
  }

  @Test
  void onStockChanged_vehicleAtZero_doesNotNotify() {
    Product vehicle = vehicleProduct("veh-2", 0);

    lowStockAlertService.onStockChanged(vehicle, 1, 0);

    verify(notificationService, never())
        .notifySuperAdminAndSalesLowStock(
            anyString(), anyString(), anyString(), anyInt(), anyInt(), anyString(), eq(true));
    verify(alertStateRepository, never()).save(any());
  }

  @Test
  void onStockChanged_vehicleRestockedAboveThreshold_clearsAlertState() {
    Product vehicle = vehicleProduct("veh-3", 10);
    org.mockito.Mockito.when(alertStateRepository.existsById("veh-3")).thenReturn(true);

    lowStockAlertService.onStockChanged(vehicle, 5, 10);

    verify(alertStateRepository).deleteById("veh-3");
    verify(notificationService, never())
        .notifySuperAdminAndSalesLowStock(
            anyString(), anyString(), anyString(), anyInt(), anyInt(), anyString(), eq(true));
  }

  @Test
  void onStockChanged_partCrossingIntoLow_notifies() {
    Product part = partProduct("part-1", 4);

    lowStockAlertService.onStockChanged(part, 6, 4);

    verify(notificationService)
        .notifySuperAdminAndSalesLowStock(
            eq("part-1"),
            eq("Brake Pad"),
            eq("BP-1"),
            eq(4),
            eq(AdminProductSpecifications.LOW_STOCK_THRESHOLD),
            eq("warning"),
            eq(true));
    verify(alertStateRepository).save(any());
  }

  private static Product vehicleProduct(String id, int stock) {
    Product p = new Product();
    p.setId(id);
    p.setSku("VEH-SKU");
    p.setName("Thar");
    p.setType(ProductType.vehicle);
    p.setStockQuantity(stock);
    return p;
  }

  private static Product partProduct(String id, int stock) {
    Product p = new Product();
    p.setId(id);
    p.setSku("BP-1");
    p.setName("Brake Pad");
    p.setType(ProductType.part);
    p.setStockQuantity(stock);
    return p;
  }
}
