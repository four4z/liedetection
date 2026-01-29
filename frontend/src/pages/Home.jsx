import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

export default function Home() {
    const { isAuthenticated } = useAuth();

    return (
        <div className="home-page">
            <section className="hero">
                <div className="container">
                    <div className="hero-content">
                        <h1 className="hero-title">
                            Detect Lies Through
                            <span className="hero-highlight"> Body Language</span>
                        </h1>
                        <p className="hero-subtitle">
                            Upload a video and our AI will analyze body language patterns
                            to detect potential signs of deception.
                        </p>
                        <div className="hero-actions">
                            <Link to="/upload" className="btn btn-primary btn-lg">
                                Start Analysis →
                            </Link>
                            {!isAuthenticated && (
                                <Link to="/register" className="btn btn-outline btn-lg">
                                    Create Account
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="visual-card">
                            <div className="visual-icon">🎥</div>
                            <div className="visual-step">1. Upload Video</div>
                        </div>
                        <div className="visual-arrow">→</div>
                        <div className="visual-card">
                            <div className="visual-icon">🤖</div>
                            <div className="visual-step">2. AI Analysis</div>
                        </div>
                        <div className="visual-arrow">→</div>
                        <div className="visual-card">
                            <div className="visual-icon">📊</div>
                            <div className="visual-step">3. Get Results</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="features">
                <div className="container">
                    <h2 className="section-title">How It Works</h2>
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">🧠</div>
                            <h3>AI-Powered Analysis</h3>
                            <p>Uses MediaPipe pose detection to analyze body language patterns in real-time.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">👤</div>
                            <h3>No Login Required</h3>
                            <p>Upload and analyze videos anonymously. Create an account to save your history.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">📱</div>
                            <h3>Works Anywhere</h3>
                            <p>Upload videos from any device. MP4, AVI, MOV, WebM, and MKV supported.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🔒</div>
                            <h3>Privacy First</h3>
                            <p>Your videos are analyzed securely and can be deleted at any time.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="cta">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Analyze?</h2>
                        <p>Upload your first video and see the results in minutes.</p>
                        <Link to="/upload" className="btn btn-primary btn-lg">
                            Upload Video
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
