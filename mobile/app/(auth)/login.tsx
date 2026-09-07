import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { KeyboardSafeScreen } from "@/components/keyboard-safe-screen";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { AppText } from "@/components/ui/text";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const { login, hasUser, resetServer } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardSafeScreen>
      <AppText variant="display">Welcome back</AppText>
      <AppText variant="body" tone="muted" className="mt-2">
        Sign in to your Flexorcist server.
      </AppText>

      <View className="mt-10 gap-5">
        <Field
          label="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          returnKeyType="next"
        />
        <PasswordField
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />

        {error ? (
          <AppText variant="small" tone="danger">
            {error}
          </AppText>
        ) : null}

        <Button
          title="Log in"
          onPress={onSubmit}
          loading={loading}
          disabled={!email || !password}
        />
      </View>

      <View className="mt-8 items-center gap-4">
        {hasUser === false ? (
          <Link href="/(auth)/register" asChild>
            <Pressable className="active:opacity-70">
              <AppText variant="bodyMedium" tone="accent">
                Create the first account
              </AppText>
            </Pressable>
          </Link>
        ) : (
          <AppText variant="small" tone="faint">
            Registration is closed on this server.
          </AppText>
        )}

        <Pressable
          onPress={() => resetServer().then(() => router.replace("/setup"))}
          className="active:opacity-70"
        >
          <AppText variant="small" tone="muted">
            Change server
          </AppText>
        </Pressable>
      </View>
    </KeyboardSafeScreen>
  );
}
