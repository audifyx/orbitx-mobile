import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { CHAINS, exportSeedPhrase, truncateAddress, type ChainId } from "../../lib/wallets";
import { getAllBalances, getActivity, type ChainBalance, type TxItem } from "../../lib/balances";

function timeAgo(t: number): string {
  if (!t) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function WalletDetail() {
  const { chain } = useLocalSearchParams<{ chain: string }>();
  const insets = useSafeAreaInsets();
  const info = CHAINS.find((c) => c.id === chain);
  const [bal, setBal] = useState<ChainBalance | null>(null);
  const [txs, setTxs] = useState<TxItem[] | null>(null);

  useEffect(() => {
    (async () => {
      const phrase = await exportSeedPhrase();
      if (!phrase || !info) return;
      const all = await getAllBalances(phrase);
      const b = all.find((x) => x.chain === chain) ?? null;
      setBal(b);
      if (b) setTxs(await getActivity(b.chain, b.address));
    })();
  }, [chain]);

  if (!info) return null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.title}>{info.label} wallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.pad}>
        {!bal ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 60 }} />
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.bigBal}>{bal.native} {bal.nativeSymbol}</Text>
              {bal.usd != null && <Text style={styles.usd}>≈ ${bal.usd.toFixed(2)}</Text>}
              <Pressable style={styles.addrRow} onPress={() => Clipboard.setStringAsync(bal.address)}>
                <Text style={styles.addr}>{truncateAddress(bal.address)}</Text>
                <Text style={styles.copy}>⧉</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.expBtn}
              onPress={() => router.push({ pathname: "/export", params: { chain: info.id } })}
            >
              <Text style={styles.expT}>Export private key</Text>
            </Pressable>

            <Text style={styles.secT}>Activity</Text>
            {!txs ? (
              <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
            ) : txs.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyT}>No transactions yet.</Text>
              </View>
            ) : (
              txs.map((t, i) => (
                <Pressable key={i} style={styles.tx} onPress={() => Linking.openURL(t.explorer)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hash} numberOfLines={1}>
                      {t.hash.slice(0, 10)}…{t.hash.slice(-6)}
                    </Text>
                    <Text style={styles.meta}>
                      {t.from ? `${t.from.slice(0, 6)}… → ${t.to.slice(0, 6)}…` : t.value} · {timeAgo(t.time)}
                    </Text>
                  </View>
                  <Text style={styles.open}>↗</Text>
                </Pressable>
              ))
            )}
          </>
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
  hero: { backgroundColor: "#000", borderRadius: 28, borderWidth: 1, borderColor: "#2f3336", padding: 28, alignItems: "center" },
  bigBal: { color: "#fff", fontSize: 34, fontWeight: "800" },
  usd: { color: "rgba(255,255,255,0.5)", fontSize: 16, marginTop: 6 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, borderWidth: 1, borderColor: "#2f3336", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  addr: { color: "#fff", fontFamily: "monospace", fontSize: 13 },
  copy: { color: "rgba(255,255,255,0.6)", fontSize: 14 },
  expBtn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 15, alignItems: "center", marginTop: 14 },
  expT: { color: "#000", fontWeight: "800", fontSize: 16 },
  secT: { color: "#fff", fontSize: 17, fontWeight: "800", marginTop: 22, marginBottom: 10 },
  empty: { alignItems: "center", paddingVertical: 32, borderWidth: 1, borderColor: "#2f3336", borderRadius: 20 },
  emptyT: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  tx: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#16181c" },
  hash: { color: "#fff", fontFamily: "monospace", fontSize: 13 },
  meta: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 3 },
  open: { color: "rgba(255,255,255,0.5)", fontSize: 16 },
});
