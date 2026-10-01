import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline, Line } from "react-native-svg";
import { getTokenIntel, type TokenIntel } from "../../lib/token-intel";
import { formatUsd, formatCompact } from "../../lib/market";

function Chart({ intel }: { intel: TokenIntel }) {
  const W = 340, H = 140;
  // Prefer Birdeye candles, fall back to CoinGecko line
  if (intel.candles && intel.candles.length > 1) {
    const cs = intel.candles;
    const lo = Math.min(...cs.map((c) => c.l));
    const hi = Math.max(...cs.map((c) => c.h));
    const span = hi - lo || 1;
    const up = cs[cs.length - 1].c >= cs[0].o;
    const color = up ? "#00c853" : "#ff5252";
    const bw = W / cs.length;
    return (
      <Svg width={W} height={H}>
        {cs.map((c, i) => {
          const x = i * bw + bw / 2;
          const yH = H - 8 - ((c.h - lo) / span) * (H - 16);
          const yL = H - 8 - ((c.l - lo) / span) * (H - 16);
          const yO = H - 8 - ((c.o - lo) / span) * (H - 16);
          const yC = H - 8 - ((c.c - lo) / span) * (H - 16);
          const bull = c.c >= c.o;
          return (
            <Svg key={i}>
              <Line x1={x} y1={yH} x2={x} y2={yL} stroke={bull ? "#00c853" : "#ff5252"} strokeWidth={1.5} />
              <Line
                x1={x - bw * 0.3} y1={Math.min(yO, yC)} x2={x + bw * 0.3} y2={Math.max(yO, yC)}
                stroke={bull ? "#00c853" : "#ff5252"} strokeWidth={4}
              />
            </Svg>
          );
        })}
      </Svg>
    );
  }
  const data = intel.chart;
  if (!data || data.length < 2) {
    return <Text style={styles.nochart}>Chart unavailable for this token.</Text>;
  }
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const up = data[data.length - 1] >= data[0];
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${(H - 8 - ((v - min) / span) * (H - 16)).toFixed(1)}`)
    .join(" ");
  return (
    <Svg width={W} height={H}>
      <Polyline points={pts} fill="none" stroke={up ? "#00c853" : "#ff5252"} strokeWidth={2} />
    </Svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sec}>
      <Text style={styles.secT}>{title}</Text>
      {children}
    </View>
  );
}

export default function TokenPage() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const insets = useSafeAreaInsets();
  const [intel, setIntel] = useState<TokenIntel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setIntel(await getTokenIntel(symbol ?? ""));
      setLoading(false);
    })();
  }, [symbol]);

  const q = intel?.quote;
  const up = (q?.change24h ?? 0) >= 0;

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.navT}>${symbol}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#fff" size="large" /></View>
      ) : !q ? (
        <View style={styles.center}>
          <Text style={styles.err}>Couldn't load ${symbol} right now.</Text>
          <Pressable style={styles.ghost} onPress={() => router.back()}><Text style={styles.ghostT}>Go back</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad}>
          {/* header */}
          <View style={styles.head}>
            <View style={styles.coin}><Text style={styles.coinT}>{q.symbol.slice(0, 1)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{q.name}</Text>
              <Text style={styles.sub}>${q.symbol} · {q.chainId}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.price}>{formatUsd(q.priceUsd)}</Text>
              <Text style={[styles.chg, up ? styles.up : styles.dn]}>
                {up ? "▲" : "▼"} {Math.abs(q.change24h).toFixed(2)}%
              </Text>
            </View>
          </View>

          {/* chart */}
          <View style={styles.chartBox}>
            <Chart intel={intel!} />
          </View>

          {/* stats */}
          <View style={styles.stats}>
            {[
              ["FDV", "$" + formatCompact(q.fdv)],
              ["Liquidity", "$" + formatCompact(q.liquidityUsd)],
              ["Vol 24h", "$" + formatCompact(q.volume24h)],
              ["ATH", intel.ath ? formatUsd(intel.ath) : "—"],
            ].map(([k, v]) => (
              <View key={k} style={styles.stat}>
                <Text style={styles.statK}>{k}</Text>
                <Text style={styles.statV}>{v}</Text>
              </View>
            ))}
          </View>

          {/* trade */}
          <View style={styles.tradeRow}>
            <Pressable style={[styles.tradeBtn, styles.buy]}
              onPress={() => router.push({ pathname: "/(tabs)/trade", params: { symbol, inputMint: "So11111111111111111111111111111111111111112" } })}>
              <Text style={styles.buyT}>Buy</Text>
            </Pressable>
            <Pressable style={[styles.tradeBtn, styles.sell]}
              onPress={() => router.push({ pathname: "/(tabs)/trade", params: { symbol, outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" } })}>
              <Text style={styles.sellT}>Sell</Text>
            </Pressable>
          </View>

          {/* safety */}
          {intel.safety && (
            <Section title="Safety scan">
              <View style={styles.srow}>
                <Text style={styles.sk}>Rugcheck score</Text>
                <Text style={[styles.sv, intel.safety.score <= 30 ? styles.up : intel.safety.score > 65 ? styles.dn : styles.warn]}>
                  {intel.safety.score}
                </Text>
              </View>
              <View style={styles.srow}>
                <Text style={styles.sk}>Mint authority</Text>
                <Text style={styles.sv}>{intel.safety.mintAuthority ? "⚠️ live" : "✓ renounced"}</Text>
              </View>
              <View style={styles.srow}>
                <Text style={styles.sk}>Freeze authority</Text>
                <Text style={styles.sv}>{intel.safety.freezeAuthority ? "⚠️ live" : "✓ renounced"}</Text>
              </View>
              <View style={styles.srow}>
                <Text style={styles.sk}>LP locked</Text>
                <Text style={styles.sv}>{intel.safety.lpLockedPct != null ? `${intel.safety.lpLockedPct}%` : "—"}</Text>
              </View>
              <View style={styles.srow}>
                <Text style={styles.sk}>Top holder</Text>
                <Text style={styles.sv}>{intel.safety.topHolderPct.toFixed(1)}%</Text>
              </View>
              <View style={styles.srow}>
                <Text style={styles.sk}>Insiders / bundles</Text>
                <Text style={[styles.sv, intel.safety.insiderPct > 5 ? styles.dn : styles.up]}>
                  {intel.safety.insiderPct.toFixed(1)}%
                </Text>
              </View>
              {intel.safety.risks.map((r, i) => (
                <Text key={i} style={styles.risk}>• {r}</Text>
              ))}
            </Section>
          )}

          {/* holders / whales */}
          {intel.holders.length > 0 && (
            <Section title="Top holders & whales">
              {intel.holders.map((h, i) => (
                <View key={i} style={styles.hrow}>
                  <Text style={styles.haddr} numberOfLines={1}>
                    {h.address.slice(0, 6)}…{h.address.slice(-4)}
                    {h.pct >= 5 && <Text style={styles.whale}> 🐋</Text>}
                  </Text>
                  <View style={styles.hbar}>
                    <View style={[styles.hfill, { width: `${Math.min(h.pct, 100)}%` }]} />
                  </View>
                  <Text style={styles.hpct}>{h.pct.toFixed(1)}%</Text>
                </View>
              ))}
            </Section>
          )}

          <Pressable style={styles.ghost} onPress={() => q.address && Linking.openURL(`https://dexscreener.com/solana/${q.pairAddress}`)}>
            <Text style={styles.ghostT}>Open on Dexscreener →</Text>
          </Pressable>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  nav: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#2f3336" },
  back: { color: "#fff", fontSize: 22 },
  navT: { color: "#fff", fontSize: 17, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  err: { color: "rgba(255,255,255,0.6)", fontSize: 15, marginBottom: 16 },
  pad: { padding: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  coin: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#2f3336", alignItems: "center", justifyContent: "center" },
  coinT: { color: "#fff", fontSize: 22, fontWeight: "800" },
  name: { color: "#fff", fontSize: 18, fontWeight: "800" },
  sub: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 },
  price: { color: "#fff", fontSize: 22, fontWeight: "800" },
  chg: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  up: { color: "#00c853" },
  dn: { color: "#ff5252" },
  warn: { color: "#ffb300" },
  chartBox: { backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336", padding: 12, alignItems: "center", marginBottom: 12 },
  nochart: { color: "rgba(255,255,255,0.5)", fontSize: 13, paddingVertical: 40 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  stat: { flex: 1, minWidth: "22%", backgroundColor: "#000", borderRadius: 18, borderWidth: 1, borderColor: "#2f3336", padding: 12, alignItems: "center" },
  statK: { color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  statV: { color: "#fff", fontSize: 14, fontWeight: "800", marginTop: 4 },
  tradeRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  tradeBtn: { flex: 1, borderRadius: 999, paddingVertical: 15, alignItems: "center" },
  buy: { backgroundColor: "#00c853" },
  sell: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#ff5252" },
  buyT: { color: "#000", fontWeight: "800", fontSize: 16 },
  sellT: { color: "#ff5252", fontWeight: "800", fontSize: 16 },
  sec: { backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336", padding: 16, marginTop: 12 },
  secT: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 12, letterSpacing: 0.5 },
  srow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#16181c" },
  sk: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
  sv: { color: "#fff", fontSize: 14, fontWeight: "700" },
  risk: { color: "#ffb300", fontSize: 13, marginTop: 6, lineHeight: 18 },
  hrow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  haddr: { color: "#fff", fontFamily: "monospace", fontSize: 12, width: 110 },
  whale: { fontSize: 12 },
  hbar: { flex: 1, height: 6, backgroundColor: "#16181c", borderRadius: 3, overflow: "hidden" },
  hfill: { height: 6, backgroundColor: "#fff", borderRadius: 3 },
  hpct: { color: "rgba(255,255,255,0.6)", fontSize: 12, width: 48, textAlign: "right" },
  ghost: { borderWidth: 1, borderColor: "#2f3336", borderRadius: 999, paddingVertical: 13, alignItems: "center", marginTop: 14 },
  ghostT: { color: "#fff", fontWeight: "700" },
});
