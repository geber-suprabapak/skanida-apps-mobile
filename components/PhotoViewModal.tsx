import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  View,
  Modal,
  Image,
  TouchableOpacity,
  Text,
  Pressable,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeIn, ZoomIn, ZoomOut } from "react-native-reanimated";

type PhotoViewModalProps = {
  photoUrl: string | null;
  isVisible: boolean;
  onClose: () => void;
};

const { width, height } = Dimensions.get("window");
const imageWidth = Math.min(width * 0.8, 320);
const imageHeight = Math.min(height * 0.5, 400);

const PhotoViewModal: React.FC<PhotoViewModalProps> = ({
  photoUrl,
  isVisible,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!photoUrl) return null;

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.modalOverlay}
        className="bg-black/75 p-4"
        onPress={onClose}
      >
        <View style={styles.contentContainer}>
          <Animated.View
            entering={ZoomIn.duration(300)}
            exiting={ZoomOut.duration(200)}
            className="bg-white rounded-xl overflow-hidden shadow-xl mb-4"
            style={{ width: imageWidth, height: imageHeight }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="flex-1 bg-gray-100 items-center justify-center"
            >
              {loading && !error && (
                <View
                  style={StyleSheet.absoluteFill}
                  className="items-center justify-center"
                >
                  <ActivityIndicator size="large" color="#0066FF" />
                </View>
              )}

              {error ? (
                <View
                  style={StyleSheet.absoluteFill}
                  className="items-center justify-center"
                >
                  <Ionicons name="image-outline" size={50} color="#666" />
                  <Text className="text-gray-500 mt-2">
                    Tidak dapat menampilkan foto
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: photoUrl }}
                  style={{ width: "100%", height: "100%" }} // Explicitly set width and height
                  resizeMode="contain"
                  onLoadStart={() => {
                    setLoading(true);
                    setError(false);
                  }}
                  onLoadEnd={() => setLoading(false)}
                  onError={() => {
                    console.log("Error loading image in modal:", photoUrl);
                    setError(true);
                    setLoading(false);
                  }}
                />
              )}
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(200)}>
            <TouchableOpacity
              className="bg-white px-8 py-3 rounded-full shadow-md"
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text className="text-black font-bold text-center">Tutup</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    alignItems: "center",
  },
});

export default PhotoViewModal;
