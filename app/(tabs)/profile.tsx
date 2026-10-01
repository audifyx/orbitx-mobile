import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput, Modal, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import WalletSection from "../../components/WalletSection";
import PostCard, { Avatar, type Post } from "../../components/PostCard";
import { supabase } from "../../lib/supabase";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<{ handle: string; display_name: string; bio: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
    if (p) {
      setProfile(p);
      setName(p.display_name); setBio(p.bio ?? "");
      const { data: ps } = await supabase
        .from("posts").select("id,user_id,text,created_at")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(20);
      setPosts((ps ?? []).map((x: any) => ({ ...x, profiles: p })));
    } else {
      // first run: create from X metadata
      const meta = data.user?.user_metadata ?? {};
      const handle = (meta.user_name ?? meta.preferred_username ?? `user${uid.slice(0, 6)}`).toString().toLowerCase().replace(/[^a-z0-9_]/g, "");
      const row = { user_id: uid, handle, display_name: meta.name ?? handle, bio: "" };
      const { data: created } = await supabase.from("profiles").insert(row).select().maybeSingle();
      if (created) { setProfile(created); setName(created.display_name); }
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!profile || saving) return;
    setSaving(true);
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles")
      .update({ display_name: name.trim() || profile.display_name, bio: bio.trim() })
      .eq("user_id", data.user!.id);
    setSaving(false);
    if (error) Alert.alert("Couldn't save", error.message);
    else { setEditing(false); load(); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Profile</Text>
        {profile && (
          <Pressable onPress={() => setEditing(true)}><Text style={styles.edit}>Edit</Text></Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.card}>
          <Avatar name={profile?.display_name ?? "?"} size={64} />
          <Text style={styles.name}>{profile?.display_name ?? "…"}</Text>
          {profile && <Text style={styles.handle}>@{profile.handle}</Text>}
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        </View>

        <WalletSection />

        <Text style={styles.secT}>Your posts</Text>
        {posts.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyT}>No posts yet.</Text></View>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} />)
        )}

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

      <Modal visible={editing} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetT}>Edit profile</Text>
            <Text style={styles.lbl}>DISPLAY NAME</Text>
            <TextInput style={styles.in} value={name} onChangeText={setName} maxLength={40} />
            <Text style={styles.lbl}>BIO</Text>
            <TextInput style={[styles.in, styles.multi]} value={bio} onChangeText={setBio} maxLength={160} multiline />
            {saving ? <ActivityIndicator color="#fff" style={{ marginTop: 16 }} /> : (
              <Pressable style={styles.btn} onPress={save}><Text style={styles.btnT}>Save</Text></Pressable>
            )}
            <Pressable style={styles.cancel} onPress={() => setEditing(false)}>
              <Text style={styles.cancelT}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 18, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: "#2f3336", backgroundColor: "#000",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  edit: { color: "#fff", fontWeight: "700", fontSize: 15 },
  pad: { padding: 12, paddingBottom: 110 },
  card: {
    backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336",
    padding: 20, alignItems: "center", marginBottom: 12,
  },
  name: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 12 },
  handle: { color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 2 },
  bio: { color: "#fff", fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 },
  secT: { color: "#fff", fontSize: 17, fontWeight: "800", marginTop: 8, marginBottom: 10 },
  empty: { alignItems: "center", paddingVertical: 28, borderWidth: 1, borderColor: "#2f3336", borderRadius: 20, marginBottom: 12 },
  emptyT: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  signout: {
    borderWidth: 1, borderColor: "rgba(255,82,82,0.4)", borderRadius: 999,
    paddingVertical: 13, alignItems: "center", marginTop: 12,
  },
  signoutT: { color: "#ff8a80", fontSize: 15, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#16181c", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: "#2f3336", padding: 22, paddingBottom: 40 },
  sheetT: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  lbl: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginTop: 12, marginBottom: 6 },
  in: { backgroundColor: "#000", borderWidth: 1, borderColor: "#2f3336", borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, color: "#fff", fontSize: 16 },
  multi: { minHeight: 80, textAlignVertical: "top" },
  btn: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 18 },
  btnT: { color: "#000", fontWeight: "800", fontSize: 16 },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelT: { color: "rgba(255,255,255,0.6)", fontWeight: "600" },
});
