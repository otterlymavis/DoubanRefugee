import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  ApiClient,
  CanonicalMedia,
  Destination,
  ExportJob,
  MediaType,
  makeApiClient,
} from "./src/api";
import { demoItems } from "./src/demoData";

const STORAGE_KEY = "douban-refugee.mobile-settings";
const DEFAULT_API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000");

type StoredSettings = {
  apiBase: string;
  userId?: string;
};

export default function App() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [userId, setUserId] = useState<string>();
  const [items, setItems] = useState<CanonicalMedia[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>("movie");
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Connect your local API, then import a sample or pasted Douban HTML.");
  const [exportJob, setExportJob] = useState<ExportJob>();

  const api = useMemo(() => makeApiClient(apiBase), [apiBase]);

  const saveSettings = useCallback(async (settings: StoredSettings) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, []);

  const refreshLibrary = useCallback(
    async (client: ApiClient, targetUserId: string) => {
      const media = await client.listMedia(targetUserId);
      setItems(media);
      return media;
    },
    [],
  );

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async (raw) => {
        if (!raw) return;
        const settings = JSON.parse(raw) as StoredSettings;
        setApiBase(settings.apiBase || DEFAULT_API_BASE);
        setUserId(settings.userId);
        if (settings.userId) {
          const client = makeApiClient(settings.apiBase || DEFAULT_API_BASE);
          const media = await refreshLibrary(client, settings.userId);
          setStatus(`Restored ${media.length} saved item(s) for this device.`);
        }
      })
      .catch((error) => setStatus(messageFrom(error)));
  }, [refreshLibrary]);

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

  async function receiveImport(importer: () => Promise<{ user_id: string; imported_count: number }>) {
    const response = await importer();
    setUserId(response.user_id);
    await saveSettings({ apiBase: api.baseUrl, userId: response.user_id });
    const media = await refreshLibrary(api, response.user_id);
    setStatus(`Imported ${response.imported_count} item(s). Library now has ${media.length} record(s).`);
  }

  function importDemo() {
    void act(() => receiveImport(() => api.importCanonical(demoItems, userId)));
  }

  function importHtml() {
    if (!html.trim()) {
      setStatus("Paste exported Douban HTML before importing.");
      return;
    }
    void act(() => receiveImport(() => api.importHtml(html, mediaType, userId)));
  }

  function refresh() {
    if (!userId) {
      setStatus("Import something first to create a local test account.");
      return;
    }
    void act(async () => {
      await saveSettings({ apiBase: api.baseUrl, userId });
      const media = await refreshLibrary(api, userId);
      setStatus(`Loaded ${media.length} item(s) from the API.`);
    });
  }

  function runMatching() {
    if (!userId) {
      setStatus("Import something first to run matching.");
      return;
    }
    void act(async () => {
      const response = await api.runMatching(userId, mediaType);
      setStatus(`Generated ${response.candidate_count} ${mediaType} candidate match(es).`);
    });
  }

  function exportItems(destination: Destination, filter?: MediaType) {
    if (!userId) {
      setStatus("Import something first to export.");
      return;
    }
    void act(async () => {
      const job = await api.createExport(userId, destination, filter);
      setExportJob(job);
      setStatus(`${destination} export is ${job.status}. Tap Download when ready.`);
    });
  }

  function downloadExport() {
    if (!exportJob) return;
    void Linking.openURL(api.downloadUrl(exportJob.id));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MOBILE TEST CLIENT</Text>
          </View>
          <Text style={styles.title}>DoubanRefugee</Text>
          <Text style={styles.subtitle}>
            Preserve Douban history on iOS and Android, then export a portable archive.
          </Text>
        </View>

        <Panel title="Connection">
          <Text style={styles.label}>API base URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setApiBase}
            placeholder="http://localhost:8000"
            style={styles.input}
            value={apiBase}
          />
          <Text style={styles.caption}>
            Android emulator: http://10.0.2.2:8000. iOS simulator: http://localhost:8000.
          </Text>
          {userId ? <Text style={styles.identity}>Saved user: {userId.slice(0, 8)}</Text> : null}
        </Panel>

        <Panel title="Import">
          <View style={styles.row}>
            <ActionButton label="Import demo records" onPress={importDemo} primary disabled={busy} />
            <ActionButton label="Refresh library" onPress={refresh} disabled={busy} />
          </View>
          <Text style={styles.label}>Paste a Douban HTML export</Text>
          <TypeSelector selected={mediaType} onSelect={setMediaType} />
          <TextInput
            multiline
            onChangeText={setHtml}
            placeholder="<li class='subject-item'>...</li>"
            style={[styles.input, styles.htmlInput]}
            textAlignVertical="top"
            value={html}
          />
          <ActionButton label="Import pasted HTML" onPress={importHtml} primary disabled={busy} />
        </Panel>

        <Panel title="Migrate">
          <View style={styles.row}>
            <ActionButton label={`Match ${mediaType}`} onPress={runMatching} disabled={busy} />
            <ActionButton label="Letterboxd CSV" onPress={() => exportItems("letterboxd", "movie")} disabled={busy} />
          </View>
          <ActionButton label="Portable archive ZIP" onPress={() => exportItems("archive")} primary disabled={busy} />
          {exportJob ? <ActionButton label="Download last export" onPress={downloadExport} disabled={busy} /> : null}
        </Panel>

        <Panel title={`Canonical Library (${items.length})`}>
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

function TypeSelector({
  onSelect,
  selected,
}: {
  onSelect: (type: MediaType) => void;
  selected: MediaType;
}) {
  return (
    <View style={styles.chips}>
      {(["movie", "book", "music"] as const).map((type) => (
        <Pressable
          key={type}
          onPress={() => onSelect(type)}
          style={[styles.chip, selected === type && styles.chipActive]}
        >
          <Text style={[styles.chipText, selected === type && styles.chipTextActive]}>{type}</Text>
        </Pressable>
      ))}
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
  htmlInput: { minHeight: 92 },
  caption: { color: "#647773", fontSize: 12, lineHeight: 18 },
  identity: { color: "#087f78", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
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
  chips: { flexDirection: "row", gap: 7 },
  chip: { borderColor: "#cddad7", borderRadius: 99, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: "#def1ed", borderColor: "#087f78" },
  chipText: { color: "#647773", fontSize: 13, textTransform: "capitalize" },
  chipTextActive: { color: "#087f78", fontWeight: "700" },
  empty: { color: "#647773", fontSize: 14, paddingVertical: 8 },
  mediaRow: { borderTopColor: "#e8eeec", borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 10 },
  mediaMain: { flex: 1, gap: 3 },
  mediaTitle: { color: "#172c2b", fontSize: 14, fontWeight: "600" },
  mediaMeta: { color: "#647773", fontSize: 12 },
  rating: { color: "#087f78", fontSize: 13, fontWeight: "700" },
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
