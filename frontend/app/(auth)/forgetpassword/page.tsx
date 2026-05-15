"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

const getErrorMessage = (detail: unknown, fallback: string) => {
    if (typeof detail === "string" && detail.trim()) {
        return detail;
    }

    if (detail && typeof detail === "object") {
        const maybeMessage = (detail as { message?: unknown; detail?: unknown }).message;
        if (typeof maybeMessage === "string" && maybeMessage.trim()) {
            return maybeMessage;
        }
    }

    return fallback;
};

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async () => {
        if (!email.trim()) {
            toast.error("Please enter your email");
            return;
        }

        try {
            setLoading(true);
            await authApi.requestPasswordReset(email.trim());
            router.push(`/verifyotp?email=${encodeURIComponent(email.trim())}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : getErrorMessage(null, "Failed to send OTP");
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen">
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-full max-w-sm bg-dark-custom border border-dark-custom rounded-3xl shadow-lg p-12 text-white">
                    <Link href="/Login" className="flex items-center mb-6">
                        <Icon icon="weui:back-outlined" width="12" height="24" />
                    </Link>

                    <div className="flex justify-center mb-6">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                            icon
                        </div>
                    </div>

                    <h2 className="text-2xl font-semibold text-center mb-3">Forgot Password</h2>
                    <p className="text-sm text-center text-white/60 mb-6">
                        Enter your email and we will send you an OTP.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-white/70">Email</label>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full rounded-xl bg-dark-secondary py-2 mt-4 text-sm font-medium cursor-pointer hover:bg-dark-secondary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Sending OTP..." : "Send OTP"}
                        </button>
                    </div>

                    <p className="mt-6 text-center text-sm text-white/60">
                        Remember your password?{" "}
                        <Link href="/Login" className="text-blue-400 hover:underline cursor-pointer">
                            Login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}