import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TokenMiniCard from "../../components/TokenMiniCard";

/**
 * Token page — placeholder for the full token screen (chart, safety, swap).
 * For now: live quote card via Dexscreener. Full page ships in a later step.
 */
export default function TokenPage() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.navT}>${symbol}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.pad}>
        {!ready ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 60 }} />
        ) : (
          <>
            <TokenMiniCard cashtag={symbol ?? ""} />
            <View style={styles.tradeRow}>
              <Pressable
                style={[styles.tradeBtn, styles.buy]}
                onPress={() => router.push({ pathname: "/(tabs)/trade", params: { symbol, inputMint: "So11111111111111111111111111111111111111112" } })}
              >
                <Text style={styles.buyT}>Buy</Text>
              </Pressable>
              <Pressable
                style={[styles.tradeBtn, styles.sell]}
                onPress={() => router.push({ pathname: "/(tabs)/trade", params: { symbol, outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" } })}
              >
                <Text style={styles.sellT}>Sell</Text>
              </Pressable>
            </View>
            <View style={styles.soon}>
              <Text style={styles.soonT}>Full token page coming soon</Text>
              <Text style={styles.soonS}>
                Live chart, safety scan, holders, and one-tap trading land here next.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  nav: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#2f3336" },
  back: { color: "#fff", fontSize: 22 },
  navT: { color: "#fff", fontSize: 17, fontWeight: "800" },
  pad: { padding: 14 },
  tradeRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  tradeBtn: { flex: 1, borderRadius: 999, paddingVertical: 15, alignItems: "center" },
  buy: { backgroundColor: "#00c853" },
  sell: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#ff5252" },
  buyT: { color: "#000", fontWeight: "800", fontSize: 16 },
  sellT: { color: "#ff5252", fontWeight: "800", fontSize: 16 },
  soon: {
    backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336",
    padding: 24, alignItems: "center", marginTop: 12,
  },
  soonT: { color: "#fff", fontSize: 17, fontWeight: "800", marginBottom: 8 },
  soonS: { color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center", lineHeight: 20 },
});
