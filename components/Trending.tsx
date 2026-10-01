import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { router } from "expo-router";

interface TrendItem {
  symbol: string;
  name: string;
  mint: string;
  priceUsd?: number;
  change24h?: number;
  tag: string;
}

/** Dexscreener boosted tokens (keyless). */
async function boosted(): Promise<TrendItem[]> {
  const r = await fetch("https://api.dexscreener.com/token-boosts/top/v1");
  if (!r.ok) throw new Error("boosts failed");
  const d = await r.json();
  const cands = (d ?? []).slice(0, 10);
  const results = await Promise.all(
    cands.map(async (b: any): Promise<TrendItem | null> => {
      try {
        const q = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${b.tokenAddress}`);
        const pair = (await q.json())?.pairs?.[0];
        if (!pair?.priceUsd) return null;
        return {
          symbol: pair.baseToken.symbol, name: pair.baseToken.name, mint: pair.baseToken.address,
          priceUsd: Number(pair.priceUsd), change24h: pair.priceChange?.h24, tag: "BOOSTED",
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter((x): x is TrendItem => x !== null).slice(0, 8);
}

/** pump.fun recently launched (keyless, gentle — rate limited). */
async function fresh(): Promise<TrendItem[]> {
  const r = await fetch(
    "https://frontend-api-v3.pump.fun/coins?offset=0&limit=10&sort=created_timestamp&order=DESC&includeNsfw=false",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!r.ok) throw new Error("pump failed");
  const d = await r.json();
  return (Array.isArray(d) ? d : []).slice(0, 10).map((c: any) => ({
    symbol: c.symbol, name: c.name, mint: c.mint, tag: "NEW",
  }));
}

function Row({ item }: { item: TrendItem }) {
  const up = (item.change24h ?? 0) >= 0;
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push({ pathname: "/token/[symbol]", params: { symbol: item.symbol } })}
    >
      <View style={styles.coin}><Text style={styles.coinT}>{item.symbol.slice(0, 1)}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sym}>${item.symbol}</Text>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      </View>
      {item.tag === "NEW" ? (
        <Text style={styles.newTag}>NEW</Text>
      ) : (
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.price}>
            {item.priceUsd != null ? (item.priceUsd >= 1 ? `$${item.priceUsd.toFixed(2)}` : `$${item.priceUsd.toFixed(6)}`) : "—"}
          </Text>
          {item.change24h != null && (
            <Text style={[styles.chg, up ? styles.up : styles.dn]}>
              {up ? "▲" : "▼"} {Math.abs(item.change24h).toFixed(1)}%
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function Trending() {
  const [tab, setTab] = useState<"trending" | "new">("trending");
  const [items, setItems] = useState<TrendItem[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    setItems(null); setErr(false);
    (tab === "trending" ? boosted() : fresh())
      .then((d) => live && setItems(d))
      .catch(() => live && setErr(true));
    return () => { live = false; };
  }, [tab]);

  return (
    <View style={styles.box}>
      <View style={styles.tabs}>
        {(["trending", "new"] as const).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabA]} onPress={() => setTab(t)}>
            <Text style={[styles.tabT, tab === t && styles.tabTA]}>
              {t === "trending" ? "🔥 Trending" : "🆕 Recently launched"}
            </Text>
          </Pressable>
        ))}
      </View>
      {!items && !err && <ActivityIndicator color="#fff" style={{ marginVertical: 24 }} />}
      {err && <Text style={styles.err}>Couldn't load right now — pull to retry.</Text>}
      {items?.map((it, i) => <Row key={it.mint + i} item={it} />)}
      {items && items.length === 0 && !err && <Text style={styles.err}>Nothing here yet.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336", padding: 14, marginBottom: 10 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tab: { flex: 1, borderWidth: 1, borderColor: "#2f3336", borderRadius: 999, paddingVertical: 9, alignItems: "center" },
  tabA: { backgroundColor: "#fff", borderColor: "#fff" },
  tabT: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 13 },
  tabTA: { color: "#000" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#16181c" },
  coin: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#2f3336", alignItems: "center", justifyContent: "center" },
  coinT: { color: "#fff", fontWeight: "800", fontSize: 16 },
  sym: { color: "#fff", fontWeight: "800", fontSize: 15 },
  name: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  price: { color: "#fff", fontWeight: "700", fontSize: 14 },
  chg: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  up: { color: "#00c853" },
  dn: { color: "#ff5252" },
  newTag: { color: "#000", backgroundColor: "#fff", fontWeight: "800", fontSize: 11, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  err: { color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", paddingVertical: 16 },
});
