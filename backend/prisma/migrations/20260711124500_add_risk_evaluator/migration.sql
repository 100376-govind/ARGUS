-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" UUID NOT NULL,
    "incidentId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "overallRiskScore" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT NOT NULL,
    "isProtocolZeroTriggered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatPrediction" (
    "id" UUID NOT NULL,
    "riskAssessmentId" UUID NOT NULL,
    "threatType" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "impact" TEXT NOT NULL,
    "estimatedTimeframe" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreatPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeverityHistory" (
    "id" UUID NOT NULL,
    "riskAssessmentId" UUID NOT NULL,
    "severity" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeverityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorityHistory" (
    "id" UUID NOT NULL,
    "riskAssessmentId" UUID NOT NULL,
    "priority" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriorityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolZeroRequest" (
    "id" UUID NOT NULL,
    "riskAssessmentId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedBy" TEXT,
    "actionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolZeroRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReasoningLog" (
    "id" UUID NOT NULL,
    "riskAssessmentId" UUID NOT NULL,
    "agentName" TEXT NOT NULL,
    "inputPayload" JSONB NOT NULL,
    "outputPayload" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReasoningLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_incidentId_key" ON "RiskAssessment"("incidentId");

-- CreateIndex
CREATE INDEX "RiskAssessment_incidentId_idx" ON "RiskAssessment"("incidentId");

-- CreateIndex
CREATE INDEX "RiskAssessment_severity_idx" ON "RiskAssessment"("severity");

-- CreateIndex
CREATE INDEX "RiskAssessment_priority_idx" ON "RiskAssessment"("priority");

-- CreateIndex
CREATE INDEX "ThreatPrediction_riskAssessmentId_idx" ON "ThreatPrediction"("riskAssessmentId");

-- CreateIndex
CREATE INDEX "ThreatPrediction_threatType_idx" ON "ThreatPrediction"("threatType");

-- CreateIndex
CREATE INDEX "SeverityHistory_riskAssessmentId_idx" ON "SeverityHistory"("riskAssessmentId");

-- CreateIndex
CREATE INDEX "PriorityHistory_riskAssessmentId_idx" ON "PriorityHistory"("riskAssessmentId");

-- CreateIndex
CREATE INDEX "ProtocolZeroRequest_riskAssessmentId_idx" ON "ProtocolZeroRequest"("riskAssessmentId");

-- CreateIndex
CREATE INDEX "ProtocolZeroRequest_status_idx" ON "ProtocolZeroRequest"("status");

-- CreateIndex
CREATE INDEX "ReasoningLog_riskAssessmentId_idx" ON "ReasoningLog"("riskAssessmentId");

-- CreateIndex
CREATE INDEX "ReasoningLog_agentName_idx" ON "ReasoningLog"("agentName");

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatPrediction" ADD CONSTRAINT "ThreatPrediction_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeverityHistory" ADD CONSTRAINT "SeverityHistory_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorityHistory" ADD CONSTRAINT "PriorityHistory_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolZeroRequest" ADD CONSTRAINT "ProtocolZeroRequest_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReasoningLog" ADD CONSTRAINT "ReasoningLog_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
