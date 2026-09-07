import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";

import { useTheme } from "@/theme";

export default function AppLayout() {
  const theme = useTheme();

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.canvas },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.faint,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.line },
        tabBarLabelStyle: { fontFamily: "Barlow_500Medium", fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: "house.fill", android: "home", web: "home" }}
              size={size}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{
                ios: "calendar.badge.checkmark",
                android: "history",
                web: "history",
              }}
              size={size}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: "Programs",
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: "calendar", android: "calendar_month", web: "calendar_month" }}
              size={size}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: "Exercises",
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: "dumbbell", android: "fitness_center", web: "fitness_center" }}
              size={size}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: "person", android: "person", web: "person" }}
              size={size}
              tintColor={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
