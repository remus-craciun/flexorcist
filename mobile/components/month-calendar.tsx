import { Pressable, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { AppText } from "@/components/ui/text";
import { formatMonthTitle, dateKey, sameDay } from "@/lib/session-days";
import { useTheme } from "@/theme";

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function monthCells(cursor: Date): (Date | null)[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const jsDay = first.getDay();
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;
  const cells: (Date | null)[] = Array.from({ length: mondayOffset }, () => null);
  const count = daysInMonth(cursor);
  for (let day = 1; day <= count; day++) {
    cells.push(new Date(first.getFullYear(), first.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function MonthCalendar({
  month,
  marked,
  selected,
  onChangeMonth,
  onSelectDay,
}: {
  month: Date;
  marked: Set<string>;
  selected: Date;
  onChangeMonth: (next: Date) => void;
  onSelectDay: (day: Date) => void;
}) {
  const theme = useTheme();
  const today = new Date();
  const cells = monthCells(month);

  function shift(delta: number) {
    onChangeMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => shift(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          className="h-11 w-11 items-center justify-center rounded-control active:bg-accent-soft"
        >
          <SymbolView
            name={{ ios: "chevron.left", android: "chevron_left", web: "chevron_left" }}
            size={20}
            tintColor={theme.ink}
          />
        </Pressable>
        <AppText variant="heading">{formatMonthTitle(month)}</AppText>
        <Pressable
          onPress={() => shift(1)}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          className="h-11 w-11 items-center justify-center rounded-control active:bg-accent-soft"
        >
          <SymbolView
            name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
            size={20}
            tintColor={theme.ink}
          />
        </Pressable>
      </View>

      <View className="flex-row">
        {WEEKDAY_HEADERS.map((label) => (
          <View key={label} className="flex-1 items-center py-1">
            <AppText variant="caption" tone="faint">
              {label}
            </AppText>
          </View>
        ))}
      </View>

      <View className="gap-1">
        {Array.from({ length: cells.length / 7 }, (_, week) => (
          <View key={week} className="flex-row gap-1">
            {cells.slice(week * 7, week * 7 + 7).map((day, index) => {
              if (!day) {
                return <View key={`empty-${week}-${index}`} className="flex-1" />;
              }
              const key = dateKey(day);
              const trained = marked.has(key);
              const isToday = sameDay(day, today);
              const isSelected = sameDay(day, selected);
              return (
                <Pressable
                  key={key}
                  onPress={() => onSelectDay(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${day.getDate()}${trained ? ", workout logged" : ""}`}
                  className={`flex-1 items-center justify-center rounded-control py-2 ${
                    isSelected
                      ? trained
                        ? "bg-done"
                        : "bg-ink"
                      : trained
                        ? "bg-done-soft"
                        : isToday
                          ? "border border-accent bg-accent-soft"
                          : "bg-surface"
                  } active:opacity-80`}
                >
                  <AppText
                    variant="label"
                    tone={
                      isSelected
                        ? "onAccent"
                        : trained
                          ? "done"
                          : isToday
                            ? "accent"
                            : "default"
                    }
                  >
                    {day.getDate()}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
