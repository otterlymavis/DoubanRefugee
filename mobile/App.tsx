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
  { destination: "letterboxd", label: "Letterboxd watched CSV", mediaType: "movie" },
  { destination: "letterboxd-watchlist", label: "Letterboxd watchlist CSV", mediaType: "movie" },
  { destination: "filmarks", label: "Filmarks transfer CSV", mediaType: "movie" },
  { destination: "goodreads", label: "Goodreads import CSV", mediaType: "book" },
  { destination: "rateyourmusic", label: "RateYourMusic transfer CSV", mediaType: "music" },
  { destination: "notion", label: "Notion media database CSV", primary: true },
  { destination: "backup", label: "Full backup JSON", primary: true },
];

export default function App() {
  const [items, setItems] = useState<CanonicalMedia[]>([]);
  const [jsonInput, setJsonInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Import scraped Douban movie, book, or music JSON, then share transfer files.");

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
          <Text style={styles.title}>DoubanRefugee</Text>
          <Text style={styles.subtitle}>Import Douban JSON and share transfer or backup files.</Text>
        </View>

        <Panel title="Import">
          <View style={styles.row}>
            <ActionButton label="Import demo records" onPress={() => importItems(demoItems, "demo data")} primary disabled={busy} />
            <ActionButton label="Clear" onPress={clearLibrary} disabled={busy || items.length === 0} />
          </View>
          <Text style={styles.label}>Paste scraped Douban JSON or backup JSON</Text>
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
            items.map((item) => <MediaRow item={item} key={`${item.media_type}:${item.source_id}:${item.collection_status || "item"}`} />)
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
  safe: { flex: 1, backgroundColor: "#f3f6f1" },
  page: { gap: 14, padding: 16, paddingBottom: 34 },
  header: {
    borderBottomColor: "#d9e2df",
    borderBottomWidth: 1,
    gap: 8,
    paddingBottom: 14,
  },
  title: { color: "#14252b", fontSize: 28, fontWeight: "700", letterSpacing: 0 },
  subtitle: { color: "#51646a", fontSize: 14, lineHeight: 21 },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#d9e2df",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  panelTitle: { color: "#14252b", fontSize: 17, fontWeight: "700", marginBottom: 2 },
  label: { color: "#40555b", fontSize: 12, fontWeight: "700", letterSpacing: 0, textTransform: "uppercase" },
  input: {
    backgroundColor: "#f9fbfa",
    borderColor: "#cbd8d6",
    borderRadius: 7,
    borderWidth: 1,
    color: "#14252b",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  jsonInput: { minHeight: 120 },
  row: { flexDirection: "row", gap: 8 },
  exportGrid: { gap: 8 },
  button: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#cbd8d6",
    borderRadius: 7,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  buttonPrimary: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.78 },
  buttonText: { color: "#20363c", fontSize: 13, fontWeight: "700", textAlign: "center" },
  buttonTextPrimary: { color: "#ffffff" },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { backgroundColor: "#f3f6f1", borderColor: "#d9e2df", borderRadius: 7, borderWidth: 1, flex: 1, padding: 10 },
  metricValue: { color: "#14252b", fontSize: 20, fontWeight: "700" },
  metricLabel: { color: "#63777d", fontSize: 11, textTransform: "uppercase" },
  empty: { color: "#63777d", fontSize: 14, paddingVertical: 8 },
  mediaRow: { borderTopColor: "#e5ece9", borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 11 },
  mediaMain: { flex: 1, gap: 3 },
  mediaTitle: { color: "#14252b", fontSize: 14, fontWeight: "600" },
  mediaMeta: { color: "#63777d", fontSize: 12 },
  rating: { color: "#0f766e", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13, fontWeight: "700" },
  status: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#cbd8d6",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  statusText: { color: "#33474d", flex: 1, fontSize: 13, lineHeight: 19 },
});
