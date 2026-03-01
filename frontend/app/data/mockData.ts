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
    videoPath?: string;
}


export const mockVideos: VideoItem[] = [
    {
        id: "1",
        userId: "user123",
        originalFilename: "Test",
        durationSeconds: 120,
        fileSize: 15728640,
        uploadedAt: "2024-02-22T10:30:00Z",
        isAnonymous: false,
        isClaimed: true,
        videoPath: "/videos/Test.mp4",
        analysisResult: {
            isLieDetected: true,
            confidenceScore: 0.85,
            status: "completed",
            analyzedAt: "2024-02-22T10:45:00Z"
        }
    }
    
];

// Helper function to get video by ID
export const getMockVideoById = (id: string): VideoItem | undefined => {
    return mockVideos.find(video => video.id === id);
};