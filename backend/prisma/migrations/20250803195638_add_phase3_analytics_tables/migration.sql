-- CreateTable
CREATE TABLE "fairness_metrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "overallScore" DECIMAL(3,2) NOT NULL,
    "workloadFairness" DECIMAL(3,2) NOT NULL,
    "weekendFairness" DECIMAL(3,2) NOT NULL,
    "assignmentFairness" DECIMAL(3,2) NOT NULL,
    "confidenceScore" DECIMAL(3,2) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fairness_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_request_impacts" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "analystId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "fairnessImpactBefore" DECIMAL(3,2) NOT NULL,
    "fairnessImpactAfter" DECIMAL(3,2) NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "recommendations" TEXT[],
    "alternativeDates" DATE[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_metrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "scheduleSuccessRate" DECIMAL(3,2) NOT NULL,
    "averageFairnessScore" DECIMAL(3,2) NOT NULL,
    "constraintViolationRate" DECIMAL(3,2) NOT NULL,
    "userSatisfactionScore" DECIMAL(3,2) NOT NULL,
    "conflictResolutionTime" DECIMAL(5,2) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fairness_metrics_date_idx" ON "fairness_metrics"("date");

-- CreateIndex
CREATE INDEX "fairness_metrics_overallScore_idx" ON "fairness_metrics"("overallScore");

-- CreateIndex
CREATE INDEX "fairness_metrics_createdAt_idx" ON "fairness_metrics"("createdAt");

-- CreateIndex
CREATE INDEX "leave_request_impacts_analystId_idx" ON "leave_request_impacts"("analystId");

-- CreateIndex
CREATE INDEX "leave_request_impacts_startDate_endDate_idx" ON "leave_request_impacts"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "leave_request_impacts_riskLevel_idx" ON "leave_request_impacts"("riskLevel");

-- CreateIndex
CREATE INDEX "leave_request_impacts_createdAt_idx" ON "leave_request_impacts"("createdAt");

-- CreateIndex
CREATE INDEX "kpi_metrics_date_idx" ON "kpi_metrics"("date");

-- CreateIndex
CREATE INDEX "kpi_metrics_scheduleSuccessRate_idx" ON "kpi_metrics"("scheduleSuccessRate");

-- CreateIndex
CREATE INDEX "kpi_metrics_averageFairnessScore_idx" ON "kpi_metrics"("averageFairnessScore");

-- CreateIndex
CREATE INDEX "kpi_metrics_createdAt_idx" ON "kpi_metrics"("createdAt");

-- AddForeignKey
ALTER TABLE "leave_request_impacts" ADD CONSTRAINT "leave_request_impacts_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
