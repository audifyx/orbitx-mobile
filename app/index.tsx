import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

const { width: W, height: H } = Dimensions.get("window");
const LETTERS = "ORBITX".split("");
const TAGLINE = "The fastest way to trade on Solana";

/* Twinkling star field */
function Star({ x, y, s, d, tw }: { x: number; y: number; s: number; d: number; tw: number }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(d, withTiming(0.55, { duration: 1400 }));
    // twinkle loop driven by shared value below via withRepeat in parent is complex;
    // simple: gentle repeat pulse
  }, []);
  const twk = useSharedValue(0);
  useEffect(() => {
    twk.value = withDelay(
      d,
      withRepeat(
        withSequence(
          withTiming(1, { duration: tw, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: tw, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: o.value * (0.35 + twk.value * 0.65),
  }));
  return (
    <Animated.View
      style={[st, { position: "absolute", left: x, top: y, width: s, height: s, borderRadius: s / 2, backgroundColor: "#fff" }]}
    />
  );
}

/* Occasional shooting star */
function ShootingStar() {
  const x = useSharedValue(-120);
  const o = useSharedValue(0);
  useEffect(() => {
    const fire = () => {
      const startY = 60 + Math.random() * (H * 0.35);
      x.value = -120;
      o.value = 0;
      // set start position via worklet-side values
      x.value = withDelay(400, withTiming(W + 120, { duration: 900, easing: Easing.out(Easing.quad) }));
      o.value = withDelay(400, withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 750 })));
    };
    const t1 = setTimeout(fire, 1400);
    const t2 = setTimeout(fire, 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateX: x.value }, { rotate: "-25deg" }],
  }));
  return (
    <Animated.View style={[st, { position: "absolute", top: H * 0.18, left: 0 }]}>
      <View style={styles.streak} />
    </Animated.View>
  );
}

function SpringLetter({ ch, i }: { ch: string; i: number }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(850 + i * 85, withSpring(1, { damping: 11, stiffness: 160 }));
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: s.value,
    transform: [{ scale: Math.max(s.value, 0.01) }, { translateY: (1 - s.value) * 22 }],
  }));
  return <Animated.Text style={[styles.word, st]}>{ch}</Animated.Text>;
}

/* Typewriter tagline */
function TypeTagline({ start }: { start: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (n >= TAGLINE.length) return;
    const t = setTimeout(() => setN((v) => v + 1), 28);
    return () => clearTimeout(t);
  }, [start, n]);
  return (
    <Text style={styles.tag}>
      {TAGLINE.slice(0, n)}
      <Text style={styles.caret}>▍</Text>
    </Text>
  );
}

export default function Splash() {
  const fadeOut = useSharedValue(1);
  const orbit = useSharedValue(0);
  const glow = useSharedValue(0);
  const markS = useSharedValue(0);
  const barW = useSharedValue(0);
  const [tagStart, setTagStart] = useState(false);

  const stars = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        x: Math.random() * W,
        y: Math.random() * H,
        s: 1 + Math.random() * 2.4,
        d: 200 + Math.random() * 1000,
        tw: 900 + Math.random() * 1800,
      })),
    []
  );

  const goNext = async () => {
    const { data } = await supabase.auth.getSession();
    router.replace(data.session ? "/(tabs)" : "/auth");
  };

  useEffect(() => {
    markS.value = withDelay(250, withSpring(1, { damping: 9, stiffness: 120 }));
    orbit.value = withDelay(300, withRepeat(withTiming(360, { duration: 2400, easing: Easing.linear }), -1));
    glow.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 850, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );
    const tt = setTimeout(() => setTagStart(true), 1650);
    barW.value = withDelay(2000, withTiming(1, { duration: 950, easing: Easing.inOut(Easing.ease) }));
    fadeOut.value = withDelay(3350, withTiming(0, { duration: 450 }, () => runOnJS(goNext)()));
    return () => clearTimeout(tt);
  }, []);

  const wrap = useAnimatedStyle(() => ({ opacity: fadeOut.value }));
  const mark = useAnimatedStyle(() => ({
    opacity: markS.value,
    transform: [{ scale: Math.max(markS.value, 0.01) }],
  }));
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${orbit.value}deg` }] }));
  const pulse = useAnimatedStyle(() => ({
    shadowOpacity: 0.4 + glow.value * 0.5,
    shadowRadius: 16 + glow.value * 26,
    transform: [{ scale: 1 + glow.value * 0.14 }],
  }));
  const bar = useAnimatedStyle(() => ({ width: `${barW.value * 100}%` }));

  return (
    <Animated.View style={[styles.root, wrap]}>
      {stars.map((p) => <Star key={p.id} {...p} />)}
      <ShootingStar />

      {/* halo behind logo */}
      <Animated.View style={[styles.halo, pulse]} />

      <Animated.View style={[styles.markWrap, mark]}>
        <View style={styles.ring}>
          <Animated.View style={[styles.orbitArm, spin]}>
            <View style={styles.sat} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.core, pulse]} />
      </Animated.View>

      <View style={styles.wordRow}>
        {LETTERS.map((ch, i) => <SpringLetter key={i} ch={ch} i={i} />)}
      </View>

      <TypeTagline start={tagStart} />

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, bar]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  streak: { width: 90, height: 2, backgroundColor: "#fff", borderRadius: 1, opacity: 0.9 },
  halo: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.05)", shadowColor: "#fff",
  },
  markWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center", marginBottom: 34 },
  ring: {
    position: "absolute", width: 104, height: 104, borderRadius: 52,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  orbitArm: { position: "absolute", width: 104, height: 104, alignItems: "center" },
  sat: {
    width: 13, height: 13, borderRadius: 6.5, backgroundColor: "#fff",
    marginTop: -7.5, shadowColor: "#fff", shadowOpacity: 0.95, shadowRadius: 12,
  },
  core: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", shadowColor: "#fff" },
  wordRow: { flexDirection: "row", marginBottom: 14 },
  word: { color: "#fff", fontSize: 44, fontWeight: "800", letterSpacing: 10 },
  tag: { color: "rgba(255,255,255,0.6)", fontSize: 15, letterSpacing: 0.5, minHeight: 22 },
  caret: { color: "#fff", opacity: 0.7 },
  barTrack: {
    position: "absolute", bottom: 108, width: 180, height: 2,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 1, overflow: "hidden",
  },
  barFill: { height: 2, backgroundColor: "#fff", borderRadius: 1 },
});
