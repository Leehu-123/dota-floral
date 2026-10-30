import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const itemSchema = z.object({
  name: z.string().min(1, 'Tên nguyên liệu không được để trống'),
  group: z.string().min(1),
  baseUnit: z.string().min(1),
  purchaseUnit: z.string().min(1),
  conversionFactor: z.number().positive('Hệ số quy đổi phải > 0'),
  purchaseQty: z.number().min(0),
  unitPrice: z.number().min(0),
  actualStock: z.number().min(0),
});

const reconciliationSchema = z.object({
  periodName: z.string().min(1, 'Tên đợt không được để trống'),
  date: z.string(),
  supplierName: z.string().optional().default(''),
  shippingCost: z.number().min(0).default(0),
  note: z.string().optional().default(''),
  items: z.array(itemSchema).min(1, 'Cần ít nhất 1 nguyên liệu'),
});

/**
 * POST /api/inventory/reconciliation
 *
 * Tạo cân đối kho sau đợt bán:
 * 1. Tạo nguyên liệu mới (nếu chưa có)
 * 2. Tạo phiếu nhập hàng từ hóa đơn → cập nhật tồn kho & giá vốn bình quân
 * 3. Điều chỉnh kho về tồn thực tế (kiểm kê)
 * 4. Trả về bảng tổng hợp giá vốn đã sử dụng
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = reconciliationSchema.parse(body);

    const result = await prisma.$transaction(
      async (tx) => {
        // ── 1. Upsert nhà cung cấp ──
        let supplierId: string | null = null;
        const supplierLabel = data.supplierName || `Cân đối ${data.periodName}`;
        if (data.supplierName) {
          const supplier = await tx.supplier.upsert({
            where: { name: data.supplierName },
            update: {},
            create: { name: data.supplierName },
          });
          supplierId = supplier.id;
        }

        // ── 2. Tạo / tìm nguyên liệu ──
        // Tìm nhanh tất cả nguyên liệu đã tồn tại trong 1 câu query
        const itemNames = data.items.map((i) => i.name);
        const existingMaterials = await tx.material.findMany({
          where: { name: { in: itemNames }, isDeleted: false },
        });
        const materialMap = new Map(existingMaterials.map((m) => [m.name, m]));

        const materialIds: string[] = [];
        for (const item of data.items) {
          let material = materialMap.get(item.name);
          if (!material) {
            material = await tx.material.create({
              data: {
                name: item.name,
                group: item.group,
                baseUnit: item.baseUnit,
                purchaseUnit: item.purchaseUnit,
                conversionFactor: item.conversionFactor,
                minStock: 0,
                avgCost: 0,
                currentStock: 0,
              },
            });
            materialMap.set(item.name, material);
          }
          materialIds.push(material.id);
        }

        // ── 3. Tạo phiếu nhập hàng (Purchase) ──
        const purchaseLinesData: {
          materialId: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
          convertedQty: number;
        }[] = [];

        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          if (item.purchaseQty <= 0) continue;
          const lineTotal = Math.round(item.purchaseQty * item.unitPrice);
          const convertedQty = item.purchaseQty * item.conversionFactor;
          purchaseLinesData.push({
            materialId: materialIds[i],
            quantity: item.purchaseQty,
            unitPrice: item.unitPrice,
            lineTotal,
            convertedQty,
          });
        }

        const totalLineAmount = purchaseLinesData.reduce((s, l) => s + l.lineTotal, 0);

        const purchase = await tx.purchase.create({
          data: {
            date: new Date(data.date),
            supplierId,
            supplierName: supplierLabel,
            shippingCost: data.shippingCost,
            totalAmount: totalLineAmount + data.shippingCost,
            note: data.note || `Cân đối kho - ${data.periodName}`,
            lines: { create: purchaseLinesData },
          },
        });

        // ── 4. Tạo stock movements (nhập kho) & cập nhật giá vốn bình quân ──
        const materialState = new Map<
          string,
          { currentStock: number; avgCost: number }
        >();

        // Lấy thông tin các material trong purchase lines
        const purchaseMatIds = Array.from(new Set(purchaseLinesData.map((l) => l.materialId)));
        const purchaseMaterials = await tx.material.findMany({
          where: { id: { in: purchaseMatIds } },
        });
        const currentMatMap = new Map(purchaseMaterials.map((m) => [m.id, m]));

        const purchaseMovementsToCreate = [];

        for (const line of purchaseLinesData) {
          const material = currentMatMap.get(line.materialId)!;
          const state = materialState.get(line.materialId) ?? {
            currentStock: Number(material.currentStock),
            avgCost: Number(material.avgCost),
          };

          const unitCostPerBase =
            line.convertedQty > 0 ? line.lineTotal / line.convertedQty : 0;

          // Bình quân gia quyền
          let newAvgCost: number;
          if (state.currentStock <= 0) {
            newAvgCost = unitCostPerBase;
          } else {
            newAvgCost =
              (state.currentStock * state.avgCost +
                line.convertedQty * unitCostPerBase) /
              (state.currentStock + line.convertedQty);
          }
          const newStock = state.currentStock + line.convertedQty;

          purchaseMovementsToCreate.push({
            materialId: line.materialId,
            type: 'purchase_in',
            quantity: line.convertedQty,
            unitCost: Math.round(unitCostPerBase * 100) / 100,
            refType: 'purchase',
            refId: purchase.id,
            note: `Cân đối - ${data.periodName}`,
          });

          materialState.set(line.materialId, {
            currentStock: newStock,
            avgCost: Math.round(newAvgCost * 100) / 100,
          });
        }

        // Batch insert stock movements cho purchase
        if (purchaseMovementsToCreate.length > 0) {
          await tx.stockMovement.createMany({
            data: purchaseMovementsToCreate,
          });
        }

        // Cập nhật tồn kho và giá vốn song song
        if (materialState.size > 0) {
          await Promise.all(
            Array.from(materialState.entries()).map(([mId, state]) =>
              tx.material.update({
                where: { id: mId },
                data: {
                  currentStock: state.currentStock,
                  avgCost: state.avgCost,
                },
              })
            )
          );
        }

        // ── 5. Điều chỉnh kho về tồn thực tế (kiểm kê cuối kỳ) ──
        const summaryItems: {
          materialId: string;
          name: string;
          group: string;
          baseUnit: string;
          purchaseUnit: string;
          conversionFactor: number;
          purchaseQty: number;
          unitPrice: number;
          initialStock: number;
          actualStock: number;
          usedQty: number;
          unitCost: number;
          purchaseCost: number;
          usedCost: number;
          currentValue: number;
        }[] = [];

        // Đọc lại stock mới nhất của tất cả materialIds
        const updatedMats = await tx.material.findMany({
          where: { id: { in: materialIds } },
        });
        const updatedMatMap = new Map(updatedMats.map((m) => [m.id, m]));

        const adjustmentMovementsToCreate = [];
        const adjustmentUpdates = [];

        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          const matId = materialIds[i];
          const mat = updatedMatMap.get(matId)!;

          const systemStock = Number(mat.currentStock);
          const avgCost = Number(mat.avgCost);
          const diff = item.actualStock - systemStock;

          if (Math.abs(diff) > 0.0001) {
            adjustmentMovementsToCreate.push({
              materialId: matId,
              type: 'adjustment',
              quantity: diff,
              unitCost: avgCost,
              refType: 'reconciliation',
              refId: purchase.id,
              note: `Kiểm kê cuối kỳ - ${data.periodName}`,
            });

            adjustmentUpdates.push({
              id: matId,
              actualStock: item.actualStock,
            });
          }

          const convertedQty = item.purchaseQty * item.conversionFactor;
          const lineTotal = Math.round(item.purchaseQty * item.unitPrice);
          const unitCostPerBase =
            convertedQty > 0 ? lineTotal / convertedQty : avgCost;
          const usedQty = Math.max(0, convertedQty - item.actualStock);
          const usedCost = Math.round(usedQty * unitCostPerBase);

          summaryItems.push({
            materialId: matId,
            name: item.name,
            group: item.group,
            baseUnit: item.baseUnit,
            purchaseUnit: item.purchaseUnit,
            conversionFactor: item.conversionFactor,
            purchaseQty: item.purchaseQty,
            unitPrice: item.unitPrice,
            initialStock: convertedQty,
            actualStock: item.actualStock,
            usedQty,
            unitCost: Math.round(unitCostPerBase * 100) / 100,
            purchaseCost: lineTotal,
            usedCost,
            currentValue: Math.round(item.actualStock * unitCostPerBase),
          });
        }

        // Batch insert adjustment movements
        if (adjustmentMovementsToCreate.length > 0) {
          await tx.stockMovement.createMany({
            data: adjustmentMovementsToCreate,
          });
        }

        // Cập nhật tồn kho thực tế song song
        if (adjustmentUpdates.length > 0) {
          await Promise.all(
            adjustmentUpdates.map((u) =>
              tx.material.update({
                where: { id: u.id },
                data: { currentStock: u.actualStock },
              })
            )
          );
        }

        return {
          purchaseId: purchase.id,
          periodName: data.periodName,
          summary: {
            totalPurchaseCost:
              summaryItems.reduce((s, i) => s + i.purchaseCost, 0) +
              data.shippingCost,
            totalCurrentValue: summaryItems.reduce(
              (s, i) => s + i.currentValue,
              0,
            ),
            totalUsedCost: summaryItems.reduce((s, i) => s + i.usedCost, 0),
            shippingCost: data.shippingCost,
            itemCount: summaryItems.length,
            items: summaryItems,
          },
        };
      },
      {
        maxWait: 15000,
        timeout: 60000,
      }
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Reconciliation error:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dữ liệu không hợp lệ', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error.message || 'Lỗi hệ thống khi cân đối kho' },
      { status: 500 },
    );
  }
}
