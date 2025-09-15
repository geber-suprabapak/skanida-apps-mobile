import React, { useEffect, useRef } from "react";
import {
  View,
  Modal,
  Animated,
  Dimensions,
  TouchableOpacity,
  Easing,
  Image,
} from "react-native";
import { Text } from "./text";
import { CheckCircle } from "~/lib/icons/CheckCircle";
import { useColorScheme } from "~/lib/useColorScheme";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface ConfettiPiece {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  scale: Animated.Value;
  color: string;
  delay: number;
}

interface AttendanceSuccessPopupProps {
  visible: boolean;
  onClose: () => void;
  attendanceType: "present" | "home";
  studentName?: string;
  time?: string;
  processingTime?: number;
  motivationMessage?: string; // pesan motivasi yang akan ditampilkan
}

const CONFETTI_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Mint
  "#F7DC6F", // Light Yellow
  "#BB8FCE", // Light Purple
  "#85C1E9", // Light Blue
];

const AttendanceSuccessPopup: React.FC<AttendanceSuccessPopupProps> = ({
  visible,
  onClose,
  attendanceType,
  studentName = "",
  time,
  processingTime,
  motivationMessage,
}) => {
  const { isDarkColorScheme } = useColorScheme();

  // Animation values
  const modalScale = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const checkIconScale = useRef(new Animated.Value(0)).current;
  const checkIconRotation = useRef(new Animated.Value(0)).current;
  const textSlideY = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;
  const confettiPieces = useRef<ConfettiPiece[]>([]);

  // Initialize confetti pieces
  const initializeConfetti = () => {
    confettiPieces.current = Array.from({ length: 30 }, (_, index) => ({
      id: index,
      x: new Animated.Value(Math.random() * screenWidth),
      y: new Animated.Value(-50),
      rotation: new Animated.Value(0),
      scale: new Animated.Value(Math.random() * 0.5 + 0.5),
      color:
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 500,
    }));
  };

  // Animate confetti falling
  const animateConfetti = () => {
    confettiPieces.current.forEach((piece) => {
      // Reset position
      piece.y.setValue(-50);
      piece.rotation.setValue(0);

      // Animate falling
      Animated.parallel([
        Animated.timing(piece.y, {
          toValue: screenHeight + 100,
          duration: 3000 + Math.random() * 2000,
          delay: piece.delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(piece.rotation, {
          toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
          duration: 2000 + Math.random() * 1000,
          delay: piece.delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(piece.x, {
            toValue: Math.random() * screenWidth,
            duration: 1000,
            delay: piece.delay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(piece.x, {
            toValue: Math.random() * screenWidth,
            duration: 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  };

  // Show animation
  const showAnimation = () => {
    // Reset all values
    modalScale.setValue(0);
    modalOpacity.setValue(0);
    checkIconScale.setValue(0);
    checkIconRotation.setValue(0);
    textSlideY.setValue(50);
    buttonScale.setValue(0);

    // Initialize confetti
    initializeConfetti();

    // Start animations sequence
    Animated.sequence([
      // Modal appears with bounce
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(modalScale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),

      // Check icon appears with spin and scale
      Animated.parallel([
        Animated.spring(checkIconScale, {
          toValue: 1,
          tension: 150,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(checkIconRotation, {
          toValue: 360,
          duration: 800,
          easing: Easing.elastic(1.2),
          useNativeDriver: true,
        }),
      ]),

      // Text slides up
      Animated.spring(textSlideY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),

      // Button appears
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 120,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Start confetti after a short delay
    setTimeout(() => {
      animateConfetti();
    }, 500);
  };

  // Hide animation
  const hideAnimation = () => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(modalScale, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  useEffect(() => {
    if (visible) {
      showAnimation();
    }
  }, [visible]);

  // Tidak lagi menggunakan title/subtitle default karena diminta hanya menampilkan motivasi

  const formatProcessingTime = (timeMs?: number): string => {
    if (!timeMs) return "";

    if (timeMs < 1000) {
      return `Processed in ${timeMs}ms ⚡`;
    } else if (timeMs < 10000) {
      return `Processed in ${(timeMs / 1000).toFixed(1)}s ⚡`;
    } else {
      return `Processed in ${Math.round(timeMs / 1000)}s ⚡`;
    }
  };

  // message dihapus, langsung gunakan motivationMessage
  // Tampilkan kembali jam (HH:MM) saja tanpa processing time
  const currentTime =
    time ||
    new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          opacity: modalOpacity,
        }}
      >
        {/* Confetti Layer */}
        <View
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {confettiPieces.current.map((piece) => (
            <Animated.View
              key={piece.id}
              style={{
                position: "absolute",
                width: 8,
                height: 8,
                backgroundColor: piece.color,
                transform: [
                  { translateX: piece.x },
                  { translateY: piece.y },
                  {
                    rotate: piece.rotation.interpolate({
                      inputRange: [0, 360],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                  { scale: piece.scale },
                ],
              }}
            />
          ))}
        </View>

        {/* Modal Content */}
        <View className="flex-1 justify-center items-center px-6">
          <Animated.View
            style={{
              transform: [{ scale: modalScale }],
              opacity: modalOpacity,
            }}
            className={`w-full max-w-sm rounded-3xl p-8 items-center ${
              isDarkColorScheme ? "bg-gray-800" : "bg-white"
            }`}
          >
            {/* Success Icon */}
            <Animated.View
              style={{
                transform: [
                  { scale: checkIconScale },
                  {
                    rotate: checkIconRotation.interpolate({
                      inputRange: [0, 360],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                ],
              }}
              className="mb-6"
            >
              <View className="w-20 h-20 rounded-full bg-green-500 items-center justify-center">
                <CheckCircle size={40} color="white" />
              </View>
            </Animated.View>

            {/* Success Text */}
            <Animated.View
              style={{
                transform: [{ translateY: textSlideY }],
              }}
              className="items-center mb-6"
            >
              {motivationMessage && (() => {
                // Batasi maksimal 5 kalimat (dipisah berdasarkan titik / ! / ?)
                const sentences = motivationMessage
                  .split(/(?<=[.!?])\s+/)
                  .filter(Boolean)
                  .slice(0, 5)
                  .join(" ");
                return (
                  <Text
                    className={`text-base text-center mb-4 font-medium ${
                      isDarkColorScheme ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {`“${sentences}”`}
                  </Text>
                );
              })()}
              <Text
                className={`text-sm -mt-2 mb-4 font-semibold tracking-wide ${
                  isDarkColorScheme ? "text-yellow-400" : "text-yellow-600"
                }`}
              >
                Kelas KING 👑🔥
              </Text>

              {/* Time Display */}
              <View
                className={`px-4 py-2 rounded-full mb-2 ${
                  isDarkColorScheme ? "bg-gray-700" : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {currentTime}
                </Text>
              </View>
            </Animated.View>

            {/* Confirm Button */}
            <Animated.View
              style={{
                transform: [{ scale: buttonScale }],
              }}
              className="w-full"
            >
              <TouchableOpacity
                onPress={hideAnimation}
                className="bg-blue-600 py-4 px-8 rounded-2xl items-center active:bg-blue-700"
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold text-lg">
                  Confirm
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
};

export default AttendanceSuccessPopup;
