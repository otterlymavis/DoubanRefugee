"use client";

import { Archive, Database, Download, FileJson, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const exportTargets: {
  destination: Destination;
  label: string;
  mediaType?: MediaType;
  variant?: "secondary" | "accent";
}[] = [
  { destination: "letterboxd", label: "Letterboxd watched CSV", mediaType: "movie", variant: "accent" },
  { destination: "letterboxd-watchlist", label: "Letterboxd watchlist CSV", mediaType: "movie", variant: "accent" },
  { destination: "filmarks", label: "Filmarks transfer CSV", mediaType: "movie", variant: "secondary" },
  { destination: "goodreads", label: "Goodreads import CSV", mediaType: "book", variant: "secondary" },
  { destination: "rateyourmusic", label: "RateYourMusic transfer CSV", mediaType: "music", variant: "secondary" },
  { destination: "notion", label: "Notion media database CSV", variant: "accent" },
  { destination: "backup", label: "Full backup JSON", variant: "accent" },
];

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<CanonicalMedia[]>([]);
  const [jsonText, setJsonText] = useState("");
  const [statusJsonText, setStatusJsonText] = useState("");
  const [html, setHtml] = useState("");
  const [htmlMediaType, setHtmlMediaType] = useState<MediaType>("movie");
  const [statuses, setStatuses] = useState<DoubanStatus[]>([]);
  const [status, setStatus] = useState("Scrape your whole Douban movie, book, or music history with the extension, import JSON here, then export transfer files.");

  const counts = useMemo(
    () => ({
      movie: items.filter((item) => item.media_type === "movie").length,
      book: items.filter((item) => item.media_type === "book").length,
      music: items.filter((item) => item.media_type === "music").length,
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
    if (incoming.length === 0) {
      setStatus(`No items found in ${label}.`);
      return;
    }
    const nextItems = mergeItems(items, incoming);
    updateLibrary(nextItems, `Imported ${incoming.length} item(s) from ${label}. Library now has ${nextItems.length}.`);
  }

  function updateStatuses(nextStatuses: DoubanStatus[], message: string) {
    setStatuses(nextStatuses);
    saveStatuses(nextStatuses);
    setStatus(message);
  }

  function importStatuses(incoming: DoubanStatus[], label: string) {
    if (incoming.length === 0) {
      setStatus(`No statuses found in ${label}.`);
      return;
    }
    const nextStatuses = mergeStatuses(statuses, incoming);
    updateStatuses(nextStatuses, `Imported ${incoming.length} Douban status(es) from ${label}. Status backup now has ${nextStatuses.length}.`);
  }

  function importDemo() {
    importItems(demoItems, "demo data");
  }

  function importHtml() {
    try {
      importItems(parseDoubanHtml(html, htmlMediaType), "pasted Douban HTML");
      setHtml("");
    } catch (error) {
      setStatus(messageFrom(error));
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      importItems(parseJsonItems(await file.text()), file.name);
    } catch (error) {
      setStatus(messageFrom(error));
    } finally {
      event.target.value = "";
    }
  }

  function importJsonText() {
    try {
      importItems(parseJsonItems(jsonText), "pasted JSON");
      setJsonText("");
    } catch (error) {
      setStatus(messageFrom(error));
    }
  }

  function importStatusJsonText() {
    try {
      importStatuses(parseStatusJson(statusJsonText), "pasted status JSON");
      setStatusJsonText("");
    } catch (error) {
      setStatus(messageFrom(error));
    }
  }

  function exportFile(target: (typeof exportTargets)[number]) {
    try {
      const file = renderExport(items, target.destination, target.mediaType);
      downloadFile(file);
      setStatus(`Downloaded ${file.filename}.`);
    } catch (error) {
      setStatus(messageFrom(error));
    }
  }

  function exportStatusMarkdown() {
    try {
      const file = renderStatusMarkdown(statuses, statuses[0]?.author.name || "Douban user");
      downloadFile(file);
      setStatus(`Downloaded ${file.filename}.`);
    } catch (error) {
      setStatus(messageFrom(error));
    }
  }

  function exportStatusJson() {
    try {
      const file = renderStatusBackupJson(statuses);
      downloadFile(file);
      setStatus(`Downloaded ${file.filename}.`);
    } catch (error) {
      setStatus(messageFrom(error));
    }
  }

  function exportStatusNotionCsv() {
    try {
      const file = renderStatusNotionCsv(statuses);
      downloadFile(file);
      setStatus(`Downloaded ${file.filename}. Import it into Notion as a database.`);
    } catch (error) {
      setStatus(messageFrom(error));
    }
  }

  function clearLibrary() {
    updateLibrary([], "Local library cleared.");
  }

  function clearStatuses() {
    updateStatuses([], "Local status backup cleared.");
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-normal text-foreground md:text-3xl">DoubanRefugee</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Import Douban media or status JSON, keep it local, and export transfer or backup files.
            </p>
          </div>
          <div className="grid w-full grid-cols-5 gap-2 font-mono text-xs md:w-auto md:min-w-[420px]">
            <Metric label="items" value={items.length.toString()} />
            <Metric label="movies" value={counts.movie.toString()} />
            <Metric label="books" value={counts.book.toString()} />
            <Metric label="music" value={counts.music.toString()} />
            <Metric label="statuses" value={statuses.length.toString()} />
          </div>
        </header>

        <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Status:</span> {status}
        </div>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4 text-primary" />Import</CardTitle>
                <CardDescription>Import the JSON produced by the extension's Douban history scraper.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <Button onClick={importDemo}>
                    <Upload className="h-4 w-4" />
                    Import Demo
                  </Button>
                  <Button onClick={() => fileInputRef.current?.click()} variant="secondary">
                    <FileJson className="h-4 w-4" />
                    Import JSON
                  </Button>
                </div>
                <input ref={fileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={importFile} />

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Scraped Douban JSON or backup JSON</label>
                  <textarea
                    className="min-h-24 w-full rounded-md border bg-background p-3 font-mono text-xs outline-none ring-ring focus:ring-2"
                    onChange={(event) => setJsonText(event.target.value)}
                    placeholder='{"items":[...]}'
                    value={jsonText}
                  />
                  <Button onClick={importJsonText} variant="secondary" disabled={!jsonText.trim()}>
                    Import Pasted JSON
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Pasted HTML media type</label>
                  <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/55 p-1">
                    {(["movie", "book", "music"] as const).map((type) => (
                      <Button key={type} onClick={() => setHtmlMediaType(type)} variant={htmlMediaType === type ? "default" : "secondary"} size="sm">
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>
                <textarea
                  className="min-h-28 w-full rounded-md border bg-background p-3 font-mono text-xs outline-none ring-ring focus:ring-2"
                  onChange={(event) => setHtml(event.target.value)}
                  placeholder="<li class='subject-item'>...</li>"
                  value={html}
                />
                <Button onClick={importHtml} variant="secondary" disabled={!html.trim()}>
                  Import Pasted HTML
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Archive className="h-4 w-4 text-primary" />Status Backup</CardTitle>
                <CardDescription>Import Douban broadcast/status JSON from the extension and export a readable Markdown archive.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  className="min-h-28 w-full rounded-md border bg-background p-3 font-mono text-xs outline-none ring-ring focus:ring-2"
                  onChange={(event) => setStatusJsonText(event.target.value)}
                  placeholder='{"statuses":[...]}'
                  value={statusJsonText}
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <Button onClick={importStatusJsonText} variant="secondary" disabled={!statusJsonText.trim()}>
                    <FileJson className="h-4 w-4" />
                    Import Status JSON
                  </Button>
                  <Button onClick={exportStatusMarkdown} disabled={statuses.length === 0} variant="accent">
                    <Download className="h-4 w-4" />
                    Export Status Markdown
                  </Button>
                  <Button onClick={exportStatusNotionCsv} disabled={statuses.length === 0} variant="accent">
                    <Download className="h-4 w-4" />
                    Export Notion Status CSV
                  </Button>
                  <Button onClick={exportStatusJson} disabled={statuses.length === 0} variant="secondary">
                    <Archive className="h-4 w-4" />
                    Export Status JSON
                  </Button>
                  <Button onClick={clearStatuses} disabled={statuses.length === 0} variant="ghost">
                    <Trash2 className="h-4 w-4" />
                    Clear Status Backup
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download className="h-4 w-4 text-primary" />Export</CardTitle>
                <CardDescription>Generate files to import or use as staging data on the destination site.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {exportTargets.map((target) => (
                  <Button key={target.destination} onClick={() => exportFile(target)} disabled={items.length === 0} variant={target.variant ?? "secondary"}>
                    <Download className="h-4 w-4" />
                    {target.label}
                  </Button>
                ))}
                <Button onClick={clearLibrary} disabled={items.length === 0} variant="ghost">
                  <Trash2 className="h-4 w-4" />
                  Clear Local Library
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" />Local Library</CardTitle>
                <CardDescription>{items.length} media item(s) saved in this browser.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto scrollbar-thin">
                {items.length === 0 ? (
                  <div className="rounded-md border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                    No data imported yet. Use the extension to scrape your Douban collection/history pages, then import the JSON here.
                  </div>
                ) : (
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2">Title</th>
                        <th>Type</th>
                        <th>Year</th>
                        <th>Rating</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>External IDs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={`${item.media_type}:${item.source_id}:${item.collection_status || "item"}`} className="border-b transition-colors last:border-0 hover:bg-muted/30">
                          <td className="py-3">
                            <div className="font-medium">{item.titles.en || item.titles.original || item.titles.zh || item.source_id}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {item.titles.zh || "Douban"} - {item.source_id}
                            </div>
                          </td>
                          <td>{item.media_type}</td>
                          <td>{item.year || ""}</td>
                          <td>{item.rating ? `${item.rating.value}/${item.rating.scale}` : ""}</td>
                          <td>{item.collection_status || ""}</td>
                          <td>{item.consumed_date || item.marked_date || ""}</td>
                          <td className="font-mono text-xs">{Object.keys(item.external_ids ?? {}).join(", ") || "none"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Douban Statuses</CardTitle>
                <CardDescription>Broadcast/status backup imported from the extension, including text, images, cards, reposts, comments, and interaction counts when Douban exposes them.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statuses.length === 0 ? (
                  <div className="rounded-md border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                    No statuses imported yet. Open a Douban statuses page with the extension, scrape status backup JSON, then import it here.
                  </div>
                ) : (
                  statuses.slice(0, 12).map((item) => (
                    <div key={item.source_id} className="rounded-md border bg-card p-4 transition-colors hover:bg-muted/25">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{item.author.name || "Douban user"}</span>
                        <span>{item.created_at || "unknown time"}</span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-6">{item.content || "No text content captured."}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {item.images?.length ? <span>{item.images.length} image(s)</span> : null}
                        {item.comments?.length ? <span>{item.comments.length} response(s)</span> : null}
                        {item.reshared_status ? <span>reshare</span> : null}
                        {item.card ? <span>card</span> : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-lg font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
