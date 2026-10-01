import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { router } from "expo-router";
import TokenMiniCard from "./TokenMiniCard";
import { extractCashtags } from "../lib/market";
import { supabase } from "../lib/supabase";

export interface Post {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  profiles?: { handle: string; display_name: string; avatar_url?: string | null };
  like_count?: number;
  repost_count?: number;
  liked?: boolean;
  reposted?: boolean;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarT, { fontSize: size * 0.42 }]}>{(name?.[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

export { Avatar };

export default function PostCard({ post }: { post: Post }) {
  const tags = extractCashtags(post.text);
  const [liked, setLiked] = useState(!!post.liked);
  const [reposted, setReposted] = useState(!!post.reposted);
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [repostCount, setRepostCount] = useState(post.repost_count ?? 0);

  const toggle = async (kind: "like" | "repost") => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    const table = kind === "like" ? "likes" : "reposts";
    const active = kind === "like" ? liked : reposted;
    try {
      if (active) {
        await supabase.from(table).delete().eq("user_id", uid).eq("post_id", post.id);
        kind === "like" ? (setLiked(false), setLikeCount((c) => c - 1)) : (setReposted(false), setRepostCount((c) => c - 1));
      } else {
        await supabase.from(table).insert({ user_id: uid, post_id: post.id });
        kind === "like" ? (setLiked(true), setLikeCount((c) => c + 1)) : (setReposted(true), setRepostCount((c) => c + 1));
      }
    } catch (e) {
      console.warn("engagement failed", e);
    }
  };

  const goProfile = () =>
    post.profiles?.handle &&
    router.push({ pathname: "/u/[handle]", params: { handle: post.profiles.handle } });

  return (
    <View style={styles.card}>
      <View style={styles.main}>
        <Pressable onPress={goProfile}>
          <Avatar name={post.profiles?.display_name ?? "?"} />
        </Pressable>
        <View style={styles.body}>
          <View style={styles.headRow}>
            <Pressable onPress={goProfile}>
              <Text style={styles.name} numberOfLines={1}>
                {post.profiles?.display_name ?? "Unknown"}
              </Text>
            </Pressable>
            <Pressable onPress={goProfile}>
              <Text style={styles.handle} numberOfLines={1}>
                @{post.profiles?.handle ?? "unknown"} · {timeAgo(post.created_at)}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.text}>{post.text}</Text>
          {tags.map((t) => (
            <TokenMiniCard key={t} cashtag={t} />
          ))}
          <View style={styles.eng}>
            <EngBtn icon="💬" count={0} onPress={() => {}} />
            <EngBtn icon="🔁" count={repostCount} active={reposted} onPress={() => toggle("repost")} />
            <EngBtn icon="♡" activeIcon="♥" count={likeCount} active={liked} onPress={() => toggle("like")} />
            <EngBtn icon="📊" count={0} onPress={() => {}} />
          </View>
        </View>
      </View>
    </View>
  );
}

function EngBtn({
  icon, activeIcon, count, active, onPress,
}: { icon: string; activeIcon?: string; count: number; active?: boolean; onPress: () => void }) {
  const pop = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const press = () => {
    pop.value = withSpring(1.45, { damping: 6, stiffness: 400 }, () => {
      pop.value = withSpring(1, { damping: 8, stiffness: 300 });
    });
    onPress();
  };
  return (
    <Pressable style={styles.engBtn} onPress={press}>
      <Animated.Text style={[styles.engIcon, active && styles.engActive, st]}>
        {active && activeIcon ? activeIcon : icon}
      </Animated.Text>
      {count > 0 && <Text style={[styles.engCount, active && styles.engActive]}>{count}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336",
    padding: 14, marginBottom: 10,
  },
  main: { flexDirection: "row", gap: 10 },
  avatar: { backgroundColor: "#2f3336", alignItems: "center", justifyContent: "center" },
  avatarT: { color: "#fff", fontWeight: "800" },
  body: { flex: 1 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { color: "#fff", fontWeight: "800", fontSize: 15 },
  handle: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  text: { color: "#fff", fontSize: 15, lineHeight: 21, marginTop: 4 },
  eng: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingRight: 20 },
  engBtn: { flexDirection: "row", alignItems: "center", gap: 5, padding: 4 },
  engIcon: { fontSize: 17, color: "rgba(255,255,255,0.5)" },
  engCount: { fontSize: 12, color: "rgba(255,255,255,0.5)" },
  engActive: { color: "#ff4d6d" },
});
