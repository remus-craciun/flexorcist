import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { KeyboardSafeScreen } from "@/components/keyboard-safe-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { OptionGroup } from "@/components/ui/option-group";
import { AppText } from "@/components/ui/text";
import { generateProgram, getProfile, type Profile } from "@/lib/api";

const WEEK_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
] as const;

const VOLUME_OPTIONS = [
  { value: "low", label: "Low  6–10" },
  { value: "medium", label: "Medium  11–15" },
  { value: "high", label: "High  16–20" },
  { value: "extra_high", label: "Extra high  21–25" },
] as const;

function profileLine(profile: Profile) {
  const bits = [
    profile.sex,
    profile.age != null ? `${profile.age} yrs` : null,
    profile.heightCm != null ? `${profile.heightCm} cm` : null,
    profile.weightKg != null ? `${profile.weightKg} kg` : null,
    profile.experience,
    profile.daysPerWeek != null ? `${profile.daysPerWeek} days/week` : null,
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(" · ") : "No profile details yet.";
}

export default function GenerateProgramScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weeks, setWeeks] = useState("4");
  const [volume, setVolume] = useState<(typeof VOLUME_OPTIONS)[number]["value"]>("medium");
  const [focus, setFocus] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then(({ profile: next }) => {
        setProfile(next);
        if (next.daysPerWeek) {
          setWeeks("4");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => setLoading(false));
  }, []);

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const { program } = await generateProgram({
        weeks: Number(weeks),
        volume,
        focus: focus.trim() || undefined,
      });
      router.replace(`/programs/${program.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <KeyboardSafeScreen contentClassName="grow gap-6 px-5 py-6">
      <AppText variant="small" tone="muted">
        Gemini builds a full program from your profile: workouts for home, park, and gym.
        New movements are saved to the exercise library and reused later.
      </AppText>

      <Card className="gap-2">
        <AppText variant="label">Profile sent to the model</AppText>
        <AppText variant="small" tone="muted">
          {profile ? profileLine(profile) : "—"}
        </AppText>
        {profile?.goals?.length ? (
          <AppText variant="small" tone="muted">
            Goals: {profile.goals.join(", ").replaceAll("_", " ")}
          </AppText>
        ) : null}
        {profile?.limitations ? (
          <AppText variant="small" tone="muted">
            Limitations: {profile.limitations}
          </AppText>
        ) : null}
      </Card>

      <View className="gap-5">
        <OptionGroup
          label="Weeks"
          options={[...WEEK_OPTIONS]}
          value={weeks}
          onChange={setWeeks}
        />
        <OptionGroup
          label="Sets per workout"
          hint="Total working sets across the whole workout, not per exercise."
          options={[...VOLUME_OPTIONS]}
          value={volume}
          onChange={setVolume}
        />
        <Field
          label="Focus (optional)"
          value={focus}
          onChangeText={setFocus}
          placeholder="More pull-ups, quieter knees…"
          multiline
          textAlignVertical="top"
          className="min-h-[80px] py-3"
        />
      </View>

      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}

      <View className="gap-3">
        <Button
          title={generating ? "Generating…" : "Generate program"}
          onPress={onGenerate}
          loading={generating}
        />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} disabled={generating} />
      </View>
    </KeyboardSafeScreen>
  );
}
