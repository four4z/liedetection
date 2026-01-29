import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sessionToken, setSessionToken] = useState(() => {
        return localStorage.getItem('sessionToken') || null;
    });

    // Check if user is logged in on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            authService.getMe()
                .then(userData => setUser(userData))
                .catch(() => {
                    localStorage.removeItem('token');
                    setUser(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    // Generate session token for anonymous users
    useEffect(() => {
        if (!sessionToken) {
            const newToken = crypto.randomUUID();
            setSessionToken(newToken);
            localStorage.setItem('sessionToken', newToken);
        }
    }, [sessionToken]);

    const login = async (email, password) => {
        const { access_token } = await authService.login(email, password);
        localStorage.setItem('token', access_token);
        const userData = await authService.getMe();
        setUser(userData);
        return userData;
    };

    const register = async (username, email, password) => {
        const { access_token } = await authService.register(username, email, password);
        localStorage.setItem('token', access_token);
        const userData = await authService.getMe();
        setUser(userData);
        return userData;
    };

    const loginWithGoogle = async (credential) => {
        const { access_token } = await authService.googleAuth(credential);
        localStorage.setItem('token', access_token);
        const userData = await authService.getMe();
        setUser(userData);
        return userData;
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    const isAuthenticated = !!user;

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAuthenticated,
            sessionToken,
            login,
            register,
            loginWithGoogle,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
