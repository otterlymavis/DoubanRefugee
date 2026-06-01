import { NextRequest, NextResponse } from "next/server";
import { syncLibrary } from "@/lib/notion-sync";
import type { CanonicalMedia } from "@/lib/local-export";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for large libraries

export async function POST(request: NextRequest) {
  const { token, databaseId, items, includeReviews } = (await request.json()) as {
    token: string;
    databaseId: string;
    items: CanonicalMedia[];
    includeReviews: boolean;
  };

  if (!token || !databaseId || !Array.isArray(items)) {
    return NextResponse.json({ error: "token, databaseId, and items are required" }, { status: 400 });
  }

  try {
    const result = await syncLibrary(token, databaseId, items, includeReviews);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 },
    );
  }
}
