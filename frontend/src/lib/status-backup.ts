export type StatusAuthor = {
  name: string;
  uid?: string;
  link?: string;
};

export type StatusComment = {
  author: StatusAuthor;
  content: string;
};

export type StatusImage = {
  url: string;
  alt?: string;
};

export type StatusCard = {
  title?: string;
  url?: string;
  description?: string;
};

export type DoubanBackupEntryType =
  | "status"
  | "diary"
  | "review"
  | "post"
  | "reply"
  | "comment"
  | "album"
  | "photo"
  | "doulist"
  | "profile"
  | "relationship"
  | "event"
  | "note"
  | "topic"
  | "unknown";

export type DoubanStatus = {
  source_platform: "douban";
  source_id: string;
  source_url?: string;
  entry_type?: DoubanBackupEntryType;
  status_type?: string;
  title?: string;
  author: StatusAuthor;
  created_at?: string;
  activity?: string;
  rating?: string;
  content: string;
  images?: StatusImage[];
  card?: StatusCard | null;
  topic?: StatusCard | null;
  reshared_status?: Pick<DoubanStatus, "author" | "content" | "source_url" | "created_at"> | null;
  comments?: StatusComment[];
  like_count?: number;
  reshare_count?: number;
  comment_count?: number;
  metadata?: Record<string, unknown>;
};

export type StatusBackupFile = {
  filename: string;
  mimeType: string;
  content: string;
};

export const STATUS_STORAGE_KEY = "douban-refugee.status-library";

export function loadStatuses(): DoubanStatus[] {
  if (typeof window === "undefined") return [];
  return parseStatusJson(window.localStorage.getItem(STATUS_STORAGE_KEY) || "[]");
}

export function saveStatuses(statuses: DoubanStatus[]) {
  window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(statuses));
}

export function parseStatusJson(value: string): DoubanStatus[] {
  const parsed = JSON.parse(value);
  const statuses = Array.isArray(parsed) ? parsed : parsed.entries || parsed.statuses || parsed.items;
  if (!Array.isArray(statuses)) {
    throw new Error("Account backup JSON must be an array or an object with an entries/statuses array.");
  }
  return statuses.map(normalizeStatus);
}

export function mergeStatuses(existing: DoubanStatus[], incoming: DoubanStatus[]) {
  const bySource = new Map(existing.map(normalizeStatus).map((status) => [sourceKey(status), status]));
  for (const status of incoming) {
    bySource.set(sourceKey(status), normalizeStatus(status));
  }
  return Array.from(bySource.values()).sort(compareStatus);
}

export function renderStatusMarkdown(statuses: DoubanStatus[], userName = "Douban user"): StatusBackupFile {
  if (statuses.length === 0) {
    throw new Error("No Douban account entries available for Markdown export.");
  }

  const body = statuses.map(statusToMarkdown).join("\n---\n\n");
  return {
    filename: `douban-account-backup-${slugFor(userName)}-${new Date().toISOString().slice(0, 10)}.md`,
    mimeType: "text/markdown;charset=utf-8",
    content: `# Douban Account Backup - ${userName}\n\nExported at ${new Date().toISOString()}.\n\n${body}\n`,
  };
}

export function renderStatusBackupJson(statuses: DoubanStatus[]): StatusBackupFile {
  if (statuses.length === 0) {
    throw new Error("No Douban account entries available for JSON backup.");
  }

  return {
    filename: "douban-account-backup.json",
    mimeType: "application/json;charset=utf-8",
    content: JSON.stringify({
      exported_at: new Date().toISOString(),
      source_profile: {
        client: "douban-refugee-web",
        entry_count: statuses.length,
        entry_types: Array.from(new Set(statuses.map((status) => status.entry_type || "status"))).sort(),
      },
      entries: statuses,
      statuses,
    }, null, 2),
  };
}

export function renderStatusNotionCsv(statuses: DoubanStatus[]): StatusBackupFile {
  if (statuses.length === 0) {
    throw new Error("No Douban account entries available for Notion CSV export.");
  }

  return {
    filename: "notion-douban-account-backup.csv",
    mimeType: "text/csv;charset=utf-8",
    content: [
      [
        "Name",
        "Type",
        "Created At",
        "Author",
        "Status Type",
        "Activity",
        "Content",
        "Source URL",
        "Images",
        "Card",
        "Topic",
        "Reshared Content",
        "Comments",
        "Likes",
        "Reshares",
        "Responses",
        "Metadata",
      ],
      ...statuses.map((status) => [
        statusTitle(status),
        status.entry_type || "status",
        status.created_at || "",
        status.author.name || "",
        status.status_type || "",
        status.activity || "",
        status.content || "",
        status.source_url || "",
        (status.images || []).map((image) => image.url).join("\n"),
        cardSummary(status.card),
        cardSummary(status.topic),
        status.reshared_status?.content || "",
        (status.comments || []).map((comment) => `${comment.author?.name || "Unknown"}: ${comment.content}`).join("\n"),
        status.like_count ?? "",
        status.reshare_count ?? "",
        status.comment_count ?? "",
        status.metadata ? JSON.stringify(status.metadata) : "",
      ]),
    ].map((row) => row.map(csvCell).join(",")).join("\n"),
  };
}

