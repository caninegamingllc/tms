-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "loadNumberPrefix" TEXT NOT NULL DEFAULT 'GLB',
    "nextLoadSequence" INTEGER NOT NULL DEFAULT 1001,
    "quickbooksMethod" TEXT NOT NULL DEFAULT 'NONE',
    "quickbooksConfigJson" TEXT,
    "logoFilePath" TEXT,
    "logoMimeType" TEXT,
    "logoOriginalFileName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommodityOption" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommodityOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierPayLineType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calculationMethod" TEXT NOT NULL DEFAULT 'FLAT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierPayLineType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "commissionProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "passwordResetAt" TIMESTAMP(3),
    "passwordResetTokenHash" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "uiPreferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMailbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerThreadId" TEXT,
    "documentId" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT,
    "direction" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT,
    "bodyText" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'BROKER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "branchId" TEXT,
    "seatAssignedAt" TIMESTAMP(3),
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipBranch" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatSubscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "seatQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NONE',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "creditLimit" INTEGER NOT NULL DEFAULT 0,
    "paymentTerms" TEXT NOT NULL DEFAULT 'Net 30',
    "rateConfirmationTerms" TEXT,
    "industry" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "externalQboId" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerActivity" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoringCompany" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameOnCheck" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "externalQboId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactoringCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "mcNumber" TEXT,
    "mcNumberNormalized" TEXT,
    "dotNumber" TEXT,
    "dotNumberNormalized" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "equipmentTypes" TEXT,
    "safetyRating" TEXT,
    "insuranceExpiresAt" TIMESTAMP(3),
    "complianceStatus" TEXT NOT NULL DEFAULT 'Needs Review',
    "paymentTerms" TEXT NOT NULL DEFAULT 'Net 30',
    "paymentMethod" TEXT,
    "factoringCompanyId" TEXT,
    "externalQboId" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierActivity" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarrierActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierContact" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CarrierContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierComplianceDocument" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Current',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarrierComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierInsuranceCoverage" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "coverageType" TEXT NOT NULL,
    "insurerName" TEXT,
    "policyNumber" TEXT,
    "limitAmount" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Current',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierInsuranceCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "address" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Load" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "loadNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUOTE',
    "customerId" TEXT NOT NULL,
    "branchId" TEXT,
    "referenceNumber" TEXT,
    "equipmentType" TEXT NOT NULL DEFAULT 'Dry Van',
    "reeferTempF" DOUBLE PRECISION,
    "commodity" TEXT,
    "weight" INTEGER,
    "pickupCity" TEXT NOT NULL,
    "pickupState" TEXT NOT NULL,
    "deliveryCity" TEXT NOT NULL,
    "deliveryState" TEXT NOT NULL,
    "pickupDate" TIMESTAMP(3) NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "carrierCostCents" INTEGER NOT NULL DEFAULT 0,
    "isCommissionable" BOOLEAN NOT NULL DEFAULT true,
    "rateConfirmationTerms" TEXT,
    "commissionProfileId" TEXT,
    "routeTotalMiles" DOUBLE PRECISION,
    "routeStateMiles" JSONB,
    "routePolyline" TEXT,
    "routeComputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Load_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadCommodityLine" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "weightLbs" INTEGER NOT NULL,
    "pieces" TEXT,
    "lengthIn" DOUBLE PRECISION,
    "widthIn" DOUBLE PRECISION,
    "heightIn" DOUBLE PRECISION,

    CONSTRAINT "LoadCommodityLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadStop" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "facilityId" TEXT,
    "type" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "facilityName" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT,
    "appointmentAt" TIMESTAMP(3),
    "actualAt" TIMESTAMP(3),
    "instructions" TEXT,

    CONSTRAINT "LoadStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadCharge" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "chargeType" TEXT NOT NULL DEFAULT 'Linehaul',
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "LoadCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadExpense" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expenseType" TEXT NOT NULL DEFAULT 'Other',
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "LoadExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionProfileRule" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "branchSharePercent" INTEGER NOT NULL DEFAULT 60,
    "companySharePercent" INTEGER NOT NULL DEFAULT 40,
    "companyMinimumExpensePercent" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "CommissionProfileRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadCommission" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "branchId" TEXT,
    "profileId" TEXT,
    "profileName" TEXT NOT NULL,
    "isCommissionable" BOOLEAN NOT NULL DEFAULT true,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "grossExpenseCents" INTEGER NOT NULL DEFAULT 0,
    "grossProfitCents" INTEGER NOT NULL DEFAULT 0,
    "branchShareCents" INTEGER NOT NULL DEFAULT 0,
    "companyShareCents" INTEGER NOT NULL DEFAULT 0,
    "calculationMethod" TEXT NOT NULL DEFAULT 'STANDARD_SPLIT',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payableAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchAssignment" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "truckNumber" TEXT,
    "trailerNumber" TEXT,
    "rateCents" INTEGER NOT NULL DEFAULT 0,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatchAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierPayLine" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "lineTypeId" TEXT NOT NULL,
    "description" TEXT,
    "unitRateCents" INTEGER NOT NULL DEFAULT 0,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierPayLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckCall" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextCheckAt" TIMESTAMP(3),

    CONSTRAINT "CheckCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "loadId" TEXT,
    "customerId" TEXT,
    "carrierId" TEXT,
    "uploadedById" TEXT,
    "type" TEXT NOT NULL,
    "types" TEXT,
    "name" TEXT NOT NULL,
    "documentNumber" TEXT,
    "filePath" TEXT,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "isCompanyDocument" BOOLEAN NOT NULL DEFAULT false,
    "generatedContent" TEXT,
    "generatedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoadDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadNote" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadActivity" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalCents" INTEGER NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "externalQboId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierBill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalCents" INTEGER NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "payeeName" TEXT,
    "nameOnCheck" TEXT,
    "remitAddress" TEXT,
    "billReference" TEXT,
    "paymentTermsDays" INTEGER,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "factoringCompanyId" TEXT,
    "receivedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "externalQboId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'CHECK',
    "reference" TEXT,
    "notes" TEXT,
    "customerId" TEXT,
    "carrierId" TEXT,
    "factoringCompanyId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentApplication" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "carrierBillId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Not Connected',
    "apiKeyLast4" TEXT,
    "notes" TEXT,
    "realmId" TEXT,
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingExport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SYNCED',
    "exportedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "message" TEXT,
    "exportedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "CommodityOption_companyId_idx" ON "CommodityOption"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CommodityOption_companyId_name_key" ON "CommodityOption"("companyId", "name");

