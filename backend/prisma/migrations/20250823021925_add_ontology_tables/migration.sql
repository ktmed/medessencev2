/*
  Warnings:

  - You are about to drop the `api_keys` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `circuit_breaker_states` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rate_limit_entries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `refresh_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `service_health` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `system_config` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_userId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_userId_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_userId_fkey";

-- DropTable
DROP TABLE "api_keys";

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "circuit_breaker_states";

-- DropTable
DROP TABLE "rate_limit_entries";

-- DropTable
DROP TABLE "refresh_tokens";

-- DropTable
DROP TABLE "service_health";

-- DropTable
DROP TABLE "sessions";

-- DropTable
DROP TABLE "system_config";

-- DropTable
DROP TABLE "user_permissions";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "audit_actions";

-- DropEnum
DROP TYPE "circuit_states";

-- DropEnum
DROP TYPE "health_status";

-- DropEnum
DROP TYPE "permission_types";

-- DropEnum
DROP TYPE "risk_levels";

-- DropEnum
DROP TYPE "user_roles";

-- CreateTable
CREATE TABLE "icd_codes" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "terminal" TEXT NOT NULL,
    "icdCode" TEXT NOT NULL,
    "icdNormCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "chapterNr" INTEGER NOT NULL,
    "icdBlockFirst" TEXT NOT NULL,
    "genderSpecific" TEXT,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "rareInCentralEurope" TEXT NOT NULL DEFAULT 'N',
    "notifiable" TEXT NOT NULL DEFAULT 'N',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "icd_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_cases" (
    "id" TEXT NOT NULL,
    "patientSex" TEXT,
    "caseAgeClass" TEXT,
    "examServiceId" TEXT,
    "order" TEXT,
    "examDescription" TEXT,
    "examDescriptionDE" TEXT,
    "caseOrderDE" TEXT,
    "icdCode" TEXT,
    "reportText" TEXT NOT NULL,
    "examDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_terms" (
    "id" TEXT NOT NULL,
    "german" TEXT NOT NULL,
    "english" TEXT,
    "category" TEXT,
    "modality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ontology_entities" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ontology_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ontology_relationships" (
    "id" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ontology_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "icd_codes_icdCode_key" ON "icd_codes"("icdCode");

-- CreateIndex
CREATE INDEX "icd_codes_icdCode_idx" ON "icd_codes"("icdCode");

-- CreateIndex
CREATE INDEX "icd_codes_chapterNr_idx" ON "icd_codes"("chapterNr");

-- CreateIndex
CREATE INDEX "icd_codes_terminal_idx" ON "icd_codes"("terminal");

-- CreateIndex
CREATE INDEX "icd_codes_label_idx" ON "icd_codes"("label");

-- CreateIndex
CREATE INDEX "medical_cases_icdCode_idx" ON "medical_cases"("icdCode");

-- CreateIndex
CREATE INDEX "medical_cases_examDate_idx" ON "medical_cases"("examDate");

-- CreateIndex
CREATE INDEX "medical_cases_examServiceId_idx" ON "medical_cases"("examServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "medical_terms_german_key" ON "medical_terms"("german");

-- CreateIndex
CREATE INDEX "medical_terms_german_idx" ON "medical_terms"("german");

-- CreateIndex
CREATE INDEX "medical_terms_category_idx" ON "medical_terms"("category");

-- CreateIndex
CREATE INDEX "medical_terms_modality_idx" ON "medical_terms"("modality");

-- CreateIndex
CREATE INDEX "ontology_entities_entityType_idx" ON "ontology_entities"("entityType");

-- CreateIndex
CREATE INDEX "ontology_entities_name_idx" ON "ontology_entities"("name");

-- CreateIndex
CREATE INDEX "ontology_relationships_relationshipType_idx" ON "ontology_relationships"("relationshipType");

-- CreateIndex
CREATE INDEX "ontology_relationships_fromEntityId_idx" ON "ontology_relationships"("fromEntityId");

-- CreateIndex
CREATE INDEX "ontology_relationships_toEntityId_idx" ON "ontology_relationships"("toEntityId");

-- AddForeignKey
ALTER TABLE "ontology_relationships" ADD CONSTRAINT "ontology_relationships_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "ontology_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ontology_relationships" ADD CONSTRAINT "ontology_relationships_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "ontology_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
