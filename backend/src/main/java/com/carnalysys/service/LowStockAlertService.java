package com.carnalysys.service;

import com.carnalysys.domain.Product;
import com.carnalysys.domain.ProductLowStockAlertState;
import com.carnalysys.repo.ProductLowStockAlertStateRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Detects when active product stock crosses into (or remains in) the low-stock band and triggers
 * in-app admin notifications plus optional WhatsApp alerts.
 */
@Service
public class LowStockAlertService {

  private static final Logger log = LoggerFactory.getLogger(LowStockAlertService.class);

  /** Sentinel for “no prior stock” on create/import (always treated as above threshold). */
  public static final int NO_PRIOR_STOCK = Integer.MAX_VALUE;

  private static final long RESEND_COOLDOWN_HOURS = 24;

  private final NotificationService notificationService;
  private final WhatsappService whatsappService;
  private final ProductLowStockAlertStateRepository alertStateRepository;

  public LowStockAlertService(
      NotificationService notificationService,
      WhatsappService whatsappService,
      ProductLowStockAlertStateRepository alertStateRepository) {
    this.notificationService = notificationService;
    this.whatsappService = whatsappService;
    this.alertStateRepository = alertStateRepository;
  }

  public static boolean isLowStock(int stockQuantity) {
    return stockQuantity <= AdminProductSpecifications.LOW_STOCK_THRESHOLD;
  }

  public static String severityForStock(int stockQuantity) {
    return stockQuantity <= 0 ? "critical" : "warning";
  }

  /**
   * @param previousStock stock before the change; use {@link #NO_PRIOR_STOCK} for new products
   * @param newStock stock after the change (usually {@link Product#getStockQuantity()})
   */
  @Transactional
  public void onStockChanged(Product product, int previousStock, int newStock) {
    if (product == null) {
      return;
    }
    String productId = product.getId();
    String sku = product.getSku() != null ? product.getSku() : productId;
    String name = product.getName() != null ? product.getName() : "Product";
    int threshold = AdminProductSpecifications.LOW_STOCK_THRESHOLD;

    log.info(
        "Low-stock check triggered: productId={}, sku={}, previousStock={}, newStock={}, threshold={}",
        productId,
        sku,
        previousStock,
        newStock,
        threshold);

    if (product.getDeletedAt() != null) {
      log.info("Low-stock check skipped (deleted): productId={}", productId);
      alertStateRepository.deleteById(productId);
      return;
    }

    int current = product.getStockQuantity();
    if (current != newStock) {
      current = newStock;
    }

    if (!isLowStock(current)) {
      log.info(
          "Low-stock check cleared (above threshold): productId={}, currentStock={}",
          productId,
          current);
      if (alertStateRepository.existsById(productId)) {
        alertStateRepository.deleteById(productId);
      }
      return;
    }

    int prev = previousStock == NO_PRIOR_STOCK ? NO_PRIOR_STOCK : previousStock;
    boolean crossedIntoLow = prev > threshold && current <= threshold;
    boolean stockChanged = prev != current && prev != NO_PRIOR_STOCK;
    Instant cooldownBefore = Instant.now().minus(RESEND_COOLDOWN_HOURS, ChronoUnit.HOURS);
    var state = alertStateRepository.findById(productId);
    boolean cooldownElapsed =
        state.map(s -> s.getLastAlertAt().isBefore(cooldownBefore)).orElse(true);

    if (!crossedIntoLow) {
      if (!stockChanged) {
        log.info(
            "Low-stock website/WhatsApp skipped (no stock change while low): productId={}, stock={}",
            productId,
            current);
        return;
      }
      if (!cooldownElapsed) {
        log.info(
            "Low-stock alert skipped (24h cooldown): productId={}, lastAlertAt={}",
            productId,
            state.map(ProductLowStockAlertState::getLastAlertAt).orElse(null));
        return;
      }
      if (notificationService.hasUnreadLowStockForProduct(productId)) {
        log.info(
            "Low-stock website notification skipped (unread exists): productId={}, stock={}",
            productId,
            current);
        return;
      }
    }

    String severity = severityForStock(current);
    log.info(
        "Low-stock alert firing: productId={}, sku={}, stock={}, crossedIntoLow={}, severity={}",
        productId,
        sku,
        current,
        crossedIntoLow,
        severity);

    notificationService.notifySuperAdminAndSalesLowStock(
        productId, name, sku, current, threshold, severity, crossedIntoLow);

    // WhatsApp low-stock goes to ADMIN_WHATSAPP_NUMBER only (not per-admin phones); cooldown above gates both channels.
    boolean whatsappEnabled = whatsappService.isEnabled();
    log.info("WhatsApp low-stock: enabled={}", whatsappEnabled);
    String messageSid =
        whatsappService.sendLowStockAlertToAdminBestEffort(name, sku, current, threshold);
    if (messageSid != null) {
      log.info("WhatsApp low-stock sent: productId={}, sid={}", productId, messageSid);
    }

    ProductLowStockAlertState row =
        state.orElseGet(ProductLowStockAlertState::new);
    row.setProductId(productId);
    row.setLastAlertAt(Instant.now());
    row.setStockAtAlert(current);
    alertStateRepository.save(row);
  }
}
