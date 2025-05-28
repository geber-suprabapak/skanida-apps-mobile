import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, TouchableOpacity, Image, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

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
  const { isDarkMode } = useThemeStore();
  logger.info("PerizinanScreen component mounted", {
    userId: user?.id,
    isDarkMode,
  });

  // State management
  const [category, setCategory] = useState<PermitCategory>("sakit");
  const [description, setDescription] = useState("");
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [uploading, setUploading] = useState(false);
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
        className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
      >
        <View // Header View
          className={`flex-row items-center p-4 border-b ${isDarkMode ? "border-gray-700 bg-gray-900" : "border-border bg-background"}`}
        >
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
            <Ionicons
              name="arrow-back-outline"
              size={24}
              color={isDarkMode ? "#fff" : "hsl(var(--foreground))"}
            />
          </TouchableOpacity>
          <Text // Using custom Text component
            className={`text-xl font-semibold ${isDarkMode ? "text-white" : "text-foreground"}`}
          >
            Buat Pengajuan Izin
          </Text>
        </View>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <Card className="mb-5">
            <CardHeader>
              <CardTitle>
                <Text
                  className={`${isDarkMode ? "text-white" : "text-black"} text-center`}
                >
                  Pilih Kategori
                </Text>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="flex-row justify-around space-x-3 mt-2">
                {(["sakit", "pergi"] as const).map((catValue) => (
                  <Button // Using custom Button component
                    key={catValue}
                    onPress={() => setCategory(catValue)}
                    variant={category === catValue ? "default" : "outline"}
                    className={`flex-1 py-3 rounded-lg ${
                      category === catValue
                        ? isDarkMode
                          ? "bg-primary text-primary-foreground"
                          : "bg-black text-white"
                        : isDarkMode
                          ? "border-gray-700 bg-gray-800"
                          : "border-gray-300 bg-gray-200"
                    }`}
                  >
                    <Text // Using custom Text component
                      className={`font-medium text-center ${
                        category === catValue
                          ? isDarkMode
                            ? "text-primary-foreground"
                            : "text-white"
                          : isDarkMode
                            ? "text-gray-300"
                            : "text-gray-700"
                      }`}
                    >
                      {catValue.charAt(0).toUpperCase() + catValue.slice(1)}
                    </Text>
                  </Button>
                ))}
              </View>
            </CardContent>
          </Card>

          <Card className="mb-5">
            <CardHeader>
              <CardTitle>
                <Text
                  className={`${isDarkMode ? "text-white" : "text-foreground"}`}
                >
                  Deskripsi
                </Text>
              </CardTitle>
              <CardDescription>
                <Text
                  className={`${isDarkMode ? "text-gray-400" : "text-muted-foreground"}`}
                >
                  Jelaskan alasan pengajuan izin Anda.
                </Text>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input // Using custom Input component
                className={`h-32 text-base ${
                  isDarkMode
                    ? "border-gray-600 bg-gray-700 text-white placeholder-gray-400"
                    : "border-input bg-background text-foreground placeholder-muted-foreground"
                }`}
                placeholder="Masukkan alasan atau deskripsi izin Anda di sini..."
                multiline
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top" // Supported by TextInput, ensure Input passes this down or handles it
                placeholderClassName={
                  isDarkMode ? "text-gray-400" : "text-muted-foreground"
                }
              />
            </CardContent>
          </Card>

          <Card className="mb-5">
            <CardHeader>
              <CardTitle>
                <Text
                  className={`${isDarkMode ? "text-white" : "text-foreground"}`}
                >
                  Lampiran Foto (Opsional)
                </Text>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="flex-row space-x-3 mb-4">
                <Button // Using custom Button component
                  variant="outline"
                  onPress={pickFromCamera}
                  className="flex-1"
                >
                  <View className="flex-row items-center justify-center">
                    <Ionicons
                      name="camera-outline"
                      size={20}
                      color={isDarkMode ? "#D1D5DB" : "hsl(var(--foreground))"}
                      style={{ marginRight: 8 }}
                    />
                    <Text // Using custom Text component
                      className={`${
                        isDarkMode ? "text-gray-300" : "text-foreground"
                      } font-medium`}
                    >
                      Ambil Foto
                    </Text>
                  </View>
                </Button>
                <Button // Using custom Button component
                  variant="outline"
                  onPress={pickFromLibrary}
                  className="flex-1"
                >
                  <View className="flex-row items-center justify-center">
                    <Ionicons
                      name="image-outline"
                      size={20}
                      color={isDarkMode ? "#D1D5DB" : "hsl(var(--foreground))"}
                      style={{ marginRight: 8 }}
                    />
                    <Text // Using custom Text component
                      className={`${
                        isDarkMode ? "text-gray-300" : "text-foreground"
                      } font-medium`}
                    >
                      Pilih File
                    </Text>
                  </View>
                </Button>
              </View>
              {imageData && (
                <View className="mt-4 items-center relative">
                  <Image
                    source={{ uri: imageData.uri }}
                    className="w-full h-48 rounded-lg"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={clearImage}
                    className={`absolute top-2 right-2 p-1.5 rounded-full ${
                      isDarkMode
                        ? "bg-gray-600 opacity-80"
                        : "bg-gray-300 opacity-80"
                    }`}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={28}
                      color={isDarkMode ? "white" : "black"}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Button // Using custom Button component
                disabled={uploading || !description.trim()}
                onPress={uploadPermit}
                className={`w-full py-3.5 rounded-lg ${
                  uploading || !description.trim()
                    ? isDarkMode
                      ? "bg-gray-600" // Consider using a disabled variant from your Button component
                      : "bg-gray-400"
                    : isDarkMode
                      ? "bg-primary"
                      : "bg-black"
                }`}
              >
                <Text // Using custom Text component
                  className={`font-semibold text-base text-center ${
                    uploading || !description.trim()
                      ? isDarkMode
                        ? "text-gray-400"
                        : "text-gray-700"
                      : isDarkMode
                        ? "text-primary-foreground"
                        : "text-white" // Ensure contrast with button bg
                  }`}
                >
                  {uploading ? "Mengirim..." : "Kirim Pengajuan Izin"}
                </Text>
              </Button>
            </CardContent>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
