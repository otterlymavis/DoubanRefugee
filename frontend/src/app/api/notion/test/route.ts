import { NextRequest, NextResponse } from "next/server";
import { testConnection } from "@/lib/notion-sync";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const databaseId = request.nextUrl.searchParams.get("databaseId");

  if (!token || !databaseId) {
    return NextResponse.json({ error: "token and databaseId are required" }, { status: 400 });
  }

  try {
    const info = await testConnection(token, databaseId);
    return NextResponse.json(info);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 },
    );
  }
}
