import { Alert } from "react-native";

/** Native confirm dialog. Resolves true only when the user confirms. */
export function confirmAction({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      {
        text: cancelLabel,
        style: "cancel",
        onPress: () => resolve(false),
      },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}
