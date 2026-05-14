"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

type GoogleCredentialResponse = {
    credential: string;
};

type GoogleIdInitializeConfig = {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    use_fedcm_for_prompt?: boolean;
};

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: GoogleIdInitializeConfig) => void;
                    prompt: () => void;
                };
            };
        };
    }
}

const getErrorMessage = (detail: unknown, fallback: string) => {
    if (typeof detail === "string" && detail.trim()) {
        return detail;
    }

    if (Array.isArray(detail)) {
        const message = detail
            .map((item) => {
                if (typeof item === "string") {
                    return item;
                }

                if (item && typeof item === "object") {
                    const maybeMessage = (item as { msg?: unknown }).msg;
                    if (typeof maybeMessage === "string") {
                        return maybeMessage;
                    }
                }

                return "";
            })
            .filter(Boolean)
            .join(", ");

        if (message) {
            return message;
        }
    }

    if (detail && typeof detail === "object") {
        const maybeMessage = (detail as { message?: unknown; detail?: unknown }).message;
        if (typeof maybeMessage === "string" && maybeMessage.trim()) {
            return maybeMessage;
        }
    }

    return fallback;
};

function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isGoogleReady, setIsGoogleReady] = useState(false);
    const hasInitializedGoogle = useRef(false);
    const { login } = useAuth();
    const router = useRouter();
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

    const handleGoogleCredential = useCallback(
        async (response: GoogleCredentialResponse) => {
            if (!response.credential) {
                alert("Google credential is missing");
                return;
            }

            try {
                setIsGoogleLoading(true);
                const data = await authApi.google(response.credential);
                const meData = await authApi.me(data.access_token);
                login(data.access_token, meData);
                router.push("/");
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : getErrorMessage(null, "Google login failed");
                alert(message);
            } finally {
                setIsGoogleLoading(false);
            }
        },
        [login, router]
    );

    useEffect(() => {
        if (!googleClientId || hasInitializedGoogle.current) {
            return;
        }

        const initializeGoogle = () => {
            if (!window.google?.accounts?.id) {
                return;
            }

            if (hasInitializedGoogle.current) {
                return;
            }

            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: handleGoogleCredential,
                // Fallback to non-FedCM flow when browsers fail to retrieve FedCM token.
                use_fedcm_for_prompt: false,
            });

            hasInitializedGoogle.current = true;
            setIsGoogleReady(true);
        };

        if (window.google?.accounts?.id) {
            initializeGoogle();
            return;
        }

        const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
        if (existingScript) {
            existingScript.addEventListener("load", initializeGoogle);
            return () => existingScript.removeEventListener("load", initializeGoogle);
        }

        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.addEventListener("load", initializeGoogle);
        document.head.appendChild(script);

        return () => script.removeEventListener("load", initializeGoogle);
    }, [googleClientId, handleGoogleCredential]);

    const handleLogin = async () => {
        try {
            setIsLoading(true);
            const data = await authApi.login(email, password);
            const meData = await authApi.me(data.access_token);
            console.log("USER:", meData);

            // ✅ เก็บ token และ user ใน context
            login(data.access_token, meData);

            // ✅ redirect
            router.push("/");

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : getErrorMessage(null, "Login failed");
            alert(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        if (!googleClientId) {
            alert("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured");
            return;
        }

        if (!isGoogleReady || !window.google?.accounts?.id) {
            alert("Google Sign-In is not ready yet");
            return;
        }

        window.google.accounts.id.prompt();
    };

    return (
        <div className=' flex justify-center items-center min-h-screen'>
            <div className="min-h-screen flex items-center justify-center ">
                <div className="w-full max-w-sm bg-dark-custom border border-dark-custom rounded-3xl shadow-lg p-12 text-white">
                    <Link href="/" className="flex items-center mb-6">
                        <Icon icon="weui:back-outlined" width="12" height="24" />
                    </Link>
                    <div className="flex justify-center mb-6">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                            icon
                        </div>
                    </div>

                    <h2 className="text-2xl font-semibold text-center mb-6">
                        Login
                    </h2>

                    <div className="space-y-4">

                        <div>
                            <label className="text-sm text-white/70">Email</label>
                            <input
                                type="text"
                                placeholder="Username"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-white/70">Password</label>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Link href="/forgetpassword" className="text-xs text-blue-400 hover:underline">
                                Forgot password?
                            </Link>
                        </div>

                        <button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className="w-full rounded-xl bg-dark-secondary py-2 mt-4 text-sm font-medium cursor-pointer hover:bg-dark-secondary-hover transition disabled:opacity-50 disabled:cursor-not-allowed">
                            {isLoading ? "Signing in..." : "Sign In"}
                        </button>
                    </div>

                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-px bg-white/20" />
                        <span className="text-sm text-white/50">OR</span>
                        <div className="flex-1 h-px bg-white/20" />
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={isGoogleLoading}
                            className="rounded-full border border-white/20 p-2 text-sm hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Icon icon="logos:google-icon" width="25" height="25" />
                        </button>
                    </div>


                    <p className="mt-6 text-center text-sm text-white/60">
                        Don’t have an account yet?{" "}
                        <Link href="/Register"
                            className="text-blue-400 hover:underline cursor-pointer">
                            Register
                        </Link>
                    </p>
                </div>

            </div>
        </div>
    )
}

export default LoginPage