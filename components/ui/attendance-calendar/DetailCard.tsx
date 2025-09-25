import React from "react";
import { View, TouchableOpacity, Image } from "react-native";
import { Text } from "~/components/ui/text";
import { Icon } from "~/components/ui/icon";
import { AlertCircle, CheckCircle, FileText } from "lucide-react-native";
import { DetailCardProps } from "./types";
import { formatTime } from "./utils";

export const DetailCard = ({
  day,
  isDarkColorScheme,
  onClose,
}: DetailCardProps) => {
  if (!day) return null;

  const getStatusText = () => {
    if (!day.attendance) return "Tidak Hadir";

    switch (day.attendance.status) {
      case "present":
        return "Hadir";
      case "leave":
        return "Izin";
      case "sick":
        return "Sakit";
      default:
        return "Tidak Hadir";
    }
  };

  const getStatusIcon = () => {
    if (!day.attendance) {
      return <Icon as={AlertCircle} className="size-6 text-red-600" />;
    }

    switch (day.attendance.status) {
      case "present":
        return <Icon as={CheckCircle} className="size-6 text-green-600" />;
      case "leave":
        return <Icon as={FileText} className="size-6 text-blue-600" />;
      case "sick":
        return <Icon as={FileText} className="size-6 text-amber-600" />;
      default:
        return <Icon as={AlertCircle} className="size-6 text-red-600" />;
    }
  };

  return (
    <View
      className={`rounded-lg p-4 mt-4 ${isDarkColorScheme ? "bg-gray-800" : "bg-white"}`}
    >
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          {getStatusIcon()}
          <Text
            className={`text-xl font-bold ml-3 ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
          >
            {getStatusText()}
          </Text>
        </View>
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            className={`p-2 rounded-full ${isDarkColorScheme ? "bg-gray-700" : "bg-gray-100"}`}
          >
            <Text
              className={`text-lg font-bold ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
            >
              ×
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        className={`p-4 rounded-lg ${isDarkColorScheme ? "bg-gray-700" : "bg-gray-100"}`}
      >
        {/* Date */}
        <View className="flex-row justify-between mb-3">
          <Text
            className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
          >
            Tanggal:
          </Text>
          <Text
            className={`font-medium ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
          >
            {new Date(day.fullDate).toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* Status */}
        <View className="flex-row justify-between mb-3">
          <Text
            className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
          >
            Status:
          </Text>
          <Text
            className={`font-medium ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
          >
            {getStatusText()}
          </Text>
        </View>

        {/* Check-in/Check-out times */}
        {day.attendance?.status === "present" && (
          <>
            {day.attendance.checkInTime && (
              <View className="flex-row justify-between mb-3">
                <Text
                  className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
                >
                  Jam Masuk:
                </Text>
                <Text
                  className={`font-medium ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
                >
                  {formatTime(day.attendance.checkInTime)}
                </Text>
              </View>
            )}
            {day.attendance.checkOutTime && (
              <View className="flex-row justify-between mb-3">
                <Text
                  className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
                >
                  Jam Pulang:
                </Text>
                <Text
                  className={`font-medium ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
                >
                  {formatTime(day.attendance.checkOutTime)}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Leave type */}
        {day.attendance?.leaveType && (
          <View className="flex-row justify-between mb-3">
            <Text
              className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
            >
              Jenis:
            </Text>
            <Text
              className={`font-medium capitalize ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
            >
              {day.attendance.leaveType}
            </Text>
          </View>
        )}

        {/* Approval status */}
        {day.attendance?.approval_status && (
          <View className="flex-row justify-between mb-3">
            <Text
              className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
            >
              Status Persetujuan:
            </Text>
            <View
              className={`px-2 py-1 rounded-full ${
                day.attendance.approval_status === "approved"
                  ? "bg-green-100"
                  : day.attendance.approval_status === "rejected"
                    ? "bg-red-100"
                    : "bg-yellow-100"
              }`}
            >
              <Text
                className={`text-xs ${
                  day.attendance.approval_status === "approved"
                    ? "text-green-800"
                    : day.attendance.approval_status === "rejected"
                      ? "text-red-800"
                      : "text-yellow-800"
                }`}
              >
                {day.attendance.approval_status === "approved"
                  ? "Disetujui"
                  : day.attendance.approval_status === "rejected"
                    ? "Ditolak"
                    : "Menunggu"}
              </Text>
            </View>
          </View>
        )}

        {/* Description */}
        {day.attendance?.description && (
          <View className="mb-3">
            <Text
              className={`font-medium mb-1 ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
            >
              Keterangan:
            </Text>
            <Text
              className={`${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
            >
              {day.attendance.description}
            </Text>
          </View>
        )}
      </View>

      {/* Photo */}
      {day.attendance?.photo_url && (
        <View className="mt-4">
          <Text
            className={`font-medium mb-2 ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
          >
            Foto:
          </Text>
          <Image
            source={{ uri: day.attendance.photo_url }}
            className="w-full h-48 rounded-lg"
            resizeMode="cover"
          />
        </View>
      )}
    </View>
  );
};
