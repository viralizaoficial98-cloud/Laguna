-- CreateTable
CREATE TABLE `app_meta` (
    `id` INTEGER NOT NULL,
    `dataVersion` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `condo_settings` (
    `id` INTEGER NOT NULL,
    `quotaT2` DECIMAL(14, 2) NOT NULL,
    `quotaDuplex` DECIMAL(14, 2) NOT NULL,
    `dueDay` INTEGER NOT NULL,
    `allowPartial` BOOLEAN NOT NULL,
    `reservationFee` DECIMAL(14, 2) NOT NULL,
    `reservationHoldHours` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `role` ENUM('administrador', 'gestor', 'financeiro', 'morador', 'porteiro') NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `status` ENUM('pendente_activacao', 'activo', 'inactivo', 'bloqueado') NOT NULL DEFAULT 'pendente_activacao',
    `passwordHash` VARCHAR(255) NULL,
    `residentId` VARCHAR(64) NULL,
    `apartmentId` VARCHAR(64) NULL,
    `block` VARCHAR(4) NULL,
    `phone` VARCHAR(40) NULL,
    `failedLogins` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `passwordChangedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(64) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_residentId_key`(`residentId`),
    INDEX `users_role_idx`(`role`),
    INDEX `users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_sessions` (
    `id` VARCHAR(64) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,

    UNIQUE INDEX `auth_sessions_tokenHash_key`(`tokenHash`),
    INDEX `auth_sessions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_tokens` (
    `id` VARCHAR(64) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(64) NULL,

    UNIQUE INDEX `auth_tokens_tokenHash_key`(`tokenHash`),
    INDEX `auth_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(190) NOT NULL,
    `userId` VARCHAR(64) NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `success` BOOLEAN NOT NULL,
    `reason` VARCHAR(60) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_email_at_idx`(`email`, `at`),
    INDEX `login_attempts_ip_at_idx`(`ip`, `at`),
    INDEX `login_attempts_userId_at_idx`(`userId`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_audit_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorId` VARCHAR(64) NULL,
    `actorName` VARCHAR(160) NOT NULL,
    `targetId` VARCHAR(64) NULL,
    `targetName` VARCHAR(160) NULL,
    `action` VARCHAR(60) NOT NULL,
    `before` TEXT NULL,
    `after` TEXT NULL,
    `ip` VARCHAR(64) NULL,

    INDEX `user_audit_log_targetId_at_idx`(`targetId`, `at`),
    INDEX `user_audit_log_at_idx`(`at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stored_files` (
    `id` VARCHAR(64) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `mime` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `storagePath` VARCHAR(255) NOT NULL,
    `ownerUserId` VARCHAR(64) NULL,
    `ownerRole` ENUM('administrador', 'gestor', 'financeiro', 'morador', 'porteiro') NULL,
    `residentId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stored_files_ownerUserId_idx`(`ownerUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `apartments` (
    `id` VARCHAR(64) NOT NULL,
    `block` VARCHAR(4) NOT NULL,
    `number` VARCHAR(8) NOT NULL,
    `floor` INTEGER NOT NULL,
    `typology` ENUM('T2', 'Duplex') NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `active` BOOLEAN NOT NULL,
    `provisional` BOOLEAN NOT NULL,
    `ownerName` VARCHAR(160) NOT NULL,
    `residentId` VARCHAR(64) NULL,
    `notes` TEXT NULL,

    UNIQUE INDEX `apartments_block_number_key`(`block`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `residents` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `documentId` VARCHAR(40) NOT NULL,
    `apartmentId` VARCHAR(64) NULL,
    `type` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `since` DATE NOT NULL,
    `dependents` LONGTEXT NOT NULL,
    `notes` TEXT NULL,

    INDEX `residents_apartmentId_idx`(`apartmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `occupancies` (
    `id` VARCHAR(80) NOT NULL,
    `apartmentId` VARCHAR(64) NOT NULL,
    `residentId` VARCHAR(64) NOT NULL,
    `residentName` VARCHAR(160) NOT NULL,
    `from` DATE NOT NULL,
    `to` DATE NULL,

    INDEX `occupancies_apartmentId_idx`(`apartmentId`),
    INDEX `occupancies_residentId_idx`(`residentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotas` (
    `id` VARCHAR(80) NOT NULL,
    `apartmentId` VARCHAR(64) NOT NULL,
    `period` VARCHAR(8) NOT NULL,
    `year` INTEGER NOT NULL,
    `quarter` INTEGER NOT NULL,
    `description` VARCHAR(160) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `typology` ENUM('T2', 'Duplex') NOT NULL,
    `paidAmount` DECIMAL(14, 2) NOT NULL,
    `dueDate` DATE NOT NULL,
    `status` ENUM('pendente', 'em_analise', 'pago', 'parcial', 'em_atraso') NOT NULL,
    `paymentId` VARCHAR(80) NULL,

    INDEX `quotas_period_idx`(`period`),
    INDEX `quotas_status_idx`(`status`),
    UNIQUE INDEX `quotas_apartmentId_period_key`(`apartmentId`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(80) NOT NULL,
    `quotaId` VARCHAR(80) NOT NULL,
    `apartmentId` VARCHAR(64) NOT NULL,
    `residentId` VARCHAR(64) NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `method` VARCHAR(20) NOT NULL,
    `reference` VARCHAR(120) NOT NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL,
    `proof` TEXT NULL,
    `status` ENUM('em_analise', 'aprovado', 'rejeitado') NOT NULL,
    `reviewedBy` VARCHAR(160) NULL,
    `reviewedByRole` ENUM('administrador', 'gestor', 'financeiro', 'morador', 'porteiro') NULL,
    `reviewedAt` DATETIME(3) NULL,
    `note` TEXT NULL,
    `validatedAmount` DECIMAL(14, 2) NULL,
    `registeredBy` VARCHAR(160) NULL,
    `receiptNumber` VARCHAR(40) NULL,

    UNIQUE INDEX `payments_receiptNumber_key`(`receiptNumber`),
    INDEX `payments_quotaId_idx`(`quotaId`),
    INDEX `payments_status_idx`(`status`),
    INDEX `payments_apartmentId_idx`(`apartmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pending_payment_slots` (
    `quotaId` VARCHAR(80) NOT NULL,
    `paymentId` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `pending_payment_slots_paymentId_key`(`paymentId`),
    PRIMARY KEY (`quotaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `charges` (
    `id` VARCHAR(80) NOT NULL,
    `apartmentId` VARCHAR(64) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `justification` TEXT NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `date` DATE NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `proposedBy` VARCHAR(160) NOT NULL,
    `confirmedBy` VARCHAR(160) NULL,
    `moveOutId` VARCHAR(80) NULL,

    INDEX `charges_apartmentId_idx`(`apartmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(80) NOT NULL,
    `date` DATE NOT NULL,
    `period` VARCHAR(8) NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,

    INDEX `expenses_period_idx`(`period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `halls` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `capacity` INTEGER NULL,
    `active` BOOLEAN NOT NULL,
    `demo` BOOLEAN NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservations` (
    `id` VARCHAR(80) NOT NULL,
    `hallId` VARCHAR(64) NOT NULL,
    `residentId` VARCHAR(64) NOT NULL,
    `apartmentId` VARCHAR(64) NOT NULL,
    `date` DATE NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `endTime` VARCHAR(5) NOT NULL,
    `eventType` VARCHAR(60) NOT NULL,
    `eventName` VARCHAR(160) NOT NULL,
    `expectedGuests` INTEGER NOT NULL,
    `guests` LONGTEXT NOT NULL,
    `notes` TEXT NULL,
    `fee` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('em_espera', 'pendente_pagamento', 'em_validacao', 'confirmada', 'cancelada', 'expirada') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `payment` TEXT NULL,
    `history` LONGTEXT NOT NULL,

    INDEX `reservations_hallId_date_idx`(`hallId`, `date`),
    INDEX `reservations_residentId_idx`(`residentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservation_slots` (
    `hallId` VARCHAR(64) NOT NULL,
    `date` DATE NOT NULL,
    `reservationId` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `reservation_slots_reservationId_key`(`reservationId`),
    PRIMARY KEY (`hallId`, `date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `move_outs` (
    `id` VARCHAR(80) NOT NULL,
    `reference` VARCHAR(20) NOT NULL,
    `residentId` VARCHAR(64) NOT NULL,
    `residentName` VARCHAR(160) NOT NULL,
    `apartmentId` VARCHAR(64) NOT NULL,
    `block` VARCHAR(4) NOT NULL,
    `number` VARCHAR(8) NOT NULL,
    `typology` ENUM('T2', 'Duplex') NOT NULL,
    `plannedDate` DATE NOT NULL,
    `reason` TEXT NULL,
    `contact` VARCHAR(120) NOT NULL,
    `notes` TEXT NULL,
    `status` ENUM('solicitacao_recebida', 'em_verificacao_financeira', 'em_verificacao_operacional', 'regularizacao_pendente', 'aguardando_aprovacao', 'autorizada', 'concluida', 'cancelada') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `financial` TEXT NOT NULL,
    `operational` LONGTEXT NOT NULL,
    `authorization` TEXT NULL,
    `completedAt` DATETIME(3) NULL,
    `history` LONGTEXT NOT NULL,

    UNIQUE INDEX `move_outs_reference_key`(`reference`),
    INDEX `move_outs_residentId_idx`(`residentId`),
    INDEX `move_outs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `active_moveouts` (
    `residentId` VARCHAR(64) NOT NULL,
    `moveOutId` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `active_moveouts_moveOutId_key`(`moveOutId`),
    PRIMARY KEY (`residentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `circulars` (
    `id` VARCHAR(80) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `number` VARCHAR(40) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `closing` TEXT NULL,
    `date` DATE NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `recipients` TEXT NOT NULL,
    `author` VARCHAR(160) NOT NULL,
    `authorTitle` VARCHAR(160) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `circulars_year_sequence_key`(`year`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notices` (
    `id` VARCHAR(80) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `date` DATE NOT NULL,
    `visibility` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `author` VARCHAR(160) NOT NULL,
    `pinned` BOOLEAN NULL,
    `pdf` TEXT NULL,
    `publishedAt` DATETIME(3) NULL,
    `withdrawnAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` VARCHAR(80) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `fileType` VARCHAR(10) NOT NULL,
    `size` INTEGER NOT NULL,
    `updatedAt` DATE NOT NULL,
    `visibility` VARCHAR(20) NOT NULL,
    `uploadedBy` VARCHAR(160) NOT NULL,
    `file` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(80) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `body` TEXT NOT NULL,
    `at` DATETIME(3) NOT NULL,
    `read` BOOLEAN NOT NULL,
    `roles` VARCHAR(255) NOT NULL,
    `href` VARCHAR(255) NULL,
    `residentId` VARCHAR(64) NULL,
    `readBy` TEXT NULL,

    INDEX `notifications_at_idx`(`at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `visits` (
    `id` VARCHAR(80) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `residentId` VARCHAR(64) NOT NULL,
    `apartmentId` VARCHAR(64) NOT NULL,
    `date` DATE NOT NULL,
    `time` VARCHAR(5) NOT NULL,
    `notes` TEXT NULL,
    `guests` LONGTEXT NOT NULL,
    `eventName` VARCHAR(160) NULL,
    `eventType` VARCHAR(40) NULL,
    `status` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `visits_date_idx`(`date`),
    INDEX `visits_residentId_idx`(`residentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `visit_checks` (
    `id` VARCHAR(80) NOT NULL,
    `visitId` VARCHAR(80) NOT NULL,
    `guestId` VARCHAR(80) NOT NULL,
    `type` VARCHAR(10) NOT NULL,
    `at` DATETIME(3) NOT NULL,
    `by` VARCHAR(160) NOT NULL,

    INDEX `visit_checks_visitId_idx`(`visitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `access_logs` (
    `id` VARCHAR(80) NOT NULL,
    `at` DATETIME(3) NOT NULL,
    `type` VARCHAR(10) NOT NULL,
    `person` VARCHAR(160) NOT NULL,
    `category` VARCHAR(20) NOT NULL,
    `apartmentId` VARCHAR(64) NULL,
    `gate` VARCHAR(80) NOT NULL,

    INDEX `access_logs_at_idx`(`at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `occurrences` (
    `id` VARCHAR(80) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `priority` VARCHAR(10) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `block` VARCHAR(4) NULL,
    `apartmentId` VARCHAR(64) NULL,
    `location` VARCHAR(255) NOT NULL,
    `assignee` VARCHAR(160) NULL,
    `elevatorId` VARCHAR(64) NULL,
    `residentId` VARCHAR(64) NULL,
    `photos` LONGTEXT NULL,
    `resolution` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `reportedBy` VARCHAR(160) NOT NULL,
    `history` LONGTEXT NOT NULL,

    INDEX `occurrences_status_idx`(`status`),
    INDEX `occurrences_residentId_idx`(`residentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `elevators` (
    `id` VARCHAR(64) NOT NULL,
    `block` VARCHAR(4) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `lastMaintenance` DATE NULL,
    `nextMaintenance` DATE NULL,
    `provider` VARCHAR(160) NOT NULL,
    `notes` TEXT NULL,
    `demo` BOOLEAN NOT NULL,
    `history` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ops_tasks` (
    `id` VARCHAR(80) NOT NULL,
    `area` VARCHAR(20) NOT NULL,
    `type` VARCHAR(60) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `location` VARCHAR(255) NOT NULL,
    `block` VARCHAR(4) NULL,
    `responsible` VARCHAR(160) NOT NULL,
    `frequency` VARCHAR(20) NULL,
    `scheduledDate` DATE NOT NULL,
    `dueDate` DATE NULL,
    `executedDate` DATE NULL,
    `status` VARCHAR(20) NOT NULL,
    `equipment` VARCHAR(160) NULL,
    `estimatedCost` DECIMAL(14, 2) NULL,
    `actualCost` DECIMAL(14, 2) NULL,
    `inspection` TEXT NULL,
    `notes` TEXT NULL,

    INDEX `ops_tasks_area_scheduledDate_idx`(`area`, `scheduledDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_entries` (
    `id` VARCHAR(80) NOT NULL,
    `at` DATETIME(3) NOT NULL,
    `by` VARCHAR(160) NOT NULL,
    `role` ENUM('administrador', 'gestor', 'financeiro', 'morador', 'porteiro') NOT NULL,
    `action` VARCHAR(120) NOT NULL,
    `entity` VARCHAR(40) NOT NULL,
    `entityId` VARCHAR(80) NOT NULL,
    `details` TEXT NULL,

    INDEX `audit_entries_at_idx`(`at`),
    INDEX `audit_entries_entity_entityId_idx`(`entity`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `action_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(64) NULL,
    `role` ENUM('administrador', 'gestor', 'financeiro', 'morador', 'porteiro') NULL,
    `action` VARCHAR(60) NOT NULL,
    `ok` BOOLEAN NOT NULL,
    `error` VARCHAR(500) NULL,
    `durationMs` INTEGER NOT NULL,
    `changes` INTEGER NOT NULL DEFAULT 0,

    INDEX `action_log_at_idx`(`at`),
    INDEX `action_log_userId_at_idx`(`userId`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_runs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source` VARCHAR(40) NOT NULL,
    `by` VARCHAR(160) NOT NULL,
    `mode` VARCHAR(40) NOT NULL,
    `summary` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_residentId_fkey` FOREIGN KEY (`residentId`) REFERENCES `residents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `residents` ADD CONSTRAINT `residents_apartmentId_fkey` FOREIGN KEY (`apartmentId`) REFERENCES `apartments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `occupancies` ADD CONSTRAINT `occupancies_apartmentId_fkey` FOREIGN KEY (`apartmentId`) REFERENCES `apartments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotas` ADD CONSTRAINT `quotas_apartmentId_fkey` FOREIGN KEY (`apartmentId`) REFERENCES `apartments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `quotas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_apartmentId_fkey` FOREIGN KEY (`apartmentId`) REFERENCES `apartments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `charges` ADD CONSTRAINT `charges_apartmentId_fkey` FOREIGN KEY (`apartmentId`) REFERENCES `apartments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_hallId_fkey` FOREIGN KEY (`hallId`) REFERENCES `halls`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_apartmentId_fkey` FOREIGN KEY (`apartmentId`) REFERENCES `apartments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `move_outs` ADD CONSTRAINT `move_outs_apartmentId_fkey` FOREIGN KEY (`apartmentId`) REFERENCES `apartments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `visits` ADD CONSTRAINT `visits_apartmentId_fkey` FOREIGN KEY (`apartmentId`) REFERENCES `apartments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `visit_checks` ADD CONSTRAINT `visit_checks_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `visits`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

