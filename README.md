# Lie Detection Web App

A web application that analyzes videos to detect deceptive behavior using AI-powered human pose estimation.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 |
| Backend | FastAPI (Python) |
| Database | MongoDB (Motor async driver) |
| AI | OpenPose + LSTM inference |
| Storage | AWS S3 (video & thumbnail uploads) |
| Auth | JWT + NextAuth + Google OAuth |
| Deployment | Vercel (frontend) |

---

## Features

- Video URL submission or live browser recording
- Direct video upload to AWS S3
- AI lie detection analysis with real-time status updates (SSE)
- User authentication — Email/Password and Google OAuth
- Password reset via OTP email
- Anonymous video upload (auto-deleted after 7 days)
- Claim anonymous videos after logging in
- View, rename, and delete your videos
- Search and filter your video list
- Video watch history (per user, no duplicates)
- Update profile username and avatar
- Rate limiting on login and OTP endpoints
- Video access control — only the owner can view their videos

---

## Project Structure

```
liedetection/
├── backend/
│   └── app/
│       ├── main.py
│       ├── api/          # auth, videos, history
│       ├── models/       # pydantic schemas
│       ├── database/     # MongoDB connection + .env
│       └── ai/           # analyzer, inference, utils
└── frontend/             # Next.js app
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB (local or Atlas)
- AWS S3 bucket
- Google Cloud project (for OAuth)

---

### Backend Setup

**1. Create the env file at `backend/app/database/.env`:**

```env
MONGO_USERNAME=your_mongo_username
MONGO_PASSWORD=your_mongo_password
MONGO_HOST=your_cluster.mongodb.net
DATABASE_NAME=liedetection

JWT_SECRET=your-super-secret-key-change-this

GOOGLE_CLIENT_ID=your-google-client-id

MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=your@gmail.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
```

**2. Install dependencies:**

```bash
cd backend
pip install -r requirements.txt
```

**3. Run the server:**

```bash
uvicorn app.main:app --reload
```

Backend runs at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

---

### Frontend Setup

**1. Copy the example env file:**

```bash
cd frontend
cp .env.example .env.local
```

**2. Fill in `frontend/.env.local`:**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000

AWS_ACCESS_KEY=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_BUCKET_NAME=your-bucket-name
AWS_BUCKET_REGION=ap-southeast-2
```

**3. Install and run:**

```bash
npm install
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

### AWS S3 Setup

1. Create an S3 bucket
2. Add this CORS config to the bucket:

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

3. Create an IAM user with these permissions: `s3:PutObject`, `s3:GetObject`
4. Add the IAM credentials to `.env.local`

---

## Deployment

### Frontend (Vercel)

Set these environment variables in your Vercel project settings:

```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com
AWS_ACCESS_KEY=...
AWS_SECRET_ACCESS_KEY=...
AWS_BUCKET_NAME=...
AWS_BUCKET_REGION=...
```

Also update your S3 bucket CORS `AllowedOrigins` to include your Vercel domain.

### Backend (any server)

Set this to allow requests from your Vercel domain:

```env
ALLOWED_ORIGINS=https://yourapp.vercel.app
```

Multiple origins: `ALLOWED_ORIGINS=https://yourapp.vercel.app,http://localhost:3000`

---

## API Overview

All protected routes require: `Authorization: Bearer <token>`

### Auth — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Register with email + password |
| POST | `/login` | Login (rate limited: 5 / 15 min) |
| POST | `/google` | Login with Google |
| GET | `/me` | Get current user |
| PATCH | `/me` | Update username or avatar URL |
| POST | `/refresh` | Get a new token before expiry |
| POST | `/logout` | Logout |
| POST | `/forgetpassword` | Send OTP to email (rate limited: 3 / 15 min) |
| POST | `/verifyotp` | Verify OTP, get reset token |
| POST | `/resetpassword` | Reset password with token |

### Videos — `/api/videos`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Required | List videos — paginated, `?status=`, `?search=` |
| POST | `/upload` | Optional | Submit video URL for analysis |
| POST | `/claim` | Required | Claim anonymous videos after login |
| GET | `/{id}` | Owner only | Get full video with segments |
| GET | `/{id}/status` | Public | Lightweight status + summary (cheap to poll) |
| GET | `/{id}/stream` | Public | SSE — pushes status updates until analysis done |
| POST | `/{id}/analyze` | Owner only | Trigger AI analysis |
| PATCH | `/{id}/rename` | Owner only | Rename video |
| DELETE | `/{id}` | Owner only | Delete video + its history |

### History — `/api/history`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Get watch history (paginated) |
| DELETE | `/clear` | Delete all history |
| DELETE | `/{id}` | Delete a single history entry |

---

## Environment Variables Reference

### Backend (`backend/app/database/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_USERNAME` | Yes | MongoDB username |
| `MONGO_PASSWORD` | Yes | MongoDB password |
| `MONGO_HOST` | Yes | MongoDB host |
| `DATABASE_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | Secret key for JWT signing |
| `GOOGLE_CLIENT_ID` | For Google login | Google OAuth client ID |
| `MAIL_USERNAME` | For password reset | SMTP username |
| `MAIL_PASSWORD` | For password reset | SMTP app password |
| `MAIL_FROM` | For password reset | Sender email |
| `MAIL_PORT` | For password reset | SMTP port (default: 587) |
| `MAIL_SERVER` | For password reset | SMTP server (default: smtp.gmail.com) |

### Backend (server environment)

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `*` | Comma-separated allowed CORS origins |

### Frontend (`.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend base URL |
| `AWS_ACCESS_KEY` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_BUCKET_NAME` | S3 bucket name |
| `AWS_BUCKET_REGION` | S3 bucket region |
