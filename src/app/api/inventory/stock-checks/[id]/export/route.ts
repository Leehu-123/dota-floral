import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MATERIAL_GROUPS, getLabel } from '@/lib/constants';

export const dynamic = 'force-dynamic';

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
            material: true,
          },
          orderBy: [
            { difference: 'asc' },
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

    const headers = [
      'STT',
      'Tên nguyên liệu',
      'Nhóm',
      'ĐVT',
      'Tồn trước kiểm',
      'Thực tế kiểm',
      'Chênh lệch',
      'Đơn giá vốn (VNĐ)',
      'Giá trị chênh lệch (VNĐ)',
      'Ghi chú',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = stockCheck.items.map((item, idx) => {
      const diff = Number(item.difference);
      const diffStr = diff > 0 ? `+${diff}` : String(diff);
      return [
        idx + 1,
        escapeCsv(item.material.name),
        escapeCsv(getLabel(MATERIAL_GROUPS, item.material.group)),
        escapeCsv(item.material.baseUnit),
        item.previousStock.toString(),
        item.actualStock.toString(),
        diffStr,
        Math.round(Number(item.unitCost)),
        Math.round(Number(item.totalCostDiff)),
        escapeCsv(item.note || ''),
      ].join(',');
    });

    const checkDateStr = new Date(stockCheck.checkDate).toLocaleDateString('vi-VN');
    const metaHeader = [
      `"Mã phiếu:","${stockCheck.code}"`,
      `"Ngày kiểm:","${checkDateStr}"`,
      `"Ghi chú:","${stockCheck.note || ''}"`,
      `"Tổng mặt hàng:","${stockCheck.totalItems}"`,
      `"Thừa (+):","${stockCheck.increaseCount}","Thiếu (-):","${stockCheck.decreaseCount}","Khớp:","${stockCheck.matchCount}"`,
      `"Tổng chênh lệch giá trị (VNĐ):","${stockCheck.totalDiffCost}"`,
      '',
    ].join('\r\n');

    const csvContent = '\uFEFF' + metaHeader + '\r\n' + headers.join(',') + '\r\n' + rows.join('\r\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="phieu-kiem-kho-${stockCheck.code}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Lỗi khi xuất CSV phiếu kiểm kho:', error);
    return NextResponse.json(
      { error: 'Không thể xuất file CSV' },
      { status: 500 }
    );
  }
}
