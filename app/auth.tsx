import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { onSignedIn } from "../lib/wallets";

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({ scheme: "orbitxmobile", path: "auth/callback" });

function XLogo() {
  return <Text style={styles.xlogo}>𝕏</Text>;
}

export default function Auth() {
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "twitter",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) throw error ?? new Error("No OAuth URL returned");
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== "success" || !res.url) {
        if (res.type !== "cancel" && res.type !== "dismiss") throw new Error("Sign-in was not completed");
        return;
      }
      // Supabase JS parses the session from the redirect URL hash
      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sess.session) throw sessErr ?? new Error("Could not establish session");
      // Self-custody: generate device wallets on first sign-in, sync addresses only
      try {
        await onSignedIn(supabase);
      } catch (wErr) {
        console.warn("[wallets] ensure/sync failed:", wErr);
      }
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Couldn't connect", e?.message ?? "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.mark}>
        <View style={styles.ring} />
        <View style={styles.core} />
      </View>
      <Text style={styles.title}>Trade at the speed of thought</Text>
      <Text style={styles.sub}>Your OrbitX feed, tokens, and wallets — in your pocket.</Text>

      <Pressable style={[styles.btn, busy && styles.btnDim]} onPress={connect} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <XLogo />}
        <Text style={styles.btnText}>{busy ? "Connecting…" : "Connect with X"}</Text>
      </Pressable>

      <Text style={styles.note}>
        New here? This creates your account. Already have one? You're back in.
      </Text>
      <Text style={styles.fine}>
        Wallets are created on this device only. We never see your keys.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 32 },
  mark: { width: 84, height: 84, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  ring: {
    position: "absolute", width: 72, height: 72, borderRadius: 36,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.28)",
  },
  core: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  title: { color: "#fff", fontSize: 30, fontWeight: "800", textAlign: "center", marginBottom: 10, letterSpacing: 0.5 },
  sub: { color: "rgba(255,255,255,0.55)", fontSize: 15, textAlign: "center", marginBottom: 36 },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    backgroundColor: "#000", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 999, paddingVertical: 16, paddingHorizontal: 32, minWidth: 260,
  },
  btnDim: { opacity: 0.6 },
  xlogo: { color: "#fff", fontSize: 20, fontWeight: "800" },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  note: { color: "rgba(255,255,255,0.65)", fontSize: 13.5, textAlign: "center", marginTop: 22, lineHeight: 20 },
  fine: { color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center", marginTop: 10 },
});
