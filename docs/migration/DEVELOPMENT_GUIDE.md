# Development Guide for Appwrite Migration

## Overview

This guide provides essential information for developers working on the Skanida Apps Mobile project during and after the migration from Supabase to Appwrite.

## Architecture Changes

### Before: Supabase Architecture
```
Mobile App (React Native)
├── @supabase/supabase-js SDK
├── PostgreSQL Database
├── Supabase Auth
└── Supabase Storage
```

### After: Appwrite Architecture
```
Mobile App (React Native)
├── appwrite SDK
├── Appwrite Database (NoSQL)
├── Appwrite Auth
└── Appwrite Storage
```

## Development Environment Setup

### Prerequisites
- Node.js 18+ with pnpm package manager
- Expo CLI 53+
- Appwrite account (Cloud or Self-hosted)
- Android Studio / Xcode for native development

### Installation Steps

1. **Install Appwrite SDK**
```bash
cd /home/runner/work/skanida-apps-mobile/skanida-apps-mobile
pnpm add appwrite
```

2. **Configure Environment Variables**
```bash
# Add to .env.local or expo environment
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
EXPO_PUBLIC_DATABASE_ID=your-database-id
EXPO_PUBLIC_BUCKET_AVATARS=avatars
EXPO_PUBLIC_BUCKET_ATTENDANCE=attendance-photos
EXPO_PUBLIC_BUCKET_PERIZINAN=perizinan
```

3. **Initialize Appwrite Client**
```typescript
// utils/appwrite.ts
import { Client, Account, Databases, Storage } from 'appwrite';

const client = new Client()
  .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client };
```

## Code Migration Patterns

### Authentication Migration

#### Before (Supabase)
```typescript
// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// Register
const { data, error } = await supabase.auth.signUp({
  email,
  password,
});

// Get current user
const { data: { user } } = await supabase.auth.getUser();
```

#### After (Appwrite)
```typescript
// Login
try {
  const session = await account.createEmailSession(email, password);
  const user = await account.get();
} catch (error) {
  console.error('Login failed:', error);
}

// Register
try {
  const user = await account.create(ID.unique(), email, password);
  await account.createEmailSession(email, password);
} catch (error) {
  console.error('Registration failed:', error);
}

// Get current user
try {
  const user = await account.get();
} catch (error) {
  // User not authenticated
}
```

### Database Operations Migration

#### Before (Supabase)
```typescript
// Insert
const { data, error } = await supabase
  .from('absences')
  .insert({
    user_id: userId,
    date: new Date().toISOString(),
    status: 'Hadir',
  });

// Query
const { data, error } = await supabase
  .from('absences')
  .select('*')
  .eq('user_id', userId)
  .order('date', { ascending: false });

// Update
const { data, error } = await supabase
  .from('user_profiles')
  .update({ full_name: newName })
  .eq('user_id', userId);
```

#### After (Appwrite)
```typescript
// Insert
try {
  const document = await databases.createDocument(
    DATABASE_ID,
    'absences',
    ID.unique(),
    {
      userId,
      date: new Date().toISOString(),
      status: 'Hadir',
    }
  );
} catch (error) {
  console.error('Insert failed:', error);
}

// Query
try {
  const documents = await databases.listDocuments(
    DATABASE_ID,
    'absences',
    [
      Query.equal('userId', userId),
      Query.orderDesc('date')
    ]
  );
} catch (error) {
  console.error('Query failed:', error);
}

// Update
try {
  const document = await databases.updateDocument(
    DATABASE_ID,
    'user_profiles',
    documentId,
    { fullName: newName }
  );
} catch (error) {
  console.error('Update failed:', error);
}
```

### File Upload Migration

#### Before (Supabase)
```typescript
const { data, error } = await supabase.storage
  .from('attendance-photos')
  .upload(fileName, file);

if (!error) {
  const { data: urlData } = supabase.storage
    .from('attendance-photos')
    .getPublicUrl(fileName);
}
```

