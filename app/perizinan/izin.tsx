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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";
import { Icon } from "~/components/ui/icon";
import {
  ChevronLeft,
  ClipboardPenLine,
  FileText,
  Camera,
  AlertCircle,
  Trash2,
  Image as ImageIcon,
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
  sakit: "Kondisi kesehatan",
  pergi: "Keperluan pribadi",
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
 * SectionHeader - Icon + title + subtitle
 */
const SectionHeader: React.FC<{
  icon: any;
  title: string;
  subtitle: string;
}> = ({ icon, title, subtitle }) => (
  <CardHeader className="pb-3">
    <View className="flex-row items-center">
      <View className="mr-3 p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
        <Icon as={icon} className="size-5 text-blue-600 dark:text-blue-400" />
      </View>
      <View>
        <CardTitle>
          <Text variant="h4" className="font-bold text-foreground">
            {title}
          </Text>
        </CardTitle>
        <Text variant="small" className="text-muted-foreground mt-1">
          {subtitle}
        </Text>
      </View>
    </View>
  </CardHeader>
);

/**
 * CategoryButton - Individual category option
 */
const CategoryButton: React.FC<{
  value: PermitCategory;
  isSelected: boolean;
  onPress: () => void;
  disabled: boolean;
}> = ({ value, isSelected, onPress, disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
      isSelected
        ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950"
        : "border-border bg-card"
    } ${disabled ? "opacity-50" : ""}`}
    activeOpacity={0.7}
  >
    <View className="items-center">
      <View className="mb-3 p-2 rounded-full bg-blue-100 dark:bg-blue-900">
        <Icon
          as={value === "sakit" ? AlertCircle : ClipboardPenLine}
          className="size-5 text-blue-600 dark:text-blue-400"
        />
      </View>
      <Text
        variant="small"
        className="font-semibold text-center text-foreground"
      >
        {CATEGORY_LABELS[value]}
      </Text>
      <Text
        variant="small"
        className="text-xs text-center mt-1 text-muted-foreground"
      >
        {CATEGORY_DESCRIPTIONS[value]}
      </Text>
    </View>
  </TouchableOpacity>
);

/**
 * ImageUploadButton - Camera or Gallery button
 */
const ImageUploadButton: React.FC<{
  type: "camera" | "gallery";
  onPress: () => void;
  disabled: boolean;
}> = ({ type, onPress, disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    className={`flex-1 p-4 rounded-xl border-2 border-dashed border-border ${
      disabled ? "opacity-50" : ""
    }`}
    activeOpacity={0.7}
  >
    <View className="items-center">
      <View className="mb-3 p-2 rounded-full bg-blue-100 dark:bg-blue-900">
        <Icon
          as={type === "camera" ? Camera : ImageIcon}
          className="size-5 text-blue-600 dark:text-blue-400"
        />
      </View>
      <Text variant="small" className="font-medium text-center text-foreground">
        {type === "camera" ? "Ambil Foto" : "Pilih File"}
      </Text>
      <Text
        variant="small"
        className="text-xs text-center mt-1 text-muted-foreground"
      >
        {type === "camera" ? "Kamera" : "Galeri"}
      </Text>
    </View>
  </TouchableOpacity>
);

/**
 * ImagePreviewCard - Preview with file info and controls
 */
const ImagePreviewCard: React.FC<{
  imageData: ImageData;
  onRemove: () => void;
  onReplace: () => void;
}> = ({ imageData, onRemove, onReplace }) => (
  <View className="space-y-4">
    <View className="relative rounded-xl overflow-hidden">
      <Image
        source={{ uri: imageData.uri }}
        className="w-full h-48"
        resizeMode="cover"
      />
      <View className="absolute inset-0 bg-black/10" />
      <TouchableOpacity
        onPress={onRemove}
        className="absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm bg-black/20 dark:bg-white/20 active:bg-black/40"
        activeOpacity={0.7}
      >
        <Icon as={Trash2} className="size-5 text-white" />
      </TouchableOpacity>
    </View>

    <View className="bg-muted/50 p-3 rounded-lg">
      <View className="flex-row items-center justify-between mb-2">
        <Text variant="small" className="font-medium text-foreground">
          ✓ Foto berhasil dipilih
        </Text>
        <View className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900">
          <Text className="text-xs font-medium text-green-700 dark:text-green-300">
            Valid
          </Text>
        </View>
      </View>
      <Text variant="small" className="text-xs text-muted-foreground">
        Ukuran: {formatFileSize(imageData.fileSize)}
      </Text>
    </View>

    <TouchableOpacity
      onPress={onReplace}
      className="w-full py-2 px-4 rounded-lg bg-blue-100 dark:bg-blue-900 active:bg-blue-200"
      activeOpacity={0.7}
    >
      <Text className="text-sm font-medium text-center text-blue-700 dark:text-blue-300">
        Ganti Foto
      </Text>
    </TouchableOpacity>
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
    warning: {
      bg: "bg-yellow-50 dark:bg-yellow-950",
      border: "border-yellow-500",
    },
    error: { bg: "bg-red-50 dark:bg-red-950", border: "border-red-500" },
    success: {
      bg: "bg-green-50 dark:bg-green-950",
      border: "border-green-500",
    },
    info: { bg: "bg-blue-50 dark:bg-blue-950", border: "border-blue-500" },
  };

  const iconBgColors = {
    warning: "bg-yellow-100 dark:bg-yellow-900",
    error: "bg-red-100 dark:bg-red-900",
    success: "bg-green-100 dark:bg-green-900",
    info: "bg-blue-100 dark:bg-blue-900",
  };

  const iconColors = {
    warning: "text-yellow-600 dark:text-yellow-400",
    error: "text-red-600 dark:text-red-400",
    success: "text-green-600 dark:text-green-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  return (
    <Card
      className={`mb-4 shadow-sm border-2 ${colors[type].bg} ${colors[type].border}`}
    >
      <CardContent className="p-4">
        <View className="flex-row items-start">
          <View className={`mr-3 p-2 rounded-lg ${iconBgColors[type]}`}>
            <Icon as={AlertCircle} className={`size-5 ${iconColors[type]}`} />
          </View>
          <View className="flex-1">
            <Text variant="p" className="font-bold text-foreground">
              {title}
            </Text>
            <Text variant="small" className="mt-1 text-foreground">
              {message}
            </Text>
          </View>
        </View>
      </CardContent>
    </Card>
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

    // Check if user has already submitted izin today
    const hasSubmittedToday = await checkTodayIzin(user.id);
    if (hasSubmittedToday) {
      Alert.alert(
        "Izin Sudah Diajukan Hari Ini",
        "Anda sudah mengajukan izin untuk hari ini. Sistem hanya memperbolehkan satu pengajuan izin per hari.\n\nJika perlu mengubah atau menambah informasi, silakan hubungi admin sekolah.",
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
      Alert.alert("Success", "Izin berhasil dikirim");
      router.back();
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";

      if (errorMessage.includes("Gagal membaca file gambar")) {
        // Alert already shown in uploadImageToStorage
        return;
      }

      if (
        errorMessage.includes("network") ||
        errorMessage.includes("connection") ||
        errorMessage.toLowerCase().includes("timeout") ||
        errorMessage.includes("internet")
      ) {
        Alert.alert(
          "Koneksi Bermasalah",
          "Gagal mengirim izin karena masalah koneksi internet. Mohon periksa koneksi Anda dan coba lagi.",
        );
      } else {
        Alert.alert("Error", `Gagal mengirim izin: ${errorMessage}`);
      }
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
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center p-4 border-b border-border bg-background">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3"
            activeOpacity={0.7}
          >
            <Icon as={ChevronLeft} className="size-6" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text variant="large">Pengajuan Izin</Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 bg-background"
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Already Submitted Today Warning */}
          {hasSubmittedToday && !uiState.checking && (
            <AlertBanner
              type="warning"
              title="Izin Sudah Diajukan Hari Ini"
              message="Anda sudah mengajukan izin untuk hari ini. Hanya satu pengajuan izin yang diperbolehkan per hari."
            />
          )}

          {/* Loading Check */}
          {uiState.checking && (
            <AlertBanner
              type="info"
              title="Memeriksa Status"
              message="Memeriksa status pengajuan hari ini..."
            />
          )}

          {/* Category Selection Card */}
          <Card
            className={`mb-4 shadow-sm bg-card ${isDisabled ? "opacity-60" : ""}`}
          >
            <SectionHeader
              icon={ClipboardPenLine}
              title="Kategori Izin"
              subtitle="Pilih jenis izin yang sesuai"
            />
            <CardContent>
              <View className="flex-row gap-3">
                {(["sakit", "pergi"] as const).map((catValue) => (
                  <CategoryButton
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
            </CardContent>
          </Card>

          {/* Description Card */}
          <Card
            className={`mb-4 shadow-sm bg-card ${isDisabled ? "opacity-60" : ""}`}
          >
            <SectionHeader
              icon={FileText}
              title="Deskripsi"
              subtitle="Jelaskan alasan pengajuan izin Anda"
            />
            <CardContent>
              <View className="rounded-xl border-2 border-border overflow-hidden bg-card">
                <TextInput
                  ref={descriptionInputRef}
                  editable={!isDisabled}
                  className="min-h-[100px] max-h-[160px] text-base border-0 p-3 text-foreground bg-transparent"
                  placeholder="Contoh: Sakit demam dan perlu istirahat di rumah..."
                  multiline
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: text.slice(0, MAX_DESCRIPTION_LENGTH),
                    }))
                  }
                  textAlignVertical="top"
                  numberOfLines={5}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  scrollEnabled={true}
                  autoCorrect={false}
                  blurOnSubmit={false}
                  returnKeyType="default"
                  style={{
                    textAlignVertical: "top",
                    lineHeight: 22,
                    minHeight: 100,
                    maxHeight: 160,
                  }}
                />
              </View>
            </CardContent>
          </Card>

          {/* Photo Upload Card */}
          <Card
            className={`mb-4 shadow-sm bg-card ${isDisabled ? "opacity-60" : ""}`}
          >
            <CardHeader className="pb-3">
              <View className="flex-row items-center">
                <View className="mr-3 p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <Icon
                    as={Camera}
                    className="size-5 text-blue-600 dark:text-blue-400"
                  />
                </View>
                <View className="flex-1">
                  <CardTitle>
                    <Text variant="h4" className="font-bold text-foreground">
                      Lampiran Foto *
                    </Text>
                  </CardTitle>
                  <Text variant="small" className="text-muted-foreground mt-1">
                    Wajib - Tambahkan bukti pendukung
                  </Text>
                </View>
                {formData.image && (
                  <View className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900">
                    <Text className="text-xs font-medium text-green-700 dark:text-green-300">
                      ✓ Foto dipilih
                    </Text>
                  </View>
                )}
              </View>
            </CardHeader>
            <CardContent>
              {!formData.image ? (
                <View className="space-y-3">
                  <View className="flex-row gap-3">
                    <ImageUploadButton
                      type="camera"
                      onPress={pickFromCamera}
                      disabled={isDisabled}
                    />
                    <ImageUploadButton
                      type="gallery"
                      onPress={pickFromLibrary}
                      disabled={isDisabled}
                    />
                  </View>
                  <Text className="text-xs text-center text-muted-foreground">
                    Format: JPG, PNG • Maksimal 10MB • Wajib dilampirkan
                  </Text>
                </View>
              ) : (
                <ImagePreviewCard
                  imageData={formData.image}
                  onRemove={() =>
                    setFormData((prev) => ({ ...prev, image: null }))
                  }
                  onReplace={() => {
                    setFormData((prev) => ({ ...prev, image: null }));
                    setTimeout(() => pickFromCamera(), 100);
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <View className="mt-6">
            <TouchableOpacity
              disabled={!canSubmit}
              onPress={uploadPermit}
              className={`w-full py-3 rounded-xl items-center justify-center ${
                canSubmit
                  ? "bg-blue-600 dark:bg-blue-700 active:bg-blue-700"
                  : "bg-gray-400 dark:bg-gray-600"
              }`}
              activeOpacity={0.7}
            >
              {uiState.uploading ? (
                <>
                  <View className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin mb-2" />
                  <Text variant="p" className="font-semibold text-white">
                    Mengirim...
                  </Text>
                </>
              ) : hasSubmittedToday ? (
                <Text variant="p" className="font-semibold text-white">
                  Sudah Diajukan Hari Ini
                </Text>
              ) : uiState.checking ? (
                <>
                  <View className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin mb-2" />
                  <Text variant="p" className="font-semibold text-white">
                    Memeriksa...
                  </Text>
                </>
              ) : (
                <Text variant="p" className="font-semibold text-white">
                  Kirim Pengajuan Izin
                </Text>
              )}
            </TouchableOpacity>

            {/* Validation Messages */}
            {!isFormValid && !hasSubmittedToday && (
              <View className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                <Text className="text-xs text-yellow-700 dark:text-yellow-300">
                  {!validation.category && "• Pilih kategori izin"}
                  {validation.category &&
                    !validation.description &&
                    "• Deskripsi belum memenuhi syarat"}
                  {validation.category &&
                    validation.description &&
                    !validation.image &&
                    "• Foto bukti belum dilampirkan"}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
