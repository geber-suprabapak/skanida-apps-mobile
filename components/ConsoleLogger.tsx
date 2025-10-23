import React, { useState, useEffect } from "react";
import { View, ScrollView } from "react-native";
import { Text } from "~/components/ui/text";

const ConsoleLogger: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const originalLog = console.log;
    const formatArg = (arg: unknown) => {
      if (arg instanceof Error) {
        const stack = arg.stack ? `\n${arg.stack}` : "";
        return `${arg.name}: ${arg.message}${stack}`;
      }

      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (error) {
          return `[unserializable object: ${String(error)}]`;
        }
      }

      return String(arg);
    };

    console.log = (...args) => {
      const message = args.map((arg) => formatArg(arg)).join(" ");
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
