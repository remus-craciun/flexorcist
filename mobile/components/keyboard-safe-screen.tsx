import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type KeyboardSafeScreenProps = {
  children: ReactNode;
  /** Defaults to all edges. Use without bottom when a tab bar is present. */
  edges?: ("top" | "right" | "bottom" | "left")[];
  /** Extra classes for the scroll content container. */
  contentClassName?: string;
  /** Extra lift when a bottom tab bar sits above the keyboard. */
  hasTabBar?: boolean;
};

/**
 * Moves form content above the keyboard. Does not dismiss the keyboard on scroll.
 */
export function KeyboardSafeScreen({
  children,
  edges = ["top", "right", "bottom", "left"],
  contentClassName = "grow justify-center px-5 py-6",
  hasTabBar = false,
}: KeyboardSafeScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={edges}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={hasTabBar ? (Platform.OS === "ios" ? 8 : 0) : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName={contentClassName}
          contentContainerStyle={{ paddingBottom: hasTabBar ? 24 : 16 }}
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
        >
          <View>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
