import { Tabs } from "expo-router";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

interface TabDef { name: string; label: string; icon: string; center?: boolean }
const TABS: TabDef[] = [
  { name: "index", label: "Home", icon: "⌂" },
  { name: "search", label: "Search", icon: "⌕" },
  { name: "trade", label: "", icon: "⚡", center: true },
  { name: "alerts", label: "Alerts", icon: "♡" },
  { name: "profile", label: "Profile", icon: "◯" },
];

function TabButton({ focused, icon, label, onPress }: { focused: boolean; icon: string; label: string; onPress: () => void }) {
  const s = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={() => { s.value = withSpring(0.82, { damping: 8 }, () => { s.value = withSpring(1); }); onPress(); }}
      style={styles.tab}
    >
      <Animated.View style={[st, styles.tabInner]}>
        <Text style={[styles.icon, focused && styles.iconActive]}>{icon}</Text>
        <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function CenterButton({ onPress }: { onPress: () => void }) {
  const s = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={() => { s.value = withSpring(0.85, { damping: 7 }, () => { s.value = withSpring(1); }); onPress(); }}
      style={styles.centerWrap}
    >
      <Animated.View style={[styles.centerBtn, st]}>
        <Text style={styles.centerIcon}>⚡</Text>
      </Animated.View>
    </Pressable>
  );
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.dock, { bottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route: { key: string; name: string }, i: number) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const focused = state.index === i;
        const onPress = () => navigation.navigate(route.name);
        if (tab.center) return <CenterButton key={route.key} onPress={onPress} />;
        return (
          <TabButton key={route.key} focused={focused} icon={tab.icon} label={tab.label} onPress={onPress} />
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(p) => <TabBar {...p} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "#000" } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="trade" />
      <Tabs.Screen name="alerts" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16181c",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2f3336",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 12 },
    }),
  },
  tab: { alignItems: "center", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 6, minWidth: 62 },
  tabInner: { alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 21, color: "rgba(255,255,255,0.45)" },
  iconActive: { color: "#fff" },
  label: { fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2, fontWeight: "600" },
  labelActive: { color: "#fff" },
  centerWrap: { paddingHorizontal: 6, marginTop: -26 },
  centerBtn: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#2f3336",
    ...Platform.select({
      ios: { shadowColor: "#fff", shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  centerIcon: { fontSize: 26, color: "#000" },
});