#### After (Appwrite)
```typescript
try {
  const file = await storage.createFile(
    'attendance-photos',
    ID.unique(),
    fileBlob
  );
  
  const fileUrl = storage.getFileView(
    'attendance-photos',
    file.$id
  );
} catch (error) {
  console.error('Upload failed:', error);
}
```

## Data Model Changes

### User Profile Model
```typescript
// Supabase (SQL)
interface UserProfile {
  id: string;
  user_id: string; // Foreign key
  full_name: string;
  email: string;
  absence_number: string;
  class_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// Appwrite (NoSQL)
interface UserProfile {
  $id: string;
  userId: string; // Reference (not enforced)
  fullName: string;
  email: string;
  absenceNumber: string;
  className: string;
  avatarUrl?: string;
  $createdAt: string;
  $updatedAt: string;
}
```

### Absence Model
```typescript
// Supabase
interface Absence {
  id: string;
  user_id: string;
  date: string; // DATE type
  status: 'Hadir' | 'Datang' | 'Pulang';
  reason?: string;
  photo_url?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}

// Appwrite
interface Absence {
  $id: string;
  userId: string;
  date: string; // ISO string
  status: 'Hadir' | 'Datang' | 'Pulang';
  reason?: string;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  $createdAt: string;
}
```

## State Management Updates

### Auth Store Migration
```typescript
// store/authStore.ts
import { create } from 'zustand';
import { account } from '~/utils/appwrite';

interface AuthState {
  user: Models.User<Models.Preferences> | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  checkAuth: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      await account.createEmailSession(email, password);
      const user = await account.get();
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  logout: async () => {
    try {
      await account.deleteSession('current');
      set({ user: null });
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
  
  register: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      await account.create(ID.unique(), email, password);
      await get().login(email, password);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  checkAuth: async () => {
    try {
      const user = await account.get();
      set({ user });
    } catch (error) {
      set({ user: null });
    }
  },
}));

export default useAuthStore;
```

## Error Handling Best Practices

### Standardized Error Handling
```typescript
// utils/errorHandler.ts
export interface AppError {
  code: number;
  message: string;
  type: 'appwrite' | 'network' | 'validation';
}

export const handleAppwriteError = (error: any): AppError => {
  if (error.type?.startsWith('appwrite')) {
    return {
      code: error.code || 500,
      message: error.message || 'An error occurred',
      type: 'appwrite'
    };
  }
  
  if (error.code === 'NetworkError') {
    return {
      code: 0,
      message: 'Network connection failed',
      type: 'network'
    };
  }
  
  return {
    code: 500,
    message: 'Unknown error occurred',
    type: 'appwrite'
  };
};

// Usage in components
try {
  await someAppwriteOperation();
} catch (error) {
  const appError = handleAppwriteError(error);
  // Handle error based on type
  switch (appError.type) {
    case 'network':
      showNetworkErrorMessage();
      break;
    case 'appwrite':
      showGenericErrorMessage(appError.message);
      break;
  }
}
```

## Performance Optimization

### Query Optimization
```typescript
// Create indexes for frequently queried fields
const createIndexes = async () => {
  // User ID and date for absences
  await databases.createIndex(
    DATABASE_ID,
    'absences',
    'userId_date_idx',
    'key',
    ['userId', 'date'],
    ['asc', 'desc']
  );
  
  // User ID for profiles
  await databases.createIndex(
    DATABASE_ID,
    'user_profiles',
    'userId_idx',
    'key',
    ['userId']
  );
};

// Efficient querying
const getRecentAbsences = async (userId: string, limit = 20) => {
  return await databases.listDocuments(
    DATABASE_ID,
    'absences',
    [
      Query.equal('userId', userId),
      Query.orderDesc('date'),
      Query.limit(limit)
    ]
  );
};
```

