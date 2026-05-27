"use client";

import { Check, ChevronDown, ChevronUp, Loader2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type MatchCandidateResponse, getReviewQueue, selectCandidate } from "@/lib/api";

const CONFIDENCE_COLORS: Record<string, string> = {
  exact: "bg-emerald-100 text-emerald-800 border-emerald-200",
  high: "bg-sky-100 text-sky-800 border-sky-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  "manual-review": "bg-rose-100 text-rose-800 border-rose-200",
};

type GroupedItem = {
  mediaItemId: string;
  candidates: MatchCandidateResponse[];
  expanded: boolean;
};

export default function ReviewPage() {
  const [userId, setUserId] = useState<string>("");
  const [queue, setQueue] = useState<MatchCandidateResponse[]>([]);
  const [groups, setGroups] = useState<GroupedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [selecting, setSelecting] = useState<string>();

  useEffect(() => {
    const stored = localStorage.getItem("dr_user_id");
    if (stored) setUserId(stored);
  }, []);

  const fetchQueue = useCallback(async () => {
    if (!userId.trim()) return;
    setLoading(true);
    setError(undefined);
    try {
      const data = await getReviewQueue(userId);
      setQueue(data);
      // Group by media_item_id
      const map = new Map<string, MatchCandidateResponse[]>();
      for (const c of data) {
        if (!map.has(c.media_item_id)) map.set(c.media_item_id, []);
        map.get(c.media_item_id)!.push(c);
      }
      setGroups(
        Array.from(map.entries()).map(([id, candidates]) => ({
          mediaItemId: id,
          candidates: candidates.sort((a, b) => b.score - a.score),
          expanded: false,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      localStorage.setItem("dr_user_id", userId);
      fetchQueue();
    }
  }, [userId, fetchQueue]);

  async function handleSelect(candidate: MatchCandidateResponse) {
    if (!userId) return;
    setSelecting(candidate.id);
    try {
      await selectCandidate(candidate.id, userId);
      await fetchQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Selection failed");
    } finally {
      setSelecting(undefined);
    }
  }

  function toggleGroup(id: string) {
    setGroups((g) => g.map((grp) => (grp.mediaItemId === id ? { ...grp, expanded: !grp.expanded } : grp)));
  }

  const pendingCount = groups.filter((g) => !g.candidates.some((c) => c.selected)).length;

  return (
    <div className="space-y-6">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Review Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm uncertain metadata matches. Your selections become reusable mappings.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">User ID</label>
          <Input
            placeholder="Paste your user UUID here"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>
        <Button onClick={fetchQueue} disabled={!userId || loading} variant="secondary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!loading && queue.length > 0 && (
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {pendingCount} items awaiting review
          </span>
          <Badge>{queue.length} candidates total</Badge>
        </div>
      )}

      {!userId && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <SlidersHorizontal className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium">Enter your user ID above</p>
              <p className="text-sm text-muted-foreground">Run matching from the Dashboard or Library first.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && userId && queue.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Check className="h-10 w-10 text-emerald-500" />
            <div>
              <p className="font-medium">Queue is clear!</p>
              <p className="text-sm text-muted-foreground">All items have been matched or are awaiting the matching engine.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {groups.map((group) => {
          const topCandidate = group.candidates[0];
          const isResolved = group.candidates.some((c) => c.selected);

          return (
            <Card key={group.mediaItemId} className={isResolved ? "border-emerald-200/60 bg-emerald-50/30" : ""}>
              <CardHeader className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-sm">
                        {topCandidate?.title || "Unknown title"}
                        {topCandidate?.year ? ` (${topCandidate.year})` : ""}
                      </CardTitle>
                      {isResolved && (
                        <span className="rounded-full border bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 border-emerald-200">
                          resolved
                        </span>
                      )}
                    </div>
                    <CardDescription className="font-mono text-xs">
                      item {group.mediaItemId.slice(0, 8)} · {group.candidates.length} candidates
                    </CardDescription>
                  </div>
                  <button
                    onClick={() => toggleGroup(group.mediaItemId)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {group.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </CardHeader>

              {group.expanded && (
                <CardContent className="pb-4 pt-0">
                  <div className="space-y-2">
                    {group.candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className={`flex items-center justify-between gap-3 rounded-md border p-3 text-sm ${
                          candidate.selected ? "border-emerald-300 bg-emerald-50" : "bg-background/60"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{candidate.title}</span>
                            {candidate.year && (
                              <span className="text-muted-foreground">({candidate.year})</span>
                            )}
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                CONFIDENCE_COLORS[candidate.confidence] ?? "bg-muted text-muted-foreground"
                              }`}
                            >
                              {candidate.confidence}
                            </span>
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {candidate.provider} · {candidate.provider_id} · score {candidate.score.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {candidate.selected ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-700">
                              <Check className="h-3.5 w-3.5" /> Selected
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleSelect(candidate)}
                              disabled={selecting === candidate.id}
                            >
                              {selecting === candidate.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              Use this
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
