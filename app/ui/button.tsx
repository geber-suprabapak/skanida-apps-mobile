// app/home.tsx
import { Stack, useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

export default function HomeScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View className="flex-1 items-center justify-center space-y-3">
        <Button>
          <Text>Lmao</Text>
        </Button>
      </View>
    </>
  );
}
