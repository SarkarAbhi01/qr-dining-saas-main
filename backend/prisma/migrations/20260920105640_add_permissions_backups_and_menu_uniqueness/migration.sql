/*
  Warnings:

  - A unique constraint covering the columns `[restaurantId,name]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[categoryId,name]` on the table `menu_items` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BackupFormat" AS ENUM ('EXCEL', 'PDF', 'TXT', 'SQL');

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "backupEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "excelExportEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "format" "BackupFormat" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "bakFileName" TEXT NOT NULL,
    "bakFilePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backups_restaurantId_createdAt_idx" ON "backups"("restaurantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_restaurantId_name_key" ON "categories"("restaurantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_categoryId_name_key" ON "menu_items"("categoryId", "name");

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