-- CreateIndex
CREATE INDEX "CarrierPayLineType_companyId_idx" ON "CarrierPayLineType"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierPayLineType_companyId_name_key" ON "CarrierPayLineType"("companyId", "name");

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetTokenHash_key" ON "User"("passwordResetTokenHash");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_userId_provider_key" ON "OAuthAccount"("userId", "provider");

-- CreateIndex
CREATE INDEX "UserMailbox_userId_idx" ON "UserMailbox"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMailbox_userId_provider_key" ON "UserMailbox"("userId", "provider");

-- CreateIndex
CREATE INDEX "EmailThread_companyId_idx" ON "EmailThread"("companyId");

-- CreateIndex
CREATE INDEX "EmailThread_loadId_idx" ON "EmailThread"("loadId");

-- CreateIndex
CREATE INDEX "EmailThread_userId_idx" ON "EmailThread"("userId");

-- CreateIndex
CREATE INDEX "EmailThread_providerThreadId_idx" ON "EmailThread"("providerThreadId");

-- CreateIndex
CREATE INDEX "EmailMessage_threadId_idx" ON "EmailMessage"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_threadId_providerMessageId_key" ON "EmailMessage"("threadId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembership_inviteTokenHash_key" ON "CompanyMembership"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "CompanyMembership_companyId_idx" ON "CompanyMembership"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembership_userId_companyId_key" ON "CompanyMembership"("userId", "companyId");

-- CreateIndex
CREATE INDEX "MembershipBranch_membershipId_idx" ON "MembershipBranch"("membershipId");

-- CreateIndex
CREATE INDEX "MembershipBranch_branchId_idx" ON "MembershipBranch"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipBranch_membershipId_branchId_key" ON "MembershipBranch"("membershipId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatSubscription_companyId_key" ON "SeatSubscription"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatSubscription_stripeCustomerId_key" ON "SeatSubscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatSubscription_stripeSubscriptionId_key" ON "SeatSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE INDEX "CustomerActivity_customerId_idx" ON "CustomerActivity"("customerId");

-- CreateIndex
CREATE INDEX "FactoringCompany_companyId_idx" ON "FactoringCompany"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FactoringCompany_companyId_name_key" ON "FactoringCompany"("companyId", "name");

