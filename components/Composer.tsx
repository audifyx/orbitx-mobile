import { useState } from "react";
import { View, TextInput, StyleSheet, Pressable, Text, ActivityIndicator, Alert } from "react-native";
import { supabase } from "../lib/supabase";
import { extractCashtags } from "../lib/market";
import { Avatar } from "./PostCard";

export default function Composer({ onPosted }: { onPosted: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const post = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) throw new Error("Sign in to post");
      const { error } = await supabase.from("posts").insert({
        user_id: uid,
        text: t,
        cashtags: extractCashtags(t),
      });
      if (error) throw error;
      setText("");
      onPosted();
    } catch (e: any) {
      Alert.alert("Couldn't post", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Avatar name="Y" size={40} />
        <TextInput
          style={styles.input}
          placeholder="What's happening?"
          placeholderTextColor="rgba(255,255,255,0.4)"
          multiline
          maxLength={500}
          value={text}
          onChangeText={setText}
        />
      </View>
      <View style={styles.footer}>
        <Text style={styles.count}>{text.length}/500</Text>
        <Pressable
          style={[styles.btn, (!text.trim() || busy) && styles.btnDim]}
          onPress={post}
          disabled={!text.trim() || busy}
        >
          {busy ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.btnT}>Post</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336", padding: 14, marginBottom: 10 },
  row: { flexDirection: "row", gap: 10 },
  input: { flex: 1, color: "#fff", fontSize: 16, minHeight: 44, textAlignVertical: "top", paddingTop: 8 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  count: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  btn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 22 },
  btnDim: { opacity: 0.35 },
  btnT: { color: "#000", fontWeight: "800", fontSize: 15 },
});
