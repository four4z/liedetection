"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { clearToken, getToken } from "./token";

type UserType = {
    id?: string;
    email?: string;
    username?: string;
    [key: string]: any;
} | null;

type AuthContextType = {
    isLogin: boolean;
    token: string | null;
    user: UserType;
    loading: boolean;
    setUser: (user: UserType) => void;
    setTokenState: (token: string | null) => void;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
    isLogin: false,
    token: null,
    user: null,
    loading: true,
    setUser: () => {},
    setTokenState: () => {},
    logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setTokenState] = useState<string | null>(null);
    const [user, setUser] = useState<UserType>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = getToken();
        setTokenState(storedToken);
        setLoading(false);
    }, []);

    const logout = () => {
        clearToken();
        setTokenState(null);
        setUser(null);
        window.location.href = "/login";
    };

    return (
        <AuthContext.Provider
            value={{
                isLogin: !!token,
                token,
                user,
                loading,
                setUser,
                setTokenState,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}