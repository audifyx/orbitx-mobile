import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, Alert, ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  CHAINS, ensureWallets, exportSeedPhrase, exportPrivateKey, truncateAddress, type ChainId,
} from "../lib/wallets";

/**
 * Wallets section — lists the 5 self-custody wallets.
 * Keys live ONLY in SecureStore on this device. Export reveals them here
 * and only here, after explicit confirmation.
 */
export default function WalletSection() {
  const [addresses, setAddresses] = useState<Record<ChainId, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmChain, setConfirmChain] = useState<ChainId | null>(null);
  const [revealed, setRevealed] = useState<{ label: string; value: string } | null>(null);
  const [revealing, setRevealing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAddresses(await ensureWallets());
    } catch (e) {
      console.warn("wallet load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  if (!addresses && !loading) {
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

  const doRevealSeed = async () => {
    setRevealing(true);
    try {
      const phrase = await exportSeedPhrase();
      setConfirmChain(null);
      if (phrase) setRevealed({ label: "Seed phrase — restores all 5 wallets", value: phrase });
    } finally {
      setRevealing(false);
    }
  };

  const doRevealKey = async (chain: ChainId) => {
    setRevealing(true);
    try {
      const key = await exportPrivateKey(chain);
      setConfirmChain(null);
      if (key) {
        const label = CHAINS.find((c) => c.id === chain)?.label ?? chain;
        setRevealed({ label: `${label} private key`, value: key });
      }
    } finally {
      setRevealing(false);
    }
  };

  const copy = async (v: string) => {
    await Clipboard.setStringAsync(v);
    Alert.alert("Copied", "Keep it somewhere safe — never share it.");
  };

  return (
    <View style={styles.box}>
      <Text style={styles.h}>Wallets</Text>
      <Text style={styles.sub}>Self-custody — keys never leave this device.</Text>

      {loading && <ActivityIndicator color="#fff" style={{ marginVertical: 16 }} />}

      {addresses &&
        CHAINS.map((c) => (
          <View key={c.id} style={styles.row}>
            <View style={styles.coin}>
              <Text style={styles.coinT}>{c.label[0]}</Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.label}>{c.label}</Text>
              <Text style={styles.addr}>{truncateAddress(addresses[c.id])}</Text>
            </View>
            <Pressable style={styles.copyBtn} onPress={() => Clipboard.setStringAsync(addresses[c.id])}>
              <Text style={styles.copyT}>Copy</Text>
            </Pressable>
            <Pressable style={styles.expBtn} onPress={() => setConfirmChain(c.id)}>
              <Text style={styles.expT}>Export</Text>
            </Pressable>
          </View>
        ))}

      {addresses && (
        <Pressable style={styles.seedBtn} onPress={() => setConfirmChain("__seed" as ChainId)}>
          <Text style={styles.seedT}>Reveal seed phrase (all wallets)</Text>
        </Pressable>
      )}

      {/* confirmation */}
      <Modal visible={confirmChain !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.warnT}>⚠️ Export private key material?</Text>
            <Text style={styles.warnS}>
              Anyone with this key controls these funds forever. Never share it, never screenshot
              it into a chat, never paste it on a website. If this device is lost without a backup,
              the funds are unrecoverable.
            </Text>
            {revealing ? (
              <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} />
            ) : (
              <>
                <Pressable
                  style={[styles.btn, styles.danger]}
                  onPress={() =>
                    confirmChain === ("__seed" as ChainId) ? doRevealSeed() : doRevealKey(confirmChain!)
                  }
                >
                  <Text style={styles.btnT}>I understand — reveal</Text>
                </Pressable>
                <Pressable style={styles.cancel} onPress={() => setConfirmChain(null)}>
                  <Text style={styles.cancelT}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* revealed key */}
      <Modal visible={revealed !== null} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.warnT}>{revealed?.label}</Text>
            <ScrollView style={styles.keyBox}>
              <Text style={styles.key} selectable>{revealed?.value}</Text>
            </ScrollView>
            <Pressable style={styles.btn} onPress={() => revealed && copy(revealed.value)}>
              <Text style={styles.btnT}>Copy</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setRevealed(null)}>
              <Text style={styles.cancelT}>Done — hide it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336", padding: 16, marginBottom: 12 },
  h: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  sub: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#1c1f23" },
  coin: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#2f3336", alignItems: "center", justifyContent: "center" },
  coinT: { color: "#fff", fontWeight: "800", fontSize: 16 },
  meta: { flex: 1 },
  label: { color: "#fff", fontSize: 15, fontWeight: "700" },
  addr: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "monospace", marginTop: 2 },
  copyBtn: { borderWidth: 1, borderColor: "#2f3336", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  copyT: { color: "#fff", fontSize: 12, fontWeight: "700" },
  expBtn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  expT: { color: "#000", fontSize: 12, fontWeight: "800" },
  seedBtn: { marginTop: 12, borderWidth: 1, borderColor: "rgba(255,82,82,0.5)", borderRadius: 999, paddingVertical: 11, alignItems: "center" },
  seedT: { color: "#ff8a80", fontSize: 13, fontWeight: "700" },
  btn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 13, alignItems: "center", marginTop: 14 },
  danger: { backgroundColor: "#ff5252" },
  btnT: { color: "#000", fontWeight: "800", fontSize: 15 },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelT: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#16181c", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: "#2f3336", padding: 24, paddingBottom: 40 },
  warnT: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 10 },
  warnS: { color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 21 },
  keyBox: { backgroundColor: "#000", borderRadius: 16, borderWidth: 1, borderColor: "#2f3336", padding: 14, marginTop: 14, maxHeight: 160 },
  key: { color: "#fff", fontFamily: "monospace", fontSize: 13, lineHeight: 20 },
});
