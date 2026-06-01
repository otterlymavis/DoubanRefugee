"use client";

import { Archive, Check, Download, FileJson, Gauge, Languages, RefreshCcw, ShieldCheck, Upload, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CanonicalMedia, createExport, downloadUrl, importBrowserExtension, runMatching } from "@/lib/api";

const sampleItems: CanonicalMedia[] = [
  {
    media_type: "movie",
    source_platform: "douban",
    source_id: "1291557",
    titles: { zh: "花样年华", en: "In the Mood for Love", original: "花樣年華" },
    year: 2000,
    rating: { value: 5, scale: 5 },
    review: "A preserved sample entry from the onboarding wizard.",
    consumed_date: "2024-01-02",
    tags: ["douban", "migration"],
    external_ids: { imdb: "tt0118694" },
  },
  {
    media_type: "movie",
    source_platform: "douban",
    source_id: "1292720",
    titles: { zh: "阿飞正传", en: "Days of Being Wild", original: "阿飛正傳" },
    year: 1990,
    rating: { value: 4.5, scale: 5 },
    consumed_date: "2024-02-12",
    tags: ["manual-review"],
    external_ids: {},
  },
];

const phases = [
  ["Phase 1", "Douban backup and Letterboxd CSV", "active"],
  ["Phase 2", "Matching engine and manual review", "ready"],
  ["Phase 3", "Notion sync and local JSON archives", "planned"],
  ["Phase 4", "Goodreads, Filmarks, RYM adapters", "planned"],
];

export default function Home() {
  const [userId, setUserId] = useState<string>();
  const [status, setStatus] = useState("Ready to ingest a local browser-extension payload.");
  const [progress, setProgress] = useState(18);
  const [exportJobId, setExportJobId] = useState<string>();

  const matched = useMemo(() => (progress >= 70 ? 1 : 0), [progress]);

  async function handleImport() {
    setStatus("Importing canonical Douban movie history...");
    const response = await importBrowserExtension(sampleItems, userId);
    setUserId(response.user_id);
    setProgress(46);
    setStatus(`Imported ${response.imported_count} items into snapshot ${response.snapshot_id.slice(0, 8)}.`);
  }

  async function handleMatch() {
    if (!userId) return;
    setStatus("Running layered multilingual matching...");
    const response = await runMatching(userId);
    setProgress(74);
    setStatus(`Generated ${response.candidate_count} candidates. Low-confidence items are queued for review.`);
  }

  async function handleExport() {
    if (!userId) return;
    setStatus("Rendering Letterboxd CSV export...");
    const response = await createExport(userId, "letterboxd", "movie");
    setExportJobId(response.id);
    setProgress(100);
    setStatus(`Export ${response.id.slice(0, 8)} is ${response.status}.`);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="border-foreground text-foreground bg-transparent">privacy-first</Badge>
            <Badge className="text-muted-foreground border-border bg-transparent">canonical schema</Badge>
            <Badge className="text-muted-foreground border-border bg-transparent">API-first</Badge>
          </div>
          <h1 className="text-4xl font-semibold tracking-normal text-foreground md:text-5xl">Dashboard</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Preserve your Douban cultural history, normalize multilingual metadata, and migrate to Letterboxd, Notion, and robust local offline backups.
          </p>
        </div>
        <div className="grid min-w-64 grid-cols-3 gap-2 border-b bg-card p-2 font-mono text-xs">
          <Metric label="items" value={sampleItems.length.toString()} />
          <Metric label="matched" value={matched.toString()} />
          <Metric label="exports" value={exportJobId ? "1" : "0"} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-3">
          {phases.map(([phase, label, state]) => (
            <Card key={phase} className={state === "active" ? "border-foreground shadow-none" : "shadow-none"}>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{phase}</CardTitle>
                  <Badge className={`bg-transparent ${state === "active" ? "border-foreground text-foreground" : "text-muted-foreground"}`}>{state}</Badge>
                </div>
                <CardDescription>{label}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </aside>

        <section className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Migration Wizard</CardTitle>
                  <CardDescription>{status}</CardDescription>
                </div>
                <Progress value={progress} className="w-full md:w-64" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <Button onClick={handleImport} variant="default">
                  <Upload className="h-4 w-4" />
                  Import Douban
                </Button>
                <Button onClick={handleMatch} disabled={!userId} variant="secondary">
                  <WandSparkles className="h-4 w-4" />
                  Match Metadata
                </Button>
                <Button onClick={handleExport} disabled={!userId} variant="accent">
                  <Download className="h-4 w-4" />
                  Letterboxd CSV
                </Button>
              </div>
              {exportJobId ? (
                <a
                  className="mt-4 inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  href={downloadUrl(exportJobId)}
                >
                  Download generated export
                </a>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Canonical Media Ledger</CardTitle>
                <CardDescription>Destination adapters read from this normalized record, not from Douban-specific HTML.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Title</th>
                      <th>Year</th>
                      <th>Rating</th>
                      <th>Consumed</th>
                      <th>External IDs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleItems.map((item) => (
                      <tr key={item.source_id} className="border-b last:border-0">
                        <td className="py-3">
                          <div className="font-medium">{item.titles.en}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {item.titles.zh} · {item.source_id}
                          </div>
                        </td>
                        <td>{item.year}</td>
                        <td>
                          {item.rating?.value}/{item.rating?.scale}
                        </td>
                        <td>{item.consumed_date}</td>
                        <td className="font-mono text-xs">{Object.keys(item.external_ids ?? {}).join(", ") || "pending"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Manual Review Queue</CardTitle>
                <CardDescription>Uncertain matches stay visible until a user-selected mapping is persisted.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ReviewRow icon={Languages} title="Chinese / English aliases" detail="花樣年華 resolves through alternate titles before fuzzy scoring." />
                <ReviewRow icon={Gauge} title="Confidence tiers" detail="Exact, high, medium, and manual-review scores are stored per candidate." />
                <ReviewRow icon={RefreshCcw} title="Correction memory" detail="Manual selections become reusable mappings for future exports." />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Capability icon={ShieldCheck} title="No passwords" text="Cookies are optional and encrypted; browser extraction is preferred." />
            <Capability icon={FileJson} title="Local Backups" text="JSON and CSV outputs preserve your record completely offline." />
            <Capability icon={RefreshCcw} title="Notion Sync" text="Push rich media items directly into your Notion workspace." />
            <Capability icon={Check} title="Other Adapters" text="Migrate easily to Letterboxd, Goodreads, and Filmarks." />
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm p-3 border border-border bg-background">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function ReviewRow({ icon: Icon, title, detail }: { icon: typeof Languages; title: string; detail: string }) {
  return (
    <div className="flex gap-3 border-b bg-background p-3 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 text-foreground" />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

function Capability({ icon: Icon, title, text }: { icon: typeof Archive; title: string; text: string }) {
  return (
    <Card className="shadow-none">
      <CardHeader className="p-4">
        <Icon className="h-5 w-5 text-foreground" />
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
    </Card>
  );
}
