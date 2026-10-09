import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { getHealth, runAgent } from "./src/api";
import type { AgentResponse, ChatMessage, Health, ProviderId } from "./src/types";
import { theme } from "./src/theme";

const ACCESS_KEY = "artss_access";
const providers: ProviderId[] = ["openai", "deepseek", "gemini"];

type UiMessage = ChatMessage & {
  id: string;
  meta?: string;
  prUrl?: string;
};

function Login({ onLogin }: { onLogin: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = code.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await onLogin(value);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.loginWrap}>
        <View style={styles.logo}><Text style={styles.logoText}>A</Text></View>
        <Text style={styles.title}>ARTSS AGENT</Text>
        <Text style={styles.subtitle}>Personal autonomous coding agent</Text>
        <TextInput
          accessibilityLabel="Access code"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="Access code"
          placeholderTextColor={theme.muted}
          style={styles.input}
          value={code}
          onChangeText={setCode}
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        <Pressable
          accessibilityRole="button"
          disabled={!code.trim() || busy}
          onPress={submit}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            (!code.trim() || busy) && styles.disabled,
          ]}
        >
          {busy ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.primaryText}>Войти</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function AppShell({
  accessCode,
  onLogout,
}: {
  accessCode: string;
  onLogout: () => Promise<void>;
}) {
  const [health, setHealth] = useState<Health | null>(null);
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "ARTSS Agent готов. Опиши задачу по репозиторию.",
    },
  ]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((value) => {
        setHealth(value);
        setProvider(current => value.providers.includes(current) ? current : value.providers[0] || current);
      })
      .catch(() => { if (!controller.signal.aborted) setHealth(null); });
    return () => controller.abort();
  }, []);

  const availableProviders = useMemo(
    () => health?.providers?.length ? health.providers : providers,
    [health],
  );

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const userMessage: UiMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    const history = [...messages.filter((m) => m.id !== "welcome"), userMessage]
      .map(({ role, content }) => ({ role, content })) as ChatMessage[];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setBusy(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result: AgentResponse = await runAgent(accessCode, provider, history, controller.signal);
      const meta = [result.provider, result.action, result.branch].filter(Boolean).join(" · ");
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: result.text || "Готово.",
          meta,
          prUrl: result.prUrl,
        },
      ]);
    } catch (error) {
      if (error instanceof Error && error.name === "UnauthorizedError") {
        await onLogout();
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? `Ошибка: ${error.message}` : "Ошибка запроса",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoSmall}><Text style={styles.logoSmallText}>A</Text></View>
            <View>
              <Text style={styles.headerTitle}>ARTSS AGENT</Text>
              <Text style={styles.headerSub}>● personal coding agent</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={onLogout} hitSlop={12}>
            <Text style={styles.logout}>Выйти</Text>
          </Pressable>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.pill, health?.ok && styles.pillOk]}>API · {health?.ok ? "online" : "…"}</Text>
          <Text style={[styles.pill, health?.githubWriteConfigured && styles.pillOk]}>
            GitHub · {health?.githubWriteConfigured ? "write ready" : "…"}
          </Text>
          <Text style={[styles.pill, health?.executionEnabled && styles.pillOk]}>
            Exec · {health?.executionEnabled ? "on" : "…"}
          </Text>
        </View>

        <View style={styles.providerRow}>
          {availableProviders.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item}
              onPress={() => setProvider(item)}
              style={[styles.providerButton, provider === item && styles.providerActive]}
            >
              <Text style={provider === item ? styles.providerActiveText : styles.providerText}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          accessibilityLabel="Chat history"
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chat}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={[styles.message, item.role === "user" ? styles.userMessage : styles.agentMessage]}>
              <Text style={styles.messageText}>{item.content}</Text>
              {!!item.meta && <Text style={styles.meta}>{item.meta}</Text>}
              {!!item.prUrl && (
                <Pressable accessibilityRole="link" onPress={() => Linking.openURL(item.prUrl!)}>
                  <Text style={styles.link}>Открыть Pull Request</Text>
                </Pressable>
              )}
            </View>
          )}
        />

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Agent task"
            multiline
            maxLength={12000}
            placeholder="Что изменить в приложении?"
            placeholderTextColor={theme.muted}
            style={styles.composerInput}
            value={input}
            onChangeText={setInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send task"
            disabled={!input.trim() || busy}
            onPress={send}
            style={({ pressed }) => [
              styles.send,
              pressed && styles.pressed,
              (!input.trim() || busy) && styles.disabled,
            ]}
          >
            {busy ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.sendText}>↑</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [accessCode, setAccessCode] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(ACCESS_KEY)
      .then(setAccessCode)
      .finally(() => setReady(true));
  }, []);

  const login = async (code: string) => {
    await SecureStore.setItemAsync(ACCESS_KEY, code, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    setAccessCode(code);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    setAccessCode(null);
  };

  if (!ready) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={theme.green} />
      </SafeAreaView>
    );
  }

  return accessCode ? <AppShell accessCode={accessCode} onLogout={logout} /> : <Login onLogin={login} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: "center", justifyContent: "center" },
  loginWrap: { flex: 1, justifyContent: "center", padding: 24, gap: 14 },
  logo: { width: 64, height: 64, borderRadius: 18, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center", backgroundColor: theme.panel },
  logoText: { color: theme.text, fontSize: 24, fontWeight: "800" },
  title: { color: theme.text, fontSize: 30, fontWeight: "800", letterSpacing: 1.5 },
  subtitle: { color: theme.muted, fontSize: 15, marginBottom: 10 },
  input: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.panel, color: theme.text, paddingHorizontal: 16, fontSize: 17 },
  primaryButton: { minHeight: 52, borderRadius: 15, backgroundColor: theme.white, alignItems: "center", justifyContent: "center" },
  primaryText: { color: theme.bg, fontWeight: "800", fontSize: 16 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  header: { minHeight: 70, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  logoSmall: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.panel, alignItems: "center", justifyContent: "center" },
  logoSmallText: { color: theme.text, fontWeight: "800" },
  headerTitle: { color: theme.text, fontWeight: "800", letterSpacing: 1.1 },
  headerSub: { color: theme.green, fontSize: 11, marginTop: 2 },
  logout: { color: theme.muted, fontSize: 13 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingHorizontal: 14, paddingTop: 12 },
  pill: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.panel, color: theme.muted, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 11, overflow: "hidden" },
  pillOk: { color: theme.green },
  providerRow: { flexDirection: "row", gap: 8, padding: 14 },
  providerButton: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.panel, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  providerActive: { backgroundColor: theme.panelStrong, borderColor: "#3A724D" },
  providerText: { color: theme.muted, textTransform: "capitalize" },
  providerActiveText: { color: theme.green, fontWeight: "700", textTransform: "capitalize" },
  chat: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  message: { maxWidth: "90%", padding: 13, borderRadius: 17, borderWidth: 1, borderColor: theme.border },
  userMessage: { alignSelf: "flex-end", backgroundColor: theme.panelStrong },
  agentMessage: { alignSelf: "flex-start", backgroundColor: theme.panel },
  messageText: { color: theme.text, fontSize: 15, lineHeight: 21 },
  meta: { color: theme.muted, fontSize: 11, marginTop: 7 },
  link: { color: theme.green, fontSize: 13, fontWeight: "700", marginTop: 8 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, padding: 10, flexDirection: "row", alignItems: "flex-end", gap: 8, backgroundColor: theme.bg },
  composerInput: { flex: 1, minHeight: 46, maxHeight: 140, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.panel, color: theme.text, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  send: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.white },
  sendText: { color: theme.bg, fontWeight: "900", fontSize: 22 },
});
