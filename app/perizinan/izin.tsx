import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  View,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  BackHandler,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import { useColorScheme } from "~/lib/useColorScheme";
import { supabase } from "~/utils/supabase";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { ClipboardPenLine } from "~/lib/icons/ClipboardPenLine";
import { FileText } from "~/lib/icons/FileText";
import { Camera } from "~/lib/icons/Camera";
import { AlertCircle } from "~/lib/icons/AlertCircle";
import { Trash2, Image as ImageIcon } from "lucide-react-native";

// Types
type PermitCategory = "sakit" | "pergi";

interface ImageData {
  uri: string;
  base64: string;
}

// Constants
const IMAGE_QUALITY = 0.8; // Optimal quality for JPEG compression
const IMAGE_FORMAT = "jpeg";
const STORAGE_BUCKET = "perizinan";

// --- UTILITY FUNCTIONS ---
const createLogger = (component: string) => ({
  debug: (message: string, data?: any) => {
    console.log(
      `🔍 [${component}] ${message}`,
      data ? JSON.stringify(data, null, 2) : "",
    );
  },
  info: (message: string, data?: any) => {
    console.info(
      `ℹ️ [${component}] ${message}`,
      data ? JSON.stringify(data, null, 2) : "",
    );
  },
  warn: (message: string, data?: any) => {
    console.warn(
      `⚠️ [${component}] ${message}`,
      data ? JSON.stringify(data, null, 2) : "",
    );
  },
  error: (message: string, error?: any) => {
    console.error(`❌ [${component}] ${message}`, error);
  },
});

const logger = createLogger("PerizinanScreen");

// Utility functions
const base64ToUint8Array = (base64: string): Uint8Array => {
  if (!base64) {
    logger.error("Invalid base64 string: cannot be null or empty");
    throw new Error("Invalid base64 string: cannot be null or empty");
  }
  logger.debug("Starting base64 conversion", {
    originalLength: base64.length,
  });

  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    logger.debug("Base64 conversion successful", {
      originalLength: base64.length,
      arrayLength: bytes.length,
    });

    return bytes;
  } catch (error: any) {
    logger.error("Error converting base64 to Uint8Array", error);
    throw new Error("Failed to process image data: " + error.message);
  }
};

const generateFileName = (
  userId: string,
  extension: string = IMAGE_FORMAT,
): string => {
  const fileName = `${userId}/${Date.now()}.${extension}`;
  logger.debug("Generated filename", { fileName, userId, extension });
  return fileName;
};

const getImageContentType = (uri: string): string => {
  const extension = uri.split(".").pop()?.toLowerCase();

  logger.debug("Determining image content type", { uri, extension });

  switch (extension) {
    case "jpg":
    case "jpeg":
      logger.debug("Content type: image/jpeg");
      return "image/jpeg";
    case "png":
      logger.debug("Content type: image/png");
      return "image/png";
    default:
      logger.debug("Content type: default to image/jpeg");
      return "image/jpeg"; // Default to JPEG
  }
};

