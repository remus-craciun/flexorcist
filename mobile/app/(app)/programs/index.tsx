import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { LocationMark } from "@/components/ui/location-mark";
import { AppText } from "@/components/ui/text";
import { listPrograms, type Program } from "@/lib/api";
import { useTheme } from "@/theme";

const statusLabel: Record<Program["status"], string> = {
  draft: "Draft",
  active: "Following",
  archived: "Archived",
};

export default function ProgramsScreen() {
  const theme = useTheme();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    setError(null);
    try {
      const data = await listPrograms({ refresh: opts?.refresh });
      setPrograms(data.programs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load programs");
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

  if (loading && programs.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <View className="flex-row items-center justify-between gap-4 px-5 pb-3 pt-2">
        <View className="flex-1 gap-1.5">
          <AppText variant="display">Programs</AppText>
          <LocationMark labels />
        </View>
        <View className="flex-row gap-2">
          <Button title="Generate" size="md" onPress={() => router.push("/programs/generate")} />
          <Button title="New" size="md" variant="secondary" onPress={() => router.push("/programs/new")} />
        </View>
      </View>

      {error ? (
        <AppText variant="small" tone="danger" className="px-5 pb-2">
          {error}
        </AppText>
      ) : null}

      <FlatList
        data={programs}
        keyExtractor={(item) => String(item.id)}
        contentInsetAdjustmentBehavior="automatic"
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
            title="No programs yet"
            hint="Generate one from your profile, or create a blank program."
            action={
              <View className="flex-row gap-2">
                <Button title="Generate" size="md" onPress={() => router.push("/programs/generate")} />
                <Button title="New" size="md" variant="secondary" onPress={() => router.push("/programs/new")} />
              </View>
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/programs/${item.id}`)}
            accessibilityRole="button"
            className="active:opacity-90"
          >
            <Card className="gap-3">
              <View className="flex-row items-start justify-between gap-3">
                <AppText variant="heading" className="flex-1">
                  {item.title}
                </AppText>
                <View className="flex-row items-baseline gap-1">
                  <AppText variant="numeral">{item.weeks}</AppText>
                  <AppText variant="caption" tone="muted">
                    {item.weeks === 1 ? "week" : "weeks"}
                  </AppText>
                </View>
              </View>
              <View className="flex-row items-center justify-between">
                <Chip
                  label={statusLabel[item.status]}
                  tone={item.status === "active" ? "accent" : "neutral"}
                />
                <LocationMark />
              </View>
              {item.notes ? (
                <AppText variant="small" tone="muted" numberOfLines={2}>
                  {item.notes}
                </AppText>
              ) : null}
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
