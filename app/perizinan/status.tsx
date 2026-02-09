import { Stack, useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState, useMemo } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  BackHandler,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";
import { Icon } from "~/components/ui/icon";
import {
  ChevronLeft,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  FileText,
  Stethoscope,
} from "lucide-react-native";
import { cn } from "~/lib/utils";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface PerizinanRecord {
  id: string;
  kategori_izin: "sakit" | "pergi" | "izin" | "cuti";
  deskripsi: string;
  approval_status: "pending" | "approved" | "rejected" | null;
  tanggal: string;
  created_at: string;
  rejection_reason?: string | null;
  rejected_at?: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  sakit: { label: "Sakit", icon: Stethoscope, color: "text-red-500" },
  izin: { label: "Izin", icon: FileText, color: "text-blue-500" },
  cuti: { label: "Cuti", icon: Calendar, color: "text-purple-500" },
  default: { label: "Izin", icon: FileText, color: "text-gray-500" },
};

const STATUS_CONFIG = {
  pending: {
    label: "Menunggu",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-200 dark:border-yellow-800",
    icon: Clock,
  },
  approved: {
    label: "Disetujui",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
    icon: CheckCircle,
  },
  rejected: {
    label: "Ditolak",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    icon: XCircle,
  },
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: string | null }) {
  const config =
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ||
    STATUS_CONFIG.pending;

  return (
    <View
      className={cn(
        "flex-row items-center px-2 py-1 rounded-full border",
        config.bg,
        config.border,
      )}
    >
      <Icon as={config.icon} className={cn("size-3 mr-1", config.text)} />
      <Text className={cn("text-[10px] font-semibold uppercase", config.text)}>
        {config.label}
      </Text>
    </View>
  );
}

