export type MediaType = "movie" | "book" | "music";
export type Destination = "letterboxd" | "filmarks" | "goodreads" | "rateyourmusic" | "archive";

export type CanonicalMedia = {
  id?: string;
  media_type: MediaType;
  source_platform: "douban";
  source_id: string;
  titles: Record<string, string>;
  year?: number;
  rating?: { value: number; scale: number } | null;
  review?: string | null;
  consumed_date?: string | null;
  tags?: string[];
  external_ids?: Record<string, string>;
  created_at?: string;
};

type ImportResponse = {
  user_id: string;
  snapshot_id: string;
  imported_count: number;
};

export type ExportJob = {
  id: string;
  user_id: string;
  destination: Destination;
  media_type?: MediaType | null;
  status: string;
  file_path?: string | null;
  error?: string | null;
};

export type ApiClient = ReturnType<typeof makeApiClient>;

export function makeApiClient(apiBase: string) {
  const baseUrl = apiBase.trim().replace(/\/+$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`API ${response.status}: ${await response.text()}`);
    }
    return response.json() as Promise<T>;
  }

  return {
    baseUrl,
    importCanonical(items: CanonicalMedia[], userId?: string) {
      return request<ImportResponse>("/api/v1/imports/douban/browser-extension", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId || null,
          items,
          source_profile: { client: "expo-mobile" },
        }),
      });
    },
    importHtml(html: string, mediaType: MediaType, userId?: string) {
      return request<ImportResponse>("/api/v1/imports/douban/html", {
        method: "POST",
        body: JSON.stringify({ user_id: userId || null, media_type: mediaType, html }),
      });
    },
    listMedia(userId: string) {
      return request<CanonicalMedia[]>(`/api/v1/media?user_id=${encodeURIComponent(userId)}`);
    },
    runMatching(userId: string, mediaType: MediaType) {
      return request<{ candidate_count: number }>("/api/v1/matching/run", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, media_type: mediaType }),
      });
    },
    createExport(userId: string, destination: Destination, mediaType?: MediaType) {
      return request<ExportJob>("/api/v1/exports", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, destination, media_type: mediaType || null }),
      });
    },
    downloadUrl(jobId: string) {
      return `${baseUrl}/api/v1/exports/${jobId}/download`;
    },
  };
}
