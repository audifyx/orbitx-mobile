import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { CHAINS, ensureWallets, truncateAddress, type ChainId } from "../lib/wallets";
import { getAllBalances, type ChainBalance } from "../lib/balances";

/** Wallets section — 5 chains, live balances, export navigates to /export. */
export default function WalletSection() {
  const [balances, setBalances] = useState<ChainBalance[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const addrs = await ensureWallets();
      // deriveAddresses needs the phrase; get it via balances fn instead
      const { exportSeedPhrase } = await import("../lib/wallets");
      const phrase = await exportSeedPhrase();
      if (phrase) setBalances(await getAllBalances(phrase));
      else {
        // no phrase yet (shouldn't happen after ensureWallets) — show addresses only
        setBalances(
          CHAINS.map((c) => ({
            chain: c.id, label: c.label, address: addrs[c.id],
            native: "—", nativeSymbol: c.symbol, usd: null,
          }))
        );
      }
    } catch (e) {
      console.warn("wallet load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  if (!balances && !loading) {
    return (
      <View style={styles.box}>
        <Text style={styles.h}>Wallets</Text>
        <Text style={styles.sub}>5 self-custody wallets, generated on this device.</Text>
        <Pressable style={styles.btn} onPress={load}>
          <Text style={styles.btnT}>Show my wallets</Text>
        </Pressable>
      </View>
    );
  }

  const totalUsd = balances?.reduce((a, b) => a + (b.usd ?? 0), 0) ?? 0;

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <View>
          <Text style={styles.h}>Wallets</Text>
          <Text style={styles.sub}>Self-custody — keys never leave this device.</Text>
        </View>
        {totalUsd > 0 && <Text style={styles.total}>${totalUsd.toFixed(2)}</Text>}
      </View>

      {loading && <ActivityIndicator color="#fff" style={{ marginVertical: 16 }} />}

      {balances?.map((b) => (
        <Pressable
          key={b.chain}
          style={styles.row}
          onPress={() => router.push({ pathname: "/wallets/[chain]", params: { chain: b.chain } })}
        >
          <View style={styles.coin}><Text style={styles.coinT}>{b.label[0]}</Text></View>
          <View style={styles.meta}>
            <Text style={styles.label}>{b.label}</Text>
            <Text style={styles.addr}>{truncateAddress(b.address)}</Text>
          </View>
          <View style={styles.balWrap}>
            <Text style={styles.bal}>{b.native} {b.nativeSymbol}</Text>
            {b.usd != null && <Text style={styles.usd}>${b.usd.toFixed(2)}</Text>}
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      ))}

      <View style={styles.actions}>
        <Pressable style={styles.copyAll} onPress={() => router.push({ pathname: "/export", params: { chain: "seed" } })}>
          <Text style={styles.copyAllT}>Reveal seed phrase</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>Tap a wallet for activity & export.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336", padding: 16, marginBottom: 12 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  h: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  sub: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  total: { color: "#fff", fontSize: 20, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#1c1f23" },
  coin: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#2f3336", alignItems: "center", justifyContent: "center" },
  coinT: { color: "#fff", fontWeight: "800", fontSize: 16 },
  meta: { flex: 1 },
  label: { color: "#fff", fontSize: 15, fontWeight: "700" },
  addr: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "monospace", marginTop: 2 },
  balWrap: { alignItems: "flex-end" },
  bal: { color: "#fff", fontSize: 14, fontWeight: "700" },
  usd: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 },
  chev: { color: "rgba(255,255,255,0.4)", fontSize: 20 },
  actions: { marginTop: 12 },
  copyAll: { borderWidth: 1, borderColor: "rgba(255,82,82,0.5)", borderRadius: 999, paddingVertical: 11, alignItems: "center" },
  copyAllT: { color: "#ff8a80", fontSize: 13, fontWeight: "700" },
  note: { color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center", marginTop: 10 },
  btn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 13, alignItems: "center", marginTop: 14 },
  btnT: { color: "#000", fontWeight: "800", fontSize: 15 },
});
