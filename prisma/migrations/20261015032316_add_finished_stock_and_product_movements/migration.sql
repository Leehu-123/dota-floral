-- AlterTable
ALTER TABLE "order_lines" ADD COLUMN     "from_stock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "product_movements" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_movements_product_id_idx" ON "product_movements"("product_id");

-- CreateIndex
CREATE INDEX "product_movements_ref_type_ref_id_idx" ON "product_movements"("ref_type", "ref_id");

-- AddForeignKey
ALTER TABLE "product_movements" ADD CONSTRAINT "product_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
