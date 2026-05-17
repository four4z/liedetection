"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import React, { useState } from "react";
import Image from "next/image";
import icon from "../public/img/ICON.png"

const quickStats = [
  { value: "3 steps", label: "Upload, analyze, review" },
  { value: "Private", label: "Secure handling of media files" },
  { value: "Fast", label: "Designed for quick decisions" },
];

const flowSteps = [
  {
    icon: "mdi:upload",
    title: "Upload video",
    description:
      "Drop in a clip from your device and start the analysis with a single click.",
  },
  {
    icon: "mdi:brain",
    title: "AI body-language scan",
    description:
      "The model inspects pose and movement patterns to surface potential signals.",
  },
  {
    icon: "mdi:chart-line",
    title: "Read the results",
    description:
      "See a focused summary with timeline highlights and actionable insights.",
  },
];

const featureCards = [
  {
    icon: "mdi:shield-lock-outline",
    title: "Privacy-first flow",
    description:
      "Analyze files without exposing extra context and keep control over your history.",
  },
  {
    icon: "mdi:camera-iris",
    title: "Body-language centered",
    description:
      "Built around pose detection so the result stays focused on visible behavior.",
  },
  {
    icon: "mdi:history",
    title: "Session history",
    description:
      "Signed-in users can revisit past analyses and compare outcomes over time.",
  },
  {
    icon: "mdi:devices",
    title: "Works on any screen",
    description:
      "Responsive layout keeps the experience usable on desktop, tablet, and mobile.",
  },
];

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

  const sections = [
    { label: "How it works", href: "#how-it-works" },
    { label: "Features", href: "#features" },
    { label: "Privacy", href: "#privacy" },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08111f] text-white scroll-smooth">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(244,114,182,0.14),transparent_26%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.12),transparent_28%)]" />
      <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)] bg-size-[72px_72px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl sm:px-5">
          <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-[0.24em] text-white/90 uppercase">
            <div className="">
                        <Image
                            src={icon}
                            alt="Forgot Password"
                            width={34}
                            height={34}
                            className=" rounded-full"
                        />
                    </div>
            <span className="hidden sm:block">LieDetect</span>
          </Link>

          <nav className="hidden gap-8 text-sm text-white/70 md:flex">
            {sections.map((section) => (
              <a key={section.href} href={section.href} className="transition-colors hover:text-white">
                {section.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={togglePopup}
                  className="flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-2 py-2 text-left transition hover:border-white/20 hover:bg-white/10"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-orange-400 to-amber-500 font-extrabold text-slate-950 uppercase">
                    {displayInitial}
                  </div>
                  <div className="hidden pr-2 sm:block">
                    <div className="text-sm font-medium text-white">{displayName}</div>
                    <div className="text-xs text-white/55">Signed in</div>
                  </div>
                </button>

                {openPopup && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
                    <div className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/40">Account</div>
                    <Link href="/history" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/8 hover:text-white">
                      <Icon icon="mdi:history" width="18" height="18" />
                      <span>View history</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/8 hover:text-white"
                    >
                      <Icon icon="mdi:logout" width="18" height="18" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/Login"
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-white/85 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  href="/Register"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:py-16">
          <div className="relative max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
              Single-page analysis dashboard
            </div>

            <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
              Detect lies through
              <span className="block bg-linear-to-r from-cyan-300 via-white to-sky-300 bg-clip-text text-transparent">
                body language
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-white/72 sm:text-lg">
              Upload a video, let the AI study motion and posture patterns, and get a concise view of potential deception cues in one flowing page.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/main"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-100"
              >
                Start analysis
                <Icon icon="mdi:arrow-right" width="18" height="18" className="ml-2" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/5 px-6 py-3.5 text-sm font-medium text-white/82 transition hover:border-white/25 hover:bg-white/10"
              >
                See how it works
              </a>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {quickStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-xl">
                  <div className="text-lg font-semibold text-white">{stat.value}</div>
                  <div className="mt-1 text-sm text-white/55">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-10 top-12 h-28 w-28 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="absolute -right-6 bottom-8 h-32 w-32 rounded-full bg-pink-400/20 blur-3xl" />

            <div className="relative overflow-hidden rounded-4xl border border-white/10 bg-slate-950/65 p-5 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-6">
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-white/42">Live overview</div>
                  <div className="mt-1 text-lg font-semibold text-white">Ready to analyze</div>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Secure mode on
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Confidence signals</span>
                    <span className="text-xs text-white/45">Preview</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Posture shifts", value: "81%" },
                      { label: "Hand movement", value: "73%" },
                      { label: "Eye contact changes", value: "68%" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-xs text-white/55">
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/8">
                          <div className="h-full rounded-full bg-linear-to-r from-cyan-300 to-sky-500" style={{ width: item.value }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-white/42">Output</div>
                    <div className="mt-2 text-2xl font-bold text-white">Focused summary</div>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Review key moments without jumping across multiple pages.
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-linear-to-br from-cyan-400/14 to-white/6 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Signal status</div>
                    <div className="mt-2 text-2xl font-bold text-white">Analysis ready</div>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Built for quick triage, follow-up review, and easy comparison.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-t border-white/8 py-16 sm:py-20">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/75">How it works</div>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">A single page that explains the full flow</h2>
            <p className="mt-4 text-white/65">
              The page guides the user from upload to result without switching context.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {flowSteps.map((step, index) => (
              <div key={step.title} className="rounded-[1.6rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                    <Icon icon={step.icon} width="24" height="24" />
                  </div>
                  <div className="text-sm font-semibold text-white/35">0{index + 1}</div>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/62">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="scroll-mt-24 border-t border-white/8 py-16 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div className="max-w-xl">
              <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/75">Features</div>
              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Designed to feel like one focused product page</h2>
              <p className="mt-4 text-white/65">
                The visuals stay consistent and minimal while still giving enough structure to scan quickly.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {featureCards.map((feature) => (
                <article key={feature.title} className="rounded-3xl border border-white/10 bg-white/6 p-5 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/8">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-300/20 to-white/10 text-cyan-100">
                    <Icon icon={feature.icon} width="22" height="22" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/62">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="privacy" className="scroll-mt-24 border-t border-white/8 py-16 sm:py-20">
          <div className="rounded-4xl border border-white/10 bg-linear-to-r from-white/8 via-white/5 to-cyan-300/10 p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-white/55">Privacy</div>
                <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Keep the experience simple and trustworthy</h2>
                <p className="mt-4 max-w-2xl text-white/68">
                  The page keeps the user oriented with a clear call to action, a compact account menu, and explicit notes about secure handling.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  ["01", "One clear path to start"],
                  ["02", "No extra navigation noise"],
                  ["03", "Fast access to history"],
                ].map(([number, label]) => (
                  <div key={number} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/60">{number}</div>
                    <div className="mt-1 text-sm text-white/82">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/8 py-6 text-sm text-white/50">
          LieDetect. Single-page landing experience.
        </footer>
      </div>
    </main>
  );
}
