/**
 * Migration Test Utilities
 * Simple validation tests for the Appwrite migration P2oC
 */

import { appwriteAuth } from "./authMigration";
import { userProfilesService } from "./databaseMigration";
import { FileUploadHelper } from "./storageMigration";

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

export class MigrationTester {
  private results: TestResult[] = [];

  /**
   * Run all migration tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log("🚀 Starting Appwrite Migration P2oC Tests...\n");

    await this.testFileUploadHelper();
    await this.testAuthServiceInterface();
    await this.testDatabaseServiceInterface();

    this.printResults();
    return this.results;
  }

  /**
   * Test file upload helper utilities
   */
  private async testFileUploadHelper(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test filename generation
      const fileName = FileUploadHelper.generateFileName(
        "test",
        "png",
        "user123",
      );
      const hasCorrectFormat =
        fileName.includes("test_") &&
        fileName.includes("user123") &&
        fileName.endsWith(".png");

      if (!hasCorrectFormat) {
        throw new Error("Filename format is incorrect");
      }

      // Test file extension extraction
      const extension = FileUploadHelper.getFileExtension("photo.jpg");
      if (extension !== "jpg") {
        throw new Error("File extension extraction failed");
      }

      this.addResult(
        "File Upload Helper",
        true,
        "All utility functions work correctly",
        Date.now() - startTime,
      );
    } catch (error: any) {
      this.addResult(
        "File Upload Helper",
        false,
        error.message,
        Date.now() - startTime,
      );
    }
  }

  /**
   * Test authentication service interface
   */
  private async testAuthServiceInterface(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test that auth service methods exist and return proper structure
      const authService = appwriteAuth;

      // Check if methods exist
      const methods = [
        "signIn",
        "signUp",
        "signOut",
        "getSession",
        "updatePassword",
        "updateEmail",
      ];
      for (const method of methods) {
        if (typeof (authService as any)[method] !== "function") {
          throw new Error(`Method ${method} is not available on auth service`);
        }
      }

      this.addResult(
        "Auth Service Interface",
        true,
        "All authentication methods are available",
        Date.now() - startTime,
      );
    } catch (error: any) {
      this.addResult(
        "Auth Service Interface",
        false,
        error.message,
        Date.now() - startTime,
      );
    }
  }

  /**
   * Test database service interface
   */
  private async testDatabaseServiceInterface(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test that database service methods exist
      const profileService = userProfilesService;

      // Check if methods exist
      const methods = ["upsertProfile", "getProfile"];
      for (const method of methods) {
        if (typeof (profileService as any)[method] !== "function") {
          throw new Error(
            `Method ${method} is not available on profile service`,
          );
        }
      }

      this.addResult(
        "Database Service Interface",
        true,
        "All database methods are available",
        Date.now() - startTime,
      );
    } catch (error: any) {
      this.addResult(
        "Database Service Interface",
        false,
        error.message,
        Date.now() - startTime,
      );
    }
  }

  /**
   * Add test result
   */
  private addResult(
    name: string,
    passed: boolean,
    message: string,
    duration: number,
  ): void {
    this.results.push({ name, passed, message, duration });
  }

  /**
   * Print test results
   */
  private printResults(): void {
    console.log("\n📊 Test Results:\n");

    let passed = 0;
    let failed = 0;

    this.results.forEach((result) => {
      const icon = result.passed ? "✅" : "❌";
      const status = result.passed ? "PASS" : "FAIL";
      console.log(`${icon} ${result.name}: ${status} (${result.duration}ms)`);
      console.log(`   ${result.message}\n`);

      if (result.passed) passed++;
      else failed++;
    });

    console.log(
      `📈 Summary: ${passed} passed, ${failed} failed, ${this.results.length} total\n`,
    );

    if (failed === 0) {
      console.log(
        "🎉 All tests passed! The migration utilities are ready for use.",
      );
    } else {
      console.log("⚠️  Some tests failed. Please check the implementation.");
    }
  }
}

/**
 * Configuration validation
 */
export class ConfigValidator {
  /**
   * Validate that all required environment variables are set
   */
  static validateEnvironment(): { valid: boolean; missing: string[] } {
    const requiredVars = [
      "EXPO_PUBLIC_APPWRITE_ENDPOINT",
      "EXPO_PUBLIC_APPWRITE_PROJECT_ID",
      "EXPO_PUBLIC_APPWRITE_DATABASE_ID",
      "EXPO_PUBLIC_APPWRITE_USER_PROFILES_COLLECTION_ID",
      "EXPO_PUBLIC_APPWRITE_ABSENCES_COLLECTION_ID",
      "EXPO_PUBLIC_APPWRITE_PERIZINAN_COLLECTION_ID",
      "EXPO_PUBLIC_APPWRITE_ATTENDANCE_PHOTOS_STORAGE",
      "EXPO_PUBLIC_APPWRITE_PERIZINAN_STORAGE",
      "EXPO_PUBLIC_APPWRITE_AVATARS_STORAGE",
    ];

    const missing = requiredVars.filter((varName) => !process.env[varName]);

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Print configuration status
   */
  static printConfigStatus(): void {
    const validation = this.validateEnvironment();

    console.log("⚙️  Configuration Status:\n");

    if (validation.valid) {
      console.log("✅ All required environment variables are configured");
    } else {
      console.log("❌ Missing required environment variables:");
      validation.missing.forEach((varName) => {
        console.log(`   - ${varName}`);
      });
      console.log(
        "\n💡 Please check .env.example for the complete configuration template",
      );
    }
  }
}

/**
 * Migration comparison examples for testing
 */
export const migrationTestExamples = {
  authFlow: {
    description: "Authentication flow comparison",
    supabase: `
// Supabase Auth Test
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'password123',
});
console.log('Supabase result:', { user: data?.user, error });`,
    appwrite: `
// Appwrite Auth Test
const result = await appwriteAuth.signIn('test@example.com', 'password123');
console.log('Appwrite result:', result);
if (result.success) {
  const user = await account.get();
  console.log('User details:', user);
}`,
  },

  databaseQuery: {
    description: "Database query comparison",
    supabase: `
// Supabase Database Test
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('user_id', 'test-user-id')
  .single();
console.log('Supabase result:', { data, error });`,
    appwrite: `
// Appwrite Database Test
const result = await userProfilesService.getProfile('test-user-id');
console.log('Appwrite result:', result);`,
  },

  fileUpload: {
    description: "File upload comparison",
    supabase: `
// Supabase Storage Test
const { data, error } = await supabase.storage
  .from('attendance-photos')
  .upload('test-photo.png', fileBuffer);
console.log('Supabase result:', { data, error });`,
    appwrite: `
// Appwrite Storage Test
const result = await attendancePhotosStorage.uploadAttendancePhoto(blob, 'test-photo.png');
console.log('Appwrite result:', result);`,
  },
};

// Export test runner for easy use
export const runMigrationTests = async (): Promise<TestResult[]> => {
  const tester = new MigrationTester();
  return await tester.runAllTests();
};
