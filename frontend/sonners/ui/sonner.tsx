"use client";
import { Toaster as SonnerToaster, toast } from "sonner";
import React from "react";

export default function Toaster() {
  return (
    <SonnerToaster
      richColors
      position="top-center"
      // closeButton
      theme="dark"
    />
  );
}

export { toast };
