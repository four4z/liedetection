# Lie Detection Web App

A web application for detecting lies through video analysis using human pose detection.

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: FastAPI (Python)
- **Database**: MongoDB + GridFS
- **AI**: OpenPose

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB running locally

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs at: http://localhost:8000

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

## Environment Variables

Create `backend/.env`:

```
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=liedetection
JWT_SECRET=your-super-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Google OAuth Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add credentials to `.env`

## Features

- ✅ Video upload with drag & drop
- ✅ AI-powered lie detection analysis
- ✅ Dark/Light mode toggle
- ✅ User authentication (Email + Google)
- ✅ Video history for logged users
- ✅ Anonymous upload with claim feature
