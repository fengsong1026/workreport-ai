import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/health
 *
 * 健康检查接口，无需认证。用于 Docker health check 和部署后验证。
 */
export async function GET() {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    // DB 不可用时返回 503
  }

  if (!dbOk) {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString(), db: false },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    db: true,
  });
}
