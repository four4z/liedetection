import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
    const { theme, toggleTheme } = useTheme();
    const { user, isAuthenticated, logout } = useAuth();

    return (
        <nav className="navbar">
            <div className="container navbar-content">
                <Link to="/" className="navbar-brand">
                    <span className="brand-icon">◉</span>
                    <span className="brand-text">LieDetect</span>
                </Link>

                <div className="navbar-links">
                    <Link to="/" className="nav-link">Home</Link>
                    <Link to="/upload" className="nav-link">Upload</Link>
                    {isAuthenticated && (
                        <Link to="/history" className="nav-link">History</Link>
                    )}
                </div>

                <div className="navbar-actions">
                    <button
                        className="btn btn-icon theme-toggle"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>

                    {isAuthenticated ? (
                        <div className="user-menu">
                            <span className="user-name">{user?.username}</span>
                            <button className="btn btn-secondary" onClick={logout}>
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="auth-buttons">
                            <Link to="/login" className="btn btn-secondary">Login</Link>
                            <Link to="/register" className="btn btn-primary">Sign Up</Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
