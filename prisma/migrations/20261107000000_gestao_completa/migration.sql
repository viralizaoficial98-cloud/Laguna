-- AlterTable
ALTER TABLE `expenses` ADD COLUMN `attachments` LONGTEXT NULL,
    ADD COLUMN `budgetLineId` VARCHAR(120) NULL,
    ADD COLUMN `costCenter` VARCHAR(80) NULL,
    ADD COLUMN `createdBy` VARCHAR(160) NULL,
    ADD COLUMN `dueDate` DATE NULL,
    ADD COLUMN `history` LONGTEXT NULL,
    ADD COLUMN `invoiceDate` DATE NULL,
    ADD COLUMN `invoiceRef` VARCHAR(80) NULL,
    ADD COLUMN `netAmount` DECIMAL(14, 2) NULL,
    ADD COLUMN `nif` VARCHAR(40) NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `paidAmount` DECIMAL(14, 2) NULL,
    ADD COLUMN `paymentDate` DATE NULL,
    ADD COLUMN `payments` LONGTEXT NULL,
    ADD COLUMN `source` LONGTEXT NULL,
    ADD COLUMN `status` VARCHAR(24) NULL,
    ADD COLUMN `supplierId` VARCHAR(80) NULL,
    ADD COLUMN `supplierName` VARCHAR(255) NULL,
    ADD COLUMN `vat` DECIMAL(14, 2) NULL,
    ADD COLUMN `voidReason` TEXT NULL,
    ADD COLUMN `withholding` DECIMAL(14, 2) NULL;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `channel` VARCHAR(12) NULL,
    ADD COLUMN `clientKey` VARCHAR(64) NULL,
    ADD COLUMN `submittedBy` VARCHAR(160) NULL;

