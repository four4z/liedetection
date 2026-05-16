"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import icon from "../../../public/img/ICON.png";

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

type VerifyOtpClientProps = {
    initialEmail: string;
};

export default function VerifyOtpClient({ initialEmail }: VerifyOtpClientProps) {
    const router = useRouter();
    const [email, setEmail] = useState(initialEmail);
    const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        setEmail(initialEmail);
    }, [initialEmail]);

    const otpCode = otpDigits.join("");

    const focusOtpInput = (index: number) => {
        otpInputRefs.current[index]?.focus();
    };

    const handleOtpChange = (index: number, value: string) => {
        const nextDigit = value.replace(/\D/g, "").slice(-1);

        setOtpDigits((current) => {
            const nextDigits = [...current];
            nextDigits[index] = nextDigit;
            return nextDigits;
        });

        if (nextDigit && index < otpInputRefs.current.length - 1) {
            focusOtpInput(index + 1);
        }
    };

    const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
            focusOtpInput(index - 1);
        }
    };

    const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedValue = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

        if (!pastedValue) {
            return;
        }

        event.preventDefault();

        const nextDigits = Array.from({ length: 6 }, (_, index) => pastedValue[index] || "");
        setOtpDigits(nextDigits);

        const nextFocusIndex = Math.min(pastedValue.length, 5);
        focusOtpInput(nextFocusIndex);
    };

    const handleSubmit = async () => {
        if (!email.trim() || otpCode.length !== 6) {
            toast.error("Please enter email and OTP");
            return;
        }

        try {
            setLoading(true);
            const data = await authApi.verifyPasswordResetOtp(email.trim(), otpCode);
            router.push(`/resetpassword?token=${encodeURIComponent(data.reset_token)}&email=${encodeURIComponent(email.trim())}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : getErrorMessage(null, "OTP verification failed");
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!email.trim()) {
            toast.error("Email is missing. Please go back and enter your email again.");
            return;
        }

        try {
            setResending(true);
            await authApi.requestPasswordReset(email.trim());
            toast.success(`OTP sent again to ${email.trim()}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : getErrorMessage(null, "Failed to resend OTP");
            toast.error(message);
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen">
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-full max-w-sm bg-dark-custom border border-dark-custom rounded-3xl shadow-lg p-12 text-white">
                    <Link href="/forgetpassword" className="flex items-center mb-6">
                        <Icon icon="weui:back-outlined" width="12" height="24" />
                    </Link>

                    <div className="flex justify-center mb-6">
                        <Image
                            src={icon}
                            alt="Verify OTP"
                            width={48}
                            height={48}
                            className="rounded-full"
                        />
                    </div>

                    <h2 className="text-2xl font-semibold text-center mb-3">Verify OTP</h2>
                    <p className="text-sm text-center text-white/60 mb-6">
                        Enter the code sent to your email.
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

                        <div>
                            <label className="text-sm text-white/70">OTP</label>
                            <div className="flex gap-2">
                                {otpDigits.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => {
                                            if (el) otpInputRefs.current[index] = el;
                                        }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        onPaste={handleOtpPaste}
                                        className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 text-center text-white font-semibold focus:outline-none focus:ring-2 focus:ring-white/30"
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading || otpCode.length !== 6}
                            className="w-full rounded-xl bg-dark-secondary py-2 mt-4 text-sm font-medium cursor-pointer hover:bg-dark-secondary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Verifying..." : "Verify OTP"}
                        </button>
                    </div>

                    <p className="mt-6 text-center text-sm text-white/60">
                        Need a new code?{" "}
                        <button
                            onClick={handleResend}
                            disabled={resending}
                            className="text-blue-400 hover:underline cursor-pointer disabled:opacity-50"
                        >
                            {resending ? "Sending..." : "Resend"}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
