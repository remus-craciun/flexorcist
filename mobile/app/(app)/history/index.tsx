import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MonthCalendar } from "@/components/month-calendar";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AppText } from "@/components/ui/text";
import { listSessions, type Session } from "@/lib/api";
import {
  dateKey,
  formatDayTitle,
  parseDateKey,
  sessionDaySet,
  sessionsOnDay,
} from "@/lib/session-days";
import { formatDuration, formatSessionClock, sessionTitle } from "@/lib/workout-session";
import { locationLabels, type Location } from "@/theme";

function placeLabel(place: Location) {
  return place === "park" ? "Workout park" : locationLabels[place];
}

function paramDate(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? parseDateKey(raw) : null;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function HistoryScreen() {
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());

  const selectDay = useCallback((day: Date) => {
    setSelected(day);
    setMonth(startOfMonth(day));
    router.setParams({ date: dateKey(day) });
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listSessions();
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const fromParam = paramDate(dateParam);
    if (!fromParam) return;
    setSelected(fromParam);
    setMonth(startOfMonth(fromParam));
  }, [dateParam]);

  const marked = useMemo(() => sessionDaySet(sessions), [sessions]);
  const forDay = useMemo(() => sessionsOnDay(sessions, selected), [sessions, selected]);

  function changeMonth(next: Date) {
    setMonth(next);
    const today = new Date();
    if (today.getFullYear() === next.getFullYear() && today.getMonth() === next.getMonth()) {
      selectDay(today);
      return;
    }
    selectDay(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  if (loading && sessions.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10 pt-2"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-1">
          <AppText variant="display">History</AppText>
          <AppText variant="heading" tone="muted">
            {sessions.length} session{sessions.length === 1 ? "" : "s"} logged
          </AppText>
        </View>

        {error ? (
          <AppText variant="small" tone="danger">
            {error}
          </AppText>
        ) : null}

        <Card>
          <MonthCalendar
            month={month}
            marked={marked}
            selected={selected}
            onChangeMonth={changeMonth}
            onSelectDay={selectDay}
          />
        </Card>

        <View className="gap-3">
          <AppText variant="heading">{formatDayTitle(selected)}</AppText>
          {forDay.length === 0 ? (
            <EmptyState
              title="No sessions this day"
              hint="Finish a workout and it will show up here."
            />
          ) : (
            forDay.map((item) => (
              <Card key={item.id} className="gap-3 border-done bg-done-soft">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Chip label="Done" tone="done" />
                  <Chip label={placeLabel(item.location)} tone={item.location} />
                </View>
                <AppText variant="title" tone="done">
                  {sessionTitle(item)}
                </AppText>
                <AppText variant="body" tone="muted">
                  {item.programTitle || "Program"} · week {item.week}
                </AppText>
                <AppText variant="small" tone="muted">
                  {formatSessionClock(item.startedAt)} – {formatSessionClock(item.endedAt)}
                </AppText>
                <AppText variant="heading" tone="done">
                  {formatDuration(item.durationMs)}
                </AppText>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
