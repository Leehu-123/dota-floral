import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const materials = await prisma.material.findMany({
      where: {
        isDeleted: false,
        minStock: {
          gt: 0,
        },
      },
      orderBy: [
        { group: 'asc' },
        { name: 'asc' },
      ],
    });

    const lowStockMaterials = materials
      .filter((m) => Number(m.currentStock) <= Number(m.minStock))
      .map((m) => {
        const currentStock = Number(m.currentStock);
        const minStock = Number(m.minStock);
        return {
          ...m,
          conversionFactor: Number(m.conversionFactor),
          minStock,
          avgCost: Number(m.avgCost),
          currentStock,
          status: currentStock <= 0 ? ('out' as const) : ('low' as const),
        };
      });

    return NextResponse.json(lowStockMaterials);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách vật tư sắp hết hàng:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách vật tư sắp hết hàng' },
      { status: 500 }
    );
  }
}
