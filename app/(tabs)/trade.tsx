import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView,
  ActivityIndicator, Alert, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import {
  searchTokens, defaultTokens, getQuote, executeSwap, getSolBalance,
  toBaseUnits, fromBaseUnits, SOL_MINT, USDC_MINT,
  type JupToken, type QuoteResult,
} from "../../lib/jupiter";

type Phase = "idle" | "quoting" | "ready" | "swapping" | "done" | "error";

export default function Trade() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ inputMint?: string; outputMint?: string; symbol?: string }>();

  const [input, setInput] = useState<JupToken>({ address: SOL_MINT, symbol: "SOL", name: "Solana", decimals: 9 });
  const [output, setOutput] = useState<JupToken>({ address: USDC_MINT, symbol: "USDC", name: "USD Coin", decimals: 6 });
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [sig, setSig] = useState("");
  const [solBal, setSolBal] = useState<string | null>(null);
  const [picker, setPicker] = useState<"in" | "out" | null>(null);
  const [tokens, setTokens] = useState<JupToken[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // prefill from token page (Buy/Sell)
  useEffect(() => {
    (async () => {
      if (params.inputMint || params.outputMint || params.symbol) {
        try {
          const list = params.symbol ? await searchTokens(params.symbol) : [];
          const found = list[0];
          if (params.symbol && found) {
            // Buy X = pay SOL, receive X ; Sell X = pay X, receive USDC
            if (params.inputMint === SOL_MINT || !params.inputMint) {
              setOutput({ address: found.address, symbol: found.symbol, name: found.name, decimals: found.decimals });
            } else {
              setInput({ address: found.address, symbol: found.symbol, name: found.name, decimals: found.decimals });
              setOutput({ address: USDC_MINT, symbol: "USDC", name: "USD Coin", decimals: 6 });
            }
          }
        } catch { /* ignore */ }
      }
    })();
  }, []);

  useEffect(() => { getSolBalance().then((b) => setSolBal(b.toFixed(4))).catch(() => {}); }, []);
  useEffect(() => { defaultTokens().then(setTokens).catch(() => {}); }, []);

  // debounce quote
  useEffect(() => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setQuote(null); setPhase("idle"); return;
    }
    setPhase("quoting");
    const t = setTimeout(async () => {
      try {
        const q = await getQuote(input.address, output.address, toBaseUnits(amount, input.decimals));
        setQuote(q); setPhase("ready"); setErr("");
      } catch (e: any) {
        setErr(e?.message ?? "Quote failed"); setPhase("error"); setQuote(null);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [amount, input.address, output.address]);

  const openPicker = async (side: "in" | "out") => {
    setPicker(side); setQuery("");
    setSearching(true);
    try { setTokens(await defaultTokens()); } finally { setSearching(false); }
  };

  const onSearch = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) return;
    setSearching(true);
    try { setTokens(await searchTokens(q.trim())); } catch { /* keep old */ }
    finally { setSearching(false); }
  };

  const pick = (t: JupToken) => {
    if (picker === "in") {
      if (t.address === output.address) setOutput(input);
      setInput(t);
    } else {
      if (t.address === input.address) setInput(output);
      setOutput(t);
    }
    setPicker(null);
  };

  const flip = () => {
    const a = input; setInput(output); setOutput(a); setAmount("");
  };

  const doSwap = () => {
    if (!quote) return;
    Alert.alert(
      `Swap ${amount} ${input.symbol} → ${output.symbol}?`,
      `You'll receive about ${fromBaseUnits(quote.outAmount, output.decimals)} ${output.symbol}. Signed on this device.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm swap", onPress: runSwap },
      ]
    );
  };

  const runSwap = async () => {
    if (!quote) return;
    setPhase("swapping"); setErr("");
    try {
      const s = await executeSwap(quote);
      setSig(s); setPhase("done"); setAmount(""); setQuote(null);
      getSolBalance().then((b) => setSolBal(b.toFixed(4))).catch(() => {});
    } catch (e: any) {
      setErr(e?.message ?? "Swap failed"); setPhase("error");
    }
  };

  const outHuman = quote ? fromBaseUnits(quote.outAmount, output.decimals) : "";
  const canSwap = phase === "ready";
  const swapping = phase === "swapping";

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Trade</Text>
        <View style={styles.headRight}>
          <View style={styles.chainPill}><Text style={styles.chainT}>Solana</Text></View>
          <Pressable style={styles.launchBtn} onPress={() => router.push("/launch")}>
            <Text style={styles.launchT}>🚀 Launch</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        {/* FROM */}
        <View style={styles.card}>
          <Text style={styles.lbl}>You pay</Text>
          <View style={styles.row}>
            <Pressable style={styles.tokBtn} onPress={() => openPicker("in")}>
              <Text style={styles.tokT}>{input.symbol} ▾</Text>
            </Pressable>
            <TextInput
              style={styles.amt}
              placeholder="0.0"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
          {solBal !== null && input.address === SOL_MINT && (
            <Text style={styles.bal}>Balance: {solBal} SOL</Text>
          )}
        </View>

        <View style={styles.flipWrap}>
          <Pressable style={styles.flip} onPress={flip}><Text style={styles.flipT}>⇅</Text></Pressable>
        </View>

        {/* TO */}
        <View style={styles.card}>
          <Text style={styles.lbl}>You receive</Text>
          <View style={styles.row}>
            <Pressable style={styles.tokBtn} onPress={() => openPicker("out")}>
              <Text style={styles.tokT}>{output.symbol} ▾</Text>
            </Pressable>
            <Text style={styles.amtOut} numberOfLines={1}>
              {phase === "quoting" ? "…" : outHuman || "0.0"}
            </Text>
          </View>
          {!!quote && (
            <Text style={styles.impact}>
              Price impact: {Number(quote.priceImpactPct).toFixed(2)}%
            </Text>
          )}
        </View>

        {!!err && <Text style={styles.err}>{err}</Text>}

        {phase === "done" && !!sig ? (
          <View style={styles.doneCard}>
            <Text style={styles.doneT}>✓ Swap confirmed</Text>
            <Text style={styles.sig} numberOfLines={2}>{sig}</Text>
            <Pressable onPress={() => Linking.openURL(`https://solscan.io/tx/${sig}`)}>
              <Text style={styles.link}>View on Solscan →</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => { setPhase("idle"); setSig(""); }}>
              <Text style={styles.btnT}>New swap</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.btn, !canSwap && styles.btnDim]}
            onPress={doSwap}
            disabled={!canSwap}
          >
            {swapping ? <ActivityIndicator color="#000" /> : (
              <Text style={styles.btnT}>
                {phase === "quoting" ? "Finding route…" : `Swap${quote ? ` → ${outHuman.slice(0, 12)} ${output.symbol}` : ""}`}
              </Text>
            )}
          </Pressable>
        )}

        <Text style={styles.fine}>
          EVM swaps (Base, Ethereum, Arc, Robinhood Chain) coming soon — Solana is live now.
        </Text>
      </ScrollView>

      {/* token picker */}
      <Modal visible={picker !== null} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetT}>Select token</Text>
            <TextInput
              style={styles.search}
              placeholder="Search name or symbol…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={query}
              onChangeText={onSearch}
            />
            {searching && <ActivityIndicator color="#fff" style={{ marginVertical: 8 }} />}
            <ScrollView style={{ maxHeight: 320 }}>
              {tokens.map((t) => (
                <Pressable key={t.address} style={styles.tokRow} onPress={() => pick(t)}>
                  <View style={styles.tokCoin}><Text style={styles.tokCoinT}>{t.symbol.slice(0, 1)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tokName}>{t.symbol}</Text>
                    <Text style={styles.tokSub} numberOfLines={1}>{t.name}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.cancel} onPress={() => setPicker(null)}>
              <Text style={styles.cancelT}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#2f3336",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  headRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  chainPill: { borderWidth: 1, borderColor: "#2f3336", borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12, backgroundColor: "#16181c" },
  launchBtn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13 },
  launchT: { color: "#000", fontSize: 12, fontWeight: "800" },
  chainT: { color: "#fff", fontSize: 12, fontWeight: "700" },
  pad: { padding: 14, paddingBottom: 120 },
  card: { backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336", padding: 16 },
  lbl: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  tokBtn: { backgroundColor: "#16181c", borderWidth: 1, borderColor: "#2f3336", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  tokT: { color: "#fff", fontWeight: "800", fontSize: 16 },
  amt: { flex: 1, color: "#fff", fontSize: 30, fontWeight: "700", textAlign: "right" },
  amtOut: { flex: 1, color: "#fff", fontSize: 30, fontWeight: "700", textAlign: "right", opacity: 0.9 },
  bal: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 8, textAlign: "right" },
  impact: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 8 },
  flipWrap: { alignItems: "center", marginVertical: -14, zIndex: 1 },
  flip: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#16181c", borderWidth: 1, borderColor: "#2f3336", alignItems: "center", justifyContent: "center" },
  flipT: { color: "#fff", fontSize: 20 },
  err: { color: "#ff8a80", fontSize: 13, textAlign: "center", marginTop: 12 },
  btn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 17, alignItems: "center", marginTop: 16 },
  btnDim: { opacity: 0.4 },
  btnT: { color: "#000", fontWeight: "800", fontSize: 17 },
  fine: { color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 18 },
  doneCard: { backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336", padding: 20, marginTop: 16, alignItems: "center" },
  doneT: { color: "#00c853", fontSize: 18, fontWeight: "800", marginBottom: 10 },
  sig: { color: "rgba(255,255,255,0.55)", fontFamily: "monospace", fontSize: 11, textAlign: "center", marginBottom: 10 },
  link: { color: "#fff", fontWeight: "700", fontSize: 14, marginBottom: 6 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#16181c", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: "#2f3336", padding: 20, paddingBottom: 40 },
  sheetT: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  search: { backgroundColor: "#000", borderWidth: 1, borderColor: "#2f3336", borderRadius: 999, paddingVertical: 11, paddingHorizontal: 18, color: "#fff", fontSize: 15, marginBottom: 8 },
  tokRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#1c1f23" },
  tokCoin: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#2f3336", alignItems: "center", justifyContent: "center" },
  tokCoinT: { color: "#fff", fontWeight: "800" },
  tokName: { color: "#fff", fontWeight: "800", fontSize: 15 },
  tokSub: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  cancel: { paddingVertical: 12, alignItems: "center", marginTop: 6 },
  cancelT: { color: "rgba(255,255,255,0.6)", fontWeight: "600" },
});
