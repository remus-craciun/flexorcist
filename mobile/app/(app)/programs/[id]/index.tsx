import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { LocationMark } from "@/components/ui/location-mark";
import { AppText } from "@/components/ui/text";
import { deleteProgram, followProgram, getProgram, listSessions, type ProgramDetail, type ProgramStatus, type Session } from "@/lib/api";
import { confirmAction } from "@/lib/confirm";
import { groupWeeks } from "@/lib/program-days";
import { completedTrainingDayKeys } from "@/lib/session-days";

const statusLabel: Record<ProgramStatus, string> = {
  draft: "Draft",
  active: "Following",
  archived: "Archived",
};

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = Number(id);
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(programId)) {
      setError("Invalid program");
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const [data, sessionData] = await Promise.all([getProgram(programId), listSessions()]);
      setProgram(data.program);
      setSessions(sessionData.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load program");
      setProgram(null);
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const weeks = useMemo(
    () => (program ? groupWeeks(program.workouts, program.weeks) : []),
    [program],
  );
  const doneDays = useMemo(
    () =>
      program
        ? completedTrainingDayKeys(
            sessions,
            program.id,
            program.workouts.map((workout) => workout.id),
          )
        : new Set<string>(),
    [program, sessions],
  );

  async function onDelete() {
    if (!program) return;
    const ok = await confirmAction({
      title: "Delete program?",
      message: `“${program.title}” and all of its workouts and exercises will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteProgram(program.id);
      router.replace("/programs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete program");
      setDeleting(false);
    }
  }

  async function onFollow() {
    if (!program || program.status === "active") return;
    setFollowing(true);
    setError(null);
    try {
      await followProgram(program.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to follow program");
    } finally {
      setFollowing(false);
    }
  }

  if (loading && !program) {
    return <LoadingScreen />;
  }

  if (!program) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-canvas px-5">
        <AppText variant="heading" tone="muted">
          {error || "Program not found"}
        </AppText>
        <Button title="Back to programs" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: program.title }} />
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerClassName="gap-5 px-5 pb-10 pt-2"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Card className="gap-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-2">
              <AppText variant="title">{program.title}</AppText>
              <View className="flex-row flex-wrap items-center gap-2">
                <Chip
                  label={statusLabel[program.status]}
                  tone={program.status === "active" ? "accent" : "neutral"}
                />
                <AppText variant="small" tone="muted">
                  {program.weeks} week{program.weeks === 1 ? "" : "s"}
                </AppText>
              </View>
            </View>
            <LocationMark />
          </View>

          {program.notes ? (
            <AppText variant="body" tone="muted">
              {program.notes}
            </AppText>
          ) : null}

          {program.status === "active" ? null : (
            <Button
              title="Follow this program"
              onPress={onFollow}
              loading={following}
            />
          )}
        </Card>

        <View className="flex-row items-center justify-between gap-3">
          <AppText variant="heading">Weekly plan</AppText>
          <Button
            title="Add day"
            size="md"
            variant="secondary"
            onPress={() => router.push(`/programs/${program.id}/add-day`)}
          />
        </View>

        {weeks.every((week) => week.days.length === 0) ? (
          <Card className="gap-3">
            <AppText variant="small" tone="muted">
              No training days yet. Add a day to start the weekly plan.
            </AppText>
            <Button
              title="Add training day"
              size="md"
              onPress={() => router.push(`/programs/${program.id}/add-day`)}
            />
          </Card>
        ) : (
          weeks.map((week) => (
            <View key={week.week} className="gap-2">
              <AppText variant="heading">Week {week.week}</AppText>
              {week.days.length === 0 ? (
                <Card>
                  <AppText variant="small" tone="muted">
                    No sessions this week.
                  </AppText>
                </Card>
              ) : (
                <Card className="gap-0 overflow-hidden px-0 py-0">
                  {week.days.map((day, index) => {
                    const done = doneDays.has(day.key);
                    return (
                      <Pressable
                        key={day.key}
                        onPress={() =>
                          router.push(
                            `/programs/${program.id}/week/${day.week}/day/${day.dayIndex}`,
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`${day.weekday} ${day.name}${done ? ", completed" : ""}`}
                        className={`flex-row items-center justify-between gap-4 px-4 py-3.5 ${
                          done ? "bg-done-soft" : "active:bg-canvas"
                        } ${index > 0 ? "border-t border-line" : ""}`}
                      >
                        <AppText variant="body" tone={done ? "done" : "muted"}>
                          {day.weekday}
                        </AppText>
                        <View className="min-w-0 flex-1 flex-row items-center justify-end gap-2">
                          {done ? (
                            <AppText variant="bodyMedium" tone="done">
                              ✅
                            </AppText>
                          ) : null}
                          <AppText variant="bodyMedium" tone={done ? "done" : "default"}>
                            {day.name}
                          </AppText>
                        </View>
                      </Pressable>
                    );
                  })}
                </Card>
              )}
            </View>
          ))
        )}

        {error ? (
          <AppText variant="small" tone="danger">
            {error}
          </AppText>
        ) : null}

        <View className="gap-3">
          <Button
            title="Edit program"
            onPress={() => router.push(`/programs/${program.id}/edit`)}
          />
          <Button
            title="Delete program"
            variant="danger"
            onPress={onDelete}
            loading={deleting}
          />
        </View>
      </ScrollView>
    </>
  );
}
