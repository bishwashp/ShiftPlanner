-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('SCREENER_SELECTION', 'WEEKEND_ROTATION', 'OPTIMIZATION_STRATEGY', 'CONSTRAINT_RESOLUTION', 'TIE_BREAKING', 'FAIRNESS_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('CONFIGURATION_CHANGE', 'STRATEGY_OPTIMIZATION', 'PERFORMANCE_IMPROVEMENT', 'CONSTRAINT_ADJUSTMENT', 'ALGORITHM_UPGRADE');

-- CreateEnum
CREATE TYPE "RecommendationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'REVIEWED', 'APPROVED', 'IMPLEMENTED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "algorithm_audits" (
    "id" TEXT NOT NULL,
    "algorithmName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "analystCount" INTEGER NOT NULL,
    "executionTime" DOUBLE PRECISION NOT NULL,
    "configuration" JSONB NOT NULL,
    "schedulesGenerated" INTEGER NOT NULL,
    "conflictsFound" INTEGER NOT NULL,
    "overwrites" INTEGER NOT NULL,
    "fairnessScore" DOUBLE PRECISION NOT NULL,
    "constraintScore" DOUBLE PRECISION NOT NULL,
    "efficiencyScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "algorithm_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_audits" (
    "id" TEXT NOT NULL,
    "algorithmAuditId" TEXT NOT NULL,
    "decisionType" "DecisionType" NOT NULL,
    "strategy" TEXT NOT NULL,
    "analystId" TEXT,
    "date" TIMESTAMP(3),
    "shiftType" TEXT,
    "alternatives" INTEGER NOT NULL,
    "selectionScore" DOUBLE PRECISION NOT NULL,
    "selectionReason" TEXT NOT NULL,
    "constraints" JSONB,
    "actualOutcome" TEXT,
    "outcomeScore" DOUBLE PRECISION,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "algorithmAuditId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "baseline" DOUBLE PRECISION,
    "improvement" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_recommendations" (
    "id" TEXT NOT NULL,
    "algorithmAuditId" TEXT,
    "type" "RecommendationType" NOT NULL,
    "priority" "RecommendationPriority" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "currentValue" JSONB,
    "recommendedValue" JSONB,
    "expectedImprovement" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "implementedAt" TIMESTAMP(3),
    "implementedBy" TEXT,
    "result" TEXT,
    "analysisData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "algorithm_audits_algorithmName_createdAt_idx" ON "algorithm_audits"("algorithmName", "createdAt");

-- CreateIndex
CREATE INDEX "algorithm_audits_success_overallScore_idx" ON "algorithm_audits"("success", "overallScore");

-- CreateIndex
CREATE INDEX "algorithm_audits_startDate_endDate_idx" ON "algorithm_audits"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "decision_audits_algorithmAuditId_idx" ON "decision_audits"("algorithmAuditId");

-- CreateIndex
CREATE INDEX "decision_audits_decisionType_strategy_idx" ON "decision_audits"("decisionType", "strategy");

-- CreateIndex
CREATE INDEX "decision_audits_analystId_date_idx" ON "decision_audits"("analystId", "date");

-- CreateIndex
CREATE INDEX "performance_metrics_algorithmAuditId_idx" ON "performance_metrics"("algorithmAuditId");

-- CreateIndex
CREATE INDEX "performance_metrics_metricType_category_idx" ON "performance_metrics"("metricType", "category");

-- CreateIndex
CREATE INDEX "performance_metrics_createdAt_idx" ON "performance_metrics"("createdAt");

-- CreateIndex
CREATE INDEX "audit_recommendations_type_priority_status_idx" ON "audit_recommendations"("type", "priority", "status");

-- CreateIndex
CREATE INDEX "audit_recommendations_confidence_idx" ON "audit_recommendations"("confidence");

-- CreateIndex
CREATE INDEX "audit_recommendations_createdAt_idx" ON "audit_recommendations"("createdAt");

-- AddForeignKey
ALTER TABLE "decision_audits" ADD CONSTRAINT "decision_audits_algorithmAuditId_fkey" FOREIGN KEY ("algorithmAuditId") REFERENCES "algorithm_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_algorithmAuditId_fkey" FOREIGN KEY ("algorithmAuditId") REFERENCES "algorithm_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_recommendations" ADD CONSTRAINT "audit_recommendations_algorithmAuditId_fkey" FOREIGN KEY ("algorithmAuditId") REFERENCES "algorithm_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