export default function PerizinanScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { isDarkColorScheme } = useColorScheme();
  logger.info("PerizinanScreen component mounted", {
    userId: user?.id,
    isDarkColorScheme,
  });

  // State management
  const [category, setCategory] = useState<PermitCategory>("sakit");
  const [description, setDescription] = useState("");
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Ref for description TextInput
  const descriptionInputRef = useRef<TextInput>(null);

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      router.back();
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [router]);
  // Image handling functions
  const clearImage = (): void => {
    logger.debug("Clearing image data");
    setImageData(null);
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    logger.debug("Requesting camera permission");
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    logger.info("Camera permission result", {
      status,
      granted: status === "granted",
    });

    if (status !== "granted") {
      logger.warn("Camera permission denied by user");
      Alert.alert(
        "Izin Ditolak",
        "Izin kamera diperlukan untuk mengambil foto.",
      );
      return false;
    }
    return true;
  };

  const requestLibraryPermission = async (): Promise<boolean> => {
    logger.debug("Requesting library permission");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    logger.info("Library permission result", {
      status,
      granted: status === "granted",
    });

    if (status !== "granted") {
      logger.warn("Library permission denied by user");
      Alert.alert("Izin Ditolak", "Izin galeri diperlukan untuk memilih foto.");
      return false;
    }
    return true;
  };

  const handleImageResult = (result: ImagePicker.ImagePickerResult): void => {
    logger.debug("Processing image picker result", {
      canceled: result.canceled,
      assetsCount: result.assets?.length || 0,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];

      logger.info("Image selected successfully", {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        hasBase64: !!asset.base64,
      });

      if (asset.base64) {
        const newImageData = {
          uri: asset.uri,
          base64: asset.base64,
        };

        logger.debug("Setting image data", {
          uriLength: newImageData.uri.length,
          base64Length: newImageData.base64.length,
        });

        setImageData(newImageData);
      } else {
        logger.error("No base64 data received from image picker");
      }
    } else {
      logger.debug("Image selection canceled or failed");
    }
  };

  const pickFromCamera = async (): Promise<void> => {
    logger.debug("Starting camera photo capture");
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      logger.debug("Launching camera with config", {
        quality: IMAGE_QUALITY,
        allowsEditing: false,
        base64: true,
      });

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: IMAGE_QUALITY,
        allowsEditing: false,
        base64: true,
      });

      handleImageResult(result);
    } catch (error) {
      logger.error("Camera photo capture failed", error);
      Alert.alert("Error", "Gagal mengambil foto dari kamera");
    }
  };

  const pickFromLibrary = async (): Promise<void> => {
    logger.debug("Starting library photo selection");
    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) return;

    try {
      logger.debug("Launching image library with config", {
        quality: IMAGE_QUALITY,
        allowsEditing: false,
        base64: true,
      });

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: IMAGE_QUALITY,
        allowsEditing: false,
        base64: true,
      });

      handleImageResult(result);
    } catch (error) {
      logger.error("Library photo selection failed", error);
      Alert.alert("Error", "Gagal memilih foto dari galeri");
    }
  };
  // Upload functions
  const uploadImageToStorage = async (
    imageData: ImageData,
    userId: string,
  ): Promise<string> => {
    const startTime = Date.now();
    logger.info("Starting image upload to storage", {
      userId,
      imageUriLength: imageData.uri.length,
      base64Length: imageData.base64.length,
    });

    const fileBuffer = base64ToUint8Array(imageData.base64);
    const contentType = getImageContentType(imageData.uri);
    const fileName = generateFileName(userId, IMAGE_FORMAT);

    logger.debug("Upload preparation completed", {
      fileName,
      contentType,
      fileBufferSize: fileBuffer.length,
      fileSizeMB: (fileBuffer.length / (1024 * 1024)).toFixed(2),
    });

    const { data, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, fileBuffer, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      logger.error("Storage upload failed", {
        error: uploadError,
        fileName,
        fileSize: fileBuffer.length,
      });

      if (
        uploadError.message?.includes("network") ||
        uploadError.message?.includes("connection") ||
        uploadError.message?.toLowerCase().includes("timeout")
      ) {
        throw new Error(
          "Koneksi internet bermasalah. Mohon periksa koneksi internet Anda dan coba lagi.",
        );
      }
      throw new Error(`Upload gagal: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    const uploadTime = Date.now() - startTime;
    const throughput = (fileBuffer.length / 1024 / (uploadTime / 1000)).toFixed(
      2,
    );

    logger.info("Image upload completed successfully", {
      fileName,
      publicUrl: urlData.publicUrl,
      uploadTime,
      throughput: `${throughput} KB/s`,
      fileSize: fileBuffer.length,
    });

    return urlData.publicUrl;
  };
  const insertPermitToDatabase = async (permitData: {
    userId: string;
    category: PermitCategory;
    description: string;
    imageUrl?: string;
  }): Promise<void> => {
    const startTime = Date.now();
    logger.info("Starting database insert", {
      userId: permitData.userId,
      category: permitData.category,
      descriptionLength: permitData.description.length,
      hasImage: !!permitData.imageUrl,
    });

    const insertData = {
      user_id: permitData.userId,
      kategori_izin: permitData.category,
      deskripsi: permitData.description,
      status: false,
      link_foto: permitData.imageUrl || null,
      tanggal: new Date().toISOString(),
    };

    logger.debug("Database insert payload", insertData);

    const { error: insertError } = await supabase
      .from("perizinan")
      .insert(insertData);

    if (insertError) {
      logger.error("Database insert failed", {
        error: insertError,
        permitData,
      });
      throw new Error(`Gagal menyimpan data: ${insertError.message}`);
    }

    const insertTime = Date.now() - startTime;
    logger.info("Database insert completed successfully", {
      insertTime,
      category: permitData.category,
    });
  };
  const resetForm = (): void => {
    logger.debug("Resetting form state");
    setCategory("sakit");
    setDescription("");
    clearImage();
    logger.debug("Form reset completed");
  };

  const uploadPermit = async (): Promise<void> => {
    const startTime = Date.now();
    logger.info("Starting permit upload process", {
      userId: user?.id,
      category,
      descriptionLength: description.length,
      hasImage: !!imageData,
      hasUser: !!user,
    });

    if (!user) {
      logger.error("Upload attempted without authenticated user");
      Alert.alert("Error", "User not authenticated");
      return;
    }

    if (!description.trim()) {
      logger.warn("Upload attempted with empty description");
      Alert.alert("Error", "Deskripsi tidak boleh kosong.");
      return;
    }

    try {
      setUploading(true);
      logger.debug("Upload state set to true");
      let imageUrl: string | undefined;

      // Upload image if exists
      if (imageData) {
        logger.debug("Starting image upload process");
        imageUrl = await uploadImageToStorage(imageData, user.id);
        logger.info("Image upload completed", { imageUrl });
      } else {
        logger.debug("No image to upload, proceeding without photo");
      }

      // Insert permit data to database
      logger.debug("Starting database insert process");
      await insertPermitToDatabase({
        userId: user.id,
        category,
        description,
        imageUrl,
      });

      const totalTime = Date.now() - startTime;
      logger.info("Permit upload process completed successfully", {
        totalTime,
        category,
        hasImage: !!imageUrl,
        throughput: imageData
          ? `${(imageData.base64.length / 1024 / (totalTime / 1000)).toFixed(2)} KB/s`
          : "N/A",
      });

      Alert.alert("Success", "Izin berhasil dikirim");
      resetForm();
      router.back();
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      const totalTime = Date.now() - startTime;

      logger.error("Permit upload process failed", {
        error: errorMessage,
        totalTime,
        category,
        hasImage: !!imageData,
        userId: user?.id,
      });

      // Handle network errors with user-friendly messages
      if (
        errorMessage.includes("network") ||
        errorMessage.includes("connection") ||
        errorMessage.toLowerCase().includes("timeout") ||
        errorMessage.includes("internet")
      ) {
        logger.warn("Network-related error detected", { errorMessage });
        Alert.alert(
          "Koneksi Bermasalah",
          "Gagal mengirim izin karena masalah koneksi internet. Mohon periksa koneksi Anda dan coba lagi.",
          [{ text: "OK" }],
        );
      } else {
        logger.warn("Non-network error detected", { errorMessage });
        Alert.alert("Error", `Gagal mengirim izin: ${errorMessage}`);
      }
    } finally {
      setUploading(false);
      logger.debug("Upload state set to false");
    }
  };

  // Component lifecycle logging
  useEffect(() => {
    logger.info("PerizinanScreen component mounted and ready");

    return () => {
      logger.info("PerizinanScreen component unmounting");
    };
  }, []);

  // Log state changes for debugging
  useEffect(() => {
    logger.debug("Category changed", { category });
  }, [category]);
  useEffect(() => {
    logger.debug("Description changed", {
      length: description.length,
      isEmpty: !description.trim(),
    });
  }, [description]);

  useEffect(() => {
    logger.debug("Image data changed", {
      hasImage: !!imageData,
      imageUriLength: imageData?.uri.length || 0,
      base64Length: imageData?.base64.length || 0,
    });
  }, [imageData]);

  useEffect(() => {
    logger.debug("Upload state changed", { uploading });
  }, [uploading]);
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView
        className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-gray-50"}`}
      >
        {/* Header */}
        <View
          className={`flex-row items-center p-4 border-b ${
            isDarkColorScheme
              ? "border-gray-700 bg-gray-900"
              : "border-gray-200 bg-white"
          }`}
        >
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <ChevronLeft
              size={24}
              color={isDarkColorScheme ? "#ffffff" : "#000000"}
            />
          </TouchableOpacity>
          <View className="flex-1">
            <Text
              className={`text-lg font-bold ${
                isDarkColorScheme ? "text-white" : "text-gray-900"
              }`}
            >
              Pengajuan Izin
            </Text>
            <Text
              className={`text-sm ${
                isDarkColorScheme ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Isi formulir dengan lengkap
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Category Selection Card */}
          <Card
            className={`mb-6 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            } shadow-sm`}
          >
            <CardHeader className="pb-4">
              <View className="flex-row items-center">
                <View
                  className={`mr-3 p-2 rounded-lg ${
                    isDarkColorScheme ? "bg-blue-900" : "bg-blue-100"
                  }`}
                >
                  <ClipboardPenLine
                    size={20}
                    color={isDarkColorScheme ? "#60A5FA" : "#3B82F6"}
                  />
                </View>
                <View>
                  <CardTitle>
                    <Text
                      className={`text-lg font-bold ${
                        isDarkColorScheme ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Kategori Izin
                    </Text>
                  </CardTitle>
                  <Text
                    className={`text-sm ${
                      isDarkColorScheme ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Pilih jenis izin yang sesuai
                  </Text>
                </View>
              </View>
            </CardHeader>
            <CardContent>
              <View className="flex-row space-x-4">
                {(["sakit", "pergi"] as const).map((catValue) => (
                  <TouchableOpacity
                    key={catValue}
                    onPress={() => setCategory(catValue)}
                    className={`flex-1 p-4 rounded-xl border-2 ${
                      category === catValue
                        ? isDarkColorScheme
                          ? "bg-blue-900 border-blue-500"
                          : "bg-blue-50 border-blue-500"
                        : isDarkColorScheme
                          ? "bg-gray-700 border-gray-600"
                          : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <View className="items-center">
                      <View
                        className={`mb-2 p-3 rounded-full ${
                          category === catValue
                            ? isDarkColorScheme
                              ? "bg-blue-800"
                              : "bg-blue-100"
                            : isDarkColorScheme
                              ? "bg-gray-600"
                              : "bg-gray-200"
                        }`}
                      >
                        {catValue === "sakit" ? (
                          <AlertCircle
                            size={24}
                            color={
                              category === catValue
                                ? isDarkColorScheme
                                  ? "#60A5FA"
                                  : "#3B82F6"
                                : isDarkColorScheme
                                  ? "#9CA3AF"
                                  : "#6B7280"
                            }
                          />
                        ) : (
                          <ClipboardPenLine
                            size={24}
                            color={
                              category === catValue
                                ? isDarkColorScheme
                                  ? "#60A5FA"
                                  : "#3B82F6"
                                : isDarkColorScheme
                                  ? "#9CA3AF"
                                  : "#6B7280"
                            }
                          />
                        )}
                      </View>
                      <Text
                        className={`font-semibold text-center ${
                          category === catValue
                            ? isDarkColorScheme
                              ? "text-blue-300"
                              : "text-blue-600"
                            : isDarkColorScheme
                              ? "text-gray-300"
                              : "text-gray-700"
                        }`}
                      >
                        {catValue.charAt(0).toUpperCase() + catValue.slice(1)}
                      </Text>
                      <Text
                        className={`text-xs text-center mt-1 ${
                          category === catValue
                            ? isDarkColorScheme
                              ? "text-blue-400"
                              : "text-blue-500"
                            : isDarkColorScheme
                              ? "text-gray-400"
                              : "text-gray-500"
                        }`}
                      >
                        {catValue === "sakit"
                          ? "Kondisi kesehatan"
                          : "Keperluan pribadi"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </CardContent>
          </Card>
          {/* Description Card */}
          <Card
            className={`mb-6 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            } shadow-sm`}
          >
            <CardHeader className="pb-4">
              <View className="flex-row items-center">
                <View
                  className={`mr-3 p-2 rounded-lg ${
                    isDarkColorScheme ? "bg-green-900" : "bg-green-100"
                  }`}
                >
                  <FileText
                    size={20}
                    color={isDarkColorScheme ? "#34D399" : "#10B981"}
                  />
                </View>
                <View>
                  <CardTitle>
                    <Text
                      className={`text-lg font-bold ${
                        isDarkColorScheme ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Deskripsi
                    </Text>
                  </CardTitle>
                  <Text
                    className={`text-sm ${
                      isDarkColorScheme ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Jelaskan alasan pengajuan izin Anda
                  </Text>
                </View>
              </View>
            </CardHeader>
            <CardContent>
              <View
                className={`rounded-xl border-2 overflow-hidden ${
                  description.trim()
                    ? isDarkColorScheme
                      ? "border-green-600 bg-green-900/20"
                      : "border-green-300 bg-green-50"
                    : isDarkColorScheme
                      ? "border-gray-600 bg-gray-700/50"
                      : "border-gray-200 bg-gray-50"
                }`}
              >
                <TextInput
                  ref={descriptionInputRef}
                  className={`min-h-[120px] max-h-[200px] text-base border-0 p-4 ${
                    isDarkColorScheme
                      ? "bg-transparent text-white placeholder-gray-400"
                      : "bg-transparent text-foreground placeholder-muted-foreground"
                  }`}
                  placeholder="Contoh: Sakit demam dan perlu istirahat di rumah..."
                  multiline
                  value={description}
                  onChangeText={setDescription}
                  textAlignVertical="top"
                  numberOfLines={6}
                  maxLength={500}
                  scrollEnabled={true}
                  autoCorrect={false}
                  blurOnSubmit={false}
                  returnKeyType="default"
                  style={{
                    textAlignVertical: "top",
                    lineHeight: 22,
                    minHeight: 120,
                    maxHeight: 200,
                  }}
                  placeholderTextColor={isDarkColorScheme ? '#9CA3AF' : '#6B7280'}
                  onContentSizeChange={(event) => {
                    // Auto-scroll to bottom when content grows
                    const { height } = event.nativeEvent.contentSize;
                    if (height > 120) {
                      // Use setNativeProps to scroll to end for multiline TextInput
                      descriptionInputRef.current?.setNativeProps({
                        text: description,
                        selection: { start: description.length, end: description.length }
                      });
                    }
                  }}
                  onSelectionChange={(event) => {
                    // Ensure cursor visibility when selection changes
                    const { selection } = event.nativeEvent;
                    if (selection.end === description.length) {
                      // If cursor is at the end, ensure it stays visible
                      descriptionInputRef.current?.setNativeProps({
                        selection: { start: description.length, end: description.length }
                      });
                    }
                  }}
                />
              </View>
              <View className="flex-row justify-between items-center mt-3">
                <Text
                  className={`text-xs ${
                    isDarkColorScheme ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Minimal 10 karakter
                </Text>
                <Text
                  className={`text-xs ${
                    description.length >= 10
                      ? isDarkColorScheme
                        ? "text-green-400"
                        : "text-green-600"
                      : isDarkColorScheme
                        ? "text-gray-400"
                        : "text-gray-500"
                  }`}
                >
                  {description.length}/500
                </Text>
              </View>
            </CardContent>
          </Card>
          {/* Photo Upload Card */}
          <Card
            className={`mb-6 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            } shadow-sm`}
          >
            <CardHeader className="pb-4">
              <View className="flex-row items-center">
                <View
                  className={`mr-3 p-2 rounded-lg ${
                    isDarkColorScheme ? "bg-purple-900" : "bg-purple-100"
                  }`}
                >
                  <Camera
                    size={20}
                    color={isDarkColorScheme ? "#A78BFA" : "#8B5CF6"}
                  />
                </View>
                <View className="flex-1">
                  <CardTitle>
                    <Text
                      className={`text-lg font-bold ${
                        isDarkColorScheme ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Lampiran Foto
                    </Text>
                  </CardTitle>
                  <Text
                    className={`text-sm ${
                      isDarkColorScheme ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Opsional - Tambahkan bukti pendukung
                  </Text>
                </View>
                {imageData && (
                  <View
                    className={`px-3 py-1 rounded-full ${
                      isDarkColorScheme ? "bg-green-900" : "bg-green-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        isDarkColorScheme ? "text-green-300" : "text-green-700"
                      }`}
                    >
                      ✓ Foto dipilih
                    </Text>
                  </View>
                )}
              </View>
            </CardHeader>
            <CardContent>
              {!imageData ? (
                <View className="space-y-4">
                  <View className="flex-row space-x-3">
                    <TouchableOpacity
                      onPress={pickFromCamera}
                      className={`flex-1 p-4 rounded-xl border-2 border-dashed ${
                        isDarkColorScheme
                          ? "border-gray-600 bg-gray-700/50"
                          : "border-gray-300 bg-gray-50"
                      }`}
                    >
                      <View className="items-center">
                        <View
                          className={`mb-2 p-3 rounded-full ${
                            isDarkColorScheme ? "bg-gray-600" : "bg-gray-200"
                          }`}
                        >
                          <Camera
                            size={24}
                            color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                          />
                        </View>
                        <Text
                          className={`font-medium text-center ${
                            isDarkColorScheme
                              ? "text-gray-300"
                              : "text-gray-700"
                          }`}
                        >
                          Ambil Foto
                        </Text>
                        <Text
                          className={`text-xs text-center mt-1 ${
                            isDarkColorScheme
                              ? "text-gray-400"
                              : "text-gray-500"
                          }`}
                        >
                          Kamera
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={pickFromLibrary}
                      className={`flex-1 p-4 rounded-xl border-2 border-dashed ${
                        isDarkColorScheme
                          ? "border-gray-600 bg-gray-700/50"
                          : "border-gray-300 bg-gray-50"
                      }`}
                    >
                      <View className="items-center">
                        <View
                          className={`mb-2 p-3 rounded-full ${
                            isDarkColorScheme ? "bg-gray-600" : "bg-gray-200"
                          }`}
                        >
                          <ImageIcon
                            size={24}
                            color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                          />
                        </View>
                        <Text
                          className={`font-medium text-center ${
                            isDarkColorScheme
                              ? "text-gray-300"
                              : "text-gray-700"
                          }`}
                        >
                          Pilih File
                        </Text>
                        <Text
                          className={`text-xs text-center mt-1 ${
                            isDarkColorScheme
                              ? "text-gray-400"
                              : "text-gray-500"
                          }`}
                        >
                          Galeri
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  <Text
                    className={`text-xs text-center ${
                      isDarkColorScheme ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Format: JPG, PNG • Maksimal 5MB
                  </Text>
                </View>
              ) : (
                <View className="space-y-4">
                  <View className="relative">
                    <Image
                      source={{ uri: imageData.uri }}
                      className="w-full h-56 rounded-xl"
                      resizeMode="cover"
                    />
                    <View className="absolute inset-0 bg-black/10 rounded-xl" />
                    <TouchableOpacity
                      onPress={clearImage}
                      className={`absolute top-3 right-3 p-2 rounded-full ${
                        isDarkColorScheme ? "bg-red-900/80" : "bg-red-100/80"
                      } backdrop-blur-sm`}
                    >
                      <Trash2
                        size={20}
                        color={isDarkColorScheme ? "#F87171" : "#EF4444"}
                      />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text
                      className={`text-sm font-medium ${
                        isDarkColorScheme ? "text-green-300" : "text-green-600"
                      }`}
                    >
                      ✓ Foto berhasil dipilih
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        clearImage();
                        // Automatically open picker again
                        setTimeout(() => {
                          pickFromCamera();
                        }, 100);
                      }}
                      className={`px-3 py-1 rounded-lg ${
                        isDarkColorScheme ? "bg-gray-700" : "bg-gray-100"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                        }`}
                      >
                        Ganti Foto
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </CardContent>
          </Card>

          {/* Submit Button Card */}
          <Card
            className={`${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            } shadow-sm`}
          >
            <CardContent className="p-6">
              <TouchableOpacity
                disabled={
                  uploading || !description.trim() || description.length < 10
                }
                onPress={uploadPermit}
                className={`w-full p-4 rounded-xl flex-row items-center justify-center ${
                  uploading || !description.trim() || description.length < 10
                    ? isDarkColorScheme
                      ? "bg-gray-700"
                      : "bg-gray-300"
                    : isDarkColorScheme
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-blue-500 hover:bg-blue-600"
                } ${uploading ? "opacity-80" : ""}`}
              >
                {uploading ? (
                  <>
                    <View className="mr-3">
                      <View
                        className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${
                          isDarkColorScheme
                            ? "border-gray-400"
                            : "border-blue-200"
                        }`}
                      />
                    </View>
                    <Text
                      className={`font-semibold text-base ${
                        isDarkColorScheme ? "text-gray-300" : "text-blue-100"
                      }`}
                    >
                      Mengirim Pengajuan...
                    </Text>
                  </>
                ) : (
                  <>
                    <ClipboardPenLine
                      size={20}
                      color={
                        !description.trim() || description.length < 10
                          ? isDarkColorScheme
                            ? "#6B7280"
                            : "#9CA3AF"
                          : "#FFFFFF"
                      }
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      className={`font-bold text-base ${
                        !description.trim() || description.length < 10
                          ? isDarkColorScheme
                            ? "text-gray-400"
                            : "text-gray-500"
                          : "text-white"
                      }`}
                    >
                      Kirim Pengajuan Izin
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Validation Message */}
              {!description.trim() && (
                <Text
                  className={`text-xs text-center mt-3 ${
                    isDarkColorScheme ? "text-red-400" : "text-red-500"
                  }`}
                >
                  ⚠️ Deskripsi tidak boleh kosong
                </Text>
              )}
              {description.trim() && description.length < 10 && (
                <Text
                  className={`text-xs text-center mt-3 ${
                    isDarkColorScheme ? "text-yellow-400" : "text-yellow-600"
                  }`}
                >
                  ⚠️ Deskripsi minimal 10 karakter
                </Text>
              )}
              {description.trim() && description.length >= 10 && (
                <Text
                  className={`text-xs text-center mt-3 ${
                    isDarkColorScheme ? "text-green-400" : "text-green-600"
                  }`}
                >
                  ✓ Siap untuk dikirim
                </Text>
              )}
            </CardContent>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
