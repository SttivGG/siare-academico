package com.siare.core.infrastructure.adapter.out.persistence;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="academic_activities")
public class AcademicActivityEntity {
    @Id @Column(length=36,columnDefinition="char(36)") String id;
    @Column(name="subject_id",length=36,columnDefinition="char(36)",nullable=false) String subjectId;
    @Column(name="document_id",length=36,columnDefinition="char(36)") String documentId;
    @Column(length=16,nullable=false) String family;
    @Column(length=100,nullable=false) String topic;
    @Column(length=16,nullable=false) String status;
    @Column(name="public_content_json",columnDefinition="mediumtext",nullable=false) String publicContent;
    @Column(name="answer_key_json",columnDefinition="mediumtext",nullable=false) String protectedSnapshot;
    @Column(name="created_at",nullable=false) Instant createdAt;
    protected AcademicActivityEntity() { }
}
