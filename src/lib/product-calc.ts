import { prisma } from '@/lib/prisma';

export interface ProductMaterialWithDetails {
  id?: string;
  productId?: string;
  materialId: string;
  quantity: number | { toNumber?: () => number } | string;
  material: {
    id: string;
    name: string;
    baseUnit: string;
    avgCost: number | { toNumber?: () => number } | string;
    currentStock?: number | { toNumber?: () => number } | string;
    group?: string;
    imageUrl?: string | null;
  };
}

export interface ComputedCosts {
  materialCost: number;
  overheadCost: number;
  totalCost: number;
  actualMargin: number;
}

/**
 * Tính chi phí nguyên vật liệu, chi phí chung, tổng chi phí và biên lợi nhuận thực tế
 */
export function computeProductCosts(
  materials: { quantity: number | any; material: { avgCost: number | any } }[],
  laborCost: number,
  overheadPercent: number,
  suggestedPrice: number = 0
): ComputedCosts {
  let materialCost = 0;

  for (const item of materials) {
    const qty = Number(item.quantity) || 0;
    const avgCost = Number(item.material.avgCost) || 0;
    materialCost += qty * avgCost;
  }

  const overheadCost = Math.round((materialCost * overheadPercent) / 100);
  const totalCost = Math.round(materialCost + laborCost + overheadCost);

  let actualMargin = 0;
  if (suggestedPrice > 0) {
    actualMargin = Number((((suggestedPrice - totalCost) / suggestedPrice) * 100).toFixed(2));
  }

  return {
    materialCost: Math.round(materialCost),
    overheadCost,
    totalCost,
    actualMargin,
  };
}

/**
 * Tính giá đề xuất từ tổng chi phí và biên lợi nhuận mục tiêu, làm tròn theo bước giá
 */
export function calculateSuggestedPrice(
  totalCost: number,
  targetMargin: number,
  roundingStep: number = 5000
): number {
  if (targetMargin >= 100) {
    return Math.round(totalCost);
  }
  const rawPrice = totalCost / (1 - targetMargin / 100);
  const step = roundingStep > 0 ? roundingStep : 1;
  const rounded = Math.round(rawPrice / step) * step;
  return Math.max(0, rounded);
}

/**
 * Lấy toàn bộ cấu hình hệ thống dưới dạng Map/Object
 */
export async function getSettingsMap(prismaClient: any = prisma): Promise<Record<string, string>> {
  const settings = await prismaClient.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return map;
}

/**
 * Format thông tin mẫu sản phẩm từ Prisma model sang JSON response kèm các trường tính toán
 */
export function formatProductResponse(product: any, checkAvailability = false) {
  const laborCost = Number(product.laborCost) || 0;
  const overheadPercent = Number(product.overheadPercent) || 0;
  const targetMargin = Number(product.targetMargin) || 0;
  const suggestedPrice = Number(product.suggestedPrice) || 0;

  const materials = (product.materials || []).map((pm: any) => {
    const quantity = Number(pm.quantity) || 0;
    const avgCost = Number(pm.material?.avgCost) || 0;
    const currentStock = Number(pm.material?.currentStock) || 0;
    const isAvailable = currentStock >= quantity;

    return {
      id: pm.id,
      productId: pm.productId,
      materialId: pm.materialId,
      quantity,
      unitCost: avgCost,
      lineCost: Math.round(quantity * avgCost),
      material: pm.material
        ? {
            id: pm.material.id,
            name: pm.material.name,
            baseUnit: pm.material.baseUnit,
            group: pm.material.group,
            avgCost,
            currentStock,
            imageUrl: pm.material.imageUrl,
          }
        : undefined,
      ...(checkAvailability
        ? {
            isAvailable,
            missingQuantity: isAvailable ? 0 : Number((quantity - currentStock).toFixed(4)),
          }
        : {}),
    };
  });

  const costs = computeProductCosts(materials, laborCost, overheadPercent, suggestedPrice);

  const isAllAvailable =
    materials.length === 0 || materials.every((m: any) => (m.isAvailable ?? true));

  return {
    id: product.id,
    name: product.name,
    type: product.type,
    description: product.description,
    imageUrl: product.imageUrl,
    laborCost,
    overheadPercent,
    targetMargin,
    suggestedPrice,
    stock: product.stock ?? 0,
    isDeleted: product.isDeleted,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    materials,
    materialCost: costs.materialCost,
    overheadCost: costs.overheadCost,
    totalCost: costs.totalCost,
    actualMargin: costs.actualMargin,
    ...(checkAvailability ? { isAvailable: isAllAvailable } : {}),
  };
}
