import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { format } from "date-fns";
import {
  View,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  BackHandler,
  TextInput,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";
import { Icon } from "~/components/ui/icon";
import { cn } from "~/lib/utils";
import {
  ChevronLeft,
  ClipboardPenLine,
  FileText,
  Camera,
  AlertCircle,
  Trash2,
  Image as ImageIcon,
  Send,
  HeartPulse,
  Briefcase,
  CheckCircle,
  CloudUpload,
  Clock,
  CheckCircle2,
} from "lucide-react-native";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type PermitCategory = "sakit" | "pergi";

interface ImageData {
  uri: string;
  fileSize: number;
}

interface FormData {
  category: PermitCategory;
  description: string;
  image: ImageData | null;
}

interface UIState {
  uploading: boolean;
  checking: boolean;
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const IMAGE_QUALITY = 0.8;
const IMAGE_FORMAT = "jpeg";
const STORAGE_BUCKET = "perizinan";
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 500;

const CATEGORY_LABELS: Record<PermitCategory, string> = {
  sakit: "Sakit",
  pergi: "Pergi",
};

const CATEGORY_DESCRIPTIONS: Record<PermitCategory, string> = {
  sakit: "Kesehatan Tubuh",
  pergi: "Urusan Pribadi",
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const generateFileName = (
  userId: string,
  extension: string = IMAGE_FORMAT,
): string => {
  const fileName = `${userId}/${Date.now()}.${extension}`;
  return fileName;
};

const getImageContentType = (uri: string): string => {
  const extension = uri.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    default:
      return "image/jpeg";
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// ============================================================================
// INTERNAL UI SUBCOMPONENTS
// ============================================================================

/**
 * CategoryCard - Individual category option
 */
const CategoryCard: React.FC<{
  value: PermitCategory;
  isSelected: boolean;
  onPress: () => void;
  disabled: boolean;
}> = ({ value, isSelected, onPress, disabled }) => {
  const isSakit = value === "sakit";
  const activeColor = isSakit ? "text-red-500" : "text-blue-500";
  const activeBg = isSakit
    ? "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/30"
    : "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30";
  const iconBg = isSakit
    ? "bg-red-200 dark:bg-red-900/50"
    : "bg-blue-200 dark:bg-blue-900/50";
  const borderColor = isSakit ? "border-red-200 dark:border-red-800" : "border-blue-200 dark:border-blue-800";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "flex-1 p-6 rounded-2xl border-2 relative shadow-sm overflow-hidden",
        isSelected ? activeBg : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
        isSelected && borderColor,
        disabled && "opacity-50",
      )}
      activeOpacity={0.8}
    >
      {isSelected && (
        <View className="absolute top-3 right-3">
          <Icon as={CheckCircle2} className={cn("size-5", activeColor)} />
        </View>
      )}

      <View
        className={cn(
          "w-12 h-12 rounded-2xl items-center justify-center mb-3",
          iconBg,
        )}
      >
        <Icon
          as={isSakit ? HeartPulse : Briefcase}
          className={cn("size-6", activeColor)}
        />
      </View>

      <Text className="font-bold text-lg text-foreground mb-1">
        {CATEGORY_LABELS[value]}
      </Text>
      <Text className="text-xs text-muted-foreground">
        {CATEGORY_DESCRIPTIONS[value]}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * UploadArea - Dashed upload container
 */
const UploadArea: React.FC<{
  onPress: () => void;
  disabled: boolean;
}> = ({ onPress, disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
    className="w-full border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-2xl p-8 items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/10 dark:to-blue-900/20"
  >
    <View className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-900/50 items-center justify-center mb-4 shadow-sm">
      <Icon as={CloudUpload} className="size-10 text-blue-500" />
    </View>
    <Text className="font-bold text-foreground text-base mb-2">
      Ambil atau Pilih Foto
    </Text>
    <Text className="text-xs text-muted-foreground text-center">
      Format: JPG, PNG • Max 10MB
    </Text>
    <Text className="text-xs text-blue-600 dark:text-blue-400 mt-3 font-medium">
      Tap untuk memilih foto
    </Text>
  </TouchableOpacity>
);

/**
 * ImagePreview - Shows selected image
 */
const ImagePreview: React.FC<{
  imageData: ImageData;
  onRemove: () => void;
}> = ({ imageData, onRemove }) => (
  <View className="relative w-full h-64 rounded-2xl overflow-hidden bg-gray-100 shadow-md">
    <Image
      source={{ uri: imageData.uri }}
      className="w-full h-full"
      resizeMode="cover"
    />
    <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 flex-row justify-between items-end">
      <View>
        <Text className="text-xs text-gray-200 font-medium">Foto dipilih</Text>
        <Text className="text-sm text-white font-semibold">{formatFileSize(imageData.fileSize)}</Text>
      </View>
      <TouchableOpacity
        onPress={onRemove}
        className="w-10 h-10 rounded-full bg-red-500 items-center justify-center shadow-lg active:bg-red-600"
      >
        <Icon as={Trash2} className="size-5 text-white" />
      </TouchableOpacity>
    </View>
  </View>
);

/**
 * AlertBanner - Reusable alert component
 */
const AlertBanner: React.FC<{
  type: "warning" | "error" | "success" | "info";
  title: string;
  message: string;
}> = ({ type, title, message }) => {
  const colors = {
    warning: "bg-gradient-to-br from-orange-50 to-orange-100/80 dark:from-orange-900/20 dark:to-orange-900/30 text-orange-900 dark:text-orange-100 border-orange-200 dark:border-orange-700",
    error: "bg-gradient-to-br from-red-50 to-red-100/80 dark:from-red-900/20 dark:to-red-900/30 text-red-900 dark:text-red-100 border-red-200 dark:border-red-700",
    success: "bg-gradient-to-br from-green-50 to-green-100/80 dark:from-green-900/20 dark:to-green-900/30 text-green-900 dark:text-green-100 border-green-200 dark:border-green-700",
    info: "bg-gradient-to-br from-blue-50 to-blue-100/80 dark:from-blue-900/20 dark:to-blue-900/30 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-700",
  };

  const iconColors = {
    warning: "text-orange-500",
    error: "text-red-500",
    success: "text-green-500",
    info: "text-blue-500",
  };

  const icons = {
    warning: AlertCircle,
    error: AlertCircle,
    success: CheckCircle,
    info: AlertCircle,
  };

  return (
    <View
      className={cn("p-4 rounded-xl border mb-6 flex-row gap-3", colors[type])}
    >
      <Icon
        as={icons[type]}
        className={cn("size-6 mt-0.5 flex-shrink-0", iconColors[type])}
      />
      <View className="flex-1">
        <Text className="font-bold text-base mb-1" style={{ color: "inherit" }}>
          {title}
        </Text>
        <Text className="text-sm opacity-90" style={{ color: "inherit" }}>
          {message}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PerizinanScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  // ---- State Management ----
  const [formData, setFormData] = useState<FormData>({
    category: "sakit",
    description: "",
    image: null,
  });

  const [uiState, setUIState] = useState<UIState>({
    uploading: false,
    checking: true,
  });

  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);

  // Ref for description TextInput
  const descriptionInputRef = useRef<TextInput>(null);

  // ---- Computed State ----
  const validation = useMemo(
    () => ({
      category: !!formData.category,
      description: formData.description.trim().length >= MIN_DESCRIPTION_LENGTH,
      image: !!formData.image,
    }),
    [formData],
  );

  const isFormValid =
    validation.category && validation.description && validation.image;
  const canSubmit =
    isFormValid &&
    !uiState.uploading &&
    !hasSubmittedToday &&
    !uiState.checking;

  // ---- Handler Functions (defined before effects) ----

  const checkTodayIzin = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        const now = new Date();
        const localDate = format(now, "yyyy-MM-dd");
        const startOfDay = new Date(`${localDate}T00:00:00`);
        const endOfDay = new Date(`${localDate}T23:59:59.999`);
        const startOfDayUTC = startOfDay.toISOString();
        const endOfDayUTC = endOfDay.toISOString();

        const { data, error } = await supabase
          .from("perizinan")
          .select("id, tanggal, kategori_izin")
          .eq("user_id", userId)
          .gte("tanggal", startOfDayUTC)
          .lte("tanggal", endOfDayUTC);

        if (error) {
          return false;
        }

        const hasSubmittedToday = data && data.length > 0;
        return hasSubmittedToday;
      } catch {
        return false;
      }
    },
    [],
  );

  // ---- Effect Hooks ----

  // Check initial submission status
  useEffect(() => {
    const checkInitialSubmissionStatus = async () => {
      if (!user?.id) {
        setUIState((prev) => ({ ...prev, checking: false }));
        return;
      }

      try {
        const hasSubmitted = await checkTodayIzin(user.id);
        setHasSubmittedToday(hasSubmitted);
      } catch {
        setHasSubmittedToday(false);
      } finally {
        setUIState((prev) => ({ ...prev, checking: false }));
      }
    };

    checkInitialSubmissionStatus();
  }, [user?.id, checkTodayIzin]);

  // Refresh submission status on focus
  useFocusEffect(
    useCallback(() => {
      const refreshSubmissionStatus = async () => {
        if (!user?.id) return;

        try {
          setUIState((prev) => ({ ...prev, checking: true }));
          const hasSubmitted = await checkTodayIzin(user.id);
          setHasSubmittedToday(hasSubmitted);
        } catch {
          setHasSubmittedToday(false);
        } finally {
          setUIState((prev) => ({ ...prev, checking: false }));
        }
      };

      refreshSubmissionStatus();
    }, [user?.id, checkTodayIzin]),
  );

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      router.back();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [router]);

  // ---- Handler Functions ----

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Izin Ditolak",
        "Izin kamera diperlukan untuk mengambil foto.",
      );
      return false;
    }
    return true;
  }, []);

  const requestLibraryPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Izin Ditolak", "Izin galeri diperlukan untuk memilih foto.");
      return false;
    }
    return true;
  }, []);

  const resolveAssetFileSize = useCallback(
    async (asset: ImagePicker.ImagePickerAsset): Promise<number> => {
      if (typeof asset.fileSize === "number") {
        return asset.fileSize;
      }

      try {
        const info = await FileSystem.getInfoAsync(asset.uri);
        if (info.exists && typeof info.size === "number") {
          return info.size;
        }
      } catch (error: any) {
        console.error("Error getting file info:", error);
        throw new Error(
          `Tidak dapat mengakses file gambar: ${error.message || "File tidak dapat dibaca"}. Silakan pilih gambar lain.`,
        );
      }

      throw new Error(
        "Tidak dapat menentukan ukuran file. Silakan coba lagi atau pilih gambar lain.",
      );
    },
    [],
  );

  const handleImageResult = useCallback(
    async (result: ImagePicker.ImagePickerResult): Promise<void> => {
      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const resolvedSize = await resolveAssetFileSize(asset);

      if (resolvedSize > MAX_IMAGE_SIZE_BYTES) {
        Alert.alert(
          "Error",
          "Ukuran file melebihi 10 MB. Silakan pilih file yang lebih kecil.",
        );
        return;
      }

      setFormData((prev) => ({
        ...prev,
        image: {
          uri: asset.uri,
          fileSize: resolvedSize,
        },
      }));
    },
    [resolveAssetFileSize],
  );

  const pickFromCamera = useCallback(async (): Promise<void> => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: IMAGE_QUALITY,
        allowsEditing: false,
        base64: false,
      });

      await handleImageResult(result);
    } catch {
      Alert.alert("Error", "Gagal mengambil foto dari kamera");
    }
  }, [requestCameraPermission, handleImageResult]);

  const pickFromLibrary = useCallback(async (): Promise<void> => {
    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: IMAGE_QUALITY,
        allowsEditing: false,
        base64: false,
      });

      await handleImageResult(result);
    } catch {
      Alert.alert("Error", "Gagal memilih foto dari galeri");
    }
  }, [requestLibraryPermission, handleImageResult]);

  const showImageSourceOptions = useCallback(() => {
    const options = [
      { text: "Ambil Foto (Kamera)", onPress: pickFromCamera },
      { text: "Pilih dari Galeri", onPress: pickFromLibrary },
      { text: "Batal", style: "cancel", onPress: () => {} },
    ];

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Batal", "Ambil Foto", "Pilih dari Galeri"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickFromCamera();
          else if (buttonIndex === 2) pickFromLibrary();
        },
      );
    } else {
      Alert.alert(
        "Upload Foto",
        "Pilih sumber foto",
        // @ts-ignore
        options,
        { cancelable: true },
      );
    }
  }, [pickFromCamera, pickFromLibrary]);

  const uploadImageToStorage = useCallback(
    async (imageData: ImageData, userId: string): Promise<string> => {
      const contentType = getImageContentType(imageData.uri);
      const extension = contentType.split("/").pop() || IMAGE_FORMAT;
      const fileName = generateFileName(userId, extension);

      let response: Response;
      let arrayBuffer: ArrayBuffer;

      try {
        response = await fetch(imageData.uri);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        arrayBuffer = await response.arrayBuffer();
      } catch (error: any) {
        Alert.alert(
          "Error Membaca File",
          "File gambar tidak dapat diakses atau rusak. Silakan pilih gambar lain.",
        );
        throw new Error(
          `Gagal membaca file gambar: ${error.message || "File tidak dapat diakses"}`,
        );
      }

      const { data, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, arrayBuffer, {
          contentType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        if (
          uploadError.message?.includes("network") ||
          uploadError.message?.includes("connection") ||
          uploadError.message?.toLowerCase().includes("timeout")
        ) {
          throw new Error(
            "Koneksi internet bermasalah. Mohon periksa koneksi internet Anda.",
          );
        }
        throw new Error(`Upload gagal: ${uploadError.message}`);
      }

      const { data: urlData, error: signedErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(data.path, 60 * 60 * 24 * 7);

      if (signedErr) {
        throw new Error(`Gagal membuat URL gambar: ${signedErr.message}`);
      }

      return urlData.signedUrl;
    },
    [],
  );

  const insertPermitToDatabase = useCallback(
    async (permitData: {
      userId: string;
      category: PermitCategory;
      description: string;
      imageUrl?: string;
    }): Promise<void> => {
      // Final check before insert
      const finalCheck = await checkTodayIzin(permitData.userId);
      if (finalCheck) {
        throw new Error(
          "Izin sudah diajukan hari ini. Hanya satu pengajuan per hari yang diperbolehkan.",
        );
      }

      const insertData = {
        user_id: permitData.userId,
        kategori_izin: permitData.category,
        deskripsi: permitData.description,
        status: false,
        link_foto: permitData.imageUrl || null,
        tanggal: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from("perizinan")
        .insert(insertData);

      if (insertError) {
        throw new Error(`Gagal menyimpan data: ${insertError.message}`);
      }
    },
    [checkTodayIzin],
  );

  const uploadPermit = useCallback(async (): Promise<void> => {
    if (!user) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    if (!validation.description) {
      Alert.alert("Error", "Deskripsi minimal 10 karakter");
      return;
    }

    if (!formData.image) {
      Alert.alert(
        "Error",
        "Foto bukti wajib dilampirkan untuk pengajuan izin.",
      );
      return;
    }

    const hasSubmittedToday = await checkTodayIzin(user.id);
    if (hasSubmittedToday) {
      Alert.alert(
        "Izin Sudah Diajukan Hari Ini",
        "Anda sudah mengajukan izin untuk hari ini. Sistem hanya memperbolehkan satu pengajuan izin per hari.",
      );
      return;
    }

    try {
      setUIState((prev) => ({ ...prev, uploading: true }));

      let imageUrl: string | undefined;
      if (formData.image) {
        imageUrl = await uploadImageToStorage(formData.image, user.id);
      }

      await insertPermitToDatabase({
        userId: user.id,
        category: formData.category,
        description: formData.description,
        imageUrl,
      });

      setHasSubmittedToday(true);
      Alert.alert("Berhasil", "Pengajuan izin berhasil dikirim", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      if (errorMessage.includes("Gagal membaca file")) return;

      Alert.alert("Gagal Mengirim", errorMessage);
    } finally {
      setUIState((prev) => ({ ...prev, uploading: false }));
    }
  }, [
    user,
    formData,
    validation.description,
    checkTodayIzin,
    uploadImageToStorage,
    insertPermitToDatabase,
    router,
  ]);

  // ---- Render ----

  const isDisabled = hasSubmittedToday || uiState.checking || uiState.uploading;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      {/* Enhanced Header */}
      <View className="px-6 py-5 flex-row items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 border-b border-blue-700 dark:border-blue-800 shadow-sm">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/20 dark:bg-white/10 items-center justify-center border border-white/30 active:bg-white/30"
        >
          <Icon
            as={ChevronLeft}
            className="size-6 text-white"
          />
        </TouchableOpacity>

        <View className="flex-1 items-center">
          <Text className="text-xl font-bold text-white">
            Pengajuan Izin
          </Text>
          <Text className="text-xs text-white/70 mt-1">
            Ajukan izin sesuai kebutuhan Anda
          </Text>
        </View>

        <View className="w-10" />
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Warnings */}
        {hasSubmittedToday && !uiState.checking && (
          <AlertBanner
            type="warning"
            title="Sudah Mengajukan"
            message="Anda sudah mengirim izin hari ini."
          />
        )}

        {/* Category Selection */}
        <View className="mb-10">
          <View className="flex-row items-center gap-2.5 mb-5">
            <View className="w-1 h-6 bg-blue-600 rounded-full" />
            <Text className="font-bold text-lg text-foreground">
              Pilih Kategori Izin
            </Text>
          </View>

          <View className="flex-row gap-4">
            {(["sakit", "pergi"] as const).map((catValue) => (
              <CategoryCard
                key={catValue}
                value={catValue}
                isSelected={formData.category === catValue}
                onPress={() =>
                  setFormData((prev) => ({
                    ...prev,
                    category: catValue,
                  }))
                }
                disabled={isDisabled}
              />
            ))}
          </View>
        </View>

        {/* Description */}
        <View className="mb-10">
          <View className="flex-row items-center gap-2.5 mb-5">
            <View className="w-1 h-6 bg-blue-600 rounded-full" />
            <Text className="font-bold text-lg text-foreground">
              Detail Keterangan
            </Text>
          </View>

          <View className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-900/50 rounded-2xl p-5 border border-gray-200 dark:border-gray-700/50 shadow-sm">
            <TextInput
              ref={descriptionInputRef}
              editable={!isDisabled}
              className="min-h-[140px] text-base text-foreground leading-6"
              placeholder="Tuliskan alasan pengajuan Anda secara detail..."
              placeholderTextColor="#a0a0a0"
              multiline
              value={formData.description}
              onChangeText={(text) =>
                setFormData((prev) => ({
                  ...prev,
                  description: text.slice(0, MAX_DESCRIPTION_LENGTH),
                }))
              }
              textAlignVertical="top"
              maxLength={MAX_DESCRIPTION_LENGTH}
            />

            <View className="flex-row justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
              <View className="flex-row items-center gap-2">
                <Icon as={AlertCircle} className="size-4 text-blue-500" />
                <Text className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  MINIMAL 10 KARAKTER
                </Text>
              </View>
              <View className={cn(
                "px-3 py-1.5 rounded-full",
                formData.description.trim().length < MIN_DESCRIPTION_LENGTH
                  ? "bg-red-100 dark:bg-red-900/30"
                  : "bg-green-100 dark:bg-green-900/30"
              )}>
                <Text className={cn(
                  "text-xs font-bold",
                  formData.description.trim().length < MIN_DESCRIPTION_LENGTH
                    ? "text-red-700 dark:text-red-400"
                    : "text-green-700 dark:text-green-400"
                )}>
                  {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Attachment */}
        <View className="mb-10">
          <View className="flex-row justify-between items-center mb-5">
            <View className="flex-row items-center gap-2.5">
              <View className="w-1 h-6 bg-blue-600 rounded-full" />
              <Text className="font-bold text-lg text-foreground">
                Bukti Lampiran
              </Text>
            </View>
            <View className="bg-orange-100 dark:bg-orange-900/30 px-3 py-1 rounded-full">
              <Text className="text-xs font-bold text-orange-600 dark:text-orange-400">
                WAJIB
              </Text>
            </View>
          </View>

          {!formData.image ? (
            <UploadArea
              onPress={showImageSourceOptions}
              disabled={isDisabled}
            />
          ) : (
            <ImagePreview
              imageData={formData.image}
              onRemove={() => setFormData((prev) => ({ ...prev, image: null }))}
            />
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={uploadPermit}
          disabled={!canSubmit}
          activeOpacity={canSubmit ? 0.8 : 1}
          className={cn(
            "w-full py-5 rounded-xl flex-row items-center justify-center shadow-lg",
            canSubmit
              ? "bg-gradient-to-r from-blue-600 to-blue-700 shadow-blue-600/50"
              : "bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800 shadow-gray-400/20",
          )}
        >
          {uiState.uploading ? (
            <>
              <View className="w-5 h-5 border-3 border-t-transparent border-white rounded-full mr-3 animate-spin" />
              <Text className="text-white font-bold text-base">Mengirim...</Text>
            </>
          ) : (
            <>
              <Icon
                as={Send}
                className={cn(
                  "size-5 mr-2.5",
                  canSubmit ? "text-white" : "text-gray-500",
                )}
              />
              <Text
                className={cn(
                  "font-bold text-base tracking-wide",
                  canSubmit ? "text-white" : "text-gray-500",
                )}
              >
                KIRIM PENGAJUAN
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
