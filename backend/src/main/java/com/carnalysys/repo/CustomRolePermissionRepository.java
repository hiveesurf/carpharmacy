package com.carnalysys.repo;

import com.carnalysys.domain.CustomRolePermission;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomRolePermissionRepository
    extends JpaRepository<CustomRolePermission, CustomRolePermission.Pk> {

  List<CustomRolePermission> findByRoleId(UUID roleId);

  void deleteByRoleId(UUID roleId);
}
