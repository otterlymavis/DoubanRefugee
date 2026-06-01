import type { CanonicalMedia } from "./local-export";

const NOTION_VERSION = "2022-06-28";
const BASE = "https://api.notion.com/v1";

export type SyncResult = { created: number; updated: number; failed: number };
export type DatabaseInfo = { id: string; name: string };

async function notionFetch(
  path: string,
  token: string,
  method: "GET" | "POST" | "PATCH",
  body?: unknown,
  retries = 4,
): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 429 && retries > 0) {
    const wait = Number(res.headers.get("Retry-After") || "1") * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return notionFetch(path, token, method, body, retries - 1);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || `Notion API ${res.status}`);
  }

  return res.json();
}

export async function testConnection(token: string, databaseId: string): Promise<DatabaseInfo> {
  const id = normaliseDatabaseId(databaseId);
  const db = await notionFetch(`/databases/${id}`, token, "GET") as {
    id: string;
    title: Array<{ plain_text: string }>;
  };
  return {
    id: db.id,
    name: db.title?.[0]?.plain_text || "Untitled",
  };
}

export async function syncLibrary(
  token: string,
  databaseId: string,
  items: CanonicalMedia[],
  includeReviews: boolean,
): Promise<SyncResult> {
  const id = normaliseDatabaseId(databaseId);
  const existing = await indexExistingPages(token, id);
  const result: SyncResult = { created: 0, updated: 0, failed: 0 };

  for (const item of items) {
    const key = `${item.media_type}:${item.source_id}:${item.collection_status || "item"}`;
    const props = buildProperties(item, includeReviews);
    try {
      const pageId = existing.get(key);
      if (pageId) {
        await notionFetch(`/pages/${pageId}`, token, "PATCH", { properties: props });
        result.updated++;
      } else {
        await notionFetch("/pages", token, "POST", {
          parent: { database_id: id },
          properties: props,
        });
        result.created++;
      }
    } catch {
      result.failed++;
    }
    // stay under Notion's 3 req/s average
    await new Promise((r) => setTimeout(r, 340));
  }

  return result;
}

async function indexExistingPages(token: string, databaseId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let cursor: string | undefined;

  do {
    const res = await notionFetch(`/databases/${databaseId}/query`, token, "POST", {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    }) as {
      results: Array<{
        id: string;
        properties: {
          "Douban Key"?: { rich_text: Array<{ plain_text: string }> };
        };
      }>;
      has_more: boolean;
      next_cursor: string | null;
    };

    for (const page of res.results) {
      const key = page.properties?.["Douban Key"]?.rich_text?.[0]?.plain_text;
      if (key) map.set(key, page.id);
    }

    cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
  } while (cursor);

  return map;
}

function buildProperties(item: CanonicalMedia, includeReviews: boolean): Record<string, unknown> {
  const title = item.titles.en || item.titles.original || item.titles.zh || item.source_id;
  const key = `${item.media_type}:${item.source_id}:${item.collection_status || "item"}`;

  const props: Record<string, unknown> = {
    Name: { title: [{ text: { content: title } }] },
    "Douban Key": { rich_text: [{ text: { content: key } }] },
    "Douban ID": { rich_text: [{ text: { content: item.source_id } }] },
    "Media Type": { select: { name: item.media_type } },
    "Collection Status": { select: { name: item.collection_status || "unknown" } },
  };

  if (item.rating?.value != null) props["Rating"] = { number: item.rating.value };
  if (item.year) props["Year"] = { number: item.year };

  const date = item.consumed_date || item.marked_date;
  if (date) props["Date"] = { date: { start: date } };

  if (includeReviews && item.review) {
    props["Review"] = { rich_text: [{ text: { content: item.review.slice(0, 2000) } }] };
  }

  if (item.source_url) props["Douban URL"] = { url: item.source_url };

  if (item.tags?.length) {
    props["Tags"] = {
      multi_select: item.tags.slice(0, 10).map((t) => ({ name: t.slice(0, 100) })),
    };
  }

  return props;
}

function normaliseDatabaseId(raw: string): string {
  // Accept full Notion URLs or bare IDs, strip hyphens
  const match = raw.match(/([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})/i);
  return match ? match[1] : raw.trim();
}
