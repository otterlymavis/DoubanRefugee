"use client";

import { AlertTriangle, Check, Copy, Settings, Shield, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "@/lib/api";

export default function SettingsPage() {
  const [userId, setUserId] = useState<string>("");
  const [apiBase, setApiBase] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string>();
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem("dr_user_id") || "";
    const api = localStorage.getItem("dr_api_base") || "http://localhost:8000";
    setUserId(id);
    setApiBase(api);
  }, []);

  function saveSettings() {
    localStorage.setItem("dr_user_id", userId);
    localStorage.setItem("dr_api_base", apiBase);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function copyUserId() {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleDelete() {
    if (!userId || deleteConfirm !== userId.slice(0, 8)) return;
    setDeleting(true);
    setDeleteError(undefined);
    try {
      await deleteAccount(userId);
      localStorage.removeItem("dr_user_id");
      localStorage.removeItem("dr_export_jobs");
      setUserId("");
      setDeleteSuccess(true);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account, API configuration, and preferences.</p>
      </header>

      {/* Account */}
      <Card className="shadow-none">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-foreground" />
            <CardTitle>Account</CardTitle>
          </div>
          <CardDescription>Your user identity is a UUID generated on first import. No account registration required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Your User ID</label>
            <div className="flex gap-2">
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="UUID from first import" className="font-mono text-xs" />
              <Button onClick={copyUserId} variant="secondary" size="icon" title="Copy to clipboard">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              This ID persists across sessions via localStorage. Keep it safe — it's your only access key.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card className="shadow-none">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-foreground" />
            <CardTitle>API Configuration</CardTitle>
          </div>
          <CardDescription>Points the web UI at the FastAPI backend. Change this if you're running a remote or Docker instance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Backend API URL</label>
            <Input
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="http://localhost:8000"
              className="font-mono text-xs"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Default: <code className="font-mono">http://localhost:8000</code>. Override with{" "}
              <code className="font-mono">NEXT_PUBLIC_API_BASE_URL</code> env variable for production.
            </p>
          </div>
          <Button onClick={saveSettings} variant="default" size="sm" className="gap-1.5">
            {saved ? <Check className="h-3.5 w-3.5" /> : null}
            {saved ? "Saved!" : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card className="shadow-none">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-foreground" />
            <CardTitle>Privacy Defaults</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {[
              "No Douban password is ever stored.",
              "Session cookies are encrypted before persistence.",
              "Export job files expire by retention policy.",
              "Account deletion removes all user-owned records and encrypted session data.",
              "Browser-extension extraction is preferred over server-side scraping.",
            ].map((point) => (
              <li key={point} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                <span className="text-muted-foreground">{point}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Danger zone */}
      {!deleteSuccess ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription>
              Permanently delete your account and all associated media items, snapshots, match candidates, and export jobs.
              This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Type the first 8 characters of your user ID to confirm:{" "}
                <code className="font-mono text-foreground">{userId ? userId.slice(0, 8) : "…"}</code>
              </label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={userId ? userId.slice(0, 8) : "your-id"}
                className="font-mono text-xs max-w-xs"
              />
            </div>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            <Button
              variant="accent"
              size="sm"
              disabled={!userId || deleteConfirm !== userId.slice(0, 8) || deleting}
              onClick={handleDelete}
              className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "Deleting…" : "Delete My Account"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-emerald-200/60 bg-emerald-50/30">
          <CardContent className="flex items-center gap-3 p-5">
            <Check className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-800">Account deleted</p>
              <p className="text-sm text-muted-foreground">All data has been removed. Import a new Douban export to start fresh.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
