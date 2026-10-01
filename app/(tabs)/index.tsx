import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PostCard, { type Post } from "../../components/PostCard";
import Composer from "../../components/Composer";
import Trending from "../../components/Trending";
import { supabase } from "../../lib/supabase";

function Header() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.mark}>
        <View style={styles.ring} />
        <View style={styles.core} />
      </View>
      <Text style={styles.title}>OrbitX</Text>
    </View>
  );
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "nodb">("loading");

  const load = useCallback(async () => {
    if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
      setState("nodb");
      return;
    }
    try {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      const { data, error } = await supabase
        .from("om_posts")
        .select("id,user_id,text,created_at,om_profiles!inner(handle,display_name,avatar_url)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const withCounts: Post[] = await Promise.all(
        (data ?? []).map(async (p: any) => {
          const [{ count: likes }, { count: reposts }] = await Promise.all([
            supabase.from("om_likes").select("*", { count: "exact", head: true }).eq("post_id", p.id),
            supabase.from("om_reposts").select("*", { count: "exact", head: true }).eq("post_id", p.id),
          ]);
          let liked = false, reposted = false;
          if (uid) {
            const [{ data: l }, { data: r }] = await Promise.all([
              supabase.from("om_likes").select("post_id").eq("user_id", uid).eq("post_id", p.id).maybeSingle(),
              supabase.from("om_reposts").select("post_id").eq("user_id", uid).eq("post_id", p.id).maybeSingle(),
            ]);
            liked = !!l; reposted = !!r;
          }
          return { ...p, like_count: likes ?? 0, repost_count: reposts ?? 0, liked, reposted };
        })
      );
      setPosts(withCounts);
      setState("ok");
    } catch (e) {
      console.warn("feed load failed", e);
      setState("ok"); // honest empty on error; posts stay as-is
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <Header />
      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedPad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        <Composer onPosted={load} />
        <Trending />
        {state === "nodb" && (
          <View style={styles.empty}>
            <Text style={styles.emptyT}>Feed backend not connected yet.</Text>
            <Text style={styles.emptyS}>Posts will appear here once the database is live.</Text>
          </View>
        )}
        {state === "ok" && posts.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyT}>No posts yet.</Text>
            <Text style={styles.emptyS}>Be the first — say what's happening.</Text>
          </View>
        )}
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 18, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: "#2f3336",
    backgroundColor: "#000",
  },
  mark: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 26, height: 26, borderRadius: 13, borderWidth: 1.2, borderColor: "rgba(255,255,255,0.35)" },
  core: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: "#fff" },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  feed: { flex: 1 },
  feedPad: { padding: 12, paddingBottom: 110 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyT: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 6 },
  emptyS: { color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center" },
});
