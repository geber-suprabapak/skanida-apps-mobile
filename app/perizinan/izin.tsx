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
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";
import { Icon } from "~/components/ui/icon";
import { cn } from "~/lib/utils";
import {
  ChevronLeft,
  FileText,
  Camera,
  AlertCircle,
  Trash2,
  Send,
  HeartPulse,
  Briefcase,
  CloudUpload,
  CheckCircle2,
} from "lucide-react-native";

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
  sakit: "Kesehatan",
  pergi: "Urusan Pribadi",
};
const generateFileName = (
  userId: string,
  extension: string = IMAGE_FORMAT,
): string => `${userId}/${Date.now()}.${extension}`;

const getImageContentType = (uri: string): string => {
  const ext = uri.split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : "image/jpeg";
};

const CategoryCard: React.FC<{
  value: PermitCategory;
  isSelected: boolean;
  onPress: () => void;
  disabled: boolean;
}> = ({ value, isSelected, onPress, disabled }) => {
  const isSakit = value === "sakit";
  const activeColor = isSakit ? "text-red-500" : "text-blue-500";
  const iconBg = isSakit
    ? "bg-red-100 dark:bg-red-900/40"
    : "bg-blue-100 dark:bg-blue-900/40";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "flex-1 p-4 rounded-3xl bg-card border-2 relative",
        isSelected
          ? isSakit
            ? "border-red-100"
            : "border-blue-100"
          : "border-transparent",
        "shadow-sm",
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

const UploadArea: React.FC<{
  onPress: () => void;
  disabled: boolean;
}> = ({ onPress, disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.8}
    className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl p-8 items-center justify-center bg-gray-50/50 dark:bg-gray-900/20"
  >
    <View className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mb-4">
      <Icon as={CloudUpload} className="size-8 text-gray-400" />
    </View>
    <Text className="font-bold text-foreground text-base mb-1">
      Ambil atau Pilih Foto
    </Text>
    <Text className="text-xs text-muted-foreground">
      Format: JPG, PNG • Max 10MB
    </Text>
  </TouchableOpacity>
);

const ImagePreview: React.FC<{
  imageData: ImageData;
  onRemove: () => void;
}> = ({ imageData, onRemove }) => (
  <View className="relative w-full h-56 rounded-3xl overflow-hidden bg-gray-100">
    <Image
      source={{ uri: imageData.uri }}
      className="w-full h-full"
      resizeMode="cover"
    />
    <View className="absolute top-0 left-0 right-0 p-4 flex-row justify-end items-start bg-black/20">
      <TouchableOpacity
        onPress={onRemove}
        className="w-8 h-8 rounded-full bg-red-500 items-center justify-center shadow-sm"
      >
        <Icon as={Trash2} className="size-4 text-white" />
      </TouchableOpacity>
    </View>
  </View>
);

const AlertBanner: React.FC<{
  type: "warning" | "error" | "success" | "info";
  title: string;
  message: string;
}> = ({ type, title, message }) => {
  const colors = {
    warning: "bg-orange-50 border-orange-200",
    error: "bg-red-50 border-red-200",
    success: "bg-green-50 border-green-200",
    info: "bg-blue-50 border-blue-200",
  };

  const iconColors = {
    warning: "text-orange-500",
    error: "text-red-500",
    success: "text-green-500",
    info: "text-blue-500",
  };

  const textColors = {
    warning: "text-orange-700",
    error: "text-red-700",
    success: "text-green-700",
    info: "text-blue-700",
  };

  return (
    <View
      className={cn("p-4 rounded-2xl border mb-4 flex-row gap-3", colors[type])}
    >
      <Icon
        as={AlertCircle}
        className={cn("size-5 mt-0.5", iconColors[type])}
      />
      <View className="flex-1">
        <Text className={cn("font-bold text-sm mb-0.5", textColors[type])}>
          {title}
        </Text>
        <Text className={cn("text-xs opacity-90", textColors[type])}>
          {message}
        </Text>
      </View>
    </View>
  );
};

export default function PerizinanScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const theme = useThemeStore((state) => state.theme);

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
  const [blockingReason, setBlockingReason] = useState<string | undefined>(
    undefined,
  );

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
    async (
      userId: string,
    ): Promise<{ canSubmit: boolean; reason?: string }> => {
      try {
        const now = new Date();
        const localDate = format(now, "yyyy-MM-dd");
        const startOfDay = new Date(`${localDate}T00:00:00`);
        const endOfDay = new Date(`${localDate}T23:59:59.999`);
        const startOfDayUTC = startOfDay.toISOString();
        const endOfDayUTC = endOfDay.toISOString();

        const { data, error } = await supabase
          .from("perizinan")
          .select("id, tanggal, kategori_izin, approval_status")
          .eq("user_id", userId)
          .gte("tanggal", startOfDayUTC)
          .lte("tanggal", endOfDayUTC);

        if (error) {
          return { canSubmit: false, reason: "Gagal memverifikasi status" };
        }

        if (!data || data.length === 0) {
          return { canSubmit: true };
        }

        // Check if there's any pending or approved perizinan
        const hasPending = data.some((p) => p.approval_status === "pending");
        const hasApproved = data.some((p) => p.approval_status === "approved");

        if (hasPending) {
          return {
            canSubmit: false,
            reason:
              "Anda masih memiliki perizinan yang menunggu persetujuan. Harap tunggu hingga diproses.",
          };
        }

        if (hasApproved) {
          return {
            canSubmit: false,
            reason:
              "Anda sudah memiliki perizinan yang disetujui hari ini. Tidak dapat mengajukan lagi.",
          };
        }

        // All are rejected, check count limit (max 3)
        if (data.length >= 3) {
          return {
            canSubmit: false,
            reason: "Batas maksimal 3 pengajuan per hari telah tercapai.",
          };
        }

        return { canSubmit: true };
      } catch {
        return { canSubmit: false, reason: "Gagal memverifikasi status" };
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
        const result = await checkTodayIzin(user.id);
        setHasSubmittedToday(!result.canSubmit);
        setBlockingReason(result.reason);
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
          const result = await checkTodayIzin(user.id);
          setHasSubmittedToday(!result.canSubmit);
          setBlockingReason(result.reason);
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
        if (__DEV__) console.error("Error getting file info:", error);
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
      Alert.alert("Upload Foto", "Pilih sumber foto", options as any, {
        cancelable: true,
      });
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
      if (!finalCheck.canSubmit) {
        throw new Error(
          finalCheck.reason || "Tidak dapat mengajukan perizinan saat ini.",
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

    const result = await checkTodayIzin(user.id);
    if (!result.canSubmit) {
      Alert.alert(
        "Tidak Dapat Mengajukan",
        result.reason || "Tidak dapat mengajukan perizinan saat ini.",
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

      const lower = errorMessage.toLowerCase();
      if (
        lower.includes("network") ||
        lower.includes("connection") ||
        lower.includes("timeout") ||
        lower.includes("internet")
      ) {
        Alert.alert(
          "Koneksi Bermasalah",
          "Gagal mengirim izin karena masalah koneksi. Mohon periksa koneksi Anda dan coba lagi.",
        );
      } else {
        Alert.alert("Gagal Mengirim", errorMessage);
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
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={theme === "dark" ? "light" : "dark"} />

      {/* Simple Header */}
      <View className="px-6 py-4 flex-row items-center justify-between bg-white dark:bg-background border-b border-gray-100 dark:border-gray-800">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center border border-gray-100 dark:border-gray-700"
        >
          <Icon
            as={ChevronLeft}
            className="size-6 text-gray-900 dark:text-gray-100"
          />
        </TouchableOpacity>

        <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Pengajuan Izin
        </Text>

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
            title="Tidak Dapat Mengajukan"
            message={
              blockingReason ||
              "Anda tidak dapat mengajukan perizinan saat ini."
            }
          />
        )}

        {/* Category Selection */}
        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-4">
            <Icon as={Briefcase} className="size-5 text-blue-600" />
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
        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-4">
            <Icon as={FileText} className="size-5 text-blue-600" />
            <Text className="font-bold text-lg text-foreground">
              Detail Keterangan
            </Text>
          </View>

          <View className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-4 border border-gray-200 dark:border-gray-800">
            <TextInput
              ref={descriptionInputRef}
              editable={!isDisabled}
              className="min-h-[120px] text-base text-foreground leading-6"
              placeholder="Tuliskan alasan pengajuan izin"
              placeholderTextColor="#9ca3af"
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

            <View className="flex-row justify-between items-center mt-4">
              <View className="flex-row items-center gap-1.5">
                <Icon as={AlertCircle} className="size-3.5 text-gray-400" />
                <Text className="text-xs text-gray-400 font-medium">
                  MIN. 10 KARAKTER
                </Text>
              </View>
              <View className="px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-800">
                <Text className="text-xs font-bold text-gray-500">
                  {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Attachment */}
        <View className="mb-10">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <Icon as={Camera} className="size-5 text-blue-600" />
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
          activeOpacity={0.9}
          className={cn(
            "w-full py-4 rounded-2xl flex-row items-center justify-center shadow-lg shadow-blue-500/30",
            canSubmit
              ? "bg-blue-600"
              : "bg-gray-200 dark:bg-gray-800 shadow-none",
          )}
        >
          {uiState.uploading ? (
            <>
              <View className="w-5 h-5 border-2 border-t-transparent border-white rounded-full mr-3 animate-spin" />
              <Text className="text-white font-bold text-lg">Mengirim...</Text>
            </>
          ) : (
            <>
              <Icon
                as={Send}
                className={cn(
                  "size-5 mr-2",
                  canSubmit ? "text-white" : "text-gray-400",
                )}
              />
              <Text
                className={cn(
                  "font-bold text-lg",
                  canSubmit ? "text-white" : "text-gray-400",
                )}
              >
                Kirim Pengajuan
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
