import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { AuthContext } from "../lib/auth-context";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AuthContext.Provider value={{ session }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#000" } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="u/[handle]" options={{ presentation: "card" }} />
          <Stack.Screen name="token/[symbol]" options={{ presentation: "card" }} />
          <Stack.Screen name="launch" options={{ presentation: "modal" }} />
          <Stack.Screen name="export" options={{ presentation: "modal" }} />
          <Stack.Screen name="wallets/[chain]" options={{ presentation: "card" }} />
        </Stack>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}
