import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const stockCheck = await prisma.stockCheck.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            material: {
              select: {
                id: true,
                name: true,
                group: true,
                baseUnit: true,
                purchaseUnit: true,
                conversionFactor: true,
                avgCost: true,
                currentStock: true,
              },
            },
          },
          orderBy: [
            { difference: 'asc' }, // Mặt hàng thiếu nhiều nhất lên trước
            { id: 'asc' },
          ],
        },
      },
    });

    if (!stockCheck) {
      return NextResponse.json(
        { error: 'Không tìm thấy phiếu kiểm kho' },
        { status: 404 }
      );
    }

    return NextResponse.json(stockCheck);
  } catch (error: any) {
    console.error('Lỗi khi lấy chi tiết phiếu kiểm kho:', error);
    return NextResponse.json(
      { error: 'Không thể tải chi tiết phiếu kiểm kho' },
      { status: 500 }
    );
  }
}
