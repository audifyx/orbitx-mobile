import { Tabs } from "expo-router";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
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

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.dock, { bottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route: { key: string; name: string }, i: number) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const focused = state.index === i;
        const onPress = () => navigation.navigate(route.name);
        if (tab.center) {
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.centerWrap}>
              <View style={styles.centerBtn}>
                <Text style={styles.centerIcon}>{tab.icon}</Text>
              </View>
            </Pressable>
          );
        }
        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tab}>
            <Text style={[styles.icon, focused && styles.iconActive]}>{tab.icon}</Text>
            <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
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
