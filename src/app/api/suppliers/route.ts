import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Tên nhà cung cấp là bắt buộc'),
  phone: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const where: any = {};

    if (search && search.trim()) {
      where.name = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            purchases: {
              where: {
                isDeleted: false,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách nhà cung cấp:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách nhà cung cấp' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createSupplierSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.errors[0]?.message || 'Dữ liệu không hợp lệ',
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, phone, note } = validated.data;

    const existing = await prisma.supplier.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Nhà cung cấp này đã tồn tại' },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        phone: phone || null,
        note: note || null,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error('Lỗi khi tạo nhà cung cấp:', error);
    return NextResponse.json(
      { error: 'Không thể tạo nhà cung cấp' },
      { status: 500 }
    );
  }
}
