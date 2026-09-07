import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { KeyboardSafeScreen } from "@/components/keyboard-safe-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { MultiOptionGroup, OptionGroup } from "@/components/ui/option-group";
import { AppText } from "@/components/ui/text";
import {
  apiRequest,
  type Experience,
  type Goal,
  type Profile,
  type ProfileInput,
  type Sex,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Muscle" },
  { value: "endurance", label: "Endurance" },
  { value: "fat_loss", label: "Fat loss" },
  { value: "general_fitness", label: "General fitness" },
  { value: "mobility", label: "Mobility" },
];

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  value: String(n) as `${1 | 2 | 3 | 4 | 5 | 6 | 7}`,
  label: String(n),
}));

const emptyForm: ProfileInput = {
  sex: null,
  age: null,
  heightCm: null,
  weightKg: null,
  experience: null,
  goals: [],
  daysPerWeek: null,
  limitations: "",
};

function profileToForm(profile: Profile): ProfileInput {
  return {
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    experience: profile.experience,
    goals: profile.goals,
    daysPerWeek: profile.daysPerWeek,
    limitations: profile.limitations ?? "",
  };
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) ? n : null;
}

export default function ProfileScreen() {
  const { user, apiUrl, logout, resetServer } = useAuth();
  const [form, setForm] = useState<ProfileInput>(emptyForm);
  const [ageText, setAgeText] = useState("");
  const [heightText, setHeightText] = useState("");
  const [weightText, setWeightText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiRequest<{ profile: Profile }>("/profile");
      const next = profileToForm(data.profile);
      setForm(next);
      setAgeText(next.age != null ? String(next.age) : "");
      setHeightText(next.heightCm != null ? String(next.heightCm) : "");
      setWeightText(next.weightKg != null ? String(next.weightKg) : "");
      setSavedAt(data.profile.updatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: ProfileInput = {
        ...form,
        age: parseOptionalInt(ageText),
        heightCm: parseOptionalInt(heightText),
        weightKg: parseOptionalInt(weightText),
      };
      const data = await apiRequest<{ profile: Profile }>("/profile", {
        method: "PUT",
        body: payload,
      });
      setSavedAt(data.profile.updatedAt);
      setForm(profileToForm(data.profile));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    await logout();
    router.replace("/");
  }

  async function onChangeServer() {
    await resetServer();
    router.replace("/setup");
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <KeyboardSafeScreen
      edges={["top", "left", "right"]}
      contentClassName="grow gap-6 px-5 pt-4"
      hasTabBar
    >
      <View className="gap-1">
        <AppText variant="display">Profile</AppText>
        <AppText variant="small" tone="muted">
          Used when generating programs. Metric units.
        </AppText>
      </View>

      <Card className="gap-4">
        <View className="gap-1">
          <AppText variant="caption" tone="faint">
            Email
          </AppText>
          <AppText variant="bodyMedium">{user?.email || "—"}</AppText>
        </View>
        <View className="gap-1">
          <AppText variant="caption" tone="faint">
            Server
          </AppText>
          <AppText variant="small" tone="muted">
            {apiUrl || "—"}
          </AppText>
        </View>
      </Card>

      <View className="gap-6">
        <OptionGroup
          label="Sex"
          options={SEX_OPTIONS}
          value={form.sex}
          onChange={(sex) => setForm((prev) => ({ ...prev, sex }))}
        />

        <View className="flex-row gap-3">
          <Field
            containerClassName="flex-1"
            label="Age"
            keyboardType="number-pad"
            value={ageText}
            onChangeText={setAgeText}
            placeholder="years"
          />
          <Field
            containerClassName="flex-1"
            label="Height"
            keyboardType="number-pad"
            value={heightText}
            onChangeText={setHeightText}
            placeholder="cm"
          />
          <Field
            containerClassName="flex-1"
            label="Weight"
            keyboardType="number-pad"
            value={weightText}
            onChangeText={setWeightText}
            placeholder="kg"
          />
        </View>

        <OptionGroup
          label="Experience"
          options={EXPERIENCE_OPTIONS}
          value={form.experience}
          onChange={(experience) => setForm((prev) => ({ ...prev, experience }))}
        />

        <MultiOptionGroup
          label="Goals"
          hint="Pick everything that matters."
          options={GOAL_OPTIONS}
          value={form.goals}
          onChange={(goals) => setForm((prev) => ({ ...prev, goals }))}
        />

        <OptionGroup
          label="Training days per week"
          options={DAY_OPTIONS}
          value={form.daysPerWeek != null ? (String(form.daysPerWeek) as `${1 | 2 | 3 | 4 | 5 | 6 | 7}`) : null}
          onChange={(days) =>
            setForm((prev) => ({ ...prev, daysPerWeek: Number(days) }))
          }
        />

        <Field
          label="Injuries & limitations"
          value={form.limitations}
          onChangeText={(limitations) => setForm((prev) => ({ ...prev, limitations }))}
          placeholder="Knees, lower back, equipment you can't use…"
          multiline
          textAlignVertical="top"
          className="min-h-[96px] py-3"
        />
      </View>

      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : savedAt ? (
        <AppText variant="caption" tone="faint">
          Saved
        </AppText>
      ) : null}

      <Button title="Save profile" onPress={onSave} loading={saving} />

      <View className="gap-3 pt-2">
        <Button title="Log out" variant="secondary" onPress={onLogout} />
        <Button title="Change server" variant="ghost" onPress={onChangeServer} />
      </View>
    </KeyboardSafeScreen>
  );
}
