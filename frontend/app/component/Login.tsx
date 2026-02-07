"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Register from "./Register";

type AuthMode = "login" | "register";

function Login() {
    const [mode, setMode] = useState<AuthMode>("login");
    return (
        
        <div className="min-h-screen flex items-center justify-center ">
            {mode === "login" ? (
            <div className="w-full max-w-sm bg-dark-custom border border-dark-custom rounded-3xl shadow-lg p-12 text-white">

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

                    <button className="w-full rounded-xl bg-dark-secondary py-2 mt-4 text-sm font-medium cursor-pointer hover:bg-dark-secondary-hover transition">
                        Sign In
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
                        <span

                            onClick={() => setMode("register")}
                            className="text-blue-400 hover:underline cursor-pointer">
                            Register for free
                        </span>
                    </p>
                </div>
            ) : (
                 <Register setMode={setMode} />
            )}
        </div>

    );
}

export default Login;