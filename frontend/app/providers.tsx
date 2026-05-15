"use client";

import { AuthProvider } from "@/lib/auth";
import { ReactNode } from "react";
// Toaster is mounted at the root layout via components/ui/sonner

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
