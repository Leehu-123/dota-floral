import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const createPurchaseSchema = z.object({
  date: z.string().or(z.date()),
  supplierName: z.string().trim().min(1, 'Tên nhà cung cấp là bắt buộc'),
  shippingCost: z.coerce.number().min(0, 'Chi phí vận chuyển không được âm').default(0),
  note: z.string().trim().optional().nullable(),
  invoiceImageUrl: z.string().trim().optional().nullable(),
  lines: z
    .array(
      z.object({
        materialId: z.string().trim().min(1, 'Vật tư là bắt buộc'),
        quantity: z.coerce.number().positive('Số lượng nhập phải lớn hơn 0'),
        unitPrice: z.coerce.number().min(0, 'Đơn giá không được âm'),
      })
    )
    .min(1, 'Đơn nhập hàng phải có ít nhất 1 mặt hàng'),
});

function formatPurchase(p: any) {
  return {
    ...p,
    shippingCost: Number(p.shippingCost),
    totalAmount: Number(p.totalAmount),
    lines: p.lines?.map((line: any) => ({
      ...line,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
      convertedQty: Number(line.convertedQty),
      material: line.material
        ? {
            ...line.material,
            conversionFactor: Number(line.material.conversionFactor),
            minStock: Number(line.material.minStock),
            avgCost: Number(line.material.avgCost),
            currentStock: Number(line.material.currentStock),
          }
        : undefined,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = searchParams.get('limit');

    const where: any = {
      isDeleted: false,
    };

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (from || to) {
      where.date = {};
      if (from) {
        where.date.gte = new Date(from);
      }
      if (to) {
        where.date.lte = new Date(to);
      }
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: true,
        lines: {
          include: {
            material: {
              select: {
                id: true,
                name: true,
                group: true,
                baseUnit: true,
                purchaseUnit: true,
                conversionFactor: true,
                currentStock: true,
                avgCost: true,
                minStock: true,
              },
            },
          },
        },
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit ? parseInt(limit, 10) : undefined,
    });

    const formatted = purchases.map(formatPurchase);

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách đơn nhập hàng:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách đơn nhập hàng' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createPurchaseSchema.safeParse(body);

    if (!validated.success) {
      const firstError = validated.error.errors[0]?.message || 'Dữ liệu không hợp lệ';
      console.error('Validation purchase error:', validated.error.flatten());
      return NextResponse.json(
        {
          error: firstError,
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { date, supplierName, shippingCost, note, invoiceImageUrl, lines } = validated.data;

    // Parse date safely
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: 'Ngày nhập hàng không hợp lệ' },
        { status: 400 }
      );
    }

    // Tăng timeout transaction lên 60 giây và batch queries để hỗ trợ đơn nhập lớn (30+ mặt hàng)
    const createdPurchase = await prisma.$transaction(
      async (tx) => {
        // 1. Tìm hoặc tạo Nhà cung cấp theo tên (upsert)
        const trimmedSupplierName = supplierName.trim();
        const supplier = await tx.supplier.upsert({
          where: { name: trimmedSupplierName },
          update: {},
          create: { name: trimmedSupplierName },
        });

        // 2. Batch query: Lấy tất cả vật tư trong 1 câu truy vấn duy nhất thay vì N câu tuần tự
        const materialIds = Array.from(new Set(lines.map((l) => l.materialId)));
        const materials = await tx.material.findMany({
          where: {
            id: { in: materialIds },
            isDeleted: false,
          },
        });
        const materialMap = new Map(materials.map((m) => [m.id, m]));

        // Kiểm tra xem có vật tư nào không tồn tại
        for (const line of lines) {
          if (!materialMap.has(line.materialId)) {
            throw new Error(`NOT_FOUND_${line.materialId}`);
          }
        }

        // 3. Tính toán các dòng nhập hàng trong bộ nhớ
        const preparedLines = [];
        let linesTotalSum = 0;

        for (const line of lines) {
          const material = materialMap.get(line.materialId)!;
          const qty = Number(line.quantity);
          const unitPrice = Math.round(Number(line.unitPrice));
          const convFactor = Number(material.conversionFactor) || 1;
          const lineTotal = Math.round(qty * unitPrice);
          const convertedQty = qty * convFactor;

          linesTotalSum += lineTotal;

          preparedLines.push({
            materialId: line.materialId,
            quantity: qty,
            unitPrice,
            lineTotal,
            convertedQty,
            material,
          });
        }

        const totalAmount = linesTotalSum + Math.round(Number(shippingCost) || 0);

        // 4. Tạo Purchase cùng các dòng PurchaseLine trong 1 câu lệnh
        const purchase = await tx.purchase.create({
          data: {
            date: parsedDate,
            supplierId: supplier.id,
            supplierName: supplier.name,
            shippingCost: Math.round(Number(shippingCost) || 0),
            totalAmount,
            note: note || null,
            invoiceImageUrl: invoiceImageUrl || null,
            lines: {
              create: preparedLines.map((l) => ({
                materialId: l.materialId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
                convertedQty: l.convertedQty,
              })),
            },
          },
          include: {
            lines: {
              include: {
                material: true,
              },
            },
            supplier: true,
          },
        });

        // 5. Chuẩn bị dữ liệu StockMovement và tính toán tồn kho + giá vốn mới
        const stockMovementsToCreate = [];
        const materialState = new Map<
          string,
          { currentStock: number; avgCost: number }
        >();

        for (const pl of preparedLines) {
          const unitCostPerBaseUnit =
            pl.convertedQty > 0 ? pl.lineTotal / pl.convertedQty : 0;

          stockMovementsToCreate.push({
            materialId: pl.materialId,
            type: 'purchase_in',
            quantity: pl.convertedQty,
            unitCost: Math.round(unitCostPerBaseUnit * 100) / 100,
            refType: 'purchase',
            refId: purchase.id,
            note: `Nhập hàng từ ${supplier.name}`,
          });

          const oldStock = materialState.has(pl.materialId)
            ? materialState.get(pl.materialId)!.currentStock
            : Number(pl.material.currentStock);

          const oldAvgCost = materialState.has(pl.materialId)
            ? materialState.get(pl.materialId)!.avgCost
            : Number(pl.material.avgCost);

          // Công thức bình quân gia quyền:
          let newAvgCost: number;
          if (oldStock <= 0 || oldStock + pl.convertedQty <= 0) {
            newAvgCost = unitCostPerBaseUnit;
          } else {
            newAvgCost =
              (oldStock * oldAvgCost + pl.convertedQty * unitCostPerBaseUnit) /
              (oldStock + pl.convertedQty);
          }

          const newStock = oldStock + pl.convertedQty;

          materialState.set(pl.materialId, {
            currentStock: newStock,
            avgCost: Math.round(newAvgCost * 100) / 100,
          });
        }

        // Batch insert toàn bộ StockMovement trong 1 lần gọi
        if (stockMovementsToCreate.length > 0) {
          await tx.stockMovement.createMany({
            data: stockMovementsToCreate,
          });
        }

        // Cập nhật tồn kho và avgCost của các vật tư song song
        await Promise.all(
          Array.from(materialState.entries()).map(([materialId, state]) =>
            tx.material.update({
              where: { id: materialId },
              data: {
                currentStock: state.currentStock,
                avgCost: state.avgCost,
              },
            })
          )
        );

        return purchase;
      },
      {
        maxWait: 15000, // Chờ connection pool tối đa 15s
        timeout: 60000, // Timeout giao dịch 60s (cho phép nhập đơn hàng lớn thoải mái)
      }
    );

    return NextResponse.json(formatPurchase(createdPurchase), { status: 201 });
  } catch (error: any) {
    console.error('Lỗi khi tạo đơn nhập hàng:', error);

    if (typeof error?.message === 'string' && error.message.startsWith('NOT_FOUND_')) {
      const materialId = error.message.replace('NOT_FOUND_', '');
      return NextResponse.json(
        { error: `Không tìm thấy vật tư có ID: ${materialId}` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error?.message || 'Không thể tạo đơn nhập hàng' },
      { status: 500 }
    );
  }
}
