import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { CHAINS, exportSeedPhrase, exportPrivateKey, type ChainId } from "../lib/wallets";

/**
 * Dedicated export screen: Profile → Wallets → Export.
 * The ONLY place raw key material is ever displayed.
 */
export default function Export() {
  const { chain } = useLocalSearchParams<{ chain: string }>();
  const insets = useSafeAreaInsets();
  const [confirmed, setConfirmed] = useState(false);
  const [revealed, setRevealed] = useState<{ label: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const isSeed = chain === "seed";
  const chainInfo = CHAINS.find((c) => c.id === chain);

  const reveal = async () => {
    setBusy(true);
    try {
      if (isSeed) {
        const phrase = await exportSeedPhrase();
        if (phrase) setRevealed({ label: "Seed phrase — restores all 5 wallets", value: phrase });
      } else if (chainInfo) {
        const key = await exportPrivateKey(chainInfo.id as ChainId);
        if (key) setRevealed({ label: `${chainInfo.label} private key`, value: key });
      }
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!revealed) return;
    await Clipboard.setStringAsync(revealed.value);
    Alert.alert("Copied", "Store it somewhere safe — never share it with anyone.");
  };

  useEffect(() => {
    if (!isSeed && !chainInfo) router.back();
  }, []);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.title}>Export {isSeed ? "seed phrase" : chainInfo?.label}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.pad}>
        {!confirmed ? (
          <View style={styles.warnCard}>
            <Text style={styles.warnT}>⚠️ Read this first</Text>
            <Text style={styles.warnS}>
              {isSeed
                ? "This seed phrase restores ALL 5 of your wallets. Anyone who sees it owns everything."
                : `This private key controls your ${chainInfo?.label} wallet. Anyone who sees it owns the funds.`}
              {"\n\n"}• Never share it, screenshot it into a chat, or paste it on a website.{"\n"}
              • OrbitX will NEVER ask for it.{"\n"}
              • If you lose this device without a backup, your funds are unrecoverable.
            </Text>
            <Pressable style={styles.danger} onPress={() => setConfirmed(true)}>
              <Text style={styles.dangerT}>I understand — reveal it</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => router.back()}>
              <Text style={styles.cancelT}>Never mind</Text>
            </Pressable>
          </View>
        ) : !revealed ? (
          <View style={styles.center}>
            {busy ? <ActivityIndicator color="#fff" size="large" /> : (
              <Pressable style={styles.btn} onPress={reveal}>
                <Text style={styles.btnT}>Reveal now</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.lbl}>{revealed.label.toUpperCase()}</Text>
            <View style={styles.keyBox}>
              {isSeed ? (
                <View style={styles.words}>
                  {revealed.value.split(" ").map((w, i) => (
                    <View key={i} style={styles.word}>
                      <Text style={styles.wordN}>{i + 1}</Text>
                      <Text style={styles.wordT}>{w}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.key} selectable>{revealed.value}</Text>
              )}
            </View>
            <Pressable style={styles.btn} onPress={copy}>
              <Text style={styles.btnT}>Copy</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => { setRevealed(null); setConfirmed(false); router.back(); }}>
              <Text style={styles.cancelT}>Done — hide it</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#2f3336" },
  back: { color: "#fff", fontSize: 22 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  pad: { padding: 16 },
  warnCard: { backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,82,82,0.4)", padding: 22 },
  warnT: { color: "#ff8a80", fontSize: 19, fontWeight: "800", marginBottom: 12 },
  warnS: { color: "rgba(255,255,255,0.75)", fontSize: 14.5, lineHeight: 23 },
  danger: { backgroundColor: "#ff5252", borderRadius: 999, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  dangerT: { color: "#000", fontWeight: "800", fontSize: 16 },
  cancel: { paddingVertical: 14, alignItems: "center" },
  cancelT: { color: "rgba(255,255,255,0.6)", fontWeight: "600", fontSize: 15 },
  center: { alignItems: "center", paddingVertical: 60 },
  btn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 15, paddingHorizontal: 40, alignItems: "center" },
  btnT: { color: "#000", fontWeight: "800", fontSize: 16 },
  lbl: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 10 },
  keyBox: { backgroundColor: "#16181c", borderRadius: 20, borderWidth: 1, borderColor: "#2f3336", padding: 16 },
  key: { color: "#fff", fontFamily: "monospace", fontSize: 13, lineHeight: 20 },
  words: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  word: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#000", borderWidth: 1, borderColor: "#2f3336", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  wordN: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700" },
  wordT: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