-- AlterTable
ALTER TABLE `stored_files` ADD COLUMN `apartmentId` VARCHAR(64) NULL,
    ADD COLUMN `category` VARCHAR(30) NULL;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` VARCHAR(80) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `nif` VARCHAR(40) NULL,
    `email` VARCHAR(190) NULL,
    `phone` VARCHAR(40) NULL,
    `address` TEXT NULL,
    `category` VARCHAR(80) NULL,
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `history` LONGTEXT NULL,

    INDEX `suppliers_nif_idx`(`nif`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parties` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `normalizedName` VARCHAR(255) NOT NULL,
    `kind` VARCHAR(20) NULL,
    `nif` VARCHAR(40) NULL,
    `email` VARCHAR(190) NULL,
    `phone` VARCHAR(40) NULL,
    `phone2` VARCHAR(40) NULL,
    `address` TEXT NULL,
    `notes` TEXT NULL,
    `residentId` VARCHAR(64) NULL,
    `source` LONGTEXT NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(160) NULL,

    INDEX `parties_normalizedName_idx`(`normalizedName`),
    INDEX `parties_nif_idx`(`nif`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fraction_holders` (
    `id` VARCHAR(64) NOT NULL,
    `apartmentId` VARCHAR(64) NOT NULL,
    `partyId` VARCHAR(64) NOT NULL,
    `role` VARCHAR(12) NOT NULL,
    `from` DATE NULL,
    `to` DATE NULL,
    `active` BOOLEAN NOT NULL,
    `source` VARCHAR(60) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(160) NULL,
    `endedBy` VARCHAR(160) NULL,
    `endReason` TEXT NULL,

    INDEX `fraction_holders_apartmentId_role_idx`(`apartmentId`, `role`),
    INDEX `fraction_holders_partyId_idx`(`partyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `active_holder_slots` (
    `apartmentId` VARCHAR(64) NOT NULL,
    `role` VARCHAR(12) NOT NULL,
    `holderId` VARCHAR(64) NOT NULL,

    UNIQUE INDEX `active_holder_slots_holderId_key`(`holderId`),
    PRIMARY KEY (`apartmentId`, `role`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `declaration_types` (
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `template` LONGTEXT NOT NULL,
    `requirement` VARCHAR(30) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `residentCanRequest` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `declarations` (
    `id` VARCHAR(64) NOT NULL,
    `number` VARCHAR(20) NOT NULL,
    `typeCode` VARCHAR(40) NOT NULL,
    `apartmentId` VARCHAR(64) NOT NULL,
    `residentId` VARCHAR(64) NULL,
    `partyId` VARCHAR(64) NULL,
    `subjectName` VARCHAR(255) NOT NULL,
    `purpose` TEXT NULL,
    `status` VARCHAR(24) NOT NULL,
    `channel` VARCHAR(12) NOT NULL,
    `requestedByUserId` VARCHAR(64) NULL,
    `requestedByName` VARCHAR(160) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL,
    `content` LONGTEXT NULL,
    `checks` LONGTEXT NULL,
    `reviewedBy` VARCHAR(160) NULL,
    `rejectionReason` TEXT NULL,
    `signedByUserId` VARCHAR(64) NULL,
    `signerName` VARCHAR(160) NULL,
    `signerTitle` VARCHAR(160) NULL,
    `signedAt` DATETIME(3) NULL,
    `signatureId` VARCHAR(64) NULL,
    `signatureProvider` VARCHAR(40) NULL,
    `pdfFileId` VARCHAR(64) NULL,
    `pdfSha256` CHAR(64) NULL,
    `verificationCode` VARCHAR(32) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedBy` VARCHAR(160) NULL,
    `revokeReason` TEXT NULL,
    `history` LONGTEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `declarations_number_key`(`number`),
    UNIQUE INDEX `declarations_verificationCode_key`(`verificationCode`),
    INDEX `declarations_apartmentId_idx`(`apartmentId`),
    INDEX `declarations_residentId_idx`(`residentId`),
    INDEX `declarations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `signatures` (
    `id` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `fileId` VARCHAR(64) NOT NULL,
    `displayName` VARCHAR(160) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `active` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    INDEX `signatures_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budgets` (
    `id` VARCHAR(64) NOT NULL,
    `year` INTEGER NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `source` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `sourceInfo` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(160) NULL,

    UNIQUE INDEX `budgets_year_key`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budget_lines` (
    `id` VARCHAR(120) NOT NULL,
    `budgetId` VARCHAR(64) NOT NULL,
    `parentId` VARCHAR(120) NULL,
    `kind` VARCHAR(12) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `position` INTEGER NOT NULL,
    `annualAmount` DECIMAL(16, 2) NOT NULL,
    `monthly` TEXT NULL,
    `isGroup` BOOLEAN NOT NULL,
    `quotaShare` DECIMAL(6, 4) NULL,
    `note` TEXT NULL,
    `sourceRaw` LONGTEXT NULL,

    INDEX `budget_lines_budgetId_idx`(`budgetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budget_executions` (
    `id` VARCHAR(64) NOT NULL,
    `lineId` VARCHAR(120) NOT NULL,
    `period` VARCHAR(8) NOT NULL,
    `amount` DECIMAL(16, 2) NOT NULL,
    `source` VARCHAR(20) NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(160) NULL,

    UNIQUE INDEX `budget_executions_lineId_period_source_key`(`lineId`, `period`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `revenues` (
    `id` VARCHAR(64) NOT NULL,
    `date` DATE NOT NULL,
    `period` VARCHAR(8) NOT NULL,
    `budgetLineId` VARCHAR(120) NULL,
    `category` VARCHAR(80) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `apartmentId` VARCHAR(64) NULL,
    `reference` VARCHAR(120) NULL,
    `status` VARCHAR(16) NOT NULL,
    `attachments` LONGTEXT NULL,
    `createdBy` VARCHAR(160) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `voidReason` TEXT NULL,

    INDEX `revenues_period_idx`(`period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `expenses_supplierId_idx` ON `expenses`(`supplierId`);

-- CreateIndex
CREATE INDEX `expenses_invoiceRef_idx` ON `expenses`(`invoiceRef`);

-- CreateIndex
CREATE INDEX `expenses_budgetLineId_idx` ON `expenses`(`budgetLineId`);

-- CreateIndex
CREATE UNIQUE INDEX `payments_clientKey_key` ON `payments`(`clientKey`);

-- CreateIndex
CREATE INDEX `stored_files_apartmentId_idx` ON `stored_files`(`apartmentId`);

-- AddForeignKey
ALTER TABLE `fraction_holders` ADD CONSTRAINT `fraction_holders_apartmentId_fkey` FOREIGN KEY (`apartmentId`) REFERENCES `apartments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fraction_holders` ADD CONSTRAINT `fraction_holders_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `budget_lines` ADD CONSTRAINT `budget_lines_budgetId_fkey` FOREIGN KEY (`budgetId`) REFERENCES `budgets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `budget_executions` ADD CONSTRAINT `budget_executions_lineId_fkey` FOREIGN KEY (`lineId`) REFERENCES `budget_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

