import { NextRequest, NextResponse } from "next/server";
import { enrichSubject } from "@/lib/douban-scraper";
import type { MediaType } from "@/lib/local-export";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sourceId = request.nextUrl.searchParams.get("sourceId");
  const mediaType = (request.nextUrl.searchParams.get("mediaType") || "movie") as MediaType;
  const cookie = request.nextUrl.searchParams.get("cookie") || undefined;

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  try {
    const result = await enrichSubject(sourceId, mediaType, cookie);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrich failed" },
      { status: 500 },
    );
  }
}
