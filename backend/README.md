# Lie Detection Backend

## Environment Variables

Create a `.env` file in the backend directory:

```
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=liedetection
JWT_SECRET=your-super-secret-key-change-in-production
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Installation

```bash
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```
