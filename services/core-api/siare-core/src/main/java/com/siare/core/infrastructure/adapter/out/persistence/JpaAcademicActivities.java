package com.siare.core.infrastructure.adapter.out.persistence;
import java.util.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.Pageable;
public interface JpaAcademicActivities extends JpaRepository<AcademicActivityEntity,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from AcademicActivityEntity a where a.id=:id")
    Optional<AcademicActivityEntity> lockById(String id);
    @Query("select a from AcademicActivityEntity a where a.subjectId=:subject and (:after is null or a.id>:after) order by a.id")
    List<AcademicActivityEntity> page(String subject,String after,Pageable pageable);
}
