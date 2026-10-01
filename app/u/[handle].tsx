import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PostCard, { Avatar, type Post } from "../../components/PostCard";
import { supabase } from "../../lib/supabase";

interface Profile {
  user_id: string;
  handle: string;
  display_name: string;
  bio: string;
}

export default function UserProfile() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"om_posts" | "om_likes">("om_posts");

  useEffect(() => {
    (async () => {
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL) { setLoading(false); return; }
      const { data: p } = await supabase.from("om_profiles").select("*").eq("handle", handle).maybeSingle();
      if (!p) { setLoading(false); return; }
      setProfile(p);
      const { data: me } = await supabase.auth.getUser();
      const uid = me.user?.id;
      const [{ count: fc }, { count: gc }, { data: f }, { data: ps }] = await Promise.all([
        supabase.from("om_follows").select("*", { count: "exact", head: true }).eq("following_id", p.user_id),
        supabase.from("om_follows").select("*", { count: "exact", head: true }).eq("follower_id", p.user_id),
        uid ? supabase.from("om_follows").select("*").eq("follower_id", uid).eq("following_id", p.user_id).maybeSingle() : { data: null },
        supabase.from("om_posts").select("id,user_id,text,created_at").eq("user_id", p.user_id).order("created_at", { ascending: false }).limit(30),
      ]);
      setFollowers(fc ?? 0); setFollowing(gc ?? 0); setIsFollowing(!!f);
      setPosts((ps ?? []).map((x: any) => ({ ...x, profiles: p })));
      setLoading(false);
    })();
  }, [handle]);

  const toggleFollow = async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid || !profile || uid === profile.user_id) return;
    if (isFollowing) {
      await supabase.from("om_follows").delete().eq("follower_id", uid).eq("following_id", profile.user_id);
      setIsFollowing(false); setFollowers((c) => c - 1);
    } else {
      await supabase.from("om_follows").insert({ follower_id: uid, following_id: profile.user_id });
      setIsFollowing(true); setFollowers((c) => c + 1);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.navT}>@{handle}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 60 }} />
      ) : !profile ? (
        <View style={styles.empty}><Text style={styles.emptyT}>Profile not found.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad}>
          <View style={styles.banner} />
          <View style={styles.head}>
            <View style={styles.avatarWrap}><Avatar name={profile.display_name} size={72} /></View>
            <Pressable style={[styles.follow, isFollowing && styles.following]} onPress={toggleFollow}>
              <Text style={[styles.followT, isFollowing && styles.followingT]}>
                {isFollowing ? "Following" : "Follow"}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.name}>{profile.display_name}</Text>
          <Text style={styles.handle}>@{profile.handle}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          <View style={styles.counts}>
            <Text style={styles.count}><Text style={styles.bold}>{following}</Text> Following</Text>
            <Text style={styles.count}><Text style={styles.bold}>{followers}</Text> Followers</Text>
          </View>
          <View style={styles.tabs}>
            {(["om_posts", "om_likes"] as const).map((t) => (
              <Pressable key={t} style={[styles.tab, tab === t && styles.tabA]} onPress={() => setTab(t)}>
                <Text style={[styles.tabT, tab === t && styles.tabTA]}>{t === "om_posts" ? "Posts" : "Likes"}</Text>
              </Pressable>
            ))}
          </View>
          {tab === "om_posts" ? (
            posts.length ? posts.map((p) => <PostCard key={p.id} post={p} />) : (
              <View style={styles.empty}><Text style={styles.emptyT}>No posts yet.</Text></View>
            )
          ) : (
            <View style={styles.empty}><Text style={styles.emptyT}>Likes coming soon.</Text></View>
          )}
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
  pad: { paddingBottom: 60 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyT: { color: "rgba(255,255,255,0.6)", fontSize: 15 },
  banner: { height: 110, backgroundColor: "#16181c", borderBottomWidth: 1, borderBottomColor: "#2f3336" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 16, marginTop: -36 },
  avatarWrap: { borderWidth: 3, borderColor: "#000", borderRadius: 39 },
  follow: { backgroundColor: "#fff", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 20 },
  following: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#2f3336" },
  followT: { color: "#000", fontWeight: "800", fontSize: 14 },
  followingT: { color: "#fff" },
  name: { color: "#fff", fontSize: 21, fontWeight: "800", marginTop: 10, paddingHorizontal: 16 },
  handle: { color: "rgba(255,255,255,0.5)", fontSize: 14, paddingHorizontal: 16, marginTop: 2 },
  bio: { color: "#fff", fontSize: 15, paddingHorizontal: 16, marginTop: 10, lineHeight: 21 },
  counts: { flexDirection: "row", gap: 16, paddingHorizontal: 16, marginTop: 10 },
  count: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  bold: { color: "#fff", fontWeight: "800" },
  tabs: { flexDirection: "row", marginTop: 14, borderBottomWidth: 1, borderBottomColor: "#2f3336" },
  tab: { flex: 1, alignItems: "center", paddingVertical: 13 },
  tabA: { borderBottomWidth: 2, borderBottomColor: "#fff" },
  tabT: { color: "rgba(255,255,255,0.5)", fontWeight: "700", fontSize: 14 },
  tabTA: { color: "#fff" },
});
