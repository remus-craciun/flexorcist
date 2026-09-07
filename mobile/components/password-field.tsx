import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable } from "react-native";

import { Field, type FieldProps } from "@/components/ui/field";
import { useTheme } from "@/theme";

type PasswordFieldProps = Omit<FieldProps, "secureTextEntry" | "accessory">;

export function PasswordField({ label = "Password", ...props }: PasswordFieldProps) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <Field
      label={label}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      {...props}
      secureTextEntry={!visible}
      accessory={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          hitSlop={8}
          className="h-12 w-12 items-center justify-center active:opacity-70"
        >
          <SymbolView
            name={
              visible
                ? { ios: "eye.slash", android: "visibility_off", web: "visibility_off" }
                : { ios: "eye", android: "visibility", web: "visibility" }
            }
            size={22}
            tintColor={theme.muted}
          />
        </Pressable>
      }
    />
  );
}
