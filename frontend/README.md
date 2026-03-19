This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Prerequisites
- Node.js 18+ installed
- AWS S3 bucket and credentials (for video upload functionality)
- Backend server running (default: http://localhost:8000)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables by copying `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

3. Update `.env.local` with your AWS credentials:
```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=your_bucket_name
AWS_REGION=us-east-1
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Features

- **Video Upload to AWS S3**: Upload videos directly to AWS S3 bucket
- **Live Recording**: Record videos directly in the browser
- **Video Analysis**: Submit videos to backend for lie detection analysis
- **User Authentication**: Login/Register system
- **Video History**: View analysis history and results

## AWS S3 Setup

To enable video uploads to AWS S3:

1. Create an S3 bucket in AWS
2. Configure bucket CORS settings to allow uploads from your domain:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

3. Create IAM user with S3 permissions:
   - s3:PutObject
   - s3:GetObject
   - s3:DeleteObject (optional)

4. Add credentials to `.env.local`

## API Integration

The application communicates with backend at the configured `NEXT_PUBLIC_API_URL`:
- `POST /videos/upload` - Submit video URL for analysis
- `GET /videos/{id}` - Get video analysis results
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/) - AWS S3 documentation

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
