import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const fromDateStr = searchParams.get('fromDate');
    const toDateStr = searchParams.get('toDate');

    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (fromDateStr || toDateStr) {
      where.checkDate = {};
      if (fromDateStr) {
        where.checkDate.gte = new Date(fromDateStr);
      }
      if (toDateStr) {
        const toD = new Date(toDateStr);
        toD.setHours(23, 59, 59, 999);
        where.checkDate.lte = toD;
      }
    }

    const stockChecks = await prisma.stockCheck.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    // Tính toán thống kê tổng quan
    let totalTickets = stockChecks.length;
    let totalItemsChecked = 0;
    let totalDiffCost = 0;
    let totalDecreaseCount = 0;
    let totalIncreaseCount = 0;

    for (const sc of stockChecks) {
      totalItemsChecked += sc.totalItems;
      totalDiffCost += Number(sc.totalDiffCost) || 0;
      totalDecreaseCount += sc.decreaseCount;
      totalIncreaseCount += sc.increaseCount;
    }

    return NextResponse.json({
      stockChecks,
      summary: {
        totalTickets,
        totalItemsChecked,
        totalDiffCost,
        totalDecreaseCount,
        totalIncreaseCount,
      },
    });
  } catch (error: any) {
    console.error('Lỗi khi lấy danh sách phiếu kiểm kho:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách phiếu kiểm kho' },
      { status: 500 }
    );
  }
}