-- CreateIndex
CREATE INDEX "Carrier_companyId_idx" ON "Carrier"("companyId");

-- CreateIndex
CREATE INDEX "Carrier_companyId_mcNumberNormalized_idx" ON "Carrier"("companyId", "mcNumberNormalized");

-- CreateIndex
CREATE INDEX "Carrier_companyId_dotNumberNormalized_idx" ON "Carrier"("companyId", "dotNumberNormalized");

-- CreateIndex
CREATE INDEX "Carrier_factoringCompanyId_idx" ON "Carrier"("factoringCompanyId");

-- CreateIndex
CREATE INDEX "CarrierActivity_carrierId_idx" ON "CarrierActivity"("carrierId");

-- CreateIndex
CREATE INDEX "Facility_companyId_idx" ON "Facility"("companyId");

-- CreateIndex
CREATE INDEX "Facility_customerId_idx" ON "Facility"("customerId");

-- CreateIndex
CREATE INDEX "Load_companyId_idx" ON "Load"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Load_companyId_loadNumber_key" ON "Load"("companyId", "loadNumber");

-- CreateIndex
CREATE INDEX "LoadCommodityLine_loadId_idx" ON "LoadCommodityLine"("loadId");

-- CreateIndex
CREATE INDEX "CommissionProfile_companyId_idx" ON "CommissionProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionProfileRule_profileId_key" ON "CommissionProfileRule"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "LoadCommission_loadId_key" ON "LoadCommission"("loadId");

-- CreateIndex
CREATE INDEX "LoadCommission_branchId_idx" ON "LoadCommission"("branchId");

-- CreateIndex
CREATE INDEX "LoadCommission_status_idx" ON "LoadCommission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchAssignment_loadId_key" ON "DispatchAssignment"("loadId");

-- CreateIndex
CREATE INDEX "CarrierPayLine_loadId_idx" ON "CarrierPayLine"("loadId");

-- CreateIndex
CREATE INDEX "CarrierPayLine_assignmentId_idx" ON "CarrierPayLine"("assignmentId");

-- CreateIndex
CREATE INDEX "CarrierPayLine_lineTypeId_idx" ON "CarrierPayLine"("lineTypeId");

-- CreateIndex
CREATE INDEX "LoadDocument_companyId_idx" ON "LoadDocument"("companyId");

-- CreateIndex
CREATE INDEX "LoadDocument_loadId_idx" ON "LoadDocument"("loadId");

-- CreateIndex
CREATE INDEX "LoadDocument_customerId_idx" ON "LoadDocument"("customerId");

-- CreateIndex
CREATE INDEX "LoadDocument_carrierId_idx" ON "LoadDocument"("carrierId");

-- CreateIndex
CREATE INDEX "LoadNote_loadId_isPrivate_idx" ON "LoadNote"("loadId", "isPrivate");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_status_idx" ON "Invoice"("companyId", "status");

