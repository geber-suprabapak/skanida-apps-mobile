import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '~/utils/supabase';
import * as FileSystem from 'expo-file-system';

const CameraAttendance = () => {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const router = useRouter();
  
  // Get location data passed from AbsenceReport screen
  const params = useLocalSearchParams();
  const locationData = {
    latitude: parseFloat(params.latitude as string) || 0,
    longitude: parseFloat(params.longitude as string) || 0,
    timestamp: params.timestamp as string || new Date().toISOString(),
    userId: params.userId as string || ''
  };

  useEffect(() => {
    if (!permission) {
      return;
    }
    if (!permission.granted) {
      console.log("Requesting camera permission...");
      requestPermission();
    }

    // Validate location data
    if (!locationData.userId || !locationData.latitude || !locationData.longitude) {
      Alert.alert(
        'Error',
        'Location data is missing. Please go back and try again.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [permission, requestPermission]);

  const saveAttendanceToSupabase = async (photoUri: string) => {
    try {
      console.log('Saving attendance data to Supabase...');
      
      // Get current date in YYYY-MM-DD format for the attendance record
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Create a reason for the attendance (could be customized based on your needs)
      const reason = "Present";

      // First upload the photo to Supabase Storage
      console.log('Uploading photo to storage...');
      
      // Create a unique file name using timestamp and userId
      const fileName = `${Date.now()}_${locationData.userId}.jpg`;
      
      // Read the file as base64 data
      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      if (!fileInfo.exists) {
        throw new Error('Photo file does not exist');
      }
      
      // Convert file to Blob for upload
      const fileData = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const blob = Buffer.from(fileData, 'base64');
      
      // Upload to Supabase storage
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('attendance-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
        });
      
      if (storageError) {
        console.error('Error uploading photo:', storageError);
        throw new Error('Failed to upload photo');
      }
      
      // Get the public URL of the uploaded photo
      const { data: urlData } = supabase
        .storage
        .from('attendance-photos')
        .getPublicUrl(fileName);
      
      const photoUrl = urlData?.publicUrl;
      console.log('Photo uploaded successfully. URL:', photoUrl);
      
      // Save attendance record with location, photo URL and other data
      const { data, error } = await supabase
        .from('absences')
        .insert([{ 
          user_id: locationData.userId,
          date: currentDate,
          reason: reason,
          created_at: new Date().toISOString(),
          photo_url: photoUrl,
          latitude: locationData.latitude,
          longitude: locationData.longitude
        }])
        .select();
        
      if (error) {
        console.error('Error saving attendance record:', error);
        throw new Error('Failed to save attendance record');
      }
      
      return data;
    } catch (error) {
      console.error('Error in saveAttendanceToSupabase:', error);
      throw error;
    }
  };

  const takePicture = async () => {
    if (cameraRef.current && !isTakingPicture) {
      setIsTakingPicture(true);
      try {
        const options = { quality: 0.7, base64: false, skipProcessing: true };
        const photo = await cameraRef.current.takePictureAsync(options);

        if (photo) {
          console.log('Photo URI:', photo.uri);
          
          // Save attendance data with both location and photo
          await saveAttendanceToSupabase(photo.uri);
          
          Alert.alert(
            'Success',
            'Attendance recorded successfully!',
            [{ 
              text: 'OK', 
              onPress: () => {
                console.log('Navigating to Home...');
                router.replace('/Home');
              }
            }]
          );
        } else {
          Alert.alert('Error', 'Failed to capture photo (no data returned).');
        }
      } catch (err) {
        console.error('Error taking picture or saving data:', err);
        Alert.alert('Error', 'Failed to capture photo or save attendance data.');
      } finally {
        setIsTakingPicture(false);
      }
    } else if (isTakingPicture) {
      console.log("Capture in progress...");
    } else {
      Alert.alert('Error', 'Camera reference not available.');
    }
  };

  // Toggle camera facing
  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  if (!permission) {
    return (
       <View style={styles.container}>
         <ActivityIndicator size="large" color="#0000ff" />
         <Text style={styles.messageText}>Loading permissions...</Text>
       </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
            <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      >
        {/* Location info overlay */}
        <View style={styles.locationOverlay}>
          <Text style={styles.locationText}>
            Location: {locationData.latitude.toFixed(4)}, {locationData.longitude.toFixed(4)}
          </Text>
        </View>
        
        <View style={styles.buttonContainer}>
           <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
              <Text style={styles.flipButtonText}>🔄</Text>
           </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureButton, isTakingPicture ? styles.captureButtonDisabled : {}]}
            onPress={takePicture}
            disabled={isTakingPicture}
          >
            {isTakingPicture ? <ActivityIndicator size="small" color="#ffffff" /> : <View style={styles.captureButtonInner} />}
          </TouchableOpacity>
          <View style={styles.flipButtonPlaceholder} />
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0'
  },
  camera: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  captureButtonDisabled: {
    backgroundColor: '#a0a0a0',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff0000',
  },
  flipButton: {
    padding: 10,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  flipButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  flipButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  permissionText: {
    textAlign: 'center',
    fontSize: 18,
    marginBottom: 20,
    color: '#333',
  },
  messageText: {
    marginTop: 10,
    color: '#555',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationOverlay: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
  },
  locationText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 12,
  }
});

export default CameraAttendance;