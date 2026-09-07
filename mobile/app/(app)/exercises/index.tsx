import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AppText } from "@/components/ui/text";
import { listExercises, type Exercise } from "@/lib/api";
import { useTheme } from "@/theme";

const SOURCE_FILTERS = [
  { value: "all", label: "All" },
  { value: "ai", label: "AI" },
  { value: "user", label: "Yours" },
] as const;

type SourceFilter = (typeof SOURCE_FILTERS)[number]["value"];

function matchesQuery(exercise: Exercise, query: string) {
  if (!query) return true;
  const haystack = [
    exercise.name,
    exercise.description,
    ...exercise.muscles,
    ...exercise.equipment,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function uniqueMuscles(exercises: Exercise[]) {
  const seen = new Map<string, string>();
  for (const exercise of exercises) {
    for (const muscle of exercise.muscles) {
      const key = muscle.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.set(key, muscle.trim());
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export default function ExercisesScreen() {
  const theme = useTheme();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [muscle, setMuscle] = useState<string | null>(null);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    setError(null);
    try {
      const data = await listExercises({ refresh: opts?.refresh });
      setExercises(data.exercises);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exercises");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const muscles = useMemo(() => uniqueMuscles(exercises), [exercises]);
  const normalizedQuery = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      exercises.filter((exercise) => {
        if (source !== "all" && exercise.source !== source) return false;
        if (muscle && !exercise.muscles.some((item) => item.toLowerCase() === muscle.toLowerCase())) {
          return false;
        }
        return matchesQuery(exercise, normalizedQuery);
      }),
    [exercises, muscle, normalizedQuery, source],
  );

  if (loading && exercises.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <View className="gap-3 px-5 pb-3 pt-2">
        <AppText variant="display">Exercises</AppText>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, muscle, equipment…"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <View className="flex-row flex-wrap gap-2">
          {SOURCE_FILTERS.map((option) => {
            const selected = source === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setSource(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`rounded-full border px-3.5 py-2 ${
                  selected ? "border-accent bg-accent-soft" : "border-line bg-surface active:bg-canvas"
                }`}
              >
                <AppText variant="label" className={selected ? "text-accent" : "text-ink"}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {muscles.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {muscles.map((item) => {
              const selected = muscle?.toLowerCase() === item.toLowerCase();
              return (
                <Pressable
                  key={item}
                  onPress={() => setMuscle(selected ? null : item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`rounded-full border px-3.5 py-2 ${
                    selected ? "border-accent bg-accent-soft" : "border-line bg-surface active:bg-canvas"
                  }`}
                >
                  <AppText variant="label" className={selected ? "text-accent" : "text-ink"}>
                    {item}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {error ? (
        <AppText variant="small" tone="danger" className="px-5 pb-2">
          {error}
        </AppText>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load({ refresh: true });
            }}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        contentContainerClassName="grow gap-3 px-5 pb-6 pt-1"
        ListEmptyComponent={
          <EmptyState
            title={exercises.length === 0 ? "No exercises yet" : "No matches"}
            hint={
              exercises.length === 0
                ? "The library fills when you generate a program."
                : "Try a different search or clear the filters."
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/exercises/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            className="active:opacity-90"
          >
            <Card className="gap-3">
              <View className="flex-row items-start justify-between gap-3">
                <AppText variant="heading" className="flex-1">
                  {item.name}
                </AppText>
                <Chip
                  label={item.source === "ai" ? "AI" : "Yours"}
                  tone={item.source === "ai" ? "accent" : "neutral"}
                />
              </View>

              {item.muscles.length > 0 || item.equipment.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {item.muscles.map((label) => (
                    <Chip key={`m-${label}`} label={label} />
                  ))}
                  {item.equipment.map((gear) => (
                    <Chip key={`e-${gear}`} label={gear} tone="gym" />
                  ))}
                </View>
              ) : null}

              {item.description ? (
                <AppText variant="small" tone="muted" numberOfLines={3}>
                  {item.description}
                </AppText>
              ) : null}
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
