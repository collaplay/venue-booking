-- 專案計價資訊：方案、國定假日、議價理由、長期合作折扣。只新增欄位（皆有預設值或可為空），不改既有資料。
ALTER TABLE "project_rental" ADD COLUMN IF NOT EXISTS "pricePlan" VARCHAR(1) NOT NULL DEFAULT 'A';
ALTER TABLE "project_rental" ADD COLUMN IF NOT EXISTS "isHoliday" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "project_rental" ADD COLUMN IF NOT EXISTS "priceNote" TEXT;
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER;
