import React from 'react';
import { View, Modal, Image, TouchableOpacity, Text, Pressable, Dimensions, StyleSheet } from 'react-native';
import Animated, { 
  FadeIn, 
  FadeOut, 
  ZoomIn, 
  ZoomOut
} from "react-native-reanimated";

type PhotoViewModalProps = {
  photoUrl: string | null;
  isVisible: boolean;
  onClose: () => void;
};

const { width, height } = Dimensions.get('window');
const imageWidth = Math.min(width * 0.8, 320);
const imageHeight = Math.min(height * 0.5, 400);

const PhotoViewModal: React.FC<PhotoViewModalProps> = ({ photoUrl, isVisible, onClose }) => {
  if (!photoUrl) return null;
  
  return (
    <Modal
      transparent={true}
      visible={isVisible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
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
            <Pressable onPress={(e) => e.stopPropagation()} className="flex-1">
              <Image 
                source={{ uri: photoUrl }} 
                className="w-full h-full"
                resizeMode="contain"
              />
            </Pressable>
          </Animated.View>
          
          <Animated.View
            entering={FadeIn.delay(200)}
          >
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    alignItems: 'center',
  }
});

export default PhotoViewModal;