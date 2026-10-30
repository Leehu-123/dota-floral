import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { formatOrder } from '@/lib/order-calc';

const updateStatusSchema = z.object({
  status: z.enum(['new', 'in_progress', 'completed', 'delivered', 'cancelled'], {
    errorMap: () => ({ message: 'Trạng thái đơn hàng không hợp lệ' }),
  }),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const validated = updateStatusSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.errors[0]?.message || 'Trạng thái không hợp lệ',
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const newStatus = validated.data.status;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lấy thông tin đơn hàng cùng lines và materials
      const order = await tx.order.findFirst({
        where: {
          id,
          isDeleted: false,
        },
        include: {
          customer: true,
          lines: {
            include: {
              materials: {
                include: {
                  material: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new Error('ORDER_NOT_FOUND');
      }

      const currentStatus = order.status;

      // Không thể thay đổi trạng thái của đơn hàng đã giao (delivered)
      if (currentStatus === 'delivered') {
        throw new Error('DELIVERED_IMMUTABLE');
      }

      // Không thể thay đổi trạng thái của đơn hàng đã hủy (cancelled)
      if (currentStatus === 'cancelled') {
        throw new Error('CANCELLED_IMMUTABLE');
      }

      if (currentStatus === newStatus) {
        throw new Error(`SAME_STATUS_${newStatus}`);
      }

      const warnings: string[] = [];

      // Kiểm tra các chuyển đổi trạng thái hợp lệ
      if (currentStatus === 'new' && (newStatus === 'in_progress' || newStatus === 'completed')) {
        // TRANSITION: new -> in_progress hoặc completed: DEDUCT STOCK
        // 1. Thu thập ID sản phẩm và nguyên liệu để query 1 lần
        const productIds = Array.from(
          new Set(
            order.lines
              .filter((l) => l.fromStock && l.productId)
              .map((l) => l.productId as string)
          )
        );

        const customLines = order.lines.filter((l) => !l.fromStock || !l.productId);
        const materialIds = Array.from(
          new Set(
            customLines.flatMap((l) => l.materials.map((m) => m.materialId))
          )
        );

        const [products, materials] = await Promise.all([
          productIds.length > 0
            ? tx.product.findMany({ where: { id: { in: productIds } } })
            : Promise.resolve([]),
          materialIds.length > 0
            ? tx.material.findMany({ where: { id: { in: materialIds } } })
            : Promise.resolve([]),
        ]);

        const prodMap = new Map(products.map((p) => [p.id, p]));
        const matMap = new Map(materials.map((m) => [m.id, m]));

        const productMovementsToCreate = [];
        const stockMovementsToCreate = [];
        const productDeductions = new Map<string, number>();
        const materialDeductions = new Map<string, number>();

        for (const line of order.lines) {
          if (line.fromStock && line.productId) {
            const product = prodMap.get(line.productId);
            if (product) {
              if (product.stock < line.quantity) {
                warnings.push(
                  `Mẫu "${product.name}" không đủ hoa có sẵn tại tiệm (còn ${product.stock} bó, đơn cần ${line.quantity} bó)`
                );
              }

              const curDeduct = productDeductions.get(line.productId) || 0;
              productDeductions.set(line.productId, curDeduct + line.quantity);

              productMovementsToCreate.push({
                productId: line.productId,
                type: 'sell',
                quantity: -line.quantity,
                unitCost: line.snapshotCost,
                refType: 'order',
                refId: order.id,
                note: `Bán hoa có sẵn cho đơn ${order.code}`,
              });
            }
          } else {
            for (const olm of line.materials) {
              const deductQty = Number(olm.quantity) * line.quantity;
              if (deductQty > 0) {
                const mat = matMap.get(olm.materialId);
                if (mat && Number(mat.currentStock) < deductQty) {
                  warnings.push(
                    `Vật tư "${mat.name}" không đủ tồn kho (còn ${mat.currentStock} ${mat.baseUnit}, cần ${deductQty} ${mat.baseUnit})`
                  );
                }

                const curMatDeduct = materialDeductions.get(olm.materialId) || 0;
                materialDeductions.set(olm.materialId, curMatDeduct + deductQty);

                stockMovementsToCreate.push({
                  materialId: olm.materialId,
                  type: 'order_out',
                  quantity: -deductQty,
                  unitCost: olm.unitCost,
                  refType: 'order',
                  refId: order.id,
                  note: `Xuất cho đơn ${order.code}`,
                });
              }
            }
          }
        }

        // Batch insert movements
        if (productMovementsToCreate.length > 0) {
          await tx.productMovement.createMany({ data: productMovementsToCreate });
        }
        if (stockMovementsToCreate.length > 0) {
          await tx.stockMovement.createMany({ data: stockMovementsToCreate });
        }

        // Cập nhật số lượng tồn kho song song
        const updatePromises: Promise<any>[] = [];
        for (const [pId, qty] of productDeductions.entries()) {
          updatePromises.push(
            tx.product.update({
              where: { id: pId },
              data: { stock: { decrement: qty } },
            })
          );
        }
        for (const [mId, qty] of materialDeductions.entries()) {
          updatePromises.push(
            tx.material.update({
              where: { id: mId },
              data: { currentStock: { decrement: qty } },
            })
          );
        }
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }
      } else if (currentStatus === 'in_progress' && newStatus === 'completed') {
        // TRANSITION: in_progress -> completed: Không biến động kho
      } else if (currentStatus === 'completed' && newStatus === 'delivered') {
        // TRANSITION: completed -> delivered: Không biến động kho
      } else if (newStatus === 'cancelled') {
        // TRANSITION: only return stock if order was previously in_progress or completed (where stock was actually deducted)
        if (currentStatus !== 'new') {
          const productMovementsToCreate = [];
          const stockMovementsToCreate = [];
          const productReturns = new Map<string, number>();
          const materialReturns = new Map<string, number>();

          for (const line of order.lines) {
            if (line.fromStock && line.productId) {
              const cur = productReturns.get(line.productId) || 0;
              productReturns.set(line.productId, cur + line.quantity);

              productMovementsToCreate.push({
                productId: line.productId,
                type: 'return',
                quantity: line.quantity,
                unitCost: line.snapshotCost,
                refType: 'order',
                refId: order.id,
                note: `Hoàn kho thành phẩm do hủy đơn ${order.code}`,
              });
            } else {
              for (const olm of line.materials) {
                const returnQty = Number(olm.quantity) * line.quantity;
                if (returnQty > 0) {
                  const cur = materialReturns.get(olm.materialId) || 0;
                  materialReturns.set(olm.materialId, cur + returnQty);

                  stockMovementsToCreate.push({
                    materialId: olm.materialId,
                    type: 'order_return',
                    quantity: returnQty,
                    unitCost: olm.unitCost,
                    refType: 'order',
                    refId: order.id,
                    note: `Hoàn kho do hủy đơn ${order.code}`,
                  });
                }
              }
            }
          }

          // Xóa biến động bán / xuất gốc của đơn hàng này
          await Promise.all([
            tx.productMovement.deleteMany({
              where: {
                refType: 'order',
                refId: order.id,
                type: 'sell',
              },
            }),
            tx.stockMovement.deleteMany({
              where: {
                refType: 'order',
                refId: order.id,
                type: 'order_out',
              },
            }),
          ]);

          // Batch insert return movements
          if (productMovementsToCreate.length > 0) {
            await tx.productMovement.createMany({ data: productMovementsToCreate });
          }
          if (stockMovementsToCreate.length > 0) {
            await tx.stockMovement.createMany({ data: stockMovementsToCreate });
          }

          // Hoàn kho song song
          const returnPromises: Promise<any>[] = [];
          for (const [pId, qty] of productReturns.entries()) {
            returnPromises.push(
              tx.product.update({
                where: { id: pId },
                data: { stock: { increment: qty } },
              })
            );
          }
          for (const [mId, qty] of materialReturns.entries()) {
            returnPromises.push(
              tx.material.update({
                where: { id: mId },
                data: { currentStock: { increment: qty } },
              })
            );
          }
          if (returnPromises.length > 0) {
            await Promise.all(returnPromises);
          }
        }
      } else {
        throw new Error(`INVALID_TRANSITION_${currentStatus}_TO_${newStatus}`);
      }

      // Cập nhật trạng thái đơn hàng
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: newStatus,
        },
        include: {
          customer: true,
          lines: {
            include: {
              materials: {
                include: {
                  material: {
                    select: {
                      id: true,
                      name: true,
                      baseUnit: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return {
        order: updatedOrder,
        warnings,
      };
    },
    {
      maxWait: 15000,
      timeout: 60000,
    });

    const formatted = formatOrder(result.order);

    return NextResponse.json({
      ...formatted,
      warnings: result.warnings,
    });
  } catch (error: any) {
    console.error('Lỗi khi cập nhật trạng thái đơn hàng:', error);

    if (error?.message === 'ORDER_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Không tìm thấy đơn hàng hoặc đơn đã bị xóa' },
        { status: 404 }
      );
    }

    if (error?.message === 'DELIVERED_IMMUTABLE') {
      return NextResponse.json(
        { error: 'Không thể thay đổi trạng thái của đơn hàng đã giao' },
        { status: 400 }
      );
    }

    if (error?.message === 'CANCELLED_IMMUTABLE') {
      return NextResponse.json(
        { error: 'Không thể thay đổi trạng thái của đơn hàng đã hủy' },
        { status: 400 }
      );
    }

    if (error?.message?.startsWith('SAME_STATUS_')) {
      const s = error.message.replace('SAME_STATUS_', '');
      return NextResponse.json(
        { error: `Đơn hàng hiện tại đã ở trạng thái "${s}"` },
        { status: 400 }
      );
    }

    if (error?.message?.startsWith('INVALID_TRANSITION_')) {
      return NextResponse.json(
        { error: 'Chuyển đổi trạng thái đơn hàng không hợp lệ' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error?.message || 'Không thể cập nhật trạng thái đơn hàng' },
      { status: 500 }
    );
  }
}
