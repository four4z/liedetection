"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

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

function page() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    const handleLogin = async () => {
        try {
            setIsLoading(true);
            const res = await fetch("http://127.0.0.1:8000/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    password,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(getErrorMessage(data.detail, "Login failed"));
            }

            // ✅ เรียก /me เพื่อได้ข้อมูล user
            const meRes = await fetch("http://127.0.0.1:8000/api/auth/me", {
                headers: {
                    Authorization: `Bearer ${data.access_token}`,
                },
            });

            const meData = await meRes.json();
            console.log("USER:", meData);

            // ✅ เก็บ token และ user ใน context
            login(data.access_token, meData);

            // ✅ redirect
            router.push("/");

        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsLoading(false);
        }
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
                        <button className=" rounded-full border border-white/20 p-2 text-sm hover:bg-white/10 transition">
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

export default page