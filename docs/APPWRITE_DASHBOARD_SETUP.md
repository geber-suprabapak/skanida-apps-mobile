# Appwrite Dashboard Setup Guide

This guide provides step-by-step instructions for setting up Appwrite to replace Supabase as the backend for the Skanida Apps Mobile application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Create Appwrite Project](#create-appwrite-project)
3. [Configure Authentication](#configure-authentication)
4. [Set Up Database](#set-up-database)
5. [Configure Storage](#configure-storage)
6. [Environment Variables](#environment-variables)
7. [Testing Configuration](#testing-configuration)
8. [Security Considerations](#security-considerations)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

- Appwrite Cloud account (https://cloud.appwrite.io) or self-hosted Appwrite instance
- Admin access to configure the project
- Understanding of the existing application data structure

## 1. Create Appwrite Project

### Using Appwrite Cloud

1. **Sign up/Login** to [Appwrite Cloud](https://cloud.appwrite.io)
2. **Create a new project**:
   - Click "Create Project"
   - Enter project name: `skanida-apps-mobile`
   - Choose your preferred region (closest to your users)
   - Click "Create"
3. **Note your Project ID** from the project settings (needed for environment variables)

### Using Self-Hosted Appwrite

1. **Install Appwrite** following the [official documentation](https://appwrite.io/docs/installation)
2. **Access the Appwrite Console** via your domain
3. **Create a project** with name `skanida-apps-mobile`

## 2. Configure Authentication

### Enable Email/Password Authentication

1. **Navigate to Auth** in the left sidebar
2. **Go to Settings** → **Authentication Methods**
3. **Enable Email/Password** authentication
4. **Configure settings**:
   - ✅ Email/Password Login
   - ✅ Account Verification (recommended)
   - ✅ Password Recovery
   - Set minimum password length: 8 characters
   - Enable special characters requirement (recommended)

### Configure Email Settings (Optional but Recommended)

1. **Go to Settings** → **Email Templates**
2. **Configure SMTP** (if using self-hosted):
   - Add your SMTP server details
   - Test email delivery
3. **Customize email templates** for:
   - Email verification
   - Password recovery
   - Welcome emails

### User Preferences

1. **Set session limits**:
   - Maximum sessions per user: 10
   - Session length: 30 days
2. **Configure password policy**:
   - Minimum length: 8 characters
   - Require special characters: Yes
   - Require numbers: Yes

## 3. Set Up Database

### Create Main Database

1. **Navigate to Databases** in the left sidebar
2. **Create Database**:
   - Name: `skanida-main-db`
   - Database ID: `skanida-main-db` (note this for environment variables)

### Create Collections

#### Collection 1: User Profiles

1. **Create Collection**:
   - Name: `User Profiles`
   - Collection ID: `user_profiles`
   - Permissions: Document security (users can read/write their own documents)

2. **Add Attributes**:
   ```
   - user_id (string, 36 chars, required, unique index)
   - full_name (string, 255 chars, required)
   - email (string, 255 chars, required, unique index)
   - absence_number (string, 50 chars, optional, unique index)
   - class_name (string, 100 chars, optional)
   - avatar_url (string, 500 chars, optional)
   - role (string, 20 chars, optional, default: "student")
   - created_at (datetime, required)
   - updated_at (datetime, required)
   ```

3. **Configure Indexes**:
   - `user_id_index`: user_id (unique)
   - `email_index`: email (unique)
   - `absence_number_index`: absence_number (unique, sparse)

4. **Set Permissions**:
   - Read: `users` (authenticated users can read all profiles)
   - Create: `users` (authenticated users can create profiles)
   - Update: `user:{user_id}` (users can only update their own profile)
   - Delete: `user:{user_id}` (users can only delete their own profile)

#### Collection 2: Absences

1. **Create Collection**:
   - Name: `Absences`
   - Collection ID: `absences`

2. **Add Attributes**:
   ```
   - user_id (string, 36 chars, required, index)
   - date (string, 10 chars, required, format: YYYY-MM-DD, index)
   - status (string, 20 chars, required, enum: ["Hadir", "Datang", "Pulang"])
   - reason (string, 500 chars, optional)
   - photo_url (string, 500 chars, optional)
   - latitude (float, optional)
   - longitude (float, optional)
   - created_at (datetime, required)
   - updated_at (datetime, required)
   ```

3. **Configure Indexes**:
   - `user_date_index`: user_id, date (compound index)
   - `date_index`: date
   - `user_id_index`: user_id

4. **Set Permissions**:
   - Read: `user:{user_id}` (users can only read their own absences)
   - Create: `user:{user_id}` (users can only create their own absences)
   - Update: `user:{user_id}` (users can only update their own absences)
   - Delete: `user:{user_id}` (users can only delete their own absences)

#### Collection 3: Perizinan (Leave Requests)

1. **Create Collection**:
   - Name: `Perizinan`
   - Collection ID: `perizinan`

2. **Add Attributes**:
   ```
   - user_id (string, 36 chars, required, index)
   - kategori_izin (string, 20 chars, required, enum: ["sakit", "pergi"])
   - deskripsi (string, 1000 chars, optional)
   - link_foto (string, 500 chars, optional)
   - tanggal (datetime, required, index)
   - approval_status (string, 20 chars, required, default: "pending", enum: ["pending", "approved", "rejected"])
   - status (boolean, required, default: false)
   - created_at (datetime, required)
   - updated_at (datetime, required)
   ```

3. **Configure Indexes**:
   - `user_date_index`: user_id, tanggal (compound index)
   - `status_index`: approval_status
   - `user_id_index`: user_id

4. **Set Permissions**:
   - Read: `user:{user_id}` (users can read their own requests)
   - Create: `user:{user_id}` (users can create their own requests)
   - Update: `user:{user_id}` (users can update their own requests)
   - Delete: `user:{user_id}` (users can delete their own requests)

## 4. Configure Storage

### Create Storage Buckets

#### Bucket 1: Attendance Photos

1. **Navigate to Storage** in the left sidebar
2. **Create Bucket**:
   - Name: `Attendance Photos`
   - Bucket ID: `attendance-photos`
   - File Security: Enabled
   - Max file size: 10MB
   - Allowed file extensions: `png, jpg, jpeg`
   - Compression: GZIP

3. **Set Permissions**:
   - Read: `user:{user_id}` (users can only read their own photos)
   - Create: `user:{user_id}` (users can only upload their own photos)
   - Update: `user:{user_id}` (users can only update their own photos)
   - Delete: `user:{user_id}` (users can only delete their own photos)

#### Bucket 2: Perizinan Documents

1. **Create Bucket**:
   - Name: `Perizinan Documents`
   - Bucket ID: `perizinan`
   - File Security: Enabled
   - Max file size: 5MB
   - Allowed file extensions: `png, jpg, jpeg, pdf`
   - Compression: GZIP

2. **Set Permissions**:
   - Read: `user:{user_id}`
   - Create: `user:{user_id}`
   - Update: `user:{user_id}`
   - Delete: `user:{user_id}`

#### Bucket 3: User Avatars

1. **Create Bucket**:
   - Name: `User Avatars`
   - Bucket ID: `avatars`
   - File Security: Enabled
   - Max file size: 2MB
   - Allowed file extensions: `png, jpg, jpeg`
   - Compression: GZIP
   - Enable Image transformations (for resizing)

2. **Set Permissions**:
   - Read: `users` (all authenticated users can view avatars)
   - Create: `user:{user_id}`
   - Update: `user:{user_id}`
   - Delete: `user:{user_id}`

## 5. Environment Variables

Create or update your `.env` file with the following variables:

```env
# Appwrite Configuration
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_project_id_here
EXPO_PUBLIC_APPWRITE_DATABASE_ID=skanida-main-db

# Collection IDs
EXPO_PUBLIC_APPWRITE_USER_PROFILES_COLLECTION_ID=user_profiles
EXPO_PUBLIC_APPWRITE_ABSENCES_COLLECTION_ID=absences
EXPO_PUBLIC_APPWRITE_PERIZINAN_COLLECTION_ID=perizinan

# Storage Bucket IDs
EXPO_PUBLIC_APPWRITE_ATTENDANCE_PHOTOS_STORAGE=attendance-photos
EXPO_PUBLIC_APPWRITE_PERIZINAN_STORAGE=perizinan
EXPO_PUBLIC_APPWRITE_AVATARS_STORAGE=avatars
```

### For Self-Hosted Appwrite

Replace the endpoint with your domain:
```env
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://your-appwrite-domain.com/v1
```

## 6. Testing Configuration

### Test Database Connection

1. **Navigate to Databases** → **Your Database**
2. **Test creating a document** in the user_profiles collection
3. **Verify permissions** by testing read/write operations

### Test Storage

1. **Navigate to Storage** → **Each Bucket**
2. **Upload a test file** to verify permissions
3. **Download the file** to verify read permissions

### Test Authentication

1. **Navigate to Auth** → **Users**
2. **Create a test user** manually
3. **Test login** with the mobile app

## 7. Security Considerations

### API Keys and Permissions

1. **Review API Keys**:
   - Use only the public API key for client-side applications
   - Never expose server API keys in mobile apps

2. **Collection Permissions**:
   - Always use `user:{user_id}` for user-specific data
   - Regularly audit permissions

3. **File Upload Security**:
   - Limit file sizes appropriately
   - Restrict file types to prevent malicious uploads
   - Enable virus scanning if available

### Rate Limiting

1. **Configure rate limits** in Project Settings:
   - Requests per minute: 1000
   - File uploads per minute: 100
   - Authentication attempts: 50

### CORS Settings

1. **Add your app domains** to allowed origins:
   - For development: `http://localhost:*`
   - For production: Your actual domain(s)

## 8. Troubleshooting

### Common Issues

#### Permission Denied Errors

- **Check collection permissions** match the user attempting the operation
- **Verify user authentication** status
- **Ensure attribute permissions** are correctly set

#### File Upload Failures

- **Check file size limits** in bucket settings
- **Verify file extensions** are allowed
- **Check storage bucket permissions**

#### Database Connection Issues

- **Verify endpoint URL** is correct
- **Check project ID** matches your configuration
- **Ensure database and collection IDs** are correct

#### Authentication Problems

- **Verify email/password** authentication is enabled
- **Check SMTP configuration** for email verification
- **Ensure session persistence** is configured correctly

### Debugging Steps

1. **Enable debug mode** in your app during testing
2. **Check Appwrite logs** in the console
3. **Use browser developer tools** to inspect network requests
4. **Test API calls** using the Appwrite REST API directly

### Support Resources

- [Appwrite Documentation](https://appwrite.io/docs)
- [Appwrite Discord Community](https://discord.gg/appwrite)
- [GitHub Issues](https://github.com/appwrite/appwrite/issues)

## Migration Checklist

- [ ] Project created and configured
- [ ] Authentication method enabled and tested
- [ ] Database and collections created with proper attributes
- [ ] Indexes configured for optimal performance
- [ ] Storage buckets created with appropriate permissions
- [ ] Environment variables updated
- [ ] Test user created and authentication verified
- [ ] Sample data uploaded and retrieved successfully
- [ ] File upload/download tested
- [ ] Mobile app connected and basic operations verified

## Next Steps

After completing the Appwrite setup:

1. **Update mobile app configuration** with new environment variables
2. **Replace Supabase SDK calls** with Appwrite SDK calls
3. **Test all app functionality** with the new backend
4. **Monitor performance** and optimize as needed
5. **Plan data migration** from Supabase (if applicable)

---

**Note**: Keep this guide updated as your application evolves and Appwrite releases new features.