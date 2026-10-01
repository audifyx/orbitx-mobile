import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import Sparkline from "./Sparkline";
import { quoteForCashtag, sparklineForSymbol, formatUsd, formatCompact, type TokenQuote } from "../lib/market";

export default function TokenMiniCard({ cashtag }: { cashtag: string }) {
  const [quote, setQuote] = useState<TokenQuote | null>(null);
  const [spark, setSpark] = useState<number[] | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let live = true;
    (async () => {
      const q = await quoteForCashtag(cashtag);
      if (!live) return;
      if (!q) {
        setState("error");
        return;
      }
      setQuote(q);
      setState("ok");
      const sp = await sparklineForSymbol(q.symbol);
      if (live) setSpark(sp);
    })();
    return () => {
      live = false;
    };
  }, [cashtag]);

  if (state === "loading") {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#fff" size="small" />
        <Text style={styles.loading}>Fetching ${cashtag}…</Text>
      </View>
    );
  }

  if (state === "error" || !quote) {
    return (
      <View style={styles.card}>
        <Text style={styles.err}>Couldn't load ${cashtag} right now.</Text>
      </View>
    );
  }

  const up = quote.change24h >= 0;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.coin}>
          <Text style={styles.coinT}>{quote.symbol.slice(0, 1)}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.sym}>${quote.symbol}</Text>
          <Text style={styles.name}>{quote.name} · {quote.chainId}</Text>
        </View>
        {spark && <Sparkline data={spark} positive={up} />}
      </View>
      <View style={styles.row2}>
        <Text style={styles.price}>{formatUsd(quote.priceUsd)}</Text>
        <Text style={[styles.chg, up ? styles.up : styles.dn]}>
          {up ? "▲" : "▼"} {Math.abs(quote.change24h).toFixed(2)}%
        </Text>
      </View>
      <View style={styles.stats}>
        <Text style={styles.stat}>Vol ${formatCompact(quote.volume24h)}</Text>
        <Text style={styles.stat}>Liq ${formatCompact(quote.liquidityUsd)}</Text>
        <Text style={styles.stat}>FDV ${formatCompact(quote.fdv)}</Text>
      </View>
      <Pressable
        style={styles.viewBtn}
        onPress={() => router.push({ pathname: "/token/[symbol]", params: { symbol: quote.symbol } })}
      >
        <Text style={styles.viewTxt}>View token →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#16181c", borderRadius: 20, borderWidth: 1, borderColor: "#2f3336",
    padding: 14, marginTop: 10,
  },
  loading: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 8, textAlign: "center" },
  err: { color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  coin: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#2f3336",
    alignItems: "center", justifyContent: "center",
  },
  coinT: { color: "#fff", fontSize: 18, fontWeight: "800" },
  meta: { flex: 1 },
  sym: { color: "#fff", fontSize: 16, fontWeight: "800" },
  name: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  row2: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 10 },
  price: { color: "#fff", fontSize: 22, fontWeight: "800" },
  chg: { fontSize: 14, fontWeight: "700" },
  up: { color: "#00c853" },
  dn: { color: "#ff5252" },
  stats: { flexDirection: "row", gap: 14, marginTop: 8 },
  stat: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  viewBtn: {
    marginTop: 12, borderWidth: 1, borderColor: "#2f3336", borderRadius: 999,
    paddingVertical: 9, alignItems: "center", backgroundColor: "#000",
  },
  viewTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
