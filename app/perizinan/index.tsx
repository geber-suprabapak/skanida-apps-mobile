// filepath: app/perizinan/index.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { View, TouchableOpacity, Image, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"; // Added import
import { Input } from "~/components/ui/input"; // Added import
import { Text } from "~/components/ui/text"; // Updated import
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

// Utility function to convert base64 string to Uint8Array
const base64ToUint8Array = (base64: string): Uint8Array => {
  if (!base64) {
    throw new Error("Invalid base64 string: cannot be null or empty");
  }
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error: any) {
    console.error("Error converting base64 to Uint8Array:", error.message);
    throw new Error("Failed to process image data: " + error.message);
  }
};

export default function PerizinanScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { isDarkMode } = useThemeStore();
  const [category, setCategory] = useState<"sakit" | "pergi">("sakit");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const clearImage = () => {
    setImageUri(null);
    setImageBase64(null);
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Izin Ditolak",
        "Izin kamera diperlukan untuk mengambil foto.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
      base64: true, // Request base64 data
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Izin Ditolak", "Izin galeri diperlukan untuk memilih foto.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
      base64: true, // Request base64 data
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  const uploadPermit = async () => {
    if (!user) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Error", "Deskripsi tidak boleh kosong.");
      return;
    }

    try {
      setUploading(true);
      let publicUrl: string | null = null;

      if (imageBase64 && imageUri) {
        console.log("Processing image (base64 available):", imageUri);
        let fileBuffer: Uint8Array;
        let determinedContentType = "application/octet-stream";

        try {
          const uriParts = imageUri.split(".");
          const fileExt = uriParts.pop()?.toLowerCase();

          if (fileExt === "jpg" || fileExt === "jpeg") {
            determinedContentType = "image/jpeg";
          } else if (fileExt === "png") {
            determinedContentType = "image/png";
          }

          fileBuffer = base64ToUint8Array(imageBase64);
          console.log("Uint8Array created from base64:", {
            size: fileBuffer.byteLength,
          });
        } catch (err: any) {
          throw new Error(`Failed to process image data: ${err.message}`);
        }

        const fileNameParts = imageUri.split(".");
        const fileNameExt = fileNameParts.pop();
        const fileName = `${user.id}/${Date.now()}.${fileNameExt || "bin"}`;

        console.log("Preparing to upload file (Uint8Array):", fileName);
        try {
          const { data, error: uploadError } = await supabase.storage
            .from("perizinan")
            .upload(fileName, fileBuffer, {
              contentType: determinedContentType,
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            // Check specifically for network-related errors
            if (
              uploadError.message?.includes("network") ||
              uploadError.message?.includes("connection") ||
              uploadError.message?.toLowerCase().includes("timeout")
            ) {
              throw new Error(
                `Koneksi internet bermasalah. Mohon periksa koneksi internet Anda dan coba lagi.`,
              );
            }
            throw new Error(
              `Supabase storage upload error: ${uploadError.message}`,
            );
          }

          console.log("File uploaded successfully, getting public URL");
          const { data: urlData } = supabase.storage
            .from("perizinan")
            .getPublicUrl(data.path);

          publicUrl = urlData.publicUrl;
          console.log("Public URL acquired:", publicUrl);
        } catch (networkErr: any) {
          if (
            networkErr.message?.includes("network") ||
            networkErr.message?.includes("connection") ||
            networkErr.message?.toLowerCase().includes("timeout")
          ) {
            throw new Error(
              `Koneksi internet bermasalah. Mohon periksa koneksi internet Anda dan coba lagi.`,
            );
          }
          throw networkErr;
        }
      }

      console.log("Inserting record to database");
      try {
        const { error: insertError } = await supabase.from("perizinan").insert({
          user_id: user.id,
          kategori_izin: category,
          deskripsi: description,
          status: false,
          link_foto: publicUrl,
        });

        if (insertError) {
          // log full error object for debugging
          console.error("Supabase insertError object:", insertError);
          // existing retry / throw logic
          if (insertError.message?.includes("boolean")) {
            console.log("Retrying with boolean status due to type mismatch");
            const { error: retryError } = await supabase
              .from("perizinan")
              .insert({
                user_id: user.id,
                kategori_izin: category,
                deskripsi: description,
                status: false,
                link_foto: publicUrl,
              });
            if (retryError) {
              console.error("Supabase retryError object:", retryError);
              throw new Error(`Supabase insert error: ${retryError.message}`);
            }
          } else {
            console.error(
              "Supabase insertError object (non-boolean):",
              insertError,
            );
            throw new Error(`Supabase insert error: ${insertError.message}`);
          }
        }
      } catch (dbErr: any) {
        // also log any caught exception
        console.error("Database insert caught exception:", dbErr);
        // ...existing network check / rethrow...
        throw dbErr;
      }

      console.log("Record inserted successfully");
      Alert.alert("Success", "Izin berhasil dikirim");
      setCategory("sakit");
      setDescription("");
      clearImage();
      router.back();
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      console.error("Upload error:", errorMessage);

      // Provide a more user-friendly message for network errors
      if (
        errorMessage.includes("network") ||
        errorMessage.includes("connection") ||
        errorMessage.toLowerCase().includes("timeout") ||
        errorMessage.includes("internet")
      ) {
        Alert.alert(
          "Koneksi Bermasalah",
          "Gagal mengirim izin karena masalah koneksi internet. Mohon periksa koneksi Anda dan coba lagi.",
          [{ text: "OK" }],
        );
      } else {
        Alert.alert("Error", `Gagal mengirim izin: ${errorMessage}`);
      }
    } finally {
      setUploading(false);
    }
  };

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
              {imageUri && (
                <View className="mt-4 items-center relative">
                  <Image
                    source={{ uri: imageUri }}
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
