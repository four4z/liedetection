import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { videoService } from '../services/api';
import './History.css';

export default function History() {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadVideos();
    }, []);

    const loadVideos = async () => {
        try {
            const data = await videoService.getUserVideos();
            setVideos(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return <span className="badge badge-success">Completed</span>;
            case 'processing':
                return <span className="badge badge-warning">Processing</span>;
            case 'failed':
                return <span className="badge badge-danger">Failed</span>;
            default:
                return <span className="badge badge-neutral">Pending</span>;
        }
    };

    if (loading) {
        return (
            <div className="history-page">
                <div className="container">
                    <div className="loading-state">
                        <div className="loader"></div>
                        <p>Loading your history...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="history-page">
            <div className="container">
                <div className="history-header">
                    <h1>Your History</h1>
                    <p className="text-muted">View all your analyzed videos</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                {videos.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📭</div>
                        <h3>No videos yet</h3>
                        <p>Upload your first video to start analyzing</p>
                        <Link to="/upload" className="btn btn-primary">
                            Upload Video
                        </Link>
                    </div>
                ) : (
                    <div className="videos-list">
                        {videos.map((video) => (
                            <div key={video.id} className="video-card">
                                <div className="video-info">
                                    <div className="video-icon">🎬</div>
                                    <div className="video-details">
                                        <h3>{video.originalFilename}</h3>
                                        <p className="video-date">{formatDate(video.uploadedAt)}</p>
                                    </div>
                                </div>

                                <div className="video-status">
                                    {getStatusBadge(video.analysisResult?.status || 'pending')}
                                </div>

                                <div className="video-result">
                                    {video.analysisResult?.status === 'completed' && (
                                        <>
                                            <div
                                                className="result-score"
                                                style={{
                                                    color: video.analysisResult.confidenceScore >= 50
                                                        ? 'var(--danger)'
                                                        : 'var(--success)'
                                                }}
                                            >
                                                {Math.round(video.analysisResult.confidenceScore)}%
                                            </div>
                                            <div className="result-label">
                                                {video.analysisResult.isLieDetected ? 'Deception' : 'Truthful'}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {video.isClaimed && (
                                    <span className="claimed-badge">Claimed</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
