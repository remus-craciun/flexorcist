import "../global.css";

import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
} from "@expo-google-fonts/barlow";
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from "@expo-google-fonts/barlow-condensed";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SyncProvider } from "@/lib/sync-provider";
import { useTheme } from "@/theme";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { ready } = useAuth();
  const theme = useTheme();
  const booted = ready && fontsReady;

  useEffect(() => {
    if (booted) {
      SplashScreen.hideAsync();
    }
  }, [booted]);

  if (!booted) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.canvas },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });

  return (
    <AuthProvider>
      <SyncProvider>
        <RootNavigator fontsReady={fontsLoaded || fontError !== null} />
      </SyncProvider>
    </AuthProvider>
  );
}
