-- CreateIndex
CREATE INDEX "algorithm_configs_isActive_idx" ON "public"."algorithm_configs"("isActive");

-- CreateIndex
CREATE INDEX "algorithm_configs_name_idx" ON "public"."algorithm_configs"("name");

-- CreateIndex
CREATE INDEX "analyst_preferences_analystId_shiftType_dayOfWeek_idx" ON "public"."analyst_preferences"("analystId", "shiftType", "dayOfWeek");

-- CreateIndex
CREATE INDEX "analyst_preferences_shiftType_dayOfWeek_idx" ON "public"."analyst_preferences"("shiftType", "dayOfWeek");

-- CreateIndex
CREATE INDEX "analysts_isActive_shiftType_idx" ON "public"."analysts"("isActive", "shiftType");

-- CreateIndex
CREATE INDEX "analysts_email_idx" ON "public"."analysts"("email");

-- CreateIndex
CREATE INDEX "analysts_createdAt_idx" ON "public"."analysts"("createdAt");

-- CreateIndex
CREATE INDEX "schedules_date_shiftType_idx" ON "public"."schedules"("date", "shiftType");

-- CreateIndex
CREATE INDEX "schedules_analystId_date_idx" ON "public"."schedules"("analystId", "date");

-- CreateIndex
CREATE INDEX "schedules_date_isScreener_idx" ON "public"."schedules"("date", "isScreener");

-- CreateIndex
CREATE INDEX "schedules_analystId_date_shiftType_idx" ON "public"."schedules"("analystId", "date", "shiftType");

-- CreateIndex
CREATE INDEX "schedules_date_idx" ON "public"."schedules"("date");

-- CreateIndex
CREATE INDEX "scheduling_constraints_analystId_startDate_endDate_isActive_idx" ON "public"."scheduling_constraints"("analystId", "startDate", "endDate", "isActive");

-- CreateIndex
CREATE INDEX "scheduling_constraints_startDate_endDate_isActive_idx" ON "public"."scheduling_constraints"("startDate", "endDate", "isActive");

-- CreateIndex
CREATE INDEX "scheduling_constraints_constraintType_isActive_idx" ON "public"."scheduling_constraints"("constraintType", "isActive");

-- CreateIndex
CREATE INDEX "vacations_analystId_startDate_endDate_idx" ON "public"."vacations"("analystId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "vacations_startDate_endDate_isApproved_idx" ON "public"."vacations"("startDate", "endDate", "isApproved");

-- CreateIndex
CREATE INDEX "vacations_isApproved_idx" ON "public"."vacations"("isApproved");
