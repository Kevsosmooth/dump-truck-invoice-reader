-- CreateEnum
CREATE TYPE "TransformationType" AS ENUM ('NONE', 'DATE_PARSE', 'NUMBER_FORMAT', 'TEXT_REPLACE', 'CUSTOM');

-- AlterTable
ALTER TABLE "FieldConfiguration" 
ADD COLUMN "transformationType" "TransformationType" NOT NULL DEFAULT 'NONE',
ADD COLUMN "transformationConfig" JSONB;