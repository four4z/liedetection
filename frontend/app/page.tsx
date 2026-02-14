"use client";
import React from "react";
import Image from "next/image";
import Footer from "./component/Footer";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="bg-dark-gradient min-h-screen text-white relative overflow-hidden">
        <div className="sphere sphere1"></div>
        <div className="sphere sphere2"></div>
        <div className="sphere sphere3"></div>

        <div className="w-full px-36 p-5 ">
          <div className="flex justify-between ">
            <div>◉ LieDetect</div>
            <div className="flex gap-4">
              {/* <Link href="/authPage">
                <button className="cursor-pointer p-2 px-6 rounded-xl duration-300 hover:text-blue-200">
                  Sign in
                </button>
              </Link> */}
              <Link href="/authPage">
                <button className="cursor-pointer border-glass-custom bg-glass-custom p-2 px-6 rounded-xl duration-300 hover:text-blue-200 hover:border-blue-200">Sign in</button>
              </Link>
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
                to detect <br/> potential signs of deception.
              </p>
              <div className="hero-actions">
                <Link href="/mainPage" className="btn-main btn-lg">
                  Start Analysis →
                </Link>
                <Link href="/authPage" className="btn-primary btn-lg">
                  Access Account
                </Link>
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
