import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { KeyboardSafeScreen } from "@/components/keyboard-safe-screen";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { AppText } from "@/components/ui/text";
import { useAuth } from "@/lib/auth";

export default function RegisterScreen() {
  const { register, hasUser, refreshStatus, resetServer } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshStatus().catch(() => undefined);
  }, [refreshStatus]);

  useEffect(() => {
    if (hasUser === true) {
      router.replace("/(auth)/login");
    }
  }, [hasUser]);

  const passwordsMatch = password === confirmPassword;
  const mismatch = confirmPassword.length > 0 && !passwordsMatch;
  const canSubmit =
    Boolean(email.trim()) && password.length >= 8 && passwordsMatch && !loading;

  async function onSubmit() {
    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await register(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardSafeScreen>
      <AppText variant="display">Create your account</AppText>
      <AppText variant="body" tone="muted" className="mt-2">
        This server has no user yet. Register once to lock it down.
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
          placeholder="At least 8 characters"
          returnKeyType="next"
          textContentType="newPassword"
        />
        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Repeat password"
          returnKeyType="done"
          textContentType="newPassword"
          onSubmitEditing={onSubmit}
          error={mismatch ? "Passwords do not match" : null}
        />

        {error && !mismatch ? (
          <AppText variant="small" tone="danger">
            {error}
          </AppText>
        ) : null}

        <Button title="Register" onPress={onSubmit} loading={loading} disabled={!canSubmit} />
      </View>

      <View className="mt-8 items-center gap-4">
        <Link href="/(auth)/login" asChild>
          <Pressable className="active:opacity-70">
            <AppText variant="bodyMedium" tone="accent">
              Already registered? Log in
            </AppText>
          </Pressable>
        </Link>

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
