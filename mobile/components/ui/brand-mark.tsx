import { View } from "react-native";

import { LocationMark } from "./location-mark";
import { AppText } from "./text";

/** Wordmark with the tri-location bar beneath it. */
export function BrandMark() {
  return (
    <View className="gap-3 self-start">
      <AppText variant="display">Flexorcist</AppText>
      <LocationMark size="bar" />
    </View>
  );
}
