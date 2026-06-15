"use client";

import {
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Code,
  Download,
  ExternalLink,
  FileJson,
  Film,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  Loader2,
  MessageCircle,
  Music,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CanonicalMedia,
  Destination,
  MediaType,
  demoItems,
  downloadFile,
  loadLibrary,
  mergeItems,
  parseDoubanHtml,
  parseJsonItems,
  renderExport,
  saveLibrary,
} from "@/lib/local-export";
import { doubanAccountBackupPageUrls, doubanPageUrl } from "@/lib/douban-scraper";
import type { AccountBackupType } from "@/lib/douban-scraper";
import type { EnrichResult } from "@/lib/douban-scraper";
import type { SyncResult } from "@/lib/notion-sync";
import {
  DoubanStatus,
  loadStatuses,
  mergeStatuses,
  parseStatusJson,
  renderStatusBackupJson,
  renderStatusMarkdown,
  renderStatusNotionCsv,
  saveStatuses,
} from "@/lib/status-backup";

type ExportTargetDef = {
  destination: Destination;
  label: string;
  subtitle: string;
  mediaType?: MediaType;
  icon: LucideIcon;
  iconClass: string;
  importUrl?: string;
};

type ScrapeMediaType = MediaType | "all";
type AccountBackupSelection = AccountBackupType;
type AccountBackupSectionResult = {
  section: AccountBackupSelection;
  count: number;
  pages: number;
  errors: string[];
};
type AccountBackupScrapedPage = {
  section: AccountBackupSelection;
  page: number;
  url: string;
  count: number;
};

const accountBackupOptions: Array<{ type: AccountBackupSelection; label: string }> = [
  { type: "status", label: "Statuses" },
  { type: "diary", label: "Diaries" },
  { type: "review", label: "Reviews" },
  { type: "post", label: "Posts" },
  { type: "reply", label: "Replies" },
  { type: "album", label: "Albums" },
  { type: "doulist", label: "Doulists" },
  { type: "profile", label: "Profile" },
  { type: "relationship", label: "Social" },
  { type: "event", label: "Events" },
];

