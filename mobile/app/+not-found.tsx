import { Link, Stack } from "expo-router";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui/text";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="flex-1 items-center justify-center gap-4 bg-canvas px-5">
        <AppText variant="title">This screen doesn't exist.</AppText>
        <Link href="/" asChild>
          <Pressable className="active:opacity-70">
            <AppText variant="bodyMedium" tone="accent">
              Back to programs
            </AppText>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
