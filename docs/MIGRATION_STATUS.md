# Migration Update - Environment Configuration

After migrating the core components from Supabase to Appwrite, update your environment configuration as follows:

## Required Environment Variables

Create a `.env` file in your project root with these variables:

```env
# Appwrite Configuration
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_project_id_here
EXPO_PUBLIC_APPWRITE_DATABASE_ID=your_database_id_here

# Collection IDs
EXPO_PUBLIC_APPWRITE_USER_PROFILES_COLLECTION_ID=user_profiles
EXPO_PUBLIC_APPWRITE_ABSENCES_COLLECTION_ID=absences
EXPO_PUBLIC_APPWRITE_PERIZINAN_COLLECTION_ID=perizinan

# Storage Bucket IDs
EXPO_PUBLIC_APPWRITE_ATTENDANCE_PHOTOS_STORAGE=attendance-photos
EXPO_PUBLIC_APPWRITE_PERIZINAN_STORAGE=perizinan
EXPO_PUBLIC_APPWRITE_AVATARS_STORAGE=avatars
```

## Migration Status

### ✅ Completed

- **Authentication System**: Login, Register, Password Change
- **User Profile Management**: Edit Profile, Avatar Upload
- **Leave Request System**: Submit and manage perizinan requests
- **Database Operations**: User profiles, absences, perizinan collections
- **Storage Operations**: File uploads for perizinan documents
- **Environment Configuration**: Updated for Appwrite

### ⚠️ Partially Completed

- **Attendance System**: AbsenceReport component updated but may need additional testing
- **Camera Attendance**: Likely still using Supabase storage - needs migration
- **Avatar Upload**: In EditProfile component - needs storage migration

### 🔄 Still Using Supabase (Need Migration)

- **CameraAttendance.tsx**: Photo uploads for attendance
- **Avatar storage operations**: In profile components
- **Some attendance-related database queries**: May remain in attendance calendar components

## Next Steps

1. **Test Authentication**: Register new user, login, change password
2. **Test Profile Management**: Update profile information
3. **Test Leave Requests**: Submit perizinan with document upload
4. **Complete Attendance Migration**: Update CameraAttendance.tsx and attendance storage
5. **Update Avatar Upload**: Migrate avatar upload to Appwrite storage
6. **Performance Testing**: Compare response times with Supabase
7. **Remove Supabase Dependencies**: Clean up unused imports and dependencies

## Migration Verification Checklist

- [ ] User can register successfully
- [ ] User can login and logout
- [ ] User can change password
- [ ] User can update profile information
- [ ] User can submit leave requests with attachments
- [ ] File uploads work correctly
- [ ] Database operations are functioning
- [ ] No critical errors in application logs

## Troubleshooting

If you encounter issues:

1. **Verify Environment Variables**: Ensure all Appwrite configuration is correct
2. **Check Appwrite Dashboard**: Verify collections and storage buckets exist
3. **Review Permissions**: Ensure proper read/write permissions are set
4. **Check Network**: Verify Appwrite endpoint is accessible
5. **Examine Logs**: Look for specific error messages in application logs

## Support

Refer to the comprehensive setup guides:
- `docs/APPWRITE_DASHBOARD_SETUP.md` - Complete Appwrite configuration guide
- `docs/MIGRATION_GUIDE.md` - Detailed migration process and comparisons