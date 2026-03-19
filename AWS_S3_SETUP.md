# AWS S3 Upload Setup Guide

## Overview
This project now uses AWS S3 for video uploads instead of local file storage. Videos are uploaded to S3 and a link is sent to the backend for analysis.

## Architecture Flow

```
Frontend (User) 
    ↓ (Upload video file)
Frontend API Route (/api/upload)
    ↓ (Upload to S3)
AWS S3
    ↓ (Return S3 URL)
Frontend API Route
    ↓ (Submit video URL)
Backend API (/videos/upload)
    ↓ (Process and store)
Database
```

## Setup Instructions

### Step 1: Create AWS S3 Bucket

1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to S3 service
3. Create a new bucket:
   - **Bucket name**: Choose a unique name (e.g., `liedetection-videos`)
   - **Region**: Select your preferred region (e.g., us-east-1)
   - **Block Public Access**: Uncheck "Block all public access" (so files can be accessed publicly)
   - Click "Create bucket"

### Step 2: Configure CORS

1. Go to your S3 bucket
2. Click "Permissions" tab
3. Scroll to "Cross-origin resource sharing (CORS)"
4. Click "Edit" and paste this configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:8000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

5. Save changes

### Step 3: Create IAM User

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Click "Users" → "Create user"
3. **User name**: `liedetection-app` (or any name)
4. Skip optional settings and click "Create user"
5. Click on the created user
6. Go to "Security credentials" tab
7. Scroll down to "Access keys"
8. Click "Create access key"
9. Choose "Application running outside AWS"
10. Click "Next"
11. Save the access key and secret key (you'll need these)

### Step 4: Assign S3 Permissions

1. Go back to the user page
2. Click "Add permissions" → "Attach policies directly"
3. Create inline policy:
   - Choose service: **S3**
   - Actions: Select:
     - `PutObject`
     - `GetObject`
     - `DeleteObject` (optional)
   - Resources: 
     - Bucket: `arn:aws:s3:::your-bucket-name`
     - Object: `arn:aws:s3:::your-bucket-name/*`
4. Click "Create policy"

Alternatively, you can use AWS managed policy: `AmazonS3FullAccess`

### Step 5: Configure Frontend Environment

1. In the `frontend` directory, create `.env.local` file:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` with your credentials:

```
AWS_ACCESS_KEY_ID=your_access_key_from_step_3
AWS_SECRET_ACCESS_KEY=your_secret_key_from_step_3
AWS_S3_BUCKET_NAME=your-bucket-name-from-step_1
AWS_REGION=us-east-1
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Step 6: Install Dependencies

In the `frontend` directory:

```bash
npm install
```

This installs the AWS SDK for S3 uploads.

### Step 7: Run the Application

Frontend:
```bash
cd frontend
npm run dev
```

Backend (in another terminal):
```bash
cd backend
python main.py
```

Visit [http://localhost:3000](http://localhost:3000)

## How It Works

### Upload Flow

1. **User uploads video** (file or recorded)
2. **Frontend sends file** to `/api/upload` endpoint (POST)
3. **Frontend API route**:
   - Receives the file
   - Creates S3Client with AWS credentials
   - Uploads file to S3 bucket
   - Returns S3 URL
4. **Frontend then sends S3 URL** to backend `/videos/upload` endpoint
5. **Backend**:
   - Receives and validates S3 URL
   - Stores video metadata in database
   - Queues video for analysis
6. **Analysis results** are stored and can be retrieved

### File Structure Changes

**Before:**
```
public/videos/
  - recorded-1234567890.webm
```

**After:**
```
AWS S3 Bucket/
  - videos/1234567890-filename.webm
  - URL: https://bucket-name.s3.region.amazonaws.com/videos/1234567890-filename.webm
```

## Testing

1. Navigate to the home page
2. Click "Upload Video" or "Record Video"
3. Click "Analyze" button
4. Check browser console for logs
5. Check S3 bucket to verify video was uploaded

## Troubleshooting

### "AWS configuration is missing" error
- Check `.env.local` has all required variables
- Verify variable names match exactly

### "Access Denied" error
- Check IAM user has S3 permissions
- Verify Access Key ID and Secret Access Key are correct
- Make sure bucket name matches

### "CORS error" in browser
- Check CORS configuration in S3 bucket settings
- Make sure `http://localhost:3000` is in AllowedOrigins
- Restart frontend dev server

### Video not appearing in S3 bucket
- Check CloudTrail logs for errors
- Verify bucket exists and is accessible
- Check bucket permissions

## Production Deployment

For production, update environment variables:
- Use HTTPS URLs in CORS configuration
- Use more restrictive CORS settings (specific domains)
- Consider using CloudFront for CDN
- Use signed URLs for temporary access (optional)
- Enable S3 encryption
- Enable versioning for backup

## Security Best Practices

1. ✅ Use IAM users with minimal permissions
2. ✅ Rotate access keys periodically
3. ✅ Don't commit `.env.local` to git
4. ✅ Use HTTPS in production
5. ✅ Consider using S3 presigned URLs instead of public-read ACL
6. ✅ Enable S3 bucket versioning
7. ✅ Use CloudTrail for audit logging

## Cost Considerations

AWS S3 pricing depends on:
- **Storage**: ~$0.023/GB/month
- **Upload requests**: ~$0.005 per 1,000 requests
- **Download/transfer**: ~$0.09/GB (varies by region)

For a small project, costs should be minimal.

## Migration from Local Storage

If you had videos stored locally:

1. Upload them to S3 manually using AWS Console or CLI
2. Update database records with new S3 URLs
3. Delete local files from `public/videos/`

```bash
# Using AWS CLI
aws s3 sync public/videos/ s3://your-bucket-name/videos/
```

## Support

For issues:
1. Check AWS EC2 console for any service status issues
2. Review AWS IAM permissions
3. Check application logs for specific error messages
4. Review AWS CloudTrail for API call history
