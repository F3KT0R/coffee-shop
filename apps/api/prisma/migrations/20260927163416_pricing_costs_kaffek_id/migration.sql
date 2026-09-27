-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "unitCostRsd" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "regularPriceRsd",
ADD COLUMN     "costRsd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kaffekId" INTEGER,
ADD COLUMN     "weightKg" DOUBLE PRECISION;

