package com.carnalysys.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class EmployeeAvailabilityTest {

  @Test
  void effectiveStatus_offlineWhenStoredOfflineRegardlessOfOrders() {
    assertThat(EmployeeAvailability.effectiveStatus("offline", true)).isEqualTo("offline");
    assertThat(EmployeeAvailability.effectiveStatus("offline", false)).isEqualTo("offline");
  }

  @Test
  void effectiveStatus_pendingStaysPendingRegardlessOfOrders() {
    assertThat(EmployeeAvailability.effectiveStatus("pending", true)).isEqualTo("pending");
    assertThat(EmployeeAvailability.effectiveStatus("pending", false)).isEqualTo("pending");
  }

  @Test
  void isPending_recognizesPendingOnly() {
    assertThat(EmployeeAvailability.isPending("pending")).isTrue();
    assertThat(EmployeeAvailability.isPending("online")).isFalse();
    assertThat(EmployeeAvailability.isPending("offline")).isFalse();
  }

  @Test
  void effectiveStatus_busyOnlyWhenActiveOrders() {
    assertThat(EmployeeAvailability.effectiveStatus("online", true)).isEqualTo("busy");
    assertThat(EmployeeAvailability.effectiveStatus("free", true)).isEqualTo("busy");
    assertThat(EmployeeAvailability.effectiveStatus("busy", true)).isEqualTo("busy");
  }

  @Test
  void effectiveStatus_staleBusyWithoutOrdersShowsOnline() {
    assertThat(EmployeeAvailability.effectiveStatus("busy", false)).isEqualTo("online");
  }

  @Test
  void effectiveStatus_onlineForOnlineOrFreeWithoutActiveOrders() {
    assertThat(EmployeeAvailability.effectiveStatus("online", false)).isEqualTo("online");
    assertThat(EmployeeAvailability.effectiveStatus("free", false)).isEqualTo("online");
  }

  @Test
  void effectiveStatus_unknownStoredTreatsAsOffline() {
    assertThat(EmployeeAvailability.effectiveStatus("away", false)).isEqualTo("offline");
  }

  @Test
  void isStoredOnline_acceptsOnlineAndFree() {
    assertThat(EmployeeAvailability.isStoredOnline("online")).isTrue();
    assertThat(EmployeeAvailability.isStoredOnline("free")).isTrue();
    assertThat(EmployeeAvailability.isStoredOnline("busy")).isFalse();
    assertThat(EmployeeAvailability.isStoredOnline("offline")).isFalse();
  }
}