function PermissionCard({ item }: { item: PerizinanRecord }) {
  const category =
    CATEGORY_CONFIG[item.kategori_izin] || CATEGORY_CONFIG.default;
  const date = parseISO(item.tanggal);
  const formattedDate = format(date, "d MMM yyyy", { locale: idLocale });
  const createdDateTime = format(
    parseISO(item.created_at),
    "d MMM yyyy, HH:mm",
    {
      locale: idLocale,
    },
  );

  const duration = "1 Hari";
  const isRejected = item.approval_status === "rejected";

  return (
    <View className="bg-card border border-border rounded-xl p-4 mb-4 shadow-sm">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-row items-center">
          <View className={cn("p-2 rounded-lg bg-secondary mr-3")}>
            <Icon as={category.icon} className={cn("size-5", category.color)} />
          </View>
          <View>
            <Text className="font-bold text-foreground text-base">
              {category.label}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {formattedDate}
            </Text>
          </View>
        </View>
        <StatusBadge status={item.approval_status} />
      </View>

      <Text className="text-foreground mb-4 font-medium" numberOfLines={2}>
        &ldquo;{item.deskripsi}&rdquo;
      </Text>

      <View className="flex-row justify-between items-center pt-3 border-t border-border">
        <Text className="text-xs text-muted-foreground">
          Diajukan: {createdDateTime}
        </Text>
        <Text className="text-xs font-medium text-foreground">{duration}</Text>
      </View>

      {/* Alasan penolakan */}
      {isRejected && item.rejection_reason && (
        <View className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <Text className="text-xs font-bold text-red-700 dark:text-red-400 mb-1">
            Alasan Ditolak:
          </Text>
          <Text className="text-sm text-red-600 dark:text-red-300">
            {item.rejection_reason}
          </Text>
          {item.rejected_at && (
            <Text className="text-xs text-red-500 dark:text-red-400 mt-2">
              {format(parseISO(item.rejected_at), "d MMM yyyy, HH:mm", {
                locale: idLocale,
              })}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function TopStatusCard({
  item,
  userName,
}: {
  item: PerizinanRecord;
  userName: string;
}) {
  if (!item) return null;

  const category =
    CATEGORY_CONFIG[item.kategori_izin] || CATEGORY_CONFIG.default;
  const date = parseISO(item.tanggal);
  const formattedDate = format(date, "d MMM yyyy", { locale: idLocale });

  const status = item.approval_status || "pending";

  return (
    <View className="bg-[#0F172A] rounded-2xl p-5 mb-6 shadow-lg">
      <View className="flex-row justify-between items-start mb-6">
        <View>
          <Text className="text-white font-bold text-lg uppercase mb-1">
            {category.label} - {userName}
          </Text>
        </View>
      </View>

      <View className="space-y-4">
        <View className="flex-row items-center">
          <Text className="text-gray-400 text-xs font-bold w-20">STATUS</Text>
          <View
            className={cn(
              "px-3 py-1 rounded-full",
              status === "approved"
                ? "bg-green-500"
                : status === "rejected"
                  ? "bg-red-500"
                  : "bg-yellow-500",
            )}
          >
            <Text className="text-white text-xs font-bold uppercase">
              {status === "approved"
                ? "Disetujui"
                : status === "rejected"
                  ? "Ditolak"
                  : "Menunggu"}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <Text className="text-gray-400 text-xs font-bold w-20">WAKTU</Text>
          <Text className="text-white font-semibold text-sm">
            {formattedDate}
          </Text>
        </View>

        <View className="flex-row items-start">
          <Text className="text-gray-400 text-xs font-bold w-20 mt-0.5">
            ALASAN
          </Text>
          <Text
            className="text-white font-semibold text-sm flex-1"
            numberOfLines={2}
          >
            {item.deskripsi}
          </Text>
        </View>

        {item.approval_status === "rejected" && item.rejection_reason && (
          <View className="flex-row items-start">
            <Text className="text-gray-400 text-xs font-bold w-20 mt-0.5">
              DITOLAK
            </Text>
            <Text
              className="text-red-300 font-semibold text-sm flex-1"
              numberOfLines={3}
            >
              {item.rejection_reason}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StatusPerizinanScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuthStore();

  // ---- State ----
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<PerizinanRecord[]>([]);

  // ---- Fetching ----
  const fetchRecords = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("perizinan")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Error fetching records:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // ---- Effects ----
  useFocusEffect(
    useCallback(() => {
      fetchRecords();
    }, [fetchRecords]),
  );

  // Hardware back button
  useFocusEffect(
    useCallback(() => {
      const backAction = () => {
        router.back();
        return true;
      };
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        backAction,
      );
      return () => backHandler.remove();
    }, [router]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRecords();
  };

  // Get today's date string for filtering
  const todayStr = useMemo(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  }, []);

  // Filter records for today only
  const todayRecords = useMemo(() => {
    return records.filter((r) => r.tanggal.startsWith(todayStr));
  }, [records, todayStr]);

  // Latest record for TODAY (for TopStatusCard)
  const todayLatestRecord = todayRecords[0] || null;

  // Count today's submissions
  const todayCount = todayRecords.length;

  const MAX_DAILY_SUBMISSIONS = 3;
  const canSubmitMore = todayCount < MAX_DAILY_SUBMISSIONS;

  // ---- Render ----
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-background">
        {/* Header - Consistent with other pages */}
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
            Status Perizinan
          </Text>

          {/* Today's Count Badge */}
          <View
            className={cn(
              "px-3 py-1.5 rounded-full min-w-[40px] items-center",
              canSubmitMore
                ? "bg-blue-100 dark:bg-blue-900/30"
                : "bg-red-100 dark:bg-red-900/30",
            )}
          >
            <Text
              className={cn(
                "text-xs font-bold",
                canSubmitMore
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {todayCount}/{MAX_DAILY_SUBMISSIONS}
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Top Card (Today's Latest Status) */}
          {todayLatestRecord && (
            <TopStatusCard
              item={todayLatestRecord}
              userName={userProfile?.full_name || "Siswa"}
            />
          )}

          {/* List */}
          {loading && !refreshing ? (
            <View className="items-center py-10">
              <Text className="text-muted-foreground">Memuat data...</Text>
            </View>
          ) : records.length > 0 ? (
            records.map((item) => <PermissionCard key={item.id} item={item} />)
          ) : (
            <View className="items-center py-10">
              <Text className="text-muted-foreground">
                Tidak ada data perizinan.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* FAB */}
        <View className="absolute bottom-6 left-5 right-5">
          <TouchableOpacity
            onPress={() => router.push("/perizinan/izin")}
            disabled={!canSubmitMore}
            className={cn(
              "flex-row items-center justify-center py-4 rounded-xl shadow-lg",
              canSubmitMore ? "bg-[#0F172A]" : "bg-gray-400",
            )}
            activeOpacity={0.8}
          >
            <Icon as={Plus} className="text-white mr-2 size-5" />
            <Text className="text-white font-bold text-base">
              {canSubmitMore
                ? "Ajukan Izin Baru"
                : `Batas Harian Tercapai (${MAX_DAILY_SUBMISSIONS})`}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}
