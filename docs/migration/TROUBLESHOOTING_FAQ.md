# Troubleshooting & FAQ - Supabase to Appwrite Migration

## Common Issues and Solutions

### Authentication Issues

#### Issue: "Session expired" errors after migration
**Symptoms**: Users getting logged out frequently, session persistence issues
**Cause**: Different session management between Supabase and Appwrite

**Solution**:
```typescript
// Implement robust session management
class SessionManager {
  private static SESSION_KEY = 'appwrite_session';
  
  static async saveSession(session: Models.Session) {
    try {
      await AsyncStorage.setItem(
        this.SESSION_KEY, 
        JSON.stringify({
          session,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }
  
  static async getValidSession(): Promise<Models.Session | null> {
    try {
      const stored = await AsyncStorage.getItem(this.SESSION_KEY);
      if (!stored) return null;
      
      const { session, timestamp } = JSON.parse(stored);
      const now = Date.now();
      const sessionAge = now - timestamp;
      
      // Check if session is still valid (7 days)
      if (sessionAge > 7 * 24 * 60 * 60 * 1000) {
        await this.clearSession();
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }
  
  static async clearSession() {
    await AsyncStorage.removeItem(this.SESSION_KEY);
  }
}
```

#### Issue: Password reset not working
**Symptoms**: Users not receiving password reset emails
**Cause**: Email configuration or URL redirect issues

**Solution**:
```typescript
// Proper password reset implementation
const resetPassword = async (email: string) => {
  try {
    await account.createRecovery(
      email,
      `${process.env.EXPO_PUBLIC_APP_URL}/reset-password`
    );
    
    Alert.alert(
      "Password Reset", 
      "Check your email for password reset instructions"
    );
  } catch (error: any) {
    if (error.code === 404) {
      Alert.alert("Error", "Email address not found");
    } else {
      Alert.alert("Error", "Failed to send reset email. Please try again.");
    }
  }
};
```

### Database Issues

#### Issue: Query performance degradation
**Symptoms**: Slow loading times, timeouts on data fetching
**Cause**: Missing indexes or inefficient queries

**Solution**:
```typescript
// Create proper indexes
const optimizeDatabase = async () => {
  // Index for user-specific queries
  await databases.createIndex(
    DATABASE_ID,
    'absences',
    'user_date_idx',
    'key',
    ['userId', 'date'],
    ['asc', 'desc']
  );
  
  // Index for date range queries
  await databases.createIndex(
    DATABASE_ID,
    'absences',
    'date_idx',
    'key',
    ['date'],
    ['desc']
  );
  
  // Compound index for complex queries
  await databases.createIndex(
    DATABASE_ID,
    'perizinan',
    'user_status_date_idx',
    'key',
    ['userId', 'approvalStatus', 'tanggal'],
    ['asc', 'asc', 'desc']
  );
};

// Optimize queries
const getRecentAbsencesOptimized = async (userId: string) => {
  // Use specific indexes and limit results
  return await databases.listDocuments(
    DATABASE_ID,
    'absences',
    [
      Query.equal('userId', userId),
      Query.orderDesc('date'),
      Query.limit(20) // Don't fetch more than needed
    ]
  );
};
```

#### Issue: Data type conversion errors
**Symptoms**: Validation errors, incorrect data formats
**Cause**: Different data types between SQL and NoSQL

**Solution**:
```typescript
// Create data transformation utilities
class DataTransformer {
  static toAppwriteDate(sqlDate: string | Date): string {
    return new Date(sqlDate).toISOString();
  }
  
  static fromAppwriteDate(isoString: string): Date {
    return new Date(isoString);
  }
  
  static toAppwriteBoolean(value: boolean): string {
    return value.toString();
  }
  
  static fromAppwriteBoolean(value: string): boolean {
    return value === 'true';
  }
  
  static validateAbsenceData(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.userId) errors.push('User ID is required');
    if (!data.date) errors.push('Date is required');
    if (!['Hadir', 'Datang', 'Pulang'].includes(data.status)) {
      errors.push('Invalid status value');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

### Storage Issues

#### Issue: File upload failures
**Symptoms**: Upload timeouts, file corruption, permission errors
**Cause**: File size limits, permission issues, network problems

**Solution**:
```typescript
// Robust file upload with retry mechanism
class FileUploadManager {
  private maxRetries = 3;
  private maxFileSize = 10 * 1024 * 1024; // 10MB
  
