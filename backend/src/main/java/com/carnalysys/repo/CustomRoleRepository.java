package com.carnalysys.repo;

import com.carnalysys.domain.CustomRole;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomRoleRepository extends JpaRepository<CustomRole, UUID> {

  Optional<CustomRole> findByNameKey(String nameKey);

  @Query(
      "select c from CustomRole c where lower(trim(c.name)) = lower(trim(:name))")
  Optional<CustomRole> findByNameNormalized(@Param("name") String name);

  List<CustomRole> findAllByOrderByNameAsc();
}
