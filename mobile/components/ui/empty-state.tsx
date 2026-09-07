import type { ReactNode } from "react";
import { View } from "react-native";

import { AppText } from "./text";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <View className="mt-20 items-center gap-2 px-6">
      <AppText variant="heading" tone="muted">
        {title}
      </AppText>
      {hint ? (
        <AppText variant="small" tone="faint" className="text-center">
          {hint}
        </AppText>
      ) : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}
