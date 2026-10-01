import { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

const { width: W, height: H } = Dimensions.get("window");
const LETTERS = "ORBITX".split("");

function Particles() {
  const dots = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        x: Math.random() * W,
        y: Math.random() * H,
        s: 1 + Math.random() * 2.5,
        d: 400 + Math.random() * 900,
      })),
    []
  );
  return (
    <>
      {dots.map((p) => (
        <ParticleDot key={p.id} {...p} />
      ))}
    </>
  );
}

function ParticleDot({ x, y, s, d }: { x: number; y: number; s: number; d: number }) {
  const o = useSharedValue(0);
  const fy = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(d, withTiming(0.5, { duration: 1200 }));
    fy.value = withDelay(
      d,
      withRepeat(withTiming(-14, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1, true)
    );
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: fy.value }],
  }));
  return (
    <Animated.View
      style={[
        st,
        { position: "absolute", left: x, top: y, width: s, height: s, borderRadius: s / 2, backgroundColor: "#fff" },
      ]}
    />
  );
}

function StaggerLetter({ ch, i }: { ch: string; i: number }) {
  const o = useSharedValue(0);
  const y = useSharedValue(18);
  useEffect(() => {
    o.value = withDelay(900 + i * 90, withTiming(1, { duration: 500 }));
    y.value = withDelay(900 + i * 90, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return <Animated.Text style={[styles.word, st]}>{ch}</Animated.Text>;
}

export default function Splash() {
  const fadeOut = useSharedValue(1);
  const orbit = useSharedValue(0);
  const glow = useSharedValue(0);
  const markScale = useSharedValue(0.6);
  const markOp = useSharedValue(0);
  const tagOp = useSharedValue(0);
  const tagY = useSharedValue(14);
  const barW = useSharedValue(0);

  const goNext = async () => {
    const { data } = await supabase.auth.getSession();
    router.replace(data.session ? "/(tabs)" : "/auth");
  };

  useEffect(() => {
    // logo mark draws in
    markOp.value = withDelay(250, withTiming(1, { duration: 700 }));
    markScale.value = withDelay(250, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));
    // orbit spin + glow pulse
    orbit.value = withDelay(300, withRepeat(withTiming(360, { duration: 2600, easing: Easing.linear }), -1));
    glow.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );
    // tagline
    tagOp.value = withDelay(1700, withTiming(1, { duration: 700 }));
    tagY.value = withDelay(1700, withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }));
    // loading bar sweeps
    barW.value = withDelay(1900, withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }));
    // dissolve out
    fadeOut.value = withDelay(3200, withTiming(0, { duration: 450 }, () => runOnJS(goNext)()));
  }, []);

  const wrap = useAnimatedStyle(() => ({ opacity: fadeOut.value }));
  const mark = useAnimatedStyle(() => ({
    opacity: markOp.value,
    transform: [{ scale: markScale.value }],
  }));
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${orbit.value}deg` }] }));
  const pulse = useAnimatedStyle(() => ({
    shadowOpacity: 0.35 + glow.value * 0.55,
    shadowRadius: 14 + glow.value * 22,
    transform: [{ scale: 1 + glow.value * 0.12 }],
  }));
  const tag = useAnimatedStyle(() => ({ opacity: tagOp.value, transform: [{ translateY: tagY.value }] }));
  const bar = useAnimatedStyle(() => ({ width: `${barW.value * 100}%` }));

  return (
    <Animated.View style={[styles.root, wrap]}>
      <Particles />
      <Animated.View style={[styles.markWrap, mark]}>
        {/* orbit ring */}
        <View style={styles.ring}>
          <Animated.View style={[styles.orbitArm, spin]}>
            <View style={styles.sat} />
          </Animated.View>
        </View>
        {/* glowing core */}
        <Animated.View style={[styles.core, pulse]} />
      </Animated.View>

      <View style={styles.wordRow}>
        {LETTERS.map((ch, i) => (
          <StaggerLetter key={i} ch={ch} i={i} />
        ))}
      </View>

      <Animated.Text style={[styles.tag, tag]}>The fastest way to trade on Solana</Animated.Text>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, bar]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  markWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center", marginBottom: 34 },
  ring: {
    position: "absolute", width: 104, height: 104, borderRadius: 52,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center", justifyContent: "center",
  },
  orbitArm: { position: "absolute", width: 104, height: 104, alignItems: "center" },
  sat: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff",
    marginTop: -7, shadowColor: "#fff", shadowOpacity: 0.9, shadowRadius: 10,
  },
  core: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff",
    shadowColor: "#fff",
  },
  wordRow: { flexDirection: "row", marginBottom: 14 },
  word: {
    color: "#fff", fontSize: 42, fontWeight: "800", letterSpacing: 10,
  },
  tag: { color: "rgba(255,255,255,0.55)", fontSize: 15, letterSpacing: 0.5 },
  barTrack: {
    position: "absolute", bottom: 110, width: 180, height: 2,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 1, overflow: "hidden",
  },
  barFill: { height: 2, backgroundColor: "#fff", borderRadius: 1 },
});