  async uploadWithRetry(
    bucketId: string, 
    file: Blob | File, 
    attempt = 1
  ): Promise<Models.File> {
    try {
      // Validate file size
      if (file.size > this.maxFileSize) {
        throw new Error(`File too large. Maximum size: ${this.maxFileSize / 1024 / 1024}MB`);
      }
      
      // Compress if it's an image
      const processedFile = await this.processFile(file);
      
      // Upload to Appwrite
      return await storage.createFile(
        bucketId,
        ID.unique(),
        processedFile
      );
      
    } catch (error: any) {
      console.error(`Upload attempt ${attempt} failed:`, error);
      
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        console.log(`Retrying upload (attempt ${attempt + 1}/${this.maxRetries})`);
        await this.delay(1000 * attempt); // Exponential backoff
        return this.uploadWithRetry(bucketId, file, attempt + 1);
      }
      
      throw error;
    }
  }
  
  private async processFile(file: Blob | File): Promise<Blob> {
    // If it's an image, compress it
    if (file.type.startsWith('image/')) {
      return await this.compressImage(file);
    }
    
    return file;
  }
  
  private async compressImage(file: Blob | File): Promise<Blob> {
    // Use expo-image-manipulator for compression
    // Implementation depends on your compression library
    return file; // Placeholder
  }
  
  private isRetryableError(error: any): boolean {
    // Network errors and temporary server errors are retryable
    return error.code >= 500 || error.message.includes('network');
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### Issue: Broken file URLs after migration
**Symptoms**: Images not loading, 404 errors on file access
**Cause**: URLs not updated properly during migration

**Solution**:
```typescript
// Smart URL resolver with fallback
class URLResolver {
  private urlCache = new Map<string, string>();
  
  async resolveFileUrl(originalUrl: string): Promise<string> {
    // Check cache first
    if (this.urlCache.has(originalUrl)) {
      return this.urlCache.get(originalUrl)!;
    }
    
    // If it's already an Appwrite URL, return as-is
    if (originalUrl.includes('appwrite.io') || originalUrl.includes('cloud.appwrite.io')) {
      this.urlCache.set(originalUrl, originalUrl);
      return originalUrl;
    }
    
    // Try to resolve Supabase URL to Appwrite
    const appwriteUrl = await this.tryResolveToAppwrite(originalUrl);
    if (appwriteUrl) {
      this.urlCache.set(originalUrl, appwriteUrl);
      return appwriteUrl;
    }
    
    // Return original URL as fallback
    console.warn('Could not resolve URL to Appwrite:', originalUrl);
    return originalUrl;
  }
  
  private async tryResolveToAppwrite(supabaseUrl: string): Promise<string | null> {
    try {
      // Parse Supabase URL to extract bucket and file info
      const urlPattern = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/;
      const match = supabaseUrl.match(urlPattern);
      
      if (!match) return null;
      
      const [, bucketName, filePath] = match;
      
      // Look up file ID in migration mapping
      const fileId = await this.getAppwriteFileId(bucketName, filePath);
      if (fileId) {
        return storage.getFileView(bucketName, fileId).href;
      }
    } catch (error) {
      console.error('Failed to resolve URL:', error);
    }
    
    return null;
  }
  
  private async getAppwriteFileId(bucket: string, path: string): Promise<string | null> {
    // This would look up the file ID from your migration mapping
    // Implementation depends on how you store the mapping
    return null; // Placeholder
  }
}
```

### Network Issues

#### Issue: API calls failing intermittently
**Symptoms**: Random failures, network timeouts, connection errors
**Cause**: Network instability, API rate limiting, server issues

**Solution**:
```typescript
// Network resilience wrapper
class NetworkManager {
  private retryDelays = [1000, 2000, 4000]; // Exponential backoff
  
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on authentication or validation errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        // Don't retry on final attempt
        if (attempt === this.retryDelays.length) {
          break;
        }
        
        const delay = this.retryDelays[attempt];
        console.warn(`${operationName} failed (attempt ${attempt + 1}), retrying in ${delay}ms`);
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }
  
  private isNonRetryableError(error: any): boolean {
    // Don't retry on authentication, validation, or permission errors
    return error.code === 401 || error.code === 403 || error.code === 422;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage example
const networkManager = new NetworkManager();

const safeApiCall = async () => {
  return networkManager.executeWithRetry(
    () => databases.listDocuments(DATABASE_ID, 'absences'),
    'Fetch absences'
  );
};
```

### Performance Issues

#### Issue: App feels slower after migration
**Symptoms**: Delayed responses, poor user experience
**Cause**: Unoptimized queries, missing caching, inefficient data loading

**Solution**:
```typescript
// Implement comprehensive caching strategy
class AppCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  set<T>(key: string, data: T, ttl = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    });
  }
  
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Cached database service
class CachedDatabaseService extends DatabaseService {
  private cache = new AppCache();
  
  async getAbsences(userId: string, limit = 50): Promise<Absence[]> {
    const cacheKey = `absences:${userId}:${limit}`;
    
    // Try cache first
    let absences = await this.cache.get<Absence[]>(cacheKey);
    if (absences) {
      return absences;
    }
    
    // Fetch from database
    absences = await super.getAbsences(userId, limit);
    
    // Cache the result
    this.cache.set(cacheKey, absences);
    
    return absences;
  }
  
  async createAbsence(absence: CreateAbsence): Promise<Absence> {
    const result = await super.createAbsence(absence);
    
    // Invalidate related cache entries
    this.cache.invalidate(`absences:${absence.userId}`);
    
    return result;
  }
}
```

## Frequently Asked Questions

### General Migration Questions

**Q: How long will the migration take?**
A: The complete migration is planned for 14 weeks, with each phase taking 1-2 weeks. Critical features will be maintained throughout the process.

**Q: Will there be any downtime?**
A: Minimal downtime is expected. The migration uses a phased approach with fallback mechanisms to ensure continuous service availability.

**Q: Can we rollback if something goes wrong?**
A: Yes, each phase includes comprehensive rollback procedures. We maintain dual systems during the transition period.

### Technical Questions

**Q: Why are we migrating from Supabase to Appwrite?**
A: [Insert your specific reasons - cost, features, control, etc.]

**Q: Will the mobile app need to be updated?**
A: Yes, the mobile app will receive updates throughout the migration, but users won't need to manually update frequently as we use Expo's OTA updates.

**Q: What happens to existing user data?**
A: All user data will be migrated intact. We have comprehensive validation to ensure zero data loss.

**Q: Will users need to reset their passwords?**
A: Yes, due to different encryption methods, users will receive password reset emails and need to create new passwords.

**Q: How will file URLs change?**
A: File URLs will change from Supabase to Appwrite format, but we implement smart URL resolution to handle this transparently.

### Development Questions

**Q: Do we need to learn new APIs?**
A: Yes, developers need to familiarize themselves with Appwrite SDK, but we provide comprehensive guides and abstraction layers to ease the transition.

**Q: Will the development workflow change?**
A: Minimally. The core React Native development remains the same. Main changes are in backend integration patterns.

**Q: How do we handle testing during migration?**
A: We maintain separate test environments for each phase and use feature flags to control which backend is used.

**Q: What about real-time features?**
A: Appwrite provides real-time subscriptions similar to Supabase. We'll migrate these features maintaining the same user experience.

### Troubleshooting Quick Reference

#### Authentication Issues
```bash
# Check user session
console.log(await account.getSession('current'));

# Verify project configuration
console.log(client.config);

# Test authentication
try {
  const user = await account.get();
  console.log('User authenticated:', user);
} catch (error) {
  console.log('Not authenticated');
}
```

#### Database Issues
```bash
# Check database connection
try {
  const response = await databases.list();
  console.log('Database connected:', response);
} catch (error) {
  console.error('Database error:', error);
}

# Verify collection exists
try {
  const collection = await databases.getCollection(DATABASE_ID, 'absences');
  console.log('Collection found:', collection);
} catch (error) {
  console.error('Collection not found:', error);
}
```

#### Storage Issues
```bash
# Check storage buckets
try {
  const buckets = await storage.listBuckets();
  console.log('Available buckets:', buckets);
} catch (error) {
  console.error('Storage error:', error);
}

# Test file upload
try {
  const file = await storage.createFile('test-bucket', ID.unique(), testBlob);
  console.log('Upload successful:', file);
} catch (error) {
  console.error('Upload failed:', error);
}
```

### Emergency Procedures

#### Complete Rollback
```typescript
const emergencyRollback = async () => {
  console.log('Starting emergency rollback...');
  
  // 1. Update feature flags
  await updateEnvironmentVariables({
    EXPO_PUBLIC_USE_APPWRITE: 'false',
    EXPO_PUBLIC_MIGRATION_PHASE: '0'
  });
  
  // 2. Clear Appwrite sessions
  await AsyncStorage.multiRemove([
    'appwrite_session',
    'appwrite_user',
    'appwrite_cache'
  ]);
  
  // 3. Restore Supabase configuration
  await restoreSupabaseConfig();
  
  // 4. Notify users
  Alert.alert(
    'Service Restored',
    'We have restored the previous version. Please restart the app.'
  );
  
  console.log('Emergency rollback completed');
};
```

#### Data Recovery
```typescript
const recoverCorruptedData = async (userId: string) => {
  try {
    // Try to recover from backup
    const backupData = await getBackupData(userId);
    
    if (backupData) {
      await restoreUserData(userId, backupData);
      console.log('Data recovered from backup');
      return true;
    }
    
    // Try to recover from Supabase
    const supabaseData = await getSupabaseUserData(userId);
    if (supabaseData) {
      await migrateUserDataAgain(userId, supabaseData);
      console.log('Data recovered from Supabase');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Data recovery failed:', error);
    return false;
  }
};
```

### Support Contacts

**Technical Issues**:
- Lead Developer: [Contact Info]
- DevOps Team: [Contact Info]
- Database Admin: [Contact Info]

**Emergency Contacts**:
- On-call Engineer: [Contact Info]
- Project Manager: [Contact Info]
- CTO: [Contact Info]

### Monitoring and Alerts

**Key Metrics to Monitor**:
- Authentication success rate (> 99%)
- API response times (< 2 seconds)
- File upload success rate (> 95%)
- Error rates (< 1%)

**Alert Thresholds**:
- High error rate: > 5% in 5 minutes
- Slow response times: > 5 seconds average
- Authentication failures: > 10% in 5 minutes
- File upload failures: > 20% in 5 minutes

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Next Review**: Weekly during migration phases