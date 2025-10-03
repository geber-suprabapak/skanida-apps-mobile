// components/TimeSyncIndicator.tsx
import { View, TouchableOpacity } from "react-native";
import { Text } from "~/components/ui/text";
import { Icon } from "~/components/ui/icon";
import { Wifi, WifiOff, Clock, AlertTriangle } from "lucide-react-native";
import useTimeSyncStore from "~/store/timeSyncStore";
import { timeSync } from "~/utils/timeSync";

interface TimeSyncIndicatorProps {
  onPress?: () => void;
  showDetails?: boolean;
}

export const TimeSyncIndicator: React.FC<TimeSyncIndicatorProps> = ({
  onPress,
  showDetails = false,
}) => {
  const status = useTimeSyncStore((state) => state.status);
  const syncSource = useTimeSyncStore((state) => state.syncSource);
  const driftDetected = useTimeSyncStore((state) => state.driftDetected);
  const lastSyncTime = useTimeSyncStore((state) => state.lastSyncTime);
  const offset = useTimeSyncStore((state) => state.offset);

  const getStatusInfo = () => {
    switch (status) {
      case "synced":
        return {
          icon: Wifi,
          color: "text-green-600",
          bgColor: "bg-green-100 dark:bg-green-900/30",
          label: "Synced",
        };
      case "syncing":
        return {
          icon: Clock,
          color: "text-blue-600",
          bgColor: "bg-blue-100 dark:bg-blue-900/30",
          label: "Syncing...",
        };
      case "failed":
        return {
          icon: WifiOff,
          color: "text-red-600",
          bgColor: "bg-red-100 dark:bg-red-900/30",
          label: "Failed",
        };
      default:
        return {
          icon: Clock,
          color: "text-gray-600",
          bgColor: "bg-gray-100 dark:bg-gray-900/30",
          label: "Idle",
        };
    }
  };

  const statusInfo = getStatusInfo();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Default action: force sync
      timeSync.forceSyncWithServer();
    }
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return "Never";
    const now = Date.now();
    const diff = now - lastSyncTime;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className={`px-3 py-2 rounded-lg ${statusInfo.bgColor}`}
    >
      <View className="flex-row items-center">
        <Icon as={statusInfo.icon} className={`size-4 ${statusInfo.color}`} />
        <Text
          variant="small"
          className={`ml-1 font-medium ${statusInfo.color}`}
        >
          {statusInfo.label}
        </Text>
        {driftDetected && (
          <Icon as={AlertTriangle} className="size-3 ml-1 text-orange-600" />
        )}
      </View>

      {showDetails && (
        <View className="mt-1">
          <Text variant="small" className="text-muted-foreground">
            Source: {syncSource}
          </Text>
          <Text variant="small" className="text-muted-foreground">
            Offset: {offset}ms
          </Text>
          <Text variant="small" className="text-muted-foreground">
            Last: {formatLastSync()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
