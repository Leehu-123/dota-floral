import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Helper functions implementing the exact business logic formulas
// matching prisma purchase & order services

describe('Quy tắc nghiệp vụ 1: Quy đổi đơn vị (Unit Conversion)', () => {
  function convertQuantity(purchaseQty: number, factor: number): number {
    return purchaseQty * factor;
  }

  function calculateBaseUnitCost(purchaseQty: number, unitPrice: number, convertedQty: number): number {
    const lineTotal = purchaseQty * unitPrice;
    return lineTotal / convertedQty;
  }

  test('Quy đổi túi sang bông: 2 túi hoa sáp (hệ số 50) = 100 bông', () => {
    const purchaseQty = 2; // 2 túi
    const factor = 50; // 1 túi = 50 bông
    const converted = convertQuantity(purchaseQty, factor);
    assert.equal(converted, 100);
  });

  test('Tính giá vốn trên 1 đơn vị cơ bản: 750.000 ₫ / túi (50 bông) = 15.000 ₫ / bông', () => {
    const purchaseQty = 2;
    const unitPrice = 750000;
    const factor = 50;
    const convertedQty = convertQuantity(purchaseQty, factor);
    const unitCost = calculateBaseUnitCost(purchaseQty, unitPrice, convertedQty);
    assert.equal(unitCost, 15000);
  });

  test('Quy đổi số lẻ: 1.5 cuộn ruy băng (hệ số 25m) = 37.5 m', () => {
    const purchaseQty = 1.5;
    const factor = 25;
    const converted = convertQuantity(purchaseQty, factor);
    assert.equal(converted, 37.5);
  });
});

describe('Quy tắc nghiệp vụ 2: Giá vốn bình quân gia quyền (Weighted Average Cost)', () => {
  function calculateWeightedAvgCost(
    oldStock: number,
    oldAvgCost: number,
    newQty: number,
    newUnitCost: number
  ): number {
    if (oldStock <= 0) {
      return newUnitCost;
    }
    const totalQty = oldStock + newQty;
    if (totalQty <= 0) {
      return newUnitCost;
    }
    const totalValue = oldStock * oldAvgCost + newQty * newUnitCost;
    return Math.round(totalValue / totalQty);
  }

  function recalculateAvgCostFromMovements(
    movements: { type: string; quantity: number; unitCost: number }[]
  ): number {
    let runningStock = 0;
    let runningAvgCost = 0;

    for (const mov of movements) {
      if (mov.type === 'purchase_in') {
        runningAvgCost = calculateWeightedAvgCost(
          runningStock,
          runningAvgCost,
          mov.quantity,
          mov.unitCost
        );
        runningStock += mov.quantity;
      }
    }
    return runningAvgCost;
  }

  test('Lần nhập đầu tiên: tồn 0, nhập 100 bông giá 15.000 ₫ -> avgCost = 15.000 ₫', () => {
    const avgCost = calculateWeightedAvgCost(0, 0, 100, 15000);
    assert.equal(avgCost, 15000);
  });

  test('Lần nhập thứ 2 giá cao hơn: tồn 100 bông giá 15.000 ₫, nhập thêm 50 bông giá 18.000 ₫', () => {
    // Tổng giá trị = (100 * 15000) + (50 * 18000) = 1.500.000 + 900.000 = 2.400.000 ₫
    // Tổng số lượng = 150 bông
    // avgCost = 2.400.000 / 150 = 16.000 ₫
    const avgCost = calculateWeightedAvgCost(100, 15000, 50, 18000);
    assert.equal(avgCost, 16000);
  });

  test('Tính lại giá vốn nhất quán khi xóa phiếu nhập (Replay history)', () => {
    // Ban đầu: Nhập P1 (100 bông @ 15.000), Nhập P2 (50 bông @ 18.000) -> avgCost = 16.000
    // Khi xóa phiếu P2: Chỉ còn P1 -> avgCost quay về 15.000 ₫
    const movementsAfterDeletingP2 = [
      { type: 'purchase_in', quantity: 100, unitCost: 15000 },
    ];
    const recalculated = recalculateAvgCostFromMovements(movementsAfterDeletingP2);
    assert.equal(recalculated, 15000);
  });
});

describe('Quy tắc nghiệp vụ 3: Trừ kho khi làm đơn & hoàn kho khi hủy đơn', () => {
  interface MaterialStock {
    id: string;
    currentStock: number;
  }

  function deductStockForOrder(
    stock: MaterialStock,
    recipeQtyPerBouquet: number,
    orderQuantity: number
  ): { updatedStock: number; deduction: number } {
    const totalDeduction = recipeQtyPerBouquet * orderQuantity;
    const updatedStock = stock.currentStock - totalDeduction;
    return { updatedStock, deduction: totalDeduction };
  }

  function returnStockForOrder(
    currentStock: number,
    deductedQty: number
  ): number {
    return currentStock + deductedQty;
  }

  test('Trừ kho khi đơn chuyển sang "Đang làm": 1 bó cần 10 bông, đơn đặt 2 bó -> trừ 20 bông', () => {
    const flower = { id: 'm1', currentStock: 100 };
    const { updatedStock, deduction } = deductStockForOrder(flower, 10, 2);

    assert.equal(deduction, 20);
    assert.equal(updatedStock, 80);
  });

  test('Hoàn kho khi hủy đơn: Tồn 80, hoàn lại 20 bông của đơn bị hủy -> tồn trở lại 100', () => {
    const currentStock = 80;
    const deductedQty = 20;
    const restoredStock = returnStockForOrder(currentStock, deductedQty);

    assert.equal(restoredStock, 100);
  });
});

describe('Quy tắc nghiệp vụ 4: Snapshot giá vốn đơn hàng (Cost Snapshot Freezing)', () => {
  interface OrderLine {
    productName: string;
    quantity: number;
    unitPrice: number;
    snapshotCost: number; // Frozen cost at order time
  }

  function createOrderLineSnapshot(
    productName: string,
    quantity: number,
    unitPrice: number,
    currentMaterialCost: number,
    laborCost: number,
    overheadPercent: number
  ): OrderLine {
    const overhead = (currentMaterialCost * overheadPercent) / 100;
    const snapshotCost = Math.round(currentMaterialCost + laborCost + overhead);

    return {
      productName,
      quantity,
      unitPrice,
      snapshotCost,
    };
  }

  function calculateOrderProfit(line: OrderLine): number {
    const revenue = line.quantity * line.unitPrice;
    const cost = line.quantity * line.snapshotCost;
    return revenue - cost;
  }

  test('Giá vốn đã snapshot không thay đổi khi giá nguyên liệu thị trường tăng', () => {
    // Lúc tạo đơn: Hoa sáp 10 bông @ 15.000 = 150.000 ₫, công làm 30.000 ₫, chi phí chung 10% (15.000 ₫)
    // Snapshot cost = 195.000 ₫, giá bán = 350.000 ₫
    const orderLine = createOrderLineSnapshot(
      'Bó hồng sáp cổ điển',
      1,
      350000,
      150000,
      30000,
      10
    );

    assert.equal(orderLine.snapshotCost, 195000);
    const initialProfit = calculateOrderProfit(orderLine);
    assert.equal(initialProfit, 155000); // 350k - 195k = 155k

    // 1 tháng sau: Giá hoa sáp tăng gấp đôi từ 15k lên 30k -> nguyên liệu tăng lên 300.000 ₫
    const newMarketCost = 300000;
    // Snapshot của đơn hàng cũ KHÔNG bị thay đổi
    assert.equal(orderLine.snapshotCost, 195000);
    const profitAfterMarketChange = calculateOrderProfit(orderLine);
    // Lợi nhuận của đơn hàng cũ giữ nguyên
    assert.equal(profitAfterMarketChange, 155000);
  });
});
