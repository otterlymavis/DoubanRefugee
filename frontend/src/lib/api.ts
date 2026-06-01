export type MediaType = "movie" | "book" | "music";
export type Destination = "letterboxd" | "filmarks" | "goodreads" | "rateyourmusic" | "archive" | "notion";
export type InterestType = "collect" | "wish" | "do";
export type MatchConfidence = "exact" | "high" | "medium" | "manual-review";

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

export type MediaItemResponse = CanonicalMedia & {
  id: string;
  created_at: string;
};

export type MatchCandidateResponse = {
  id: string;
  media_item_id: string;
  provider: string;
  provider_id: string;
  title: string;
  year?: number;
  confidence: MatchConfidence;
  score: number;
  metadata: Record<string, unknown>;
  selected: boolean;
};

export type ExportJobResponse = {
  id: string;
  status: "pending" | "running" | "done" | "error";
  destination: Destination;
  media_type?: MediaType;
  file_path?: string;
  metadata: Record<string, unknown>;
  created_at?: string;
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

// Imports
export function importBrowserExtension(items: CanonicalMedia[], userId?: string) {
  return request<{ user_id: string; snapshot_id: string; imported_count: number }>(
    "/api/v1/imports/douban/browser-extension",
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId, items, source_profile: { client: "web-wizard" } }),
    },
  );
}

export function importHtml(htmlContent: string, userId?: string) {
  return request<{ user_id: string; snapshot_id: string; imported_count: number }>(
    "/api/v1/imports/douban/html",
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId, html: htmlContent }),
    },
  );
}

// Media library
export function listMedia(userId: string, mediaType?: MediaType) {
  const params = new URLSearchParams({ user_id: userId });
  if (mediaType) params.set("media_type", mediaType);
  return request<MediaItemResponse[]>(`/api/v1/media?${params}`);
}

// Matching
export function runMatching(userId: string, mediaType: MediaType = "movie") {
  return request<{ candidate_count: number }>("/api/v1/matching/run", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, media_type: mediaType }),
  });
}

export function getReviewQueue(userId: string) {
  return request<MatchCandidateResponse[]>(`/api/v1/review-queue?user_id=${userId}`);
}

export function selectCandidate(candidateId: string, userId: string) {
  return request<MatchCandidateResponse>(`/api/v1/review-queue/${candidateId}/select`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

// Exports
export function createExport(userId: string, destination: Destination, mediaType?: MediaType) {
  return request<ExportJobResponse>("/api/v1/exports", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, destination, media_type: mediaType }),
  });
}

export function getExport(jobId: string) {
  return request<ExportJobResponse>(`/api/v1/exports/${jobId}`);
}

export function downloadUrl(jobId: string) {
  return `${API_BASE}/api/v1/exports/${jobId}/download`;
}

// Account
export function deleteAccount(userId: string) {
  return request<{ deleted: boolean }>(`/api/v1/account?user_id=${userId}`, {
    method: "DELETE",
  });
}

// Health
export function healthCheck() {
  return request<{ status: string }>("/health");
}
