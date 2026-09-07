import { Redirect } from "expo-router";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { useAuth } from "@/lib/auth";

export default function Index() {
  const { ready, apiUrl, token, hasUser } = useAuth();

  if (!ready) {
    return <LoadingScreen />;
  }

  if (!apiUrl) {
    return <Redirect href="/setup" />;
  }

  if (!token) {
    if (hasUser === false) {
      return <Redirect href="/(auth)/register" />;
    }
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/home" />;
}
