import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VideoUploader from '../components/VideoUploader';
import AnalysisResult from '../components/AnalysisResult';
import { videoService } from '../services/api';
import './Upload.css';

export default function Upload() {
    const navigate = useNavigate();
    const { isAuthenticated, sessionToken } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedVideo, setUploadedVideo] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [error, setError] = useState(null);

    const handleUpload = async (file) => {
        setIsUploading(true);
        setError(null);

        try {
            // Upload video
            const uploadResult = await videoService.upload(file);
            setUploadedVideo(uploadResult);

            // Store session token for anonymous users
            if (!isAuthenticated && uploadResult.sessionToken) {
                localStorage.setItem('sessionToken', uploadResult.sessionToken);
            }

            // Trigger analysis
            await videoService.analyze(uploadResult.id);

            // Poll for results
            pollForResults(uploadResult.id);
        } catch (err) {
            setError(err.message);
            setIsUploading(false);
        }
    };

    const pollForResults = async (videoId) => {
        const maxAttempts = 60; // 5 minutes
        let attempts = 0;

        const poll = async () => {
            try {
                const video = await videoService.getVideo(videoId);

                if (video.analysisResult?.status === 'completed' || video.analysisResult?.status === 'failed') {
                    setAnalysisResult(video.analysisResult);
                    setIsUploading(false);
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(poll, 5000); // Poll every 5 seconds
                } else {
                    setError('Analysis timed out. Please try again.');
                    setIsUploading(false);
                }
            } catch (err) {
                setError('Failed to get results. Please try again.');
                setIsUploading(false);
            }
        };

        // Start with processing status
        setAnalysisResult({ status: 'processing' });
        setIsUploading(false);
        poll();
    };

    return (
        <div className="upload-page">
            <div className="container">
                <div className="upload-header">
                    <h1>Upload Video</h1>
                    <p className="text-muted">
                        {isAuthenticated
                            ? 'Your video will be saved to your history'
                            : 'You\'re uploading anonymously. Login to save to history.'
                        }
                    </p>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <VideoUploader onUpload={handleUpload} isUploading={isUploading} />

                {analysisResult && (
                    <AnalysisResult
                        result={analysisResult}
                        videoName={uploadedVideo?.originalFilename}
                    />
                )}

                {analysisResult?.status === 'completed' && !isAuthenticated && (
                    <div className="login-prompt">
                        <p>Want to save this result?</p>
                        <button
                            className="btn btn-secondary"
                            onClick={() => navigate('/login')}
                        >
                            Login to save
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
