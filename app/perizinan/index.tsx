// filepath: app/perizinan/index.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import { H1, Large } from "~/components/ui/typography";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

// Debug helper function untuk menampilkan error dengan detail
const logError = (context: string, error: any): string => {
  console.error(`==== ERROR [${context}] ====`);
  console.error(`Message: ${error.message || "No error message"}`);
  console.error(`Stack: ${error.stack || "No stack trace"}`);

  // Log additional Supabase specific error details if available
  if (error.error) {
    console.error(`Supabase error code: ${error.error}`);
  }

  if (error.status) {
    console.error(`Status: ${error.status}`);
  }

  if (error.details) {
    console.error(`Details: ${JSON.stringify(error.details)}`);
  }

  if (error.response) {
    console.error(`Response: ${JSON.stringify(error.response)}`);
  }

  console.error("==== END ERROR ====");
  return error.message || "Unknown error occurred";
};

export default function PerizinanScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { isDarkMode } = useThemeStore();
  const [category, setCategory] = useState<"sakit" | "pergi">("sakit");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Camera permission is required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Media library permission is required");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
    }
  };

  const uploadPermit = async () => {
    if (!user) {
      Alert.alert("Error", "User not authenticated");
      return;
    }
    if (!imageUri) {
      Alert.alert("Error", "Pilih foto terlebih dahulu");
      return;
    }
    try {
      setUploading(true);
      console.log("Network Request: GET", imageUri);
      let response;
      try {
        response = await fetch(imageUri);
        // Detailed network response logging
        console.log("Network Response Details:", {
          url: response.url,
          status: response.status,
          ok: response.ok,
          type: response.type,
          redirected: response.redirected,
        });
        console.log("Response Headers:");
        for (const [key, value] of response.headers.entries()) {
          console.log(`Response Header: ${key}: ${value}`);
        }
      } catch (err) {
        const errorMsg = logError("fetchImage", err);
        throw new Error("Network request failed: " + errorMsg);
      }
      let blob;
      try {
        blob = await response.blob();
        console.log("Blob created:", { size: blob.size, type: blob.type });
      } catch (err) {
        const errorMsg = logError("createBlob", err);
        throw new Error("Failed to create blob: " + errorMsg);
      }
      const fileExt = imageUri.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      console.log("Preparing to upload file:", fileName);
      const { data, error: uploadError } = await supabase.storage
        .from("perizinan")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        const errorMsg = logError("uploadToStorage", uploadError);
        throw new Error(errorMsg);
      }

      console.log("File uploaded successfully, getting public URL");
      const { data: urlData } = supabase.storage
        .from("perizinan")
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;
      console.log("Public URL acquired:", publicUrl);

      console.log("Inserting record to database");
      const { error: insertError } = await supabase.from("perizinan").insert({
        user_id: user.id,
        kategori_izin: category,
        deskripsi: description,
        status: false,
        link_foto: publicUrl,
      });

      if (insertError) {
        const errorMsg = logError("insertToDB", insertError);
        throw new Error(errorMsg);
      }

      console.log("Record inserted successfully");
      Alert.alert("Success", "Izin berhasil dikirim");
      // Reset form
      setCategory("sakit");
      setDescription("");
      setImageUri(null);
      router.back();
    } catch (error) {
      const errorMessage = logError("uploadPermit", error);
      Alert.alert("Error", `Gagal mengirim izin: ${errorMessage}`);
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
        {/* Custom Header Bar */}
        <View
          className={`flex-row items-center p-4 border-b ${isDarkMode ? "border-gray-700 bg-gray-900" : "border-border bg-background"}`}
        >
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons
              name="arrow-back-outline"
              size={24}
              color={isDarkMode ? "#fff" : "black"}
            />
          </TouchableOpacity>
          <Text
            className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-black"}`}
          >
            Perizinan
          </Text>
        </View>
        <ScrollView
          className={`flex-1 px-5 pt-5 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-5">
            <H1
              className={`${isDarkMode ? "text-white" : "text-black"} mb-2 text-center`}
            >
              Pilih Kategori
            </H1>
            <View className="flex-row justify-center space-x-4 mt-2">
              {["sakit", "pergi"].map((item) => (
                <TouchableOpacity
                  key={item}
                  className={`px-8 py-3 rounded ${category === item ? "bg-black" : "bg-gray-200"}`}
                  onPress={() => setCategory(item as "sakit" | "pergi")}
                >
                  <Text
                    className={`${category === item ? "text-white font-bold" : "text-black"} text-center`}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View className="mb-5">
            <H1
              className={`${isDarkMode ? "text-white" : "text-black"} mb-2 text-center`}
            >
              Deskripsi
            </H1>
            <TextInput
              className={`border ${isDarkMode ? "border-gray-700 bg-gray-800 text-white" : "border-gray-300 bg-white text-black"} rounded-lg p-4 mt-2 h-28`}
              placeholder="Masukkan deskripsi izin"
              placeholderTextColor={isDarkMode ? "#9ca3af" : "#6b7280"}
              multiline
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />
          </View>
          <View className="mb-5">
            <H1
              className={`${isDarkMode ? "text-white" : "text-black"} mb-2 text-center`}
            >
              Foto
            </H1>
            <View className="flex-row justify-center space-x-4 mt-2">
              <Button onPress={pickFromCamera} className="bg-black flex-1 py-3">
                <Text className="text-white font-medium text-center">
                  Ambil Foto
                </Text>
              </Button>
              <Button
                onPress={pickFromLibrary}
                className="bg-black flex-1 py-3"
              >
                <Text className="text-white font-medium text-center">
                  Pilih File
                </Text>
              </Button>
            </View>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                className="w-full h-48 mt-4 rounded-lg"
                resizeMode="cover"
              />
            )}
          </View>
          <View className="items-center">
            <Button
              disabled={uploading}
              onPress={uploadPermit}
              className="w-full bg-black rounded-lg py-4 mb-4"
            >
              <Large className="text-white font-bold text-center">
                {uploading ? "Uploading..." : "Submit"}
              </Large>
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
