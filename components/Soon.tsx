import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Soon({ title, sub }: { title: string; sub: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 60 }]}>
      <View style={styles.bubble}>
        <Text style={styles.t}>{title}</Text>
        <Text style={styles.s}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", alignItems: "center", paddingHorizontal: 24 },
  bubble: {
    backgroundColor: "#000", borderRadius: 24, borderWidth: 1, borderColor: "#2f3336",
    padding: 28, alignItems: "center", width: "100%",
  },
  t: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  s: { color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center", lineHeight: 20 },
});
