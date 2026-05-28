import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CanonicalMedia, Destination, MediaType, mergeItems, parseJsonItems, renderExport } from "./src/local-export";
import { demoItems } from "./src/demoData";

const STORAGE_KEY = "douban-refugee.mobile-library";

const exportTargets: { destination: Destination; label: string; mediaType?: MediaType; primary?: boolean }[] = [
  { destination: "letterboxd", label: "Letterboxd CSV", mediaType: "movie" },
  { destination: "filmarks", label: "Filmarks CSV", mediaType: "movie" },
  { destination: "goodreads", label: "Goodreads CSV", mediaType: "book" },
  { destination: "rateyourmusic", label: "RateYourMusic CSV", mediaType: "music" },
  { destination: "backup", label: "Backup JSON", primary: true },
];

export default function App() {
  const [items, setItems] = useState<CanonicalMedia[]>([]);
  const [jsonInput, setJsonInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Local-only mode. Import JSON or demo records, then share export files.");

  const counts = useMemo(
    () => ({
      movie: items.filter((item) => item.media_type === "movie").length,
      book: items.filter((item) => item.media_type === "book").length,
      music: items.filter((item) => item.media_type === "music").length,
    }),
    [items],
  );

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const restored = parseJsonItems(raw);
        setItems(restored);
        setStatus(`Restored ${restored.length} local item(s).`);
      })
      .catch((error) => setStatus(messageFrom(error)));
  }, []);

  async function updateLibrary(nextItems: CanonicalMedia[], message: string) {
    setItems(nextItems);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
    setStatus(message);
  }

  async function act(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setStatus(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  function importItems(incoming: CanonicalMedia[], label: string) {
    void act(async () => {
      const nextItems = mergeItems(items, incoming);
      await updateLibrary(nextItems, `Imported ${incoming.length} item(s) from ${label}. Library now has ${nextItems.length}.`);
    });
  }

  function importJson() {
    if (!jsonInput.trim()) {
      setStatus("Paste extension JSON or backup JSON first.");
      return;
    }
    importItems(parseJsonItems(jsonInput), "pasted JSON");
    setJsonInput("");
  }

  function clearLibrary() {
    void act(async () => {
      await updateLibrary([], "Local library cleared.");
    });
  }

  function shareExport(destination: Destination, mediaType?: MediaType) {
    void act(async () => {
      const file = renderExport(items, destination, mediaType);
      await Share.share({ title: file.filename, message: file.content });
      setStatus(`Prepared ${file.filename} for sharing.`);
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>LOCAL-ONLY</Text>
          </View>
          <Text style={styles.title}>DoubanRefugee</Text>
          <Text style={styles.subtitle}>No account, server, or API. Keep your Douban archive on this device.</Text>
        </View>

        <Panel title="Import">
          <View style={styles.row}>
            <ActionButton label="Import demo records" onPress={() => importItems(demoItems, "demo data")} primary disabled={busy} />
            <ActionButton label="Clear" onPress={clearLibrary} disabled={busy || items.length === 0} />
          </View>
          <Text style={styles.label}>Paste extension JSON or backup JSON</Text>
          <TextInput
            multiline
            onChangeText={setJsonInput}
            placeholder='{"items":[...]}'
            style={[styles.input, styles.jsonInput]}
            textAlignVertical="top"
            value={jsonInput}
          />
          <ActionButton label="Import pasted JSON" onPress={importJson} primary disabled={busy || !jsonInput.trim()} />
        </Panel>

        <Panel title="Export">
          <View style={styles.exportGrid}>
            {exportTargets.map((target) => (
              <ActionButton
                key={target.destination}
                label={target.label}
                onPress={() => shareExport(target.destination, target.mediaType)}
                primary={target.primary}
                disabled={busy || items.length === 0}
              />
            ))}
          </View>
        </Panel>

        <Panel title={`Local Library (${items.length})`}>
          <View style={styles.metrics}>
            <Metric label="movies" value={counts.movie} />
            <Metric label="books" value={counts.book} />
            <Metric label="music" value={counts.music} />
          </View>
          {items.length === 0 ? (
            <Text style={styles.empty}>No media imported on this device yet.</Text>
          ) : (
            items.map((item) => <MediaRow item={item} key={`${item.media_type}:${item.source_id}`} />)
          )}
        </Panel>

        <View style={styles.status}>
          {busy ? <ActivityIndicator color="#087f78" /> : null}
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionButton({
  disabled,
  label,
  onPress,
  primary,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function MediaRow({ item }: { item: CanonicalMedia }) {
  const title = item.titles.en || item.titles.original || item.titles.zh || item.source_id;
  return (
    <View style={styles.mediaRow}>
      <View style={styles.mediaMain}>
        <Text style={styles.mediaTitle}>{title}</Text>
        <Text style={styles.mediaMeta}>
          {item.media_type} / {item.year || "year unknown"} / Douban {item.source_id}
        </Text>
      </View>
      <Text style={styles.rating}>{item.rating ? `${item.rating.value}/${item.rating.scale}` : "-"}</Text>
    </View>
  );
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f5ec" },
  page: { gap: 16, padding: 18, paddingBottom: 36 },
  header: { gap: 8, paddingTop: 10, paddingBottom: 6 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#def1ed",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { color: "#087f78", fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  title: { color: "#172c2b", fontSize: 36, fontWeight: "700", letterSpacing: -1 },
  subtitle: { color: "#546663", fontSize: 15, lineHeight: 22 },
  panel: {
    backgroundColor: "#fffdf8",
    borderColor: "#dce4e1",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    shadowColor: "#102f2d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  panelTitle: { color: "#172c2b", fontSize: 18, fontWeight: "700", marginBottom: 2 },
  label: { color: "#465d5a", fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#d5dfdc",
    borderRadius: 10,
    borderWidth: 1,
    color: "#172c2b",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  jsonInput: { minHeight: 112 },
  row: { flexDirection: "row", gap: 8 },
  exportGrid: { gap: 8 },
  button: {
    alignItems: "center",
    borderColor: "#cddad7",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  buttonPrimary: { backgroundColor: "#087f78", borderColor: "#087f78" },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: "#27413e", fontSize: 13, fontWeight: "700", textAlign: "center" },
  buttonTextPrimary: { color: "#ffffff" },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { backgroundColor: "#eef5f3", borderRadius: 10, flex: 1, padding: 10 },
  metricValue: { color: "#172c2b", fontSize: 20, fontWeight: "700" },
  metricLabel: { color: "#647773", fontSize: 11, textTransform: "uppercase" },
  empty: { color: "#647773", fontSize: 14, paddingVertical: 8 },
  mediaRow: { borderTopColor: "#e8eeec", borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 10 },
  mediaMain: { flex: 1, gap: 3 },
  mediaTitle: { color: "#172c2b", fontSize: 14, fontWeight: "600" },
  mediaMeta: { color: "#647773", fontSize: 12 },
  rating: { color: "#087f78", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13, fontWeight: "700" },
  status: {
    alignItems: "center",
    backgroundColor: "#def1ed",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  statusText: { color: "#27413e", flex: 1, fontSize: 13, lineHeight: 19 },
});
