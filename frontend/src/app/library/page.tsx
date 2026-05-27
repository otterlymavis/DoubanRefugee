"use client";

import { BookOpen, Clapperboard, Loader2, Music2, RefreshCw, Search, WandSparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type MediaItemResponse, type MediaType, listMedia, runMatching } from "@/lib/api";

const MEDIA_TYPES: { value: MediaType | "all"; label: string; icon: typeof Clapperboard }[] = [
  { value: "all", label: "All", icon: BookOpen },
  { value: "movie", label: "Movies", icon: Clapperboard },
  { value: "book", label: "Books", icon: BookOpen },
  { value: "music", label: "Music", icon: Music2 },
];

const STARS = ["★", "★★", "★★★", "★★★★", "★★★★★"];

function ratingStars(rating?: { value: number; scale: number }) {
  if (!rating) return null;
  const idx = Math.round((rating.value / rating.scale) * 5) - 1;
  return STARS[Math.max(0, Math.min(4, idx))];
}

function confidenceBadge(ids: Record<string, string> = {}) {
  const count = Object.keys(ids).length;
  if (count === 0) return { label: "unmatched", class: "bg-amber-100 text-amber-800 border-amber-200" };
  if (count >= 2) return { label: "matched", class: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  return { label: "partial", class: "bg-sky-100 text-sky-800 border-sky-200" };
}

export default function LibraryPage() {
  const [userId, setUserId] = useState<string>("");
  const [items, setItems] = useState<MediaItemResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [filter, setFilter] = useState<MediaType | "all">("all");
  const [search, setSearch] = useState("");
  const [matching, setMatching] = useState(false);
  const [matchMsg, setMatchMsg] = useState("");

  const fetchItems = useCallback(async () => {
    if (!userId.trim()) return;
    setLoading(true);
    setError(undefined);
    try {
      const data = await listMedia(userId, filter === "all" ? undefined : filter);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load library");
    } finally {
      setLoading(false);
    }
  }, [userId, filter]);

  useEffect(() => {
    const stored = localStorage.getItem("dr_user_id");
    if (stored) setUserId(stored);
  }, []);

  useEffect(() => {
    if (userId) {
      localStorage.setItem("dr_user_id", userId);
      fetchItems();
    }
  }, [userId, fetchItems]);

  async function handleRunMatching() {
    if (!userId) return;
    setMatching(true);
    setMatchMsg("");
    try {
      const res = await runMatching(userId, filter === "all" ? "movie" : filter);
      setMatchMsg(`Generated ${res.candidate_count} candidates.`);
      await fetchItems();
    } catch {
      setMatchMsg("Matching failed.");
    } finally {
      setMatching(false);
    }
  }

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const titles = Object.values(item.titles || {}).join(" ").toLowerCase();
    return titles.includes(q) || item.source_id.includes(q);
  });

  const counts = { movie: 0, book: 0, music: 0 };
  for (const item of items) {
    if (item.media_type in counts) counts[item.media_type as keyof typeof counts]++;
  }

  return (
    <div className="space-y-6">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">All imported media items in their canonical form.</p>
      </header>

      {/* User ID + controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">User ID</label>
          <Input
            placeholder="Paste your user UUID here"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>
        <Button onClick={fetchItems} disabled={!userId || loading} variant="secondary" size="default">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
        <Button onClick={handleRunMatching} disabled={!userId || matching} variant="default">
          {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
          Run Matching
        </Button>
      </div>
      {matchMsg && <p className="text-sm text-primary">{matchMsg}</p>}

      {/* Stats */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
          {(["movie", "book", "music"] as MediaType[]).map((type) => (
            <Card key={type} className="cursor-pointer" onClick={() => setFilter(type)}>
              <CardHeader className="p-4">
                <CardTitle className="text-2xl font-bold">{counts[type]}</CardTitle>
                <CardDescription className="capitalize">{type}s</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {MEDIA_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 w-48 text-xs"
            placeholder="Search titles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && userId && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium">No items yet</p>
              <p className="text-sm text-muted-foreground">Import your Douban history from the Dashboard.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!userId && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium">Enter your user ID above</p>
              <p className="text-sm text-muted-foreground">Your user ID is shown in the Dashboard after your first import.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Year</th>
                  <th className="px-3 py-3">Rating</th>
                  <th className="px-3 py-3">Consumed</th>
                  <th className="px-3 py-3">External IDs</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const badge = confidenceBadge(item.external_ids);
                  const title = item.titles?.en || item.titles?.zh || item.titles?.original || "Untitled";
                  const subtitle = item.titles?.zh || item.titles?.original;
                  return (
                    <tr key={item.id ?? item.source_id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <div className="font-medium">{title}</div>
                        {subtitle && subtitle !== title && (
                          <div className="font-mono text-xs text-muted-foreground">{subtitle}</div>
                        )}
                        <div className="font-mono text-xs text-muted-foreground/60">#{item.source_id}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="capitalize text-muted-foreground">{item.media_type}</span>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{item.year ?? "—"}</td>
                      <td className="px-3 py-3 text-amber-500">{ratingStars(item.rating) ?? "—"}</td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{item.consumed_date ?? "—"}</td>
                      <td className="px-3 py-3 font-mono text-xs">
                        {Object.entries(item.external_ids ?? {})
                          .slice(0, 3)
                          .map(([k, v]) => (
                            <span key={k} className="mr-1.5 text-muted-foreground">
                              {k}:{v}
                            </span>
                          ))}
                        {!Object.keys(item.external_ids ?? {}).length && "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.class}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {items.length} items
        </p>
      )}
    </div>
  );
}
