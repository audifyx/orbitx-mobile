import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  ActivityIndicator, Alert, Image, Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { launchSolanaToken } from "../lib/launch-solana";
import { launchEvmToken, EVM_LAUNCH_CHAINS, type EvmChainConfig } from "../lib/launch-evm";
import { supabase } from "../lib/supabase";

type ChainChoice = "solana" | EvmChainConfig["id"] | "arc" | "robinhood";
type Step = "form" | "deploying" | "done";

const CHAINS: { id: ChainChoice; label: string; live: boolean }[] = [
  { id: "solana", label: "Solana", live: true },
  { id: "base", label: "Base", live: true },
  { id: "ethereum", label: "Ethereum", live: true },
  { id: "arc", label: "Arc", live: false },
  { id: "robinhood", label: "Robinhood Chain", live: false },
];

export default function Launch() {
  const insets = useSafeAreaInsets();
  const [chain, setChain] = useState<ChainChoice>("solana");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [desc, setDesc] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ id: string; explorer: string; tx: string } | null>(null);

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!r.canceled && r.assets[0]) setImage(r.assets[0].uri);
  };

  const valid =
    name.trim().length >= 2 &&
    ticker.trim().length >= 2 &&
    Number(supply) > 0 &&
    (CHAINS.find((c) => c.id === chain)?.live ?? false);

  const deploy = () => {
    Alert.alert(
      `Launch $${ticker.toUpperCase()} on ${CHAINS.find((c) => c.id === chain)?.label}?`,
      "This deploys from YOUR wallet and YOU pay the gas. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "🚀 Launch", onPress: runDeploy },
      ]
    );
  };

  const runDeploy = async () => {
    setStep("deploying");
    setStatus("Preparing deployment…");
    try {
      let id = "", explorer = "", tx = "";
      const cleanTicker = ticker.trim().toUpperCase();
      if (chain === "solana") {
        setStatus("Uploading metadata…");
        const r = await launchSolanaToken({
          name: name.trim(),
          symbol: cleanTicker,
          description: desc.trim(),
          imageUri: image ?? undefined,
          supply: supply.trim(),
        });
        id = r.mint;
        explorer = `https://solscan.io/token/${r.mint}`;
        tx = r.signature;
        setStatus("Token live on Solana!");
      } else {
        const cfg = EVM_LAUNCH_CHAINS.find((c) => c.id === chain)!;
        setStatus(`Deploying to ${cfg.label}…`);
        const r = await launchEvmToken(cfg, name.trim(), cleanTicker, supply.trim());
        id = r.contract;
        explorer = `${r.explorer}/address/${r.contract}`;
        tx = r.txHash;
        setStatus(`Token live on ${cfg.label}!`);
      }
      setResult({ id, explorer, tx });
      // auto-socialize: post to the feed with the $CASHTAG
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          await supabase.from("posts").insert({
            user_id: data.user.id,
            text: `🚀 Just launched $${cleanTicker} — ${name.trim()}. ${desc.trim()}`,
            cashtags: [cleanTicker],
          });
        }
      } catch { /* feed is best-effort */ }
      setStep("done");
    } catch (e: any) {
      setStep("form");
      Alert.alert("Launch failed", e?.message ?? "Something went wrong. Check your gas balance and try again.");
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.title}>Launch a token</Text>
      </View>

      {step === "deploying" ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.status}>{status}</Text>
          <Text style={styles.fine}>Signing on this device…{"\n"}You pay the gas from your wallet.</Text>
        </View>
      ) : step === "done" && result ? (
        <ScrollView contentContainerStyle={styles.pad}>
          <View style={styles.doneCard}>
            <Text style={styles.rocket}>🚀</Text>
            <Text style={styles.doneT}>${ticker.toUpperCase()} is live!</Text>
            <Text style={styles.id} selectable numberOfLines={2}>{result.id}</Text>
            <Pressable style={styles.btn} onPress={() => Linking.openURL(result.explorer)}>
              <Text style={styles.btnT}>View on explorer →</Text>
            </Pressable>
            <Pressable
              style={styles.ghost}
              onPress={() => router.push({ pathname: "/token/[symbol]", params: { symbol: ticker.toUpperCase() } })}
            >
              <Text style={styles.ghostT}>Open token page</Text>
            </Pressable>
            <Text style={styles.fine}>Auto-posted to your feed with ${ticker.toUpperCase()}</Text>
            <Pressable style={styles.cancel} onPress={() => router.back()}>
              <Text style={styles.cancelT}>Done</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Text style={styles.lbl}>CHAIN</Text>
          <View style={styles.chainRow}>
            {CHAINS.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.chip, chain === c.id && styles.chipA, !c.live && styles.chipOff]}
                onPress={() => c.live && setChain(c.id)}
              >
                <Text style={[styles.chipT, chain === c.id && styles.chipTA]}>
                  {c.label}{c.live ? "" : " · soon"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.lbl}>TOKEN IMAGE</Text>
          <Pressable style={styles.imgBox} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image }} style={styles.img} />
            ) : (
              <Text style={styles.imgPh}>＋ Add image</Text>
            )}
          </Pressable>

          <Text style={styles.lbl}>NAME</Text>
          <TextInput style={styles.in} placeholder="e.g. OrbitX Coin" placeholderTextColor="rgba(255,255,255,0.3)"
            value={name} onChangeText={setName} maxLength={32} />

          <Text style={styles.lbl}>TICKER</Text>
          <TextInput style={styles.in} placeholder="e.g. OXC" placeholderTextColor="rgba(255,255,255,0.3)"
            value={ticker} onChangeText={(t) => setTicker(t.replace(/[^a-zA-Z0-9]/g, ""))} maxLength={10}
            autoCapitalize="characters" />

          <Text style={styles.lbl}>TOTAL SUPPLY</Text>
          <TextInput style={styles.in} placeholder="1000000000" placeholderTextColor="rgba(255,255,255,0.3)"
            value={supply} onChangeText={(t) => setSupply(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" />

          <Text style={styles.lbl}>DESCRIPTION</Text>
          <TextInput style={[styles.in, styles.multi]} placeholder="What is this coin about?"
            placeholderTextColor="rgba(255,255,255,0.3)" value={desc} onChangeText={setDesc}
            multiline maxLength={280} />

          <Pressable style={[styles.btn, !valid && styles.btnDim]} onPress={deploy} disabled={!valid}>
            <Text style={styles.btnT}>🚀 Launch token</Text>
          </Pressable>
          <Text style={styles.fine}>
            Deploys from your in-app wallet. You pay gas — never a platform wallet.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#2f3336" },
  back: { color: "#fff", fontSize: 22 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 0.5 },
  pad: { padding: 16, paddingBottom: 60 },
  lbl: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginTop: 16, marginBottom: 8 },
  chainRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#2f3336", borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15, backgroundColor: "#000" },
  chipA: { backgroundColor: "#fff", borderColor: "#fff" },
  chipOff: { opacity: 0.4 },
  chipT: { color: "#fff", fontWeight: "700", fontSize: 13 },
  chipTA: { color: "#000" },
  imgBox: { width: 96, height: 96, borderRadius: 24, borderWidth: 1, borderColor: "#2f3336", borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: "#000", overflow: "hidden" },
  img: { width: 96, height: 96 },
  imgPh: { color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600" },
  in: { backgroundColor: "#000", borderWidth: 1, borderColor: "#2f3336", borderRadius: 18, paddingVertical: 13, paddingHorizontal: 16, color: "#fff", fontSize: 16 },
  multi: { minHeight: 90, textAlignVertical: "top" },
  btn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 17, alignItems: "center", marginTop: 24 },
  btnDim: { opacity: 0.35 },
  btnT: { color: "#000", fontWeight: "800", fontSize: 17 },
  fine: { color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  status: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 18, textAlign: "center" },
  doneCard: { backgroundColor: "#000", borderRadius: 28, borderWidth: 1, borderColor: "#2f3336", padding: 28, alignItems: "center" },
  rocket: { fontSize: 52, marginBottom: 12 },
  doneT: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 10 },
  id: { color: "rgba(255,255,255,0.55)", fontFamily: "monospace", fontSize: 12, textAlign: "center", marginBottom: 18 },
  ghost: { borderWidth: 1, borderColor: "#2f3336", borderRadius: 999, paddingVertical: 13, paddingHorizontal: 28, marginTop: 10 },
  ghostT: { color: "#fff", fontWeight: "700" },
  cancel: { paddingVertical: 14, marginTop: 6 },
  cancelT: { color: "rgba(255,255,255,0.6)", fontWeight: "600" },
});
