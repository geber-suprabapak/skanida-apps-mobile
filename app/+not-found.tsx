import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Tidak Ditemukan" }} />
      <View className="flex-1 items-center justify-center p-6 bg-background">
        <Text className="text-xl font-bold text-foreground text-center">
          Halaman Tidak Ditemukan
        </Text>
        <Link
          href="/"
          className="mt-4 p-3 min-h-[48px] justify-center items-center"
          accessibilityRole="link"
          accessibilityLabel="Kembali ke Beranda"
        >
          <Text className="text-base text-primary font-semibold">
            Kembali ke Beranda
          </Text>
        </Link>
      </View>
    </>
  );
}
