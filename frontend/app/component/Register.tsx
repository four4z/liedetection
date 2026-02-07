"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

type RegisterProps = {
    setMode: (mode: "login" | "register") => void;
};
function Register({ setMode }: RegisterProps) {

    return (
        <div className="min-h-screen flex items-center justify-center ">
            <div className="w-full max-w-sm bg-dark-custom border border-dark-custom rounded-3xl shadow-lg p-12 text-white">

                <div className="flex justify-center mb-6">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                        icon
                    </div>
                </div>

                <h2 className="text-2xl font-semibold text-center mb-6">
                    Register
                </h2>

                <div className="space-y-4">

                    <div>
                        <label className="text-sm text-white/70">Email</label>
                        <input
                            type="text"
                            placeholder="Username"
                            className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                        />
                    </div>

                    <div>
                        <label className="text-sm text-white/70">Password</label>
                        <input
                            type="password"
                            placeholder="Password"
                            className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-white/70">Confirm Password</label>
                        <input
                            type="password"
                            placeholder="Password"
                            className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                        />
                    </div>

                    <button className="w-full rounded-xl bg-dark-secondary py-2 mt-4 text-sm font-medium cursor-pointer hover:bg-dark-secondary-hover transition">
                        Sign Up
                    </button>
                </div>


                <p className="mt-6 text-center text-sm text-white/60">
                    Already have an account?{" "}
                    <span
                        onClick={() => setMode("login")}
                        className="text-blue-400 hover:underline cursor-pointer">
                        Login
                    </span>
                </p>
            </div>
        </div>
    )
}

export default Register