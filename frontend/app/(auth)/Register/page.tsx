"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";

function page() {

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
                        Register
                    </h2>

                    <div className="space-y-4">

                        <div>
                            <label className="text-sm text-white/70">Email</label>
                            <input
                                type="text"
                                placeholder="Email"
                                className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-white/70">Username</label>
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

                    </div>

                    <button className="w-full rounded-xl bg-dark-secondary py-2 mt-8 text-sm font-medium cursor-pointer hover:bg-dark-secondary-hover transition">
                        Sign Up
                    </button>

                    <p className="mt-6 text-center text-sm text-white/60">
                        Already have an account?{" "}
                        <Link href="/Login"
                            className="text-blue-400 hover:underline cursor-pointer">
                            Login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default page