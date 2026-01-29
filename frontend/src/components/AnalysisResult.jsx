import './AnalysisResult.css';

export default function AnalysisResult({ result, videoName }) {
    if (!result) return null;

    const { isLieDetected, confidenceScore, status, indicators } = result;

    const getStatusBadge = () => {
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

    const getResultColor = () => {
        if (confidenceScore >= 70) return 'var(--danger)';
        if (confidenceScore >= 40) return 'var(--warning)';
        return 'var(--success)';
    };

    if (status === 'processing') {
        return (
            <div className="analysis-result processing">
                <div className="loader"></div>
                <p>Analyzing video...</p>
                <p className="text-sm text-muted">This may take a few moments</p>
            </div>
        );
    }

    if (status === 'failed') {
        return (
            <div className="analysis-result failed">
                <div className="result-icon">❌</div>
                <p>Analysis failed</p>
                <p className="text-sm text-muted">Please try uploading again</p>
            </div>
        );
    }

    if (status !== 'completed') {
        return null;
    }

    return (
        <div className="analysis-result completed animate-fadeIn">
            <div className="result-header">
                <h3>{videoName}</h3>
                {getStatusBadge()}
            </div>

            <div className="result-main">
                <div
                    className="confidence-circle"
                    style={{ '--score-color': getResultColor() }}
                >
                    <div className="confidence-value">{Math.round(confidenceScore)}%</div>
                    <div className="confidence-label">Confidence</div>
                </div>

                <div className="result-verdict">
                    {isLieDetected ? (
                        <>
                            <span className="verdict-icon">⚠️</span>
                            <span className="verdict-text danger">Potential Deception Detected</span>
                        </>
                    ) : (
                        <>
                            <span className="verdict-icon">✓</span>
                            <span className="verdict-text success">No Deception Detected</span>
                        </>
                    )}
                </div>
            </div>

            {indicators && (
                <div className="result-indicators">
                    <h4>Analysis Breakdown</h4>
                    <div className="indicator">
                        <span className="indicator-label">Fidget Level</span>
                        <div className="progress">
                            <div
                                className="progress-bar"
                                style={{
                                    width: `${indicators.fidgetLevel}%`,
                                    backgroundColor: indicators.fidgetLevel > 50 ? 'var(--danger)' : 'var(--success)'
                                }}
                            />
                        </div>
                        <span className="indicator-value">{indicators.fidgetLevel}%</span>
                    </div>
                    <div className="indicator">
                        <span className="indicator-label">Face Touch</span>
                        <div className="progress">
                            <div
                                className="progress-bar"
                                style={{
                                    width: `${indicators.faceTouchLevel}%`,
                                    backgroundColor: indicators.faceTouchLevel > 50 ? 'var(--danger)' : 'var(--success)'
                                }}
                            />
                        </div>
                        <span className="indicator-value">{indicators.faceTouchLevel}%</span>
                    </div>
                    <div className="indicator">
                        <span className="indicator-label">Posture Change</span>
                        <div className="progress">
                            <div
                                className="progress-bar"
                                style={{
                                    width: `${indicators.postureChangeLevel}%`,
                                    backgroundColor: indicators.postureChangeLevel > 50 ? 'var(--danger)' : 'var(--success)'
                                }}
                            />
                        </div>
                        <span className="indicator-value">{indicators.postureChangeLevel}%</span>
                    </div>
                </div>
            )}

            <p className="disclaimer">
                ⚠️ This analysis is for entertainment purposes only. Lie detection through body language is not scientifically reliable.
            </p>
        </div>
    );
}
