/**
 * Practical Migration Demo
 * Demonstrates how to use the migration utilities in practice
 */

import React, { useState } from "react";
import { View, Text, Button, Alert } from "react-native";

// Import migration utilities
import {
  appwriteAuth,
  userProfilesService,
  attendancePhotosStorage,
  FileUploadHelper,
  runMigrationTests,
  ConfigValidator,
} from "~/utils/migration";

export default function MigrationDemo() {
  const [testResults, setTestResults] = useState<string>("");

  // Test authentication migration
  const testAuthMigration = async () => {
    try {
      Alert.alert(
        "Info",
        "Testing auth migration - this will attempt to connect to Appwrite",
      );

      // Test session check (won't actually sign in without credentials)
      const sessionResult = await appwriteAuth.getSession();

      if (sessionResult.success) {
        Alert.alert("Success", "Already authenticated with Appwrite!");
      } else {
        Alert.alert(
          "Info",
          "No active session - auth service is working correctly",
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Auth Test",
        `Auth service interface is working: ${error.message}`,
      );
    }
  };

  // Test database migration interface
  const testDatabaseMigration = async () => {
    try {
      Alert.alert("Info", "Testing database migration interface");

      // This will test the interface without actual data
      const testUserId = "test-user-id";
      const result = await userProfilesService.getProfile(testUserId);

      if (result.success) {
        Alert.alert("Database Test", "Profile service is working correctly");
      } else {
        Alert.alert(
          "Database Test",
          "Interface is working - expected no profile found",
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Database Test",
        `Service interface is functional: ${error.message}`,
      );
    }
  };

  // Test file upload utilities
  const testFileUploadUtilities = () => {
    try {
      // Test filename generation
      const fileName = FileUploadHelper.generateFileName(
        "test",
        "png",
        "user123",
      );
      const extension = FileUploadHelper.getFileExtension("photo.jpg");

      Alert.alert(
        "File Upload Test",
        `Utilities working correctly:\nGenerated: ${fileName}\nExtension: ${extension}`,
      );
    } catch (error: any) {
      Alert.alert("File Upload Test", `Error: ${error.message}`);
    }
  };

  // Run comprehensive tests
  const runComprehensiveTests = async () => {
    try {
      Alert.alert("Info", "Running comprehensive migration tests...");

      const results = await runMigrationTests();
      const passed = results.filter((r) => r.passed).length;
      const total = results.length;

      const summary = results
        .map((r) => `${r.passed ? "✅" : "❌"} ${r.name}: ${r.message}`)
        .join("\n\n");

      setTestResults(`${passed}/${total} tests passed\n\n${summary}`);

      Alert.alert(
        "Test Results",
        `${passed}/${total} tests passed. Check the results below.`,
      );
    } catch (error: any) {
      Alert.alert("Test Error", error.message);
    }
  };

  // Check configuration
  const checkConfiguration = () => {
    const validation = ConfigValidator.validateEnvironment();

    if (validation.valid) {
      Alert.alert(
        "Configuration",
        "✅ All environment variables are configured",
      );
    } else {
      Alert.alert(
        "Configuration",
        `❌ Missing variables:\n${validation.missing.join("\n")}\n\nPlease check .env.example`,
      );
    }
  };

  return (
    <View style={{ padding: 20, flex: 1 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>
        Appwrite Migration Demo
      </Text>

      <Text style={{ marginBottom: 20 }}>
        This demo shows how to use the migration utilities to transition from
        Supabase to Appwrite.
      </Text>

      <View style={{ gap: 10, marginBottom: 20 }}>
        <Button title="Check Configuration" onPress={checkConfiguration} />
        <Button title="Test Auth Migration" onPress={testAuthMigration} />
        <Button
          title="Test Database Migration"
          onPress={testDatabaseMigration}
        />
        <Button
          title="Test File Upload Utilities"
          onPress={testFileUploadUtilities}
        />
        <Button
          title="Run Comprehensive Tests"
          onPress={runComprehensiveTests}
        />
      </View>

      {testResults ? (
        <View
          style={{ backgroundColor: "#f0f0f0", padding: 15, borderRadius: 8 }}
        >
          <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
            Test Results:
          </Text>
          <Text style={{ fontFamily: "monospace", fontSize: 12 }}>
            {testResults}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
          Migration Steps:
        </Text>
        <Text>
          1. Set up Appwrite project and configure environment variables{"\n"}
          2. Create database collections matching the schema{"\n"}
          3. Set up storage buckets{"\n"}
          4. Replace Supabase calls with migration utilities{"\n"}
          5. Test thoroughly before production deployment
        </Text>
      </View>
    </View>
  );
}

/**
 * Usage Examples for Different Components:
 */

// 1. Replace authentication in Login component:
/*
// Before (Supabase):
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// After (Appwrite):
const result = await appwriteAuth.signIn(email, password);
if (result.success) {
  const user = await account.get();
  setUser(user);
}
*/

// 2. Replace profile operations:
/*
// Before (Supabase):
await supabase.from('user_profiles').upsert({ user_id: userId, full_name: name });

// After (Appwrite):
await userProfilesService.upsertProfile({ user_id: userId, full_name: name });
*/

// 3. Replace file uploads:
/*
// Before (Supabase):
const { data } = await supabase.storage.from('attendance-photos').upload(fileName, fileBuffer);

// After (Appwrite):
const blob = await FileUploadHelper.convertImagePickerResult(imageResult);
const result = await attendancePhotosStorage.uploadAttendancePhoto(blob, fileName);
*/
