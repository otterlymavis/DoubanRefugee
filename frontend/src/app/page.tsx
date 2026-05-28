"use client";

import { Archive, Download, FileJson, ShieldCheck, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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

const exportTargets: {
  destination: Destination;
  label: string;
  mediaType?: MediaType;
  variant?: "secondary" | "accent";
}[] = [
  { destination: "letterboxd", label: "Letterboxd import CSV", mediaType: "movie", variant: "accent" },
  { destination: "filmarks", label: "Filmarks transfer CSV", mediaType: "movie", variant: "secondary" },
  { destination: "goodreads", label: "Goodreads import CSV", mediaType: "book", variant: "secondary" },
  { destination: "rateyourmusic", label: "RateYourMusic transfer CSV", mediaType: "music", variant: "secondary" },
  { destination: "backup", label: "Full backup JSON", variant: "accent" },
];

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<CanonicalMedia[]>([]);
  const [jsonText, setJsonText] = useState("");
  const [html, setHtml] = useState("");
  const [htmlMediaType, setHtmlMediaType] = useState<MediaType>("movie");
  const [status, setStatus] = useState("Scrape your whole Douban history with the extension, import JSON here, then export transfer files.");

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

  function exportFile(target: (typeof exportTargets)[number]) {
    try {
      const file = renderExport(items, target.destination, target.mediaType);
      downloadFile(file);
      setStatus(`Downloaded ${file.filename}.`);
    } catch (error) {
      setStatus(messageFrom(error));
    }
  }

  function clearLibrary() {
    updateLibrary([], "Local library cleared.");
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b bg-background/80 pb-6 backdrop-blur md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-primary/30 text-primary">Douban scraper</Badge>
              <Badge>transfer files</Badge>
              <Badge>local-only</Badge>
            </div>
            <h1 className="text-4xl font-semibold tracking-normal text-foreground md:text-6xl">DoubanRefugee</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              Scrape your whole logged-in Douban movie, book, and music history, then turn it into files for Letterboxd, Filmarks, Goodreads,
              RateYourMusic, or a full backup. Your data stays on this device unless you export it.
            </p>
          </div>
          <div className="grid min-w-72 grid-cols-4 gap-2 rounded-md border bg-card p-2 font-mono text-xs ledger-panel">
            <Metric label="items" value={items.length.toString()} />
            <Metric label="movies" value={counts.movie.toString()} />
            <Metric label="books" value={counts.book.toString()} />
            <Metric label="music" value={counts.music.toString()} />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Import</CardTitle>
                <CardDescription>Import the JSON produced by the extension's whole-history Douban scraper.</CardDescription>
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
                    className="min-h-24 w-full rounded-md border bg-background p-3 text-sm outline-none ring-ring focus:ring-2"
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
                  <div className="grid grid-cols-3 gap-2">
                    {(["movie", "book", "music"] as const).map((type) => (
                      <Button key={type} onClick={() => setHtmlMediaType(type)} variant={htmlMediaType === type ? "default" : "secondary"} size="sm">
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>
                <textarea
                  className="min-h-28 w-full rounded-md border bg-background p-3 text-sm outline-none ring-ring focus:ring-2"
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
                <CardTitle>Export</CardTitle>
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

          <div className="space-y-6">
            <Card className="ledger-panel">
              <CardHeader>
                <CardTitle>Local Library</CardTitle>
                <CardDescription>{status}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {items.length === 0 ? (
                  <div className="rounded-md border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                    No data imported yet. Use the extension to scrape your whole Douban collection/history, then import the JSON here.
                  </div>
                ) : (
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2">Title</th>
                        <th>Type</th>
                        <th>Year</th>
                        <th>Rating</th>
                        <th>Consumed</th>
                        <th>External IDs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={`${item.media_type}:${item.source_id}`} className="border-b last:border-0">
                          <td className="py-3">
                            <div className="font-medium">{item.titles.en || item.titles.original || item.titles.zh || item.source_id}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {item.titles.zh || "Douban"} - {item.source_id}
                            </div>
                          </td>
                          <td>{item.media_type}</td>
                          <td>{item.year || ""}</td>
                          <td>{item.rating ? `${item.rating.value}/${item.rating.scale}` : ""}</td>
                          <td>{item.consumed_date || ""}</td>
                          <td className="font-mono text-xs">{Object.keys(item.external_ids ?? {}).join(", ") || "none"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Capability icon={ShieldCheck} title="Own-History Scrape" text="The extension runs in your logged-in browser session and follows Douban pagination." />
              <Capability icon={FileJson} title="Backup JSON" text="Download a full canonical backup you can re-import later." />
              <Capability icon={Archive} title="Transfer Files" text="Export Letterboxd, Filmarks, Goodreads, and RateYourMusic files." />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-muted/60 p-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function Capability({ icon: Icon, title, text }: { icon: typeof Archive; title: string; text: string }) {
  return (
    <Card>
      <CardHeader className="p-4">
        <Icon className="h-5 w-5 text-primary" />
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
