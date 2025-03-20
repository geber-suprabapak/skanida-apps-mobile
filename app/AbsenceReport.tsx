import React, { useState, useEffect } from "react";
import { YStack, XStack, Text, Button, Input } from "tamagui";
import { Alert } from "react-native";
import { supabase } from "~/utils/supabase";
import { useRouter } from "expo-router";

const AbsenceReport = () => {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [className, setClassName] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState("Tidak Hadir");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.error("User auth error:", userError?.message);
          Alert.alert("Error", "Failed to retrieve user. Please log in again.");
          router.push("/Login");
          return;
        }

        const currentUserId = userData.user.id;
        setUserId(currentUserId);

        // Pastikan user_id benar-benar ada di profiles
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", currentUserId)
          .maybeSingle();

        if (profileError) {
          console.error("Profile fetch error:", profileError.message);
        }

        if (!profileData) {
          Alert.alert("Error", "Profile not found. Please complete your profile.");
          router.push("/ProfileSetup" as any);
        }
      } catch (exception) {
        console.error("Unexpected error:", exception);
        Alert.alert("Error", "An unexpected error occurred.");
      }
    };

    fetchUserData();
  }, []);

  const handleSubmit = async () => {
    if (!date || !reason || !className || !userId) {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }

    setLoading(true);

    if (new Date(date) < new Date("2025-01-01")) {
      Alert.alert("Error", "Absence date must be after 2025-01-01.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("absences")
        .insert([
          {
            user_id: userId, // Pastikan ID valid
            date,
            reason,
            attendance_status: attendanceStatus,
            class_name: className,
          },
        ]);

      if (error) {
        console.error("Insert error:", error.message);
        Alert.alert("Error", `Failed to report attendance: ${error.message}`);
      } else {
        Alert.alert("Success", "Attendance reported successfully.");
        router.push("/Home");
      }
    } catch (exception) {
      console.error("Unexpected error:", exception);
      Alert.alert("Error", "An unexpected error occurred while submitting attendance.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack flex={1} jc="center" ai="center" space="$4" padding="$4">
      <Text fontSize="$6" fontWeight="bold">Report Attendance</Text>

      <Input placeholder="Date (YYYY-MM-DD)" value={date} editable={false} width="100%" />
      <Input placeholder="Reason" value={reason} onChangeText={setReason} width="100%" />
      <Input placeholder="Class Name" value={className} onChangeText={setClassName} width="100%" />

      <Text>Status:</Text>
      <XStack space="$2">
        <Button
          backgroundColor={attendanceStatus === "Hadir" ? "green" : "gray"}
          onPress={() => setAttendanceStatus("Hadir")}
        >
          Hadir
        </Button>
        <Button
          backgroundColor={attendanceStatus === "Tidak Hadir" ? "red" : "gray"}
          onPress={() => setAttendanceStatus("Tidak Hadir")}
        >
          Tidak Hadir
        </Button>
      </XStack>

      <Button onPress={handleSubmit} backgroundColor="$blue10" width="100%" disabled={loading}>
        {loading ? "Submitting..." : "Submit Attendance"}
      </Button>
    </YStack>
  );
};

export default AbsenceReport;
