import { Tabs } from "expo-router";
import {
  House,
  History,
  ClipboardPenLine,
  Settings,
} from "lucide-react-native";

const tabIconSize = 22;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0066FF",
        tabBarInactiveTintColor: "#64748B",
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Beranda",
          tabBarAccessibilityLabel: "Beranda",
          tabBarIcon: ({ color }) => <House color={color} size={tabIconSize} />,
        }}
      />
      <Tabs.Screen
        name="riwayat"
        options={{
          title: "Riwayat",
          tabBarAccessibilityLabel: "Riwayat kehadiran",
          tabBarIcon: ({ color }) => (
            <History color={color} size={tabIconSize} />
          ),
        }}
      />
      <Tabs.Screen
        name="perizinan"
        options={{
          title: "Perizinan",
          tabBarAccessibilityLabel: "Status perizinan",
          tabBarIcon: ({ color }) => (
            <ClipboardPenLine color={color} size={tabIconSize} />
          ),
        }}
      />
      <Tabs.Screen
        name="pengaturan"
        options={{
          title: "Pengaturan",
          tabBarAccessibilityLabel: "Pengaturan aplikasi",
          tabBarIcon: ({ color }) => (
            <Settings color={color} size={tabIconSize} />
          ),
        }}
      />
    </Tabs>
  );
}
