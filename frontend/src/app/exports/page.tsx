"use client";

import { Download, FileArchive, FileSpreadsheet, Loader2, PlusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type Destination, type ExportJobResponse, type MediaType, createExport, downloadUrl } from "@/lib/api";

const DESTINATIONS: { value: Destination; label: string; description: string; mediaTypes: MediaType[] }[] = [
  { value: "letterboxd", label: "Letterboxd", description: "CSV import for movie diary and ratings", mediaTypes: ["movie"] },
  { value: "filmarks", label: "Filmarks", description: "CSV import for Japanese movie tracker", mediaTypes: ["movie"] },
  { value: "goodreads", label: "Goodreads", description: "CSV import for book ratings and reviews", mediaTypes: ["book"] },
  { value: "rateyourmusic", label: "RateYourMusic", description: "CSV import for music ratings", mediaTypes: ["music"] },
  { value: "archive", label: "Full Archive", description: "ZIP bundle with JSON, CSV, and Markdown", mediaTypes: ["movie", "book", "music"] },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  running: "bg-sky-100 text-sky-800 border-sky-200",
  done: "bg-emerald-100 text-emerald-800 border-emerald-200",
  error: "bg-rose-100 text-rose-800 border-rose-200",
};

const DEST_ICONS: Record<Destination, typeof FileSpreadsheet> = {
  letterboxd: FileSpreadsheet,
  filmarks: FileSpreadsheet,
  goodreads: FileSpreadsheet,
  rateyourmusic: FileSpreadsheet,
  archive: FileArchive,
};

export default function ExportsPage() {
  const [userId, setUserId] = useState<string>("");
  const [jobs, setJobs] = useState<ExportJobResponse[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedDest, setSelectedDest] = useState<Destination>("letterboxd");
  const [selectedType, setSelectedType] = useState<MediaType | undefined>("movie");
  const [error, setError] = useState<string>();

  useEffect(() => {
    const stored = localStorage.getItem("dr_user_id");
    if (stored) setUserId(stored);
    const storedJobs = localStorage.getItem("dr_export_jobs");
    if (storedJobs) {
      try {
        setJobs(JSON.parse(storedJobs));
      } catch {
        /* ignore */
      }
    }
  }, []);

  function persistJobs(updated: ExportJobResponse[]) {
    setJobs(updated);
    localStorage.setItem("dr_export_jobs", JSON.stringify(updated));
  }

  async function handleCreate() {
    if (!userId.trim()) return;
    setCreating(true);
    setError(undefined);
    try {
      const job = await createExport(userId, selectedDest, selectedType);
      persistJobs([{ ...job, created_at: new Date().toISOString() }, ...jobs]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setCreating(false);
    }
  }

  const dest = DESTINATIONS.find((d) => d.value === selectedDest)!;

  return (
    <div className="space-y-6">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Exports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate destination-compatible files from your canonical media library.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">User ID</label>
          <Input
            placeholder="Paste your user UUID here"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              localStorage.setItem("dr_user_id", e.target.value);
            }}
          />
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Create export */}
      <Card className="ledger-panel">
        <CardHeader>
          <CardTitle>New Export</CardTitle>
          <CardDescription>Choose a destination to render your media history into the correct format.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Destination picker */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {DESTINATIONS.map((d) => {
              const Icon = DEST_ICONS[d.value];
              return (
                <button
                  key={d.value}
                  onClick={() => {
                    setSelectedDest(d.value);
                    setSelectedType(d.mediaTypes[0]);
                  }}
                  className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left text-sm transition-colors ${
                    selectedDest === d.value
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{d.label}</span>
                  <span className="text-[11px] text-muted-foreground">{d.description}</span>
                </button>
              );
            })}
          </div>

          {/* Media type picker */}
          {dest.mediaTypes.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Media type:</span>
              {dest.mediaTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors capitalize ${
                    selectedType === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          <Button onClick={handleCreate} disabled={!userId || creating} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Generate {dest.label} Export
          </Button>
        </CardContent>
      </Card>

      {/* Export history */}
      {jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Export History</CardTitle>
            <CardDescription>Generated files are available for download until they expire.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Job ID</th>
                  <th className="px-3 py-3">Destination</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3">Download</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3 font-mono text-xs">{job.id.slice(0, 8)}…</td>
                    <td className="px-3 py-3 capitalize">{job.destination}</td>
                    <td className="px-3 py-3 capitalize text-muted-foreground">{job.media_type ?? "all"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          STATUS_COLORS[job.status] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">
                      {job.created_at ? new Date(job.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-3">
                      {job.status === "done" ? (
                        <a
                          href={downloadUrl(job.id)}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {jobs.length === 0 && userId && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileArchive className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium">No exports yet</p>
              <p className="text-sm text-muted-foreground">Generate your first export above.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Format guide */}
      <Card>
        <CardHeader>
          <CardTitle>Destination Guide</CardTitle>
          <CardDescription>Each export is validated before download. Adapters normalize field names, date formats, and encodings.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {DESTINATIONS.map((d) => (
              <div key={d.value} className="space-y-0.5">
                <dt className="font-medium">{d.label}</dt>
                <dd className="text-muted-foreground">{d.description}</dd>
                <dd className="text-xs text-muted-foreground/70 capitalize">{d.mediaTypes.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
