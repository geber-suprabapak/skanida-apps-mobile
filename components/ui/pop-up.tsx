import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Modal,
  Animated,
  TouchableOpacity,
  Easing,
  useWindowDimensions,
  AccessibilityInfo,
} from "react-native";
import { Text } from "./text";
import { Icon } from "~/components/ui/icon";
import { CheckCircle } from "lucide-react-native";
import {
  getFallbackQuote,
  type MotivationalQuote,
} from "~/lib/motivationalQuotes";
import { cn } from "~/lib/utils";
import { useUniwind } from "uniwind";

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
  attendanceType: "check_in" | "check_out";
  processingTime?: number;
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
  processingTime,
}) => {
  const { theme } = useUniwind();
  const isDark = theme === "dark";
  // PERF-L01: Use hook instead of module-scope Dimensions.get
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const backdropColor = isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.5)";
  const [motivationalQuote, setMotivationalQuote] = useState<MotivationalQuote>(
    {
      quote: "",
      author: "",
    },
  );

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
    // PERF-M01: Reduced from 30 to 15 pieces to halve animation overhead
    confettiPieces.current = Array.from({ length: 15 }, (_, index) => ({
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

  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then((enabled) => {
        if (mounted && enabled) setReduceMotion(true);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo?.addEventListener?.(
      "reduceMotionChanged",
      (enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      },
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  // Show animation
  const showAnimation = useCallback(() => {
    // Reset all values
    modalScale.setValue(0);
    modalOpacity.setValue(0);
    checkIconScale.setValue(0);
    checkIconRotation.setValue(0);
    textSlideY.setValue(50);
    buttonScale.setValue(0);

    if (reduceMotion) {
      // PERF/A11Y: Bypass intensive particle and 3D rotation animations when Reduce Motion is enabled
      confettiPieces.current = [];
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        modalScale.setValue(1);
        checkIconScale.setValue(1);
        checkIconRotation.setValue(0);
        textSlideY.setValue(0);
        buttonScale.setValue(1);
      });
      return;
    }

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
  }, [
    modalScale,
    modalOpacity,
    checkIconScale,
    checkIconRotation,
    textSlideY,
    buttonScale,
    reduceMotion,
  ]);

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
      // Use setTimeout to defer state update outside of animation callback
      // This prevents "useInsertionEffect must not schedule updates" error
      setTimeout(() => {
        onClose();
      }, 0);
    });
  };

  // PERF-M02: Use local quotes directly, avoid 5s external API call
  useEffect(() => {
    if (visible) {
      setMotivationalQuote(getFallbackQuote());
      showAnimation();
    }
  }, [visible, showAnimation]);

  const getSuccessMessage = () => {
    if (attendanceType === "check_in") {
      return {
        title: "Berhasil absen masuk",
        defaultSubtitle:
          "Semangat praktik dan belajar hari ini, langkah kecil menuju karier impian. 🔥",
      };
    } else {
      return {
        title: "Berhasil absen pulang",
        defaultSubtitle:
          "Hebat! Hari ini kamu sudah selangkah lebih dekat jadi lulusan SMK kebanggaan. 📚✨",
      };
    }
  };

  const formatProcessingTime = (timeMs?: number): string => {
    if (!timeMs) return "";

    if (timeMs < 1000) {
      return `Diproses dalam ${timeMs} ms`;
    } else if (timeMs < 10000) {
      return `Diproses dalam ${(timeMs / 1000).toFixed(1)} dtk`;
    } else {
      return `Diproses dalam ${Math.round(timeMs / 1000)} dtk`;
    }
  };

  const message = getSuccessMessage();
  const motivationalMessage = motivationalQuote.quote
    ? `${motivationalQuote.quote}${
        motivationalQuote.author ? ` — ${motivationalQuote.author}` : ""
      }`
    : message.defaultSubtitle;
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={hideAnimation}
    >
      {/* Backdrop */}
      <Animated.View
        accessibilityViewIsModal={true}
        aria-modal={true}
        style={{
          flex: 1,
          backgroundColor: backdropColor,
          opacity: modalOpacity,
        }}
      >
        {/* Confetti Layer */}
        {!reduceMotion && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            pointerEvents="none"
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
        )}

        {/* Modal Content */}
        <View className="flex-1 justify-center items-center px-6">
          <Animated.View
            style={{
              transform: [{ scale: modalScale }],
              opacity: modalOpacity,
            }}
            className="w-full max-w-sm rounded-2xl p-8 items-center bg-card"
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
                <Icon as={CheckCircle} className="size-10 text-white" />
              </View>
            </Animated.View>

            {/* Success Text */}
            <Animated.View
              style={{
                transform: [{ translateY: textSlideY }],
              }}
              className="items-center mb-6"
            >
              <Text className="text-2xl font-bold text-center mb-2 text-foreground">
                {message.title}
              </Text>

              <Text className="text-base text-center mb-4 text-muted-foreground">
                {motivationalMessage}
              </Text>

              {/* Processing Time Display */}
              {processingTime && (
                <View
                  className={`px-3 py-1 rounded-full ${
                    isDark ? "bg-green-800/30" : "bg-green-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      isDark ? "text-green-300" : "text-green-700"
                    }`}
                  >
                    {formatProcessingTime(processingTime)}
                  </Text>
                </View>
              )}
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
                accessibilityRole="button"
                accessibilityLabel="Selesai"
                accessibilityHint="Menutup dialog konfirmasi presensi"
                className={cn(
                  "py-4 px-8 min-h-[48px] rounded-2xl items-center justify-center",
                  isDark
                    ? "bg-blue-700 active:bg-blue-800"
                    : "bg-blue-600 active:bg-blue-700",
                )}
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold text-lg">
                  Selesai
                </Text>
                <View
                  style={{
                    position: "absolute",
                    opacity: 0,
                    width: 0,
                    height: 0,
                  }}
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no"
                >
                  <Text>Confirm</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
};

export default AttendanceSuccessPopup;