-- CreateIndex
CREATE INDEX "Invoice_companyId_dueAt_idx" ON "Invoice"("companyId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNo_key" ON "Invoice"("companyId", "invoiceNo");

-- CreateIndex
CREATE INDEX "CarrierBill_companyId_idx" ON "CarrierBill"("companyId");

-- CreateIndex
CREATE INDEX "CarrierBill_companyId_status_idx" ON "CarrierBill"("companyId", "status");

-- CreateIndex
CREATE INDEX "CarrierBill_companyId_dueAt_idx" ON "CarrierBill"("companyId", "dueAt");

-- CreateIndex
CREATE INDEX "CarrierBill_factoringCompanyId_idx" ON "CarrierBill"("factoringCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierBill_companyId_billNo_key" ON "CarrierBill"("companyId", "billNo");

-- CreateIndex
CREATE INDEX "Payment_companyId_idx" ON "Payment"("companyId");

-- CreateIndex
CREATE INDEX "Payment_companyId_direction_idx" ON "Payment"("companyId", "direction");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_carrierId_idx" ON "Payment"("carrierId");

-- CreateIndex
CREATE INDEX "PaymentApplication_paymentId_idx" ON "PaymentApplication"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentApplication_invoiceId_idx" ON "PaymentApplication"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentApplication_carrierBillId_idx" ON "PaymentApplication"("carrierBillId");

-- CreateIndex
CREATE INDEX "IntegrationAccount_companyId_idx" ON "IntegrationAccount"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_companyId_provider_key" ON "IntegrationAccount"("companyId", "provider");

-- CreateIndex
CREATE INDEX "AccountingExport_companyId_method_idx" ON "AccountingExport"("companyId", "method");

-- CreateIndex
CREATE INDEX "AccountingExport_companyId_entityType_entityId_idx" ON "AccountingExport"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingExport_entityType_entityId_method_key" ON "AccountingExport"("entityType", "entityId", "method");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_availableAt_idx" ON "BackgroundJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_type_status_idx" ON "BackgroundJob"("type", "status");

-- AddForeignKey
ALTER TABLE "CommodityOption" ADD CONSTRAINT "CommodityOption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierPayLineType" ADD CONSTRAINT "CarrierPayLineType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_commissionProfileId_fkey" FOREIGN KEY ("commissionProfileId") REFERENCES "CommissionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMailbox" ADD CONSTRAINT "UserMailbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LoadDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipBranch" ADD CONSTRAINT "MembershipBranch_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CompanyMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipBranch" ADD CONSTRAINT "MembershipBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatSubscription" ADD CONSTRAINT "SeatSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CompanyMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoringCompany" ADD CONSTRAINT "FactoringCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carrier" ADD CONSTRAINT "Carrier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carrier" ADD CONSTRAINT "Carrier_factoringCompanyId_fkey" FOREIGN KEY ("factoringCompanyId") REFERENCES "FactoringCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carrier" ADD CONSTRAINT "Carrier_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierActivity" ADD CONSTRAINT "CarrierActivity_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierActivity" ADD CONSTRAINT "CarrierActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierContact" ADD CONSTRAINT "CarrierContact_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierComplianceDocument" ADD CONSTRAINT "CarrierComplianceDocument_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierInsuranceCoverage" ADD CONSTRAINT "CarrierInsuranceCoverage_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Load" ADD CONSTRAINT "Load_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Load" ADD CONSTRAINT "Load_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Load" ADD CONSTRAINT "Load_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Load" ADD CONSTRAINT "Load_commissionProfileId_fkey" FOREIGN KEY ("commissionProfileId") REFERENCES "CommissionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadCommodityLine" ADD CONSTRAINT "LoadCommodityLine_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadStop" ADD CONSTRAINT "LoadStop_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadStop" ADD CONSTRAINT "LoadStop_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadCharge" ADD CONSTRAINT "LoadCharge_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadExpense" ADD CONSTRAINT "LoadExpense_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionProfile" ADD CONSTRAINT "CommissionProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionProfileRule" ADD CONSTRAINT "CommissionProfileRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CommissionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadCommission" ADD CONSTRAINT "LoadCommission_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadCommission" ADD CONSTRAINT "LoadCommission_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadCommission" ADD CONSTRAINT "LoadCommission_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CommissionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadCommission" ADD CONSTRAINT "LoadCommission_settledByUserId_fkey" FOREIGN KEY ("settledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierPayLine" ADD CONSTRAINT "CarrierPayLine_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierPayLine" ADD CONSTRAINT "CarrierPayLine_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "DispatchAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierPayLine" ADD CONSTRAINT "CarrierPayLine_lineTypeId_fkey" FOREIGN KEY ("lineTypeId") REFERENCES "CarrierPayLineType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckCall" ADD CONSTRAINT "CheckCall_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "DispatchAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadDocument" ADD CONSTRAINT "LoadDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadDocument" ADD CONSTRAINT "LoadDocument_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadDocument" ADD CONSTRAINT "LoadDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadDocument" ADD CONSTRAINT "LoadDocument_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadDocument" ADD CONSTRAINT "LoadDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadNote" ADD CONSTRAINT "LoadNote_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadNote" ADD CONSTRAINT "LoadNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadActivity" ADD CONSTRAINT "LoadActivity_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadActivity" ADD CONSTRAINT "LoadActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierBill" ADD CONSTRAINT "CarrierBill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierBill" ADD CONSTRAINT "CarrierBill_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierBill" ADD CONSTRAINT "CarrierBill_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierBill" ADD CONSTRAINT "CarrierBill_factoringCompanyId_fkey" FOREIGN KEY ("factoringCompanyId") REFERENCES "FactoringCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_factoringCompanyId_fkey" FOREIGN KEY ("factoringCompanyId") REFERENCES "FactoringCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_carrierBillId_fkey" FOREIGN KEY ("carrierBillId") REFERENCES "CarrierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingExport" ADD CONSTRAINT "AccountingExport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
