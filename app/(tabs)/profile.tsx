import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import WalletSection from "../../components/WalletSection";
import { Avatar } from "../../components/PostCard";
import { supabase } from "../../lib/supabase";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: p } = await supabase.from("profiles").select("handle,display_name").eq("user_id", uid).maybeSingle();
      setHandle(p?.display_name ?? data.user?.user_metadata?.name ?? "You");
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Profile</Text>
      </View>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.card}>
          <Avatar name={handle ?? "?"} size={64} />
          <Text style={styles.name}>{handle ?? "…"}</Text>
          <Text style={styles.note}>Your OrbitX identity</Text>
        </View>

        <WalletSection />

        <Pressable
          style={styles.signout}
          onPress={() => Alert.alert("Sign out?", "Your wallets stay on this device.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: signOut },
          ])}
        >
          <Text style={styles.signoutT}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: {
    paddingHorizontal: 18, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: "#2f3336", backgroundColor: "#000",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  pad: { padding: 12, paddingBottom: 110 },
  card: {
    backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336",
    padding: 20, alignItems: "center", marginBottom: 12,
  },
  name: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 12 },
  note: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 },
  signout: {
    borderWidth: 1, borderColor: "rgba(255,82,82,0.4)", borderRadius: 999,
    paddingVertical: 13, alignItems: "center", marginTop: 4,
  },
  signoutT: { color: "#ff8a80", fontSize: 15, fontWeight: "700" },
});
