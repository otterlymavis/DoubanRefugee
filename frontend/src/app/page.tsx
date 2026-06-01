"use client";

import {
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Code,
  Download,
  FileJson,
  Film,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  MessageCircle,
  Music,
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
};

const exportTargets: ExportTargetDef[] = [
  { destination: "letterboxd", label: "Letterboxd", subtitle: "watched", mediaType: "movie", icon: Clapperboard, iconClass: "text-emerald-600" },
  { destination: "letterboxd-watchlist", label: "Watchlist", subtitle: "want to see", mediaType: "movie", icon: Bookmark, iconClass: "text-emerald-500" },
  { destination: "goodreads", label: "Goodreads", subtitle: "books", mediaType: "book", icon: BookOpen, iconClass: "text-amber-600" },
  { destination: "rateyourmusic", label: "RYM", subtitle: "music", mediaType: "music", icon: Music, iconClass: "text-purple-600" },
  { destination: "filmarks", label: "Filmarks", subtitle: "movies", mediaType: "movie", icon: Film, iconClass: "text-sky-500" },
  { destination: "notion", label: "Notion", subtitle: "CSV", icon: LayoutGrid, iconClass: "text-primary" },
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
    if (incoming.length === 0) { setStatus(`No statuses in ${label}.`); return; }
    const next = mergeStatuses(statuses, incoming);
    updateStatuses(next, `Imported ${incoming.length} status(es). Total: ${next.length}.`);
  }

  function importDemo() { importItems(demoItems, "demo data"); }

  function importHtml() {
    try { importItems(parseDoubanHtml(html, htmlMediaType), "pasted HTML"); setHtml(""); }
    catch (e) { setStatus(messageFrom(e)); }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try { importItems(parseJsonItems(await file.text()), file.name); }
    catch (e) { setStatus(messageFrom(e)); }
    finally { event.target.value = ""; }
  }

  function importJsonText() {
    try { importItems(parseJsonItems(jsonText), "pasted JSON"); setJsonText(""); }
    catch (e) { setStatus(messageFrom(e)); }
  }

  function importStatusJsonText() {
    try { importStatuses(parseStatusJson(statusJsonText), "pasted status JSON"); setStatusJsonText(""); }
    catch (e) { setStatus(messageFrom(e)); }
  }

  function exportFile(target: ExportTargetDef) {
    try { const f = renderExport(items, target.destination, target.mediaType); downloadFile(f); setStatus(`Downloaded ${f.filename}.`); }
    catch (e) { setStatus(messageFrom(e)); }
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

  function clearLibrary() { updateLibrary([], "Library cleared."); setShowLibrary(false); }
  function clearStatuses() { updateStatuses([], "Status backup cleared."); }

  function togglePaste(mode: "json" | "html") {
    setPasteMode((prev) => (prev === mode ? null : mode));
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

        {/* Step 1 — Import */}
        <section className="mb-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">1 — Import</p>

          <div className="grid grid-cols-4 gap-2">
            <ImportCard icon={FolderOpen} label="Upload JSON" onClick={() => fileInputRef.current?.click()} primary />
            <ImportCard icon={Sparkles} label="Try Demo" onClick={importDemo} />
            <ImportCard icon={FileJson} label="Paste JSON" onClick={() => togglePaste("json")} active={pasteMode === "json"} />
            <ImportCard icon={Code} label="Paste HTML" onClick={() => togglePaste("html")} active={pasteMode === "html"} />
          </div>
          <input ref={fileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={importFile} />

          {pasteMode === "json" && (
            <div className="mt-3 space-y-2 rounded-2xl border bg-card p-4">
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
            <div className="mt-3 space-y-2 rounded-2xl border bg-card p-4">
              <div className="flex gap-1.5">
                {(["movie", "book", "music"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setHtmlMediaType(type)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      htmlMediaType === type
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
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
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">2 — Export to</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {exportTargets.map((target) => (
              <ExportCard
                key={target.destination}
                target={target}
                disabled={items.length === 0}
                onClick={() => exportFile(target)}
              />
            ))}
          </div>
          {items.length === 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">Import data first to unlock exports</p>
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

        {/* Status Backup (collapsible) */}
        <section>
          <button
            onClick={() => setShowStatusBackup((v) => !v)}
            className="flex w-full items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
          >
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span>Status Backup</span>
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
              <textarea
                className="min-h-[80px] w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs outline-none ring-ring focus:ring-2"
                value={statusJsonText}
                onChange={(e) => setStatusJsonText(e.target.value)}
                placeholder='{"statuses":[...]} from the extension'
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
                        <span className="font-medium">{item.author.name}</span>
                        <span>{item.created_at || ""}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                  {statuses.length > 5 && (
                    <p className="text-center text-xs text-muted-foreground">+{statuses.length - 5} more statuses</p>
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
      className="group flex flex-col items-center gap-1.5 rounded-2xl border bg-card p-3 text-center transition-all hover:border-primary hover:bg-muted/50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-35 active:scale-95"
    >
      <Icon className={`h-6 w-6 transition-transform group-hover:scale-110 ${target.iconClass}`} />
      <span className="text-[11px] font-semibold leading-tight">{target.label}</span>
      <span className="text-[9px] leading-tight text-muted-foreground">{target.subtitle}</span>
    </button>
  );
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