const exportTargets: ExportTargetDef[] = [
  { destination: "letterboxd", label: "Letterboxd", subtitle: "watched", mediaType: "movie", icon: Clapperboard, iconClass: "text-emerald-600", importUrl: "https://letterboxd.com/import/" },
  { destination: "letterboxd-watchlist", label: "Watchlist", subtitle: "want to see", mediaType: "movie", icon: Bookmark, iconClass: "text-emerald-500", importUrl: "https://letterboxd.com/watchlist/upload/" },
  { destination: "goodreads", label: "Goodreads", subtitle: "books", mediaType: "book", icon: BookOpen, iconClass: "text-amber-600", importUrl: "https://www.goodreads.com/review/import" },
  { destination: "rateyourmusic", label: "RYM", subtitle: "music", mediaType: "music", icon: Music, iconClass: "text-purple-600", importUrl: "https://rateyourmusic.com/account/rate_albums" },
  { destination: "filmarks", label: "Filmarks", subtitle: "movies", mediaType: "movie", icon: Film, iconClass: "text-sky-500", importUrl: "https://filmarks.com/" },
  { destination: "notion", label: "Notion", subtitle: "Sync", icon: LayoutGrid, iconClass: "text-foreground" },
  { destination: "backup", label: "Backup", subtitle: "JSON", icon: HardDrive, iconClass: "text-foreground" },
];

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<CanonicalMedia[]>([]);
  const [jsonText, setJsonText] = useState("");
  const [statusJsonText, setStatusJsonText] = useState("");
  const [html, setHtml] = useState("");
  const [htmlMediaType, setHtmlMediaType] = useState<MediaType>("movie");
  const [statuses, setStatuses] = useState<DoubanStatus[]>([]);
  const [status, setStatus] = useState("Ready. Upload JSON from the extension to get started.");
  const [pasteMode, setPasteMode] = useState<"json" | "html" | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showStatusBackup, setShowStatusBackup] = useState(false);
  const [accountBackupTypes, setAccountBackupTypes] = useState<AccountBackupSelection[]>(accountBackupOptions.map((option) => option.type));
  const [accountStartPage, setAccountStartPage] = useState(1);
  const [accountEndPage, setAccountEndPage] = useState(1);
  const [accountScrapeRunning, setAccountScrapeRunning] = useState(false);
  const [accountScrapeProgress, setAccountScrapeProgress] = useState("");
  const [accountScrapeResults, setAccountScrapeResults] = useState<AccountBackupSectionResult[]>([]);

  // Scrape state
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scrapeUserId, setScrapeUserId] = useState("");
  const [scrapeMediaType, setScrapeMediaType] = useState<ScrapeMediaType>("all");
  const [scrapeWatched, setScrapeWatched] = useState(true);
  const [scrapeWishlist, setScrapeWishlist] = useState(true);
  const [scrapeCookie, setScrapeCookie] = useState("");
  const [scrapeRunning, setScrapeRunning] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState("");
  const [includeReviews, setIncludeReviews] = useState(true);

  // Enrich state
  const [enrichRunning, setEnrichRunning] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState("");

  // Notion sync state
  const [showNotion, setShowNotion] = useState(false);
  const [notionToken, setNotionToken] = useState("");
  const [notionDbId, setNotionDbId] = useState("");
  const [notionDbName, setNotionDbName] = useState("");
  const [notionTesting, setNotionTesting] = useState(false);
  const [notionSyncing, setNotionSyncing] = useState(false);
  const [notionResult, setNotionResult] = useState<SyncResult | null>(null);
  const [notionError, setNotionError] = useState("");

  const counts = useMemo(
    () => ({
      movie: items.filter((i) => i.media_type === "movie").length,
      book: items.filter((i) => i.media_type === "book").length,
      music: items.filter((i) => i.media_type === "music").length,
    }),
    [items],
  );

  useEffect(() => {
    try {
      setItems(loadLibrary());
      setStatuses(loadStatuses());
      setNotionToken(localStorage.getItem("dr_notion_token") || "");
      setNotionDbId(localStorage.getItem("dr_notion_db_id") || "");
      setNotionDbName(localStorage.getItem("dr_notion_db_name") || "");
    } catch (error) {
      setStatus(messageFrom(error));
    }
  }, []);

  function updateLibrary(nextItems: CanonicalMedia[], message: string) {
    setItems(nextItems);
    saveLibrary(nextItems);
    setStatus(message);
  }

  function importItems(incoming: CanonicalMedia[], label: string) {
    if (incoming.length === 0) { setStatus(`No items found in ${label}.`); return; }
    const next = mergeItems(items, incoming);
    updateLibrary(next, `Imported ${incoming.length} item(s) from ${label}. Library: ${next.length}.`);
  }

  function updateStatuses(next: DoubanStatus[], message: string) {
    setStatuses(next); saveStatuses(next); setStatus(message);
  }

  function importStatuses(incoming: DoubanStatus[], label: string) {
    if (incoming.length === 0) { setStatus(`No account entries in ${label}.`); return; }
    const next = mergeStatuses(statuses, incoming);
    updateStatuses(next, `Imported ${incoming.length} account entry/entries. Total: ${next.length}.`);
  }

  function importDemo() { importItems(demoItems, "demo data"); }

  function importHtml() {
    try { importItems(parseDoubanHtml(html, htmlMediaType), "pasted HTML"); setHtml(""); }
    catch (e) { setStatus(messageFrom(e)); }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      importAnyJson(await file.text(), file.name);
    }
    catch (e) { setStatus(messageFrom(e)); }
    finally { event.target.value = ""; }
  }

  function importJsonText() {
    try {
      importAnyJson(jsonText, "pasted JSON");
      setJsonText("");
    }
    catch (e) { setStatus(messageFrom(e)); }
  }

  function importStatusJsonText() {
    try { importStatuses(parseStatusJson(statusJsonText), "pasted status JSON"); setStatusJsonText(""); }
    catch (e) { setStatus(messageFrom(e)); }
  }

  async function startAccountBackupScrape() {
    const userId = scrapeUserId.trim();
    if (!userId) { setStatus("Enter a Douban user ID first."); return; }
    const startPage = Math.max(1, Math.floor(accountStartPage || 1));
    const endPage = Math.max(startPage, Math.floor(accountEndPage || startPage));
    const backupTypes = accountBackupTypes.length > 0 ? accountBackupTypes : accountBackupOptions.map((option) => option.type);
    let scraped: DoubanStatus[] = [];
    const errors: string[] = [];
    const scrapedPages: AccountBackupScrapedPage[] = [];
    const results = new Map<AccountBackupSelection, AccountBackupSectionResult>();

    setAccountScrapeRunning(true);
    setAccountScrapeProgress("Starting account backup...");
    setAccountScrapeResults([]);

    for (const backupType of backupTypes) {
      const sectionStart = backupType === "profile" ? 1 : startPage;
      const sectionEnd = backupType === "profile" ? 1 : endPage;
      results.set(backupType, { section: backupType, count: 0, pages: 0, errors: [] });
      for (let page = sectionStart; page <= sectionEnd; page += 1) {
        const urls = doubanAccountBackupPageUrls(userId, backupType, page);
        for (const [urlIndex, url] of urls.entries()) {
          const label = `${backupType} p${page}${urls.length > 1 ? `.${urlIndex + 1}` : ""}`;
          setAccountScrapeProgress(`Scraping ${label}... (${scraped.length} entries so far)`);
          try {
            const params = new URLSearchParams({ url });
            if (scrapeCookie) params.set("cookie", scrapeCookie);
            const res = await fetch(`/api/account-backup?${params}`);
            const data: { entries?: DoubanStatus[]; error?: string } = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Account backup scrape failed");
            const pageEntries = data.entries || [];
            scraped = [...scraped, ...pageEntries];
            scrapedPages.push({ section: backupType, page, url, count: pageEntries.length });
            const current = results.get(backupType)!;
            results.set(backupType, { ...current, count: current.count + pageEntries.length, pages: current.pages + 1 });
            setAccountScrapeResults(Array.from(results.values()));
            if (page < sectionEnd || urlIndex < urls.length - 1) await new Promise((r) => setTimeout(r, 600));
          } catch (e) {
            const message = `${label}: ${messageFrom(e)}`;
            errors.push(message);
            scrapedPages.push({ section: backupType, page, url, count: 0 });
            const current = results.get(backupType)!;
            results.set(backupType, { ...current, pages: current.pages + 1, errors: [...current.errors, message] });
            setAccountScrapeResults(Array.from(results.values()));
            setStatus(`Skipped ${message}`);
          }
        }
      }
    }

    setAccountScrapeProgress("");
    setAccountScrapeRunning(false);
    const annotated = scraped.map((entry) => ({
      ...entry,
      metadata: {
        ...(entry.metadata || {}),
        backup_run: {
          user_id: userId,
          selected_sections: backupTypes,
          start_page: startPage,
          end_page: endPage,
          scraped_pages: scrapedPages,
          errors,
          scraped_at: new Date().toISOString(),
        },
      },
    }));
    const next = mergeStatuses(statuses, annotated);
    updateStatuses(next, `Backed up ${annotated.length} account entrie(s) from ${backupTypes.length} section(s).${errors.length ? ` ${errors.length} section/page error(s).` : ""}`);
  }

  function exportFile(target: ExportTargetDef) {
    try {
      const f = renderExport(items, target.destination, target.mediaType, includeReviews);
      downloadFile(f);
      if (target.importUrl) {
        setStatus(`Downloaded ${f.filename} — opening ${target.label} import page…`);
        setTimeout(() => window.open(target.importUrl, "_blank", "noopener,noreferrer"), 400);
      } else {
        setStatus(`Downloaded ${f.filename}.`);
      }
    } catch (e) { setStatus(messageFrom(e)); }
  }

  function exportStatusMarkdown() {
    try { const f = renderStatusMarkdown(statuses, statuses[0]?.author.name || "Douban user"); downloadFile(f); setStatus(`Downloaded ${f.filename}.`); }
    catch (e) { setStatus(messageFrom(e)); }
  }

  function exportStatusJson() {
    try { const f = renderStatusBackupJson(statuses); downloadFile(f); setStatus(`Downloaded ${f.filename}.`); }
    catch (e) { setStatus(messageFrom(e)); }
  }

  function exportStatusNotionCsv() {
    try { const f = renderStatusNotionCsv(statuses); downloadFile(f); setStatus(`Downloaded ${f.filename}.`); }
    catch (e) { setStatus(messageFrom(e)); }
  }

  async function startScrape() {
    const userId = scrapeUserId.trim();
    if (!userId) { setStatus("Enter a Douban user ID first."); return; }

    const sections: Array<"collect" | "wish"> = [
      ...(scrapeWatched ? ["collect" as const] : []),
      ...(scrapeWishlist ? ["wish" as const] : []),
    ];
    if (sections.length === 0) { setStatus("Select at least one of Watched or Wishlist."); return; }

    setScrapeRunning(true);
    setScrapeProgress("Starting…");
    let scraped: CanonicalMedia[] = [];

    const mediaTypes: MediaType[] = scrapeMediaType === "all" ? ["movie", "book", "music"] : [scrapeMediaType];

    for (const mediaType of mediaTypes) {
      for (const section of sections) {
        let url: string | null = doubanPageUrl(userId, mediaType, section);
        let page = 0;

        while (url) {
          const label = `${mediaType} ${section === "collect" ? "watched" : "wishlist"} p${page + 1}`;
          setScrapeProgress(`Scraping ${label}… (${scraped.length} items so far)`);

          try {
            const params = new URLSearchParams({ url });
            if (scrapeCookie) params.set("cookie", scrapeCookie);
            const res: Response = await fetch(`/api/scrape?${params}`);
            const data: { items?: CanonicalMedia[]; nextUrl?: string | null; error?: string } = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Scrape failed");
            scraped = [...scraped, ...(data.items ?? [])];
            url = data.nextUrl ?? null;
            page++;
            if (url) await new Promise((r) => setTimeout(r, 600));
          } catch (e) {
            setScrapeProgress("");
            setScrapeRunning(false);
            setStatus(`Scrape error: ${messageFrom(e)}`);
            return;
          }
        }
      }
    }

    setScrapeProgress("");
    setScrapeRunning(false);
    importItems(scraped, `Douban ${scrapeMediaType === "all" ? "all-media" : scrapeMediaType} scrape for ${userId}`);
  }

  async function enrichLibrary() {
    const needsEnrich = items.filter((item) => !item.titles.en && !item.titles.original);
    if (needsEnrich.length === 0) { setStatus("All items already have original titles."); return; }

    setEnrichRunning(true);
    let enriched = 0;
    let updatedItems = [...items];

    for (let i = 0; i < needsEnrich.length; i++) {
      const item = needsEnrich[i];
      setEnrichProgress(`Fetching ${i + 1}/${needsEnrich.length} — ${item.titles.zh || item.source_id}`);
      try {
        const params = new URLSearchParams({ sourceId: item.source_id, mediaType: item.media_type });
        if (scrapeCookie) params.set("cookie", scrapeCookie);
        const res = await fetch(`/api/enrich?${params}`);
        const data = await res.json() as EnrichResult & { error?: string };
        if (res.ok && (data.originalTitle || data.imdbId || data.year)) {
          updatedItems = updatedItems.map((it) => {
            if (it.source_id !== item.source_id || it.media_type !== item.media_type) return it;
            return {
              ...it,
              titles: {
                ...it.titles,
                ...(data.originalTitle ? { en: data.originalTitle } : {}),
                ...(data.alternativeTitles?.length ? { original: data.alternativeTitles[0] } : {}),
              },
              year: it.year ?? data.year,
              external_ids: { ...it.external_ids, ...(data.imdbId ? { imdb: data.imdbId } : {}) },
            };
          });
          enriched++;
        }
      } catch { /* skip individual failures */ }
      await new Promise((r) => setTimeout(r, 400));
    }

    setEnrichRunning(false);
    setEnrichProgress("");
    updateLibrary(updatedItems, `Enriched ${enriched}/${needsEnrich.length} items with original titles.`);
  }

  async function testNotion() {
    if (!notionToken || !notionDbId) return;
    setNotionTesting(true);
    setNotionError("");
    setNotionDbName("");
    try {
      const res = await fetch(`/api/notion/test?${new URLSearchParams({ token: notionToken, databaseId: notionDbId })}`);
      const data = await res.json() as { name?: string; error?: string };
      if (!res.ok) throw new Error(data.error);
      setNotionDbName(data.name || "Connected");
      localStorage.setItem("dr_notion_token", notionToken);
      localStorage.setItem("dr_notion_db_id", notionDbId);
      localStorage.setItem("dr_notion_db_name", data.name || "");
    } catch (e) { setNotionError(messageFrom(e)); }
    finally { setNotionTesting(false); }
  }

  async function syncToNotion() {
    if (!notionToken || !notionDbId || items.length === 0) return;
    setNotionSyncing(true);
    setNotionError("");
    setNotionResult(null);
    try {
      const res = await fetch("/api/notion/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: notionToken, databaseId: notionDbId, items, includeReviews }),
      });
      const data = await res.json() as SyncResult & { error?: string };
      if (!res.ok) throw new Error(data.error);
      setNotionResult(data);
      setStatus(`Notion sync done — ${data.created} created, ${data.updated} updated.`);
    } catch (e) { setNotionError(messageFrom(e)); }
    finally { setNotionSyncing(false); }
  }

  function clearLibrary() { updateLibrary([], "Library cleared."); setShowLibrary(false); }
  function clearStatuses() { updateStatuses([], "Account backup cleared."); }

  function importAnyJson(text: string, label: string) {
    const parsed = JSON.parse(text) as { items?: unknown; entries?: unknown; statuses?: unknown };
    const hasItems = !Array.isArray(parsed) && Array.isArray(parsed.items);
    const hasEntries = !Array.isArray(parsed) && (Array.isArray(parsed.entries) || Array.isArray(parsed.statuses));

    if (hasItems) {
      const incomingItems = parseJsonItems(text);
      const nextItems = mergeItems(items, incomingItems);
      saveLibrary(nextItems);
      setItems(nextItems);
    }

    if (hasEntries) {
      const incomingStatuses = parseStatusJson(text);
      const nextStatuses = mergeStatuses(statuses, incomingStatuses);
      saveStatuses(nextStatuses);
      setStatuses(nextStatuses);
    }

    if (hasItems || hasEntries) {
      setStatus([
        hasItems ? `media library: ${items.length} -> ${mergeItems(items, parseJsonItems(text)).length}` : "",
        hasEntries ? `account backup: ${statuses.length} -> ${mergeStatuses(statuses, parseStatusJson(text)).length}` : "",
      ].filter(Boolean).join("; "));
      return;
    }

    importItems(parseJsonItems(text), label);
  }

  function togglePaste(mode: "json" | "html") {
    setPasteMode((prev) => (prev === mode ? null : mode));
  }

  function toggleAccountBackupType(type: AccountBackupSelection) {
    setAccountBackupTypes((current) => (
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    ));
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold tracking-tight">DoubanRefugee</h1>
          <div className="flex min-w-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-muted-foreground">{status}</span>
          </div>
        </header>

        {/* Library stat bar */}
        <div className="mb-5 flex items-center gap-1 rounded-2xl border bg-card p-1.5">
          <StatChip icon={Clapperboard} count={counts.movie} label="films" />
          <div className="h-5 w-px bg-border" />
          <StatChip icon={BookOpen} count={counts.book} label="books" />
          <div className="h-5 w-px bg-border" />
          <StatChip icon={Music} count={counts.music} label="music" />
          {items.length > 0 && (
            <>
              <button
                onClick={() => setShowLibrary((v) => !v)}
                className="ml-auto flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                {showLibrary ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {items.length} items
              </button>
              {(() => {
                const missing = items.filter((i) => !i.titles.en && !i.titles.original).length;
                return missing > 0 ? (
                  <button
                    onClick={enrichLibrary}
                    disabled={enrichRunning}
                    title={`${missing} items missing original title — click to fetch from Douban`}
                    className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50"
                  >
                    {enrichRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    {enrichRunning ? enrichProgress.split("—")[0]?.trim() : `Enrich ${missing}`}
                  </button>
                ) : null;
              })()}
              <button
                onClick={clearLibrary}
                title="Clear library"
                className="flex items-center rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {enrichRunning && enrichProgress && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl border bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span className="truncate">{enrichProgress}</span>
          </div>
        )}

        {/* Step 1 — Import */}
        <section className="mb-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">1 — Import</p>

          {/* Scrape — primary action */}
          <button
            onClick={() => { setScrapeOpen((v) => !v); setPasteMode(null); }}
            className={`mb-2 flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all hover:shadow-sm ${
              scrapeOpen ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            <ScanSearch className={`h-5 w-5 shrink-0 ${scrapeOpen ? "text-primary" : "text-muted-foreground"}`} />
            <div className="flex-1">
              <div className="text-sm font-semibold">Scrape from Douban</div>
              <div className="text-xs text-muted-foreground">Enter a user ID and we fetch their history automatically</div>
            </div>
            {scrapeOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {scrapeOpen && (
            <div className="mb-2 space-y-3 rounded-2xl border bg-card p-4">
              {/* User ID */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Douban User ID</label>
                <input
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                  placeholder="e.g. otterlymavis"
                  value={scrapeUserId}
                  onChange={(e) => setScrapeUserId(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Find your ID in your Douban profile URL: douban.com/people/<strong>your-id</strong>/</p>
              </div>

              {/* Media type */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Media type</label>
                <div className="flex gap-1.5">
                  {([["all", "All"], ["movie", "Movies"], ["book", "Books"], ["music", "Music"]] as const).map(([type, label]) => (
                    <button
                      key={type}
                      onClick={() => setScrapeMediaType(type)}
                      className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                        scrapeMediaType === type
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Include toggles */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Include</label>
                <div className="flex gap-2">
                  {([
                    [scrapeWatched, setScrapeWatched, "✓ Watched"] as const,
                    [scrapeWishlist, setScrapeWishlist, "🔖 Wishlist"] as const,
                  ]).map(([on, toggle, label], i) => (
                    <button
                      key={i}
                      onClick={() => toggle(!on)}
                      className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                        on ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cookie — always visible, required for books/music */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Session Cookie <span className="normal-case font-normal text-muted-foreground/70">(required for books &amp; music)</span>
                </label>
                <input
                  className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs outline-none ring-ring focus:ring-2"
                  placeholder="Paste your Douban cookie string here…"
                  value={scrapeCookie}
                  onChange={(e) => setScrapeCookie(e.target.value)}
                />
                <details className="group">
                  <summary className="cursor-pointer list-none text-[11px] text-primary hover:underline">
                    How to get your cookie ›
                  </summary>
                  <ol className="mt-2 space-y-1 rounded-xl bg-muted/60 p-3 text-[11px] text-muted-foreground list-decimal list-inside">
                    <li>Open Chrome and sign in to <strong>douban.com</strong></li>
                    <li>Press <strong>F12</strong> to open DevTools</li>
                    <li>Click the <strong>Network</strong> tab, then reload the page</li>
                    <li>Click any request to <strong>douban.com</strong> in the list</li>
                    <li>Under <strong>Request Headers</strong>, find the <strong>Cookie</strong> row</li>
                    <li>Copy the entire value and paste it above</li>
                  </ol>
                </details>
              </div>

              {/* Progress / button */}
              {scrapeProgress && (
                <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  {scrapeProgress}
                </div>
              )}

              <Button onClick={startScrape} disabled={scrapeRunning || !scrapeUserId.trim()} className="w-full gap-2">
                {scrapeRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                {scrapeRunning ? "Scraping…" : "Start Scraping"}
              </Button>
            </div>
          )}

          {/* Other import options */}
          <div className="grid grid-cols-4 gap-2">
            <ImportCard icon={FolderOpen} label="Upload JSON" onClick={() => { fileInputRef.current?.click(); setScrapeOpen(false); }} />
            <ImportCard icon={Sparkles} label="Try Demo" onClick={() => { importDemo(); setScrapeOpen(false); }} />
            <ImportCard icon={FileJson} label="Paste JSON" onClick={() => { togglePaste("json"); setScrapeOpen(false); }} active={pasteMode === "json"} />
            <ImportCard icon={Code} label="Paste HTML" onClick={() => { togglePaste("html"); setScrapeOpen(false); }} active={pasteMode === "html"} />
          </div>
          <input ref={fileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={importFile} />

          {pasteMode === "json" && (
            <div className="mt-2 space-y-2 rounded-2xl border bg-card p-4">
              <textarea
                className="min-h-[90px] w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs outline-none ring-ring focus:ring-2"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{"items":[...]} or paste the extension output directly'
              />
              <Button onClick={importJsonText} disabled={!jsonText.trim()} size="sm">Import JSON</Button>
            </div>
          )}

          {pasteMode === "html" && (
            <div className="mt-2 space-y-2 rounded-2xl border bg-card p-4">
              <div className="flex gap-1.5">
                {(["movie", "book", "music"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setHtmlMediaType(type)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      htmlMediaType === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {type === "movie" ? "🎬" : type === "book" ? "📚" : "🎵"} {type}
                  </button>
                ))}
              </div>
              <textarea
                className="min-h-[90px] w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs outline-none ring-ring focus:ring-2"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="Paste Douban page HTML here"
              />
              <Button onClick={importHtml} disabled={!html.trim()} size="sm">Import HTML</Button>
            </div>
          )}
        </section>

        {/* Step 2 — Export */}
        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">2 — Export to</p>
            <div className="flex rounded-xl border bg-card p-0.5 text-xs font-medium">
              <button
                onClick={() => setIncludeReviews(false)}
                className={`rounded-lg px-3 py-1.5 transition-colors ${!includeReviews ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                ⭐ Ratings only
              </button>
              <button
                onClick={() => setIncludeReviews(true)}
                className={`rounded-lg px-3 py-1.5 transition-colors ${includeReviews ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                ⭐📝 Ratings + Reviews
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {exportTargets.map((target) => (
              <ExportCard
                key={target.destination}
                target={target}
                disabled={items.length === 0}
                onClick={() => {
                  if (target.destination === "notion") {
                    setShowNotion((v) => !v);
                  } else {
                    exportFile(target);
                  }
                }}
              />
            ))}
          </div>
          {items.length === 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">Import data first to unlock exports</p>
          )}

          {showNotion && (
            <div className="mt-4 space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm relative">
              <button
                onClick={() => setShowNotion(false)}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <LayoutGrid className="h-4 w-4" />
                Notion API Sync
                {notionDbName && (
                  <span className="rounded-full border border-primary/20 bg-background px-2 py-0.5 text-[10px] font-medium text-primary">{notionDbName}</span>
                )}
              </div>
              
              {/* Token */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Integration Token</label>
                <input
                  type="password"
                  className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs outline-none ring-ring focus:ring-2"
                  placeholder="secret_xxxxxxxxxxxxxxxxxxxx"
                  value={notionToken}
                  onChange={(e) => { setNotionToken(e.target.value); setNotionDbName(""); }}
                />
                <details className="group">
                  <summary className="cursor-pointer list-none text-[11px] text-primary hover:underline">How to create a Notion integration ›</summary>
                  <ol className="mt-2 space-y-1 rounded-xl bg-muted/60 p-3 text-[11px] text-muted-foreground list-decimal list-inside">
                    <li>Go to <strong>notion.so/my-integrations</strong> and click <strong>New integration</strong></li>
                    <li>Name it (e.g. "DoubanRefugee"), select your workspace, click <strong>Submit</strong></li>
                    <li>Copy the <strong>Internal Integration Token</strong> (starts with <code>secret_</code>)</li>
                    <li>In your Notion database page, click <strong>⋯ → Connect to → your integration</strong></li>
                  </ol>
                </details>
              </div>

              {/* Database ID */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Database ID or URL</label>
                <input
                  className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs outline-none ring-ring focus:ring-2"
                  placeholder="https://notion.so/… or paste the database ID"
                  value={notionDbId}
                  onChange={(e) => { setNotionDbId(e.target.value); setNotionDbName(""); }}
                />
                <p className="text-[11px] text-muted-foreground">Open your Notion database, copy the URL — the ID is the 32-char hex string in it.</p>
              </div>

              {/* Required schema notice */}
              <details className="group">
                <summary className="cursor-pointer list-none text-[11px] text-primary hover:underline">Required database properties ›</summary>
                <div className="mt-2 rounded-xl bg-muted/60 p-3 text-[11px] text-muted-foreground">
                  <p className="mb-2">Your Notion database must have these properties with these exact names:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono">
                    {[["Name","Title (default)"],["Douban Key","Text"],["Douban ID","Text"],["Media Type","Select"],["Collection Status","Select"],["Rating","Number"],["Year","Number"],["Date","Date"],["Review","Text"],["Douban URL","URL"],["Tags","Multi-select"]].map(([n, t]) => (
                      <span key={n}><strong>{n}</strong> — {t}</span>
                    ))}
                  </div>
                </div>
              </details>

              {/* Error */}
              {notionError && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{notionError}</p>
              )}

              {/* Connected indicator */}
              {notionDbName && !notionError && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  Connected to <strong>{notionDbName}</strong>
                </div>
              )}

              {/* Sync result */}
              {notionResult && (
                <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  Last sync — <strong className="text-foreground">{notionResult.created}</strong> created · <strong className="text-foreground">{notionResult.updated}</strong> updated
                  {notionResult.failed > 0 && <> · <strong className="text-destructive">{notionResult.failed}</strong> failed</>}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={testNotion}
                  disabled={notionTesting || !notionToken || !notionDbId}
                  variant="secondary"
                  size="sm"
                >
                  {notionTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Test Connection
                </Button>
                <Button
                  onClick={syncToNotion}
                  disabled={notionSyncing || !notionDbName || items.length === 0}
                  size="sm"
                  className="gap-1.5"
                >
                  {notionSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {notionSyncing ? `Syncing ${items.length} items…` : "Sync Library"}
                </Button>
              </div>
              {notionSyncing && (
                <p className="text-[11px] text-muted-foreground">Syncing at ~3 items/sec to respect Notion rate limits. Don't close this tab.</p>
              )}
            </div>
          )}
        </section>

        {/* Library table (collapsible) */}
        {showLibrary && items.length > 0 && (
          <section className="mb-5 overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Year</th>
                  <th className="px-3 py-3">Rating</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={`${item.media_type}:${item.source_id}:${item.collection_status || "item"}`}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{item.titles.en || item.titles.original || item.titles.zh || item.source_id}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{item.source_id}</div>
                    </td>
                    <td className="px-3 py-2.5 capitalize text-muted-foreground">{item.media_type}</td>
                    <td className="px-3 py-2.5">{item.year || "—"}</td>
                    <td className="px-3 py-2.5">{item.rating ? `${item.rating.value}/${item.rating.scale}` : "—"}</td>
                    <td className="px-3 py-2.5 capitalize text-muted-foreground">{item.collection_status || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.consumed_date || item.marked_date || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}


        {/* Account Backup (collapsible) */}
        <section>
          <button
            onClick={() => setShowStatusBackup((v) => !v)}
            className="flex w-full items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
          >
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span>Account Backup</span>
            {statuses.length > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {statuses.length}
              </span>
            )}
            <span className="ml-auto text-muted-foreground">
              {showStatusBackup ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>

          {showStatusBackup && (
            <div className="mt-2 space-y-3 rounded-2xl border bg-card p-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Douban User ID</label>
                <input
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                  placeholder="e.g. otterlymavis"
                  value={scrapeUserId}
                  onChange={(e) => setScrapeUserId(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Account sections</label>
                    <button
                      type="button"
                      onClick={() => setAccountBackupTypes(accountBackupOptions.map((option) => option.type))}
                      className="rounded-lg px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      Whole account
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {accountBackupOptions.map((option) => (
                      <label
                        key={option.type}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                          accountBackupTypes.includes(option.type)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <input
                          checked={accountBackupTypes.includes(option.type)}
                          className="h-3.5 w-3.5"
                          onChange={() => toggleAccountBackupType(option.type)}
                          type="checkbox"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">From</label>
                  <input
                    className="w-20 rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                    min={1}
                    type="number"
                    value={accountStartPage}
                    onChange={(e) => setAccountStartPage(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">To</label>
                  <input
                    className="w-20 rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                    min={1}
                    type="number"
                    value={accountEndPage}
                    onChange={(e) => setAccountEndPage(Number(e.target.value))}
                  />
                </div>
              </div>
              {accountScrapeProgress && (
                <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  {accountScrapeProgress}
                </div>
              )}
              {accountScrapeResults.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 rounded-xl border bg-background/60 p-2 sm:grid-cols-3">
                  {accountScrapeResults.map((result) => (
                    <div key={result.section} className="rounded-lg bg-muted/50 px-2 py-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium capitalize">{result.section}</span>
                        <span className={result.errors.length ? "text-destructive" : "text-muted-foreground"}>
                          {result.count}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {result.pages} page(s){result.errors.length ? ` / ${result.errors.length} error(s)` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={startAccountBackupScrape} disabled={accountScrapeRunning || !scrapeUserId.trim()} className="w-full gap-2">
                {accountScrapeRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                {accountScrapeRunning ? "Backing up..." : "Backup Selected Account Data"}
              </Button>
              <details className="rounded-xl border bg-muted/30 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Session cookie for private posts</summary>
                <textarea
                  className="mt-2 min-h-[70px] w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs outline-none ring-ring focus:ring-2"
                  placeholder="Paste your Douban cookie string here..."
                  value={scrapeCookie}
                  onChange={(e) => setScrapeCookie(e.target.value)}
                />
              </details>
              <textarea
                className="min-h-[80px] w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs outline-none ring-ring focus:ring-2"
                value={statusJsonText}
                onChange={(e) => setStatusJsonText(e.target.value)}
                placeholder='{"entries":[...]} from the extension'
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={importStatusJsonText} disabled={!statusJsonText.trim()} variant="secondary" size="sm">
                  Import
                </Button>
                <Button onClick={exportStatusMarkdown} disabled={statuses.length === 0} size="sm">
                  <Download className="h-3.5 w-3.5" /> Markdown
                </Button>
                <Button onClick={exportStatusNotionCsv} disabled={statuses.length === 0} size="sm">
                  <Download className="h-3.5 w-3.5" /> Notion CSV
                </Button>
                <Button onClick={exportStatusJson} disabled={statuses.length === 0} variant="secondary" size="sm">
                  <Download className="h-3.5 w-3.5" /> JSON
                </Button>
                {statuses.length > 0 && (
                  <button
                    onClick={clearStatuses}
                    className="flex items-center rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {statuses.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  {statuses.slice(0, 5).map((item) => (
                    <div key={item.source_id} className="rounded-xl border bg-background/60 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">{item.entry_type || "status"} / {item.author.name || item.title || item.source_id}</span>
                        <span>{item.created_at || ""}</span>
                      </div>
                      {item.title && <p className="mt-1 text-sm font-medium leading-relaxed">{item.title}</p>}
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                  {statuses.length > 5 && (
                    <p className="text-center text-xs text-muted-foreground">+{statuses.length - 5} more entries</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatChip({ icon: Icon, count, label }: { icon: LucideIcon; count: number; label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-sm font-bold">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function ImportCard({
  icon: Icon,
  label,
  onClick,
  primary,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center text-xs font-medium transition-all active:scale-95 hover:shadow-sm ${
        primary
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : active
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card hover:bg-muted"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="leading-tight">{label}</span>
    </button>
  );
}

function ExportCard({
  target,
  disabled,
  onClick,
}: {
  target: ExportTargetDef;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = target.icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative flex flex-col items-center gap-1.5 rounded-2xl border bg-card p-3 text-center transition-all hover:border-primary hover:bg-muted/50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-35 active:scale-95"
    >
      {target.importUrl && (
        <ExternalLink className="absolute right-2 top-2 h-2.5 w-2.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      )}
      <Icon className={`h-6 w-6 transition-transform group-hover:scale-110 ${target.iconClass}`} />
      <span className="text-[11px] font-semibold leading-tight">{target.label}</span>
      <span className="text-[9px] leading-tight text-muted-foreground">{target.subtitle}</span>
    </button>
  );
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
