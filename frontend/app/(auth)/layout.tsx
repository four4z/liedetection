import React from "react";

export default function AuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="bg-dark-gradient min-h-screen text-white relative overflow-hidden">
            <div className="sphere sphere1" />
            <div className="sphere sphere2" />
            <div className="sphere sphere3" />

            <main className="relative z-10 min-h-screen">
                {children}
            </main>
        </div>
    );
}