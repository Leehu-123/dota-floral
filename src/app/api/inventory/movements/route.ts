import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('materialId');
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = searchParams.get('limit');

    const where: any = {};

    if (materialId) {
      where.materialId = materialId;
    }

    if (type) {
      where.type = type;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        // Hỗ trợ định dạng YYYY-MM-DD hoặc ISO string
        const fromDate = from.includes('T') ? new Date(from) : new Date(`${from}T00:00:00.000Z`);
        where.createdAt.gte = fromDate;
      }
      if (to) {
        const toDate = to.includes('T') ? new Date(to) : new Date(`${to}T23:59:59.999Z`);
        where.createdAt.lte = toDate;
      }
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        material: {
          select: {
            id: true,
            name: true,
            group: true,
            baseUnit: true,
            purchaseUnit: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit ? parseInt(limit, 10) : undefined,
    });

    const formatted = movements.map((m) => ({
      ...m,
      quantity: Number(m.quantity),
      unitCost: Number(m.unitCost),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử biến động kho:', error);
    return NextResponse.json(
      { error: 'Không thể tải lịch sử biến động kho' },
      { status: 500 }
    );
  }
}