### Caching Strategy
```typescript
// utils/cache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

class CacheManager {
  private static CACHE_PREFIX = 'appwrite_cache_';
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(
        this.CACHE_PREFIX + key
      );
      
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      
      if (now - timestamp > this.CACHE_DURATION) {
        await this.remove(key);
        return null;
      }
      
      return data;
    } catch {
      return null;
    }
  }
  
  static async set<T>(key: string, data: T): Promise<void> {
    const cached = {
      data,
      timestamp: Date.now()
    };
    
    await AsyncStorage.setItem(
      this.CACHE_PREFIX + key,
      JSON.stringify(cached)
    );
  }
  
  static async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(this.CACHE_PREFIX + key);
  }
}
```

## Testing Guidelines

### Unit Testing
```typescript
// __tests__/authStore.test.ts
import { renderHook, act } from '@testing-library/react-native';
import useAuthStore from '~/store/authStore';

// Mock Appwrite
jest.mock('~/utils/appwrite', () => ({
  account: {
    createEmailSession: jest.fn(),
    get: jest.fn(),
    deleteSession: jest.fn(),
  }
}));

describe('AuthStore', () => {
  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuthStore());
    
    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });
    
    expect(result.current.user).toBeDefined();
  });
});
```

### Integration Testing
```typescript
// __tests__/integration/attendance.test.ts
import { databases } from '~/utils/appwrite';

describe('Attendance Integration', () => {
  it('should create and retrieve absence record', async () => {
    const absenceData = {
      userId: 'test-user',
      date: new Date().toISOString(),
      status: 'Hadir'
    };
    
    const created = await databases.createDocument(
      DATABASE_ID,
      'absences',
      ID.unique(),
      absenceData
    );
    
    expect(created.$id).toBeDefined();
    expect(created.status).toBe('Hadir');
  });
});
```

## Debugging Tips

### Appwrite Console
- Use Appwrite Console for database inspection
- Monitor real-time logs and usage metrics
- Set up custom functions for complex operations

### Local Development
```typescript
// Enable debug mode for development
const client = new Client()
  .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!);

if (__DEV__) {
  // Enable detailed logging
  client.setEndpoint('http://localhost/v1'); // Local instance
}
```

### Common Debug Commands
```bash
# Check Appwrite server status
curl https://cloud.appwrite.io/v1/health

# Test database connection
curl -X GET 'https://cloud.appwrite.io/v1/databases' \
  -H 'X-Appwrite-Project: YOUR_PROJECT_ID'

# Monitor real-time subscriptions
npx appwrite functions logs --functionId=your-function-id
```

## Security Considerations

### Permission Management
```typescript
// Set up collection permissions
const setupPermissions = async () => {
  // User profiles - users can read/write their own
  await databases.updateCollection(
    DATABASE_ID,
    'user_profiles',
    'User Profiles',
    [Permission.read(Role.users())],
    [Permission.write(Role.users())]
  );
  
  // Absences - users can read/write their own
  await databases.updateCollection(
    DATABASE_ID,
    'absences',
    'Absences',
    [Permission.read(Role.users())],
    [Permission.write(Role.users())]
  );
};
```

### Input Validation
```typescript
// Validate input data before submission
const validateAbsenceData = (data: any) => {
  const errors: string[] = [];
  
  if (!data.userId) errors.push('User ID is required');
  if (!data.date) errors.push('Date is required');
  if (!['Hadir', 'Datang', 'Pulang'].includes(data.status)) {
    errors.push('Invalid status');
  }
  
  return errors;
};
```

## Deployment Checklist

### Pre-deployment
- [ ] All environment variables configured
- [ ] Database collections and indexes created
- [ ] Storage buckets configured with proper permissions
- [ ] Authentication providers set up
- [ ] Rate limits configured
- [ ] Security rules validated

### Post-deployment
- [ ] Health checks passing
- [ ] Monitoring and alerting active
- [ ] Performance metrics within acceptable ranges
- [ ] Error rates below threshold
- [ ] User feedback collection active

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Next Review**: Weekly during migration phases