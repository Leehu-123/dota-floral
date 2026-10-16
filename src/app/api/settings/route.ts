import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const settings = await prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });

    const settingsMap: Record<string, string> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error('Lỗi khi lấy cài đặt hệ thống:', error);
    return NextResponse.json(
      { error: 'Không thể tải cài đặt hệ thống' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Dữ liệu không hợp lệ, yêu cầu đối tượng key-value' },
        { status: 400 }
      );
    }

    const entries = Object.entries(body);
    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'Không có cài đặt nào được gửi lên để cập nhật' },
        { status: 400 }
      );
    }

    // Cập nhật hoặc tạo mới từng cài đặt trong Prisma transaction
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: {
            key,
            value: String(value),
          },
        })
      )
    );

    const updatedSettings = await prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });

    const resultMap: Record<string, string> = {};
    for (const s of updatedSettings) {
      resultMap[s.key] = s.value;
    }

    return NextResponse.json(resultMap);
  } catch (error) {
    console.error('Lỗi khi cập nhật cài đặt hệ thống:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật cài đặt hệ thống' },
      { status: 500 }
    );
  }
}