function normalizeStatus(status: DoubanStatus): DoubanStatus {
  if (!status.source_id) {
    throw new Error("Every Douban account entry needs a source_id.");
  }

  return compactObject({
    source_platform: "douban",
    source_id: String(status.source_id),
    source_url: status.source_url || undefined,
    entry_type: status.entry_type || "status",
    status_type: status.status_type || undefined,
    title: status.title || undefined,
    author: {
      name: status.author?.name || "",
      uid: status.author?.uid || undefined,
      link: status.author?.link || undefined,
    },
    created_at: status.created_at || undefined,
    activity: status.activity || undefined,
    rating: status.rating || undefined,
    content: status.content || "",
    images: status.images || [],
    card: status.card || null,
    topic: status.topic || null,
    reshared_status: status.reshared_status || null,
    comments: status.comments || [],
    like_count: numberOrUndefined(status.like_count),
    reshare_count: numberOrUndefined(status.reshare_count),
    comment_count: numberOrUndefined(status.comment_count),
    metadata: status.metadata || undefined,
  });
}

function statusToMarkdown(status: DoubanStatus) {
  const lines = [
    `## ${status.title || status.created_at || status.source_id}`,
    "",
    `Type: ${status.entry_type || "status"}`,
    status.created_at ? `Created: ${status.created_at}` : "",
    status.author.name ? `Author: ${status.author.name}` : "",
    status.source_url ? `[Original](${status.source_url})` : "",
    status.activity ? `Activity: ${status.activity}` : "",
    status.rating ? `Rating: ${status.rating}` : "",
    "",
    status.content || "_No text content captured._",
  ].filter((line, index) => line || index < 2);

  if (status.topic?.title || status.topic?.url) {
    lines.push("", `Topic: ${linkOrText(status.topic.title || "Topic", status.topic.url)}`);
  }

  if (status.card?.title || status.card?.url || status.card?.description) {
    lines.push("", `Card: ${linkOrText(status.card.title || status.card.url || "Attached card", status.card.url)}`);
    if (status.card.description) lines.push(status.card.description);
  }

  if (status.images?.length) {
    lines.push("", "Images:");
    status.images.forEach((image) => lines.push(`- ${linkOrText(image.alt || image.url, image.url)}`));
  }

  if (status.reshared_status?.content) {
    lines.push("", "Reshared status:", "");
    lines.push(`> ${status.reshared_status.content.replace(/\n/g, "\n> ")}`);
    if (status.reshared_status.author?.name) {
      lines.push(`> - ${status.reshared_status.author.name}`);
    }
  }

  const interactionParts = [
    status.like_count !== undefined ? `${status.like_count} like(s)` : "",
    status.reshare_count !== undefined ? `${status.reshare_count} reshare(s)` : "",
    status.comment_count !== undefined ? `${status.comment_count} response(s)` : "",
  ].filter(Boolean);
  if (interactionParts.length > 0) {
    lines.push("", `Interactions: ${interactionParts.join(", ")}`);
  }

  if (status.comments?.length) {
    lines.push("", "Responses:");
    status.comments.forEach((comment, index) => {
      const author = comment.author?.name || "Unknown";
      lines.push(`${index + 1}. ${author}: ${comment.content}`);
    });
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function statusTitle(status: DoubanStatus) {
  const text = status.title || status.content || status.card?.title || status.topic?.title || status.source_id;
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function cardSummary(card?: StatusCard | null) {
  if (!card) return "";
  return [card.title, card.url, card.description].filter(Boolean).join("\n");
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function linkOrText(label: string, url?: string) {
  return url ? `[${escapeMarkdown(label)}](${url})` : escapeMarkdown(label);
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\[\]])/g, "\\$1");
}

function sourceKey(status: DoubanStatus) {
  return `${status.source_platform}:${status.entry_type || "status"}:${status.source_id}`;
}

function compareStatus(a: DoubanStatus, b: DoubanStatus) {
  return (b.created_at || "").localeCompare(a.created_at || "") || sourceKey(a).localeCompare(sourceKey(b));
}

function numberOrUndefined(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function compactObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function slugFor(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-").replace(/^-|-$/g, "") || "douban-user";
}
