export type MediaType = "movie" | "book" | "music";
export type Destination = "letterboxd" | "filmarks" | "goodreads" | "rateyourmusic" | "archive";

export type CanonicalMedia = {
  media_type: MediaType;
  source_platform: "douban";
  source_id: string;
  titles: Record<string, string>;
  year?: number;
  rating?: { value: number; scale: number };
  review?: string;
  consumed_date?: string;
  tags?: string[];
  external_ids?: Record<string, string>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export function importBrowserExtension(items: CanonicalMedia[], userId?: string) {
  return request<{ user_id: string; snapshot_id: string; imported_count: number }>("/api/v1/imports/douban/browser-extension", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, items, source_profile: { client: "web-wizard" } }),
  });
}

export function runMatching(userId: string, mediaType: MediaType = "movie") {
  return request<{ candidate_count: number }>("/api/v1/matching/run", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, media_type: mediaType }),
  });
}

export function createExport(userId: string, destination: Destination, mediaType?: MediaType) {
  return request<{ id: string; status: string; file_path?: string; metadata: Record<string, unknown> }>("/api/v1/exports", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, destination, media_type: mediaType }),
  });
}

export function downloadUrl(jobId: string) {
  return `${API_BASE}/api/v1/exports/${jobId}/download`;
}

