import React, { useState, useEffect } from "react";
import { View, ScrollView } from "react-native";
import { Text } from "~/components/ui/text";

const ConsoleLogger: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const originalLog = console.log;
    console.log = (...args) => {
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
        )
        .join(" ");
      setLogs((prev) => [...prev, message]);
      originalLog(...args); // Tetap log ke console asli
    };

    return () => {
      console.log = originalLog; // Restore saat unmount
    };
  }, []);

  return (
    <View className="flex-1 p-4 bg-black">
      <ScrollView>
        {logs.map((log, index) => (
          <Text key={index} variant="small" className="text-green-400 mb-1">
            {log}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

export default ConsoleLogger;
