import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MATERIAL_GROUPS } from '@/lib/constants';

const createMaterialSchema = z.object({
  name: z.string().trim().min(1, 'Tên vật tư là bắt buộc'),
  group: z.string().trim().min(1, 'Nhóm vật tư là bắt buộc').refine(
    (val) => MATERIAL_GROUPS.some((g) => g.value === val),
    { message: 'Nhóm vật tư không hợp lệ' }
  ),
  baseUnit: z.string().trim().min(1, 'Đơn vị cơ bản là bắt buộc'),
  purchaseUnit: z.string().trim().min(1, 'Đơn vị nhập là bắt buộc'),
  conversionFactor: z.coerce.number().positive('Hệ số quy đổi phải lớn hơn 0'),
  minStock: z.coerce.number().min(0, 'Tồn kho tối thiểu không được âm').default(0),
  note: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
});

function computeMaterialStatus(stock: number, min: number): 'ok' | 'low' | 'out' {
  if (stock <= 0) return 'out';
  if (stock <= min) return 'low';
  return 'ok';
}

function formatMaterial(material: any) {
  const currentStock = Number(material.currentStock);
  const minStock = Number(material.minStock);
  return {
    ...material,
    conversionFactor: Number(material.conversionFactor),
    minStock,
    avgCost: Number(material.avgCost),
    currentStock,
    status: computeMaterialStatus(currentStock, minStock),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const group = searchParams.get('group');
    const search = searchParams.get('search');
    const status = searchParams.get('status'); // 'ok' | 'low' | 'out'

    const where: any = {
      isDeleted: false,
    };

    if (group) {
      where.group = group;
    }

    if (search && search.trim()) {
      where.name = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    const materials = await prisma.material.findMany({
      where,
      orderBy: [
        { group: 'asc' },
        { name: 'asc' },
      ],
    });

    let formatted = materials.map(formatMaterial);

    if (status) {
      if (status === 'low') {
        formatted = formatted.filter((m) => m.status === 'low');
      } else if (status === 'out') {
        formatted = formatted.filter((m) => m.status === 'out');
      } else if (status === 'ok') {
        formatted = formatted.filter((m) => m.status === 'ok');
      }
    }

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách vật tư:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách vật tư' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createMaterialSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.errors[0]?.message || 'Dữ liệu không hợp lệ',
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validated.data;

    const newMaterial = await prisma.material.create({
      data: {
        name: data.name,
        group: data.group,
        baseUnit: data.baseUnit,
        purchaseUnit: data.purchaseUnit,
        conversionFactor: data.conversionFactor,
        minStock: data.minStock,
        avgCost: 0,
        currentStock: 0,
        note: data.note || null,
        imageUrl: data.imageUrl || null,
      },
    });

    return NextResponse.json(formatMaterial(newMaterial), { status: 201 });
  } catch (error) {
    console.error('Lỗi khi tạo vật tư:', error);
    return NextResponse.json(
      { error: 'Không thể tạo vật tư mới' },
      { status: 500 }
    );
  }
}
