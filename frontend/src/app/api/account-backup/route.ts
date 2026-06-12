import { NextRequest, NextResponse } from "next/server";
import { scrapeDoubanAccountBackupPage } from "@/lib/douban-scraper";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const cookie = request.nextUrl.searchParams.get("cookie") || undefined;

  if (!url) {
    return NextResponse.json({ error: "url parameter is required" }, { status: 400 });
  }

  try {
    const result = await scrapeDoubanAccountBackupPage(url, cookie);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Account backup scrape failed" },
      { status: 500 },
    );
  }
}
