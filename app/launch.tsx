import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  ActivityIndicator, Alert, Image, Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { launchPumpToken, type QuotePair } from "../lib/pump";
import { supabase } from "../lib/supabase";

type Step = "form" | "deploying" | "done";

/**
 * Launch — Solana-only, via the pump.fun program (mirrors the OrbitX launchpad).
 * Vanity mint (…obx), SOL or USDC liquidity pair, working dev-buy.
 * The user pays gas from their own wallet. Never a platform wallet.
 */
export default function Launch() {
  const insets = useSafeAreaInsets();
  const [pair, setPair] = useState<QuotePair>("sol");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [desc, setDesc] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [devBuy, setDevBuy] = useState("0");
  const [step, setStep] = useState<Step>("form");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ mint: string; sig: string; devSig?: string; vanity: boolean } | null>(null);

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!r.canceled && r.assets[0]) setImage(r.assets[0].uri);
  };

  const valid = name.trim().length >= 2 && ticker.trim().length >= 2;

  const deploy = () => {
    const dev = Number(devBuy) || 0;
    Alert.alert(
      `Launch $${ticker.toUpperCase()} on pump.fun?`,
      `Pair: ${pair === "sol" ? "SOL" : "USDC"}${dev > 0 ? `\nDev buy: ${dev} ${pair === "sol" ? "SOL" : "USDC"}` : "\nNo dev buy"}\n\nDeploys from YOUR wallet. You pay the gas. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "🚀 Launch", onPress: runDeploy },
      ]
    );
  };

  const runDeploy = async () => {
    setStep("deploying");
    try {
      const r = await launchPumpToken(
        {
          name: name.trim(),
          symbol: ticker.trim().toUpperCase(),
          description: desc.trim(),
          imageUri: image ?? undefined,
          pair,
          devBuySol: Number(devBuy) || 0,
        },
        setStatus
      );
      setResult({ mint: r.mint, sig: r.signature, devSig: r.devBuySignature, vanity: r.vanity });
      // auto-post to the recently-launched feed with the $CASHTAG + track the launch
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const { data: post } = await supabase.from("om_posts").insert({
            user_id: data.user.id,
            text: `🚀 Just launched $${ticker.trim().toUpperCase()} on pump.fun (${pair === "sol" ? "SOL" : "USDC"} pair)${r.vanity ? " — vanity mint …obx" : ""}. ${desc.trim()}`,
            cashtags: [ticker.trim().toUpperCase()],
          }).select("id").maybeSingle();
          await supabase.from("om_launches").insert({
            user_id: data.user.id,
            post_id: post?.id ?? null,
            mint: r.mint,
            name: name.trim(),
            symbol: ticker.trim().toUpperCase(),
            pair,
            signature: r.signature,
            dev_buy_signature: r.devBuySignature ?? null,
            vanity: r.vanity,
            metadata_uri: r.metadataUri ?? null,
          });
        }
      } catch { /* feed is best-effort */ }
      setStep("done");
    } catch (e: any) {
      setStep("form");
      Alert.alert("Launch failed", e?.message ?? "Something went wrong. Check your SOL balance and try again.");
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.title}>Launch a token</Text>
        <View style={styles.pumpPill}><Text style={styles.pumpT}>pump.fun</Text></View>
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
            {result.vanity && <Text style={styles.vanity}>✨ vanity mint …obx</Text>}
            <Text style={styles.id} selectable numberOfLines={2}>{result.mint}</Text>
            <Pressable style={styles.btn} onPress={() => Linking.openURL(`https://pump.fun/coin/${result.mint}`)}>
              <Text style={styles.btnT}>View on pump.fun →</Text>
            </Pressable>
            <Pressable
              style={styles.ghost}
              onPress={() => router.push({ pathname: "/token/[symbol]", params: { symbol: ticker.toUpperCase() } })}
            >
              <Text style={styles.ghostT}>Open token page</Text>
            </Pressable>
            <Text style={styles.fine}>Auto-posted to recently launched with ${ticker.toUpperCase()}</Text>
            <Pressable style={styles.cancel} onPress={() => router.back()}>
              <Text style={styles.cancelT}>Done</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Text style={styles.lbl}>LIQUIDITY PAIR</Text>
          <View style={styles.pairRow}>
            {(["sol", "usdc"] as QuotePair[]).map((p) => (
              <Pressable key={p} style={[styles.pair, pair === p && styles.pairA]} onPress={() => setPair(p)}>
                <Text style={[styles.pairT, pair === p && styles.pairTA]}>
                  {p === "sol" ? "◎ SOL" : "$ USDC"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.lbl}>TOKEN IMAGE</Text>
          <Pressable style={styles.imgBox} onPress={pickImage}>
            {image ? <Image source={{ uri: image }} style={styles.img} /> : <Text style={styles.imgPh}>＋ Add image</Text>}
          </Pressable>

          <Text style={styles.lbl}>NAME</Text>
          <TextInput style={styles.in} placeholder="e.g. OrbitX Coin" placeholderTextColor="rgba(255,255,255,0.3)"
            value={name} onChangeText={setName} maxLength={32} />

          <Text style={styles.lbl}>TICKER</Text>
          <TextInput style={styles.in} placeholder="e.g. OXC" placeholderTextColor="rgba(255,255,255,0.3)"
            value={ticker} onChangeText={(t) => setTicker(t.replace(/[^a-zA-Z0-9]/g, ""))} maxLength={10}
            autoCapitalize="characters" />

          <Text style={styles.lbl}>DESCRIPTION</Text>
          <TextInput style={[styles.in, styles.multi]} placeholder="What is this coin about?"
            placeholderTextColor="rgba(255,255,255,0.3)" value={desc} onChangeText={setDesc}
            multiline maxLength={280} />

          <Text style={styles.lbl}>DEV BUY ({pair === "sol" ? "SOL" : "USDC"}) — OPTIONAL</Text>
          <TextInput style={styles.in} placeholder="0" placeholderTextColor="rgba(255,255,255,0.3)"
            value={devBuy} onChangeText={(t) => setDevBuy(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" />
          <Text style={styles.hint}>
            Buy your own coin at launch from your wallet. {pair === "usdc" ? "Buys right after create — " : "Same transaction — "}you pay.
          </Text>

          <Pressable style={[styles.btn, !valid && styles.btnDim]} onPress={deploy} disabled={!valid}>
            <Text style={styles.btnT}>🚀 Launch on pump.fun</Text>
          </Pressable>
          <Text style={styles.fine}>
            Vanity mint …obx when found. Deploys from your in-app wallet — you pay gas, never a platform wallet.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#2f3336" },
  back: { color: "#fff", fontSize: 22 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 0.5, flex: 1 },
  pumpPill: { borderWidth: 1, borderColor: "#2f3336", borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12, backgroundColor: "#16181c" },
  pumpT: { color: "#fff", fontSize: 12, fontWeight: "700" },
  pad: { padding: 16, paddingBottom: 60 },
  lbl: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginTop: 16, marginBottom: 8 },
  pairRow: { flexDirection: "row", gap: 10 },
  pair: { flex: 1, borderWidth: 1, borderColor: "#2f3336", borderRadius: 18, paddingVertical: 14, alignItems: "center", backgroundColor: "#000" },
  pairA: { backgroundColor: "#fff", borderColor: "#fff" },
  pairT: { color: "#fff", fontWeight: "800", fontSize: 16 },
  pairTA: { color: "#000" },
  imgBox: { width: 96, height: 96, borderRadius: 24, borderWidth: 1, borderColor: "#2f3336", borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: "#000", overflow: "hidden" },
  img: { width: 96, height: 96 },
  imgPh: { color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600" },
  in: { backgroundColor: "#000", borderWidth: 1, borderColor: "#2f3336", borderRadius: 18, paddingVertical: 13, paddingHorizontal: 16, color: "#fff", fontSize: 16 },
  multi: { minHeight: 90, textAlignVertical: "top" },
  hint: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6, lineHeight: 17 },
  btn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 17, alignItems: "center", marginTop: 24 },
  btnDim: { opacity: 0.35 },
  btnT: { color: "#000", fontWeight: "800", fontSize: 17 },
  fine: { color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  status: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 18, textAlign: "center" },
  doneCard: { backgroundColor: "#000", borderRadius: 28, borderWidth: 1, borderColor: "#2f3336", padding: 28, alignItems: "center" },
  rocket: { fontSize: 52, marginBottom: 12 },
  doneT: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 6 },
  vanity: { color: "#fff", fontSize: 13, fontWeight: "700", marginBottom: 8, opacity: 0.8 },
  id: { color: "rgba(255,255,255,0.55)", fontFamily: "monospace", fontSize: 12, textAlign: "center", marginBottom: 18 },
  ghost: { borderWidth: 1, borderColor: "#2f3336", borderRadius: 999, paddingVertical: 13, paddingHorizontal: 28, marginTop: 10 },
  ghostT: { color: "#fff", fontWeight: "700" },
  cancel: { paddingVertical: 14, marginTop: 6 },
  cancelT: { color: "rgba(255,255,255,0.6)", fontWeight: "600" },
});
