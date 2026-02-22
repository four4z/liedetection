export interface AnalysisResult {
    isLieDetected: boolean;
    confidenceScore: number;
    status: string;
    analyzedAt?: string;
}

export interface VideoItem {
    id: string;
    userId?: string;
    originalFilename: string;
    durationSeconds?: number;
    fileSize: number;
    uploadedAt: string;
    isAnonymous: boolean;
    isClaimed: boolean;
    analysisResult?: AnalysisResult;
}

export const mockVideos: VideoItem[] = [
    {
        id: "1",
        userId: "user123",
        originalFilename: "interview_session_1.mp4",
        durationSeconds: 120,
        fileSize: 15728640, // 15MB
        uploadedAt: "2024-02-22T10:30:00Z",
        isAnonymous: false,
        isClaimed: true,
        analysisResult: {
            isLieDetected: true,
            confidenceScore: 0.85,
            status: "completed",
            analyzedAt: "2024-02-22T10:45:00Z"
        }
    },
    {
        id: "2",
        userId: "user123",
        originalFilename: "presentation_demo.mp4",
        durationSeconds: 300,
        fileSize: 52428800, // 50MB
        uploadedAt: "2024-02-21T15:20:00Z",
        isAnonymous: false,
        isClaimed: true,
        analysisResult: {
            isLieDetected: false,
            confidenceScore: 0.12,
            status: "completed",
            analyzedAt: "2024-02-21T15:35:00Z"
        }
    },
    {
        id: "3",
        userId: "user123",
        originalFilename: "questionnaire_response.mp4",
        durationSeconds: 45,
        fileSize: 7864320, // 7.5MB
        uploadedAt: "2024-02-20T09:15:00Z",
        isAnonymous: true,
        isClaimed: false,
        // analysisResult: {
        //     status: "processing"
        // }
    },
    {
        id: "4",
        originalFilename: "anonymous_test.mp4",
        durationSeconds: 90,
        fileSize: 20971520, // 20MB
        uploadedAt: "2024-02-19T14:00:00Z",
        isAnonymous: true,
        isClaimed: false,
        // analysisResult: {
        //     status: "pending"
        // }
    },
    {
        id: "5",
        userId: "user123",
        originalFilename: "failed_analysis.mp4",
        durationSeconds: 180,
        fileSize: 31457280, // 30MB
        uploadedAt: "2024-02-18T11:45:00Z",
        isAnonymous: false,
        isClaimed: true,
        // analysisResult: {
        //     status: "failed"
        // }
    }
];

// Helper function to get video by ID
export const getMockVideoById = (id: string): VideoItem | undefined => {
    return mockVideos.find(video => video.id === id);
};