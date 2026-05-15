"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";

interface RenameModalProps {
    isOpen: boolean;
    currentTitle: string;
    onClose: () => void;
    onConfirm: (newTitle: string) => Promise<void>;
    isLoading?: boolean;
}

export default function RenameModal({
    isOpen,
    currentTitle,
    onClose,
    onConfirm,
    isLoading = false,
}: RenameModalProps) {
    const [newTitle, setNewTitle] = useState(currentTitle);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setNewTitle(currentTitle);
        setError(null);
    }, [currentTitle, isOpen]);

    const handleConfirm = async () => {
        if (!newTitle.trim()) {
            setError("Video title cannot be empty");
            return;
        }

        if (newTitle.trim() === currentTitle) {
            setError("Please enter a different title");
            return;
        }

        try {
            setError(null);
            await onConfirm(newTitle.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to rename video");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            void handleConfirm();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md mx-4 rounded-lg  bg-greay-custom p-6 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <Icon icon="mdi:pencil" width="24" height="24" />
                        Rename Video
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <Icon icon="mdi:close" width="24" height="24" />
                    </button>
                </div>

                {/* Body */}
                <div className="space-y-4">


                    <div>
                        <label className="block text-sm text-gray-300 mb-2">
                            New title
                        </label>
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            placeholder="Enter new video title"
                            className="w-full px-3 py-2 rounded-lg bg-black/30  text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                            <Icon
                                icon="mdi:alert-circle"
                                width="18"
                                height="18"
                                className="text-red-400 mt-0.5 shrink-0"
                            />
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-white transition-colors disabled:opacity-50 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                Renaming...
                            </>
                        ) : (
                            <>
                                <Icon icon="mdi:check" width="18" height="18" />
                                Rename
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
