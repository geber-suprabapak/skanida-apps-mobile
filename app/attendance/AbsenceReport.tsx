import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native';

import { supabase } from '~/utils/supabase';

const AbsenceReport = () => {
  const [date] = useState(new Date().toISOString());
  const [reason, setReason] = useState('');
  const [className, setClassName] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState('Tidak Hadir');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.error('User auth error:', userError?.message);
          Alert.alert('Error', 'Failed to retrieve user. Please log in again.');
          router.push('../Login');
          return;
        }

        const currentUserId = userData.user.id;
        setUserId(currentUserId);

        // Pastikan user_id benar-benar ada di profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', currentUserId)
          .maybeSingle();

        if (profileError) {
          console.error('Profile fetch error:', profileError.message);
        }

        if (!profileData) {
          Alert.alert('Error', 'Profile not found. Please complete your profile.');
          router.push('/ProfileSetup' as any);
        }
      } catch (exception) {
        console.error('Unexpected error:', exception);
        Alert.alert('Error', 'An unexpected error occurred.');
      }
    };

    fetchUserData();
  }, []);

  const handleSubmit = async () => {
    if (!reason || !className || !userId || !date) {
      Alert.alert('Error', 'Please fill all fields.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('absences').insert([
        {
          user_id: userId, // Pastikan ID valid
          date,
          reason,
          attendance_status: attendanceStatus,
          class_name: className,
        },
      ]);

      if (error) {
        console.error('Insert error:', error.message);
        Alert.alert('Error', `Failed to report attendance: ${error.message}`);
      } else {
        Alert.alert('Success', 'Attendance reported successfully.');
        router.push('/Home');
      }
    } catch (exception) {
      console.error('Unexpected error:', exception);
      Alert.alert('Error', 'An unexpected error occurred while submitting attendance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center space-y-4 p-4">
      <Text className="text-2xl font-bold">Report Attendance</Text>

      <TextInput
        placeholder="Reason"
        value={reason}
        onChangeText={setReason}
        className="w-full rounded-md border border-gray-300 p-3"
      />
      <TextInput
        placeholder="Class Name"
        value={className}
        onChangeText={setClassName}
        className="w-full rounded-md border border-gray-300 p-3"
      />

      <Text className="text-base">Status:</Text>
      <View className="flex-row space-x-2">
        <TouchableOpacity
          className={`rounded-md px-4 py-2 ${
            attendanceStatus === 'Hadir' ? 'bg-green-500' : 'bg-gray-400'
          }`}
          onPress={() => setAttendanceStatus('Hadir')}>
          <Text className="text-center text-white">Hadir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`rounded-md px-4 py-2 ${
            attendanceStatus === 'Tidak Hadir' ? 'bg-red-500' : 'bg-gray-400'
          }`}
          onPress={() => setAttendanceStatus('Tidak Hadir')}>
          <Text className="text-center text-white">Tidak Hadir</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading}
        className={`w-full rounded-md p-3 ${loading ? 'bg-blue-300' : 'bg-blue-500'}`}>
        <Text className="text-center text-white">
          {loading ? 'Submitting...' : 'Submit Attendance'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default AbsenceReport;
