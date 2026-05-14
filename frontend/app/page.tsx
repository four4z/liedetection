"use client";

import Footer from "./component/Footer";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import React, { useState } from "react";

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const displayName = user?.username?.trim() || "User";
  const displayInitial = (Array.from(displayName)[0] || "U").toUpperCase();
  const [openPopup, setOpenPopup] = useState(false);

  const togglePopup = () => {
    setOpenPopup((prev) => !prev);
  };

  const handleLogout = () => {
    logout();
    setOpenPopup(false);
    router.push("/");
  };
  return (
    <>
      <div className="bg-dark-gradient min-h-screen text-white relative overflow-hidden">
        <div className="sphere sphere1"></div>
        <div className="sphere sphere2"></div>
        <div className="sphere sphere3"></div>

        <div className="w-full px-36 p-5 ">
          <div className="flex justify-between ">
            <h2 className=" text-xl">◉ LieDetect</h2>
            <div className="flex gap-4 items-center">
              {user ? (
                <div className="relative">
                  <button
                    onClick={togglePopup}
                    className="flex items-center  rounded-xl hover:opacity-90 transition-opacity"
                  >
                    <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-[#ff7a00] text-white font-extrabold text-lg leading-none uppercase">
                      {displayInitial}
                    </div>
               
                  </button>

                  {openPopup && (
                    <div className="absolute top-full right-0 mt-2 bg-white text-black p-2 rounded-lg shadow-xl z-50 w-40">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-slate-200"
                      >
                        <Icon icon="mdi:logout" width="20" height="20" />
                        <span className="text-sm">Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link href="/Login">
                    <button className="cursor-pointer border-glass-custom bg-glass-custom p-2 px-6 rounded-xl duration-300 hover:text-blue-200 hover:border-blue-200">Sign in</button>
                  </Link>
                  <Link href="/Register">
                    <button className="cursor-pointer border-glass-custom bg-white text-black p-2 px-6 rounded-xl duration-300 hover:bg-white/80">Sign up</button>
                  </Link>
                </>
              )}
            </div>
            
          </div>
        </div>

        <div>
          <div className="flex justify-center">
            <div className="text-center">
              <h1 className="hero-title pt-24 ">
                Detect Lies Through
                <span className="hero-highlight"> Body Language</span>
              </h1>
              <p className="hero-subtitle">
                Upload a video and our AI will analyze body language patterns
                to detect <br /> potential signs of deception.
              </p>
              <div>
                <div className="hero-actions">
                  <Link href="/main" className="btn-main btn-lg">
                    Start Analysis →
                  </Link>
                </div>
              </div>

              <div className="hero-visual flex justify-center items-center mt-16">
                <div className="visual-card mx-5">
                  <div className="visual-icon">🎥</div>
                  <div className="visual-step">1. Upload Video</div>
                </div>
                <div className="visual-arrow">→</div>
                <div className="visual-card mx-5">
                  <div className="visual-icon">🤖</div>
                  <div className="visual-step">2. AI Analysis</div>
                </div>
                <div className="visual-arrow">→</div>
                <div className="visual-card mx-5">
                  <div className="visual-icon">📊</div>
                  <div className="visual-step">3. Get Results</div>
                </div>
              </div>

              <div className="pt-10">
                <h2 className="section-title">How It Works</h2>
                <div className="features-grid">
                  <div className="feature-card">
                    <div className="feature-icon">🧠</div>
                    <h3>AI-Powered Analysis</h3>
                    <p>Uses MediaPipe pose detection to analyze body language patterns in real-time.</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">👤</div>
                    <h3>No Login Required</h3>
                    <p>Upload and analyze videos anonymously. Create an account to save your history.</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">📱</div>
                    <h3>Works Anywhere</h3>
                    <p>Upload videos from any device. MP4, AVI, MOV, WebM, and MKV supported.</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">🔒</div>
                    <h3>Privacy First</h3>
                    <p>Your videos are analyzed securely and can be deleted at any time.</p>
                  </div>
                </div>
              </div>
              

            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
