import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { KeyboardSafeScreen } from "@/components/keyboard-safe-screen";
import { BrandMark } from "@/components/ui/brand-mark";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { AppText } from "@/components/ui/text";
import { useAuth } from "@/lib/auth";

export default function SetupScreen() {
  const { setServerUrl } = useAuth();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConnect() {
    setLoading(true);
    setError(null);
    try {
      await setServerUrl(url);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardSafeScreen>
      <BrandMark />
      <AppText variant="body" tone="muted" className="mt-6">
        Programs for home, park, and gym — built by AI, kept on your own server.
      </AppText>

      <View className="mt-10 gap-5">
        <Field
          label="Server address"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={url}
          onChangeText={setUrl}
          placeholder="http://192.168.1.10:3000"
          returnKeyType="go"
          onSubmitEditing={onConnect}
          error={error}
        />
        <Button title="Connect" onPress={onConnect} loading={loading} disabled={!url.trim()} />
      </View>
    </KeyboardSafeScreen>
  );
}
