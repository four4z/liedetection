"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

interface SidebarProps {
    children?: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openPopup, setOpenPopup] = useState(false);
    const pathname = usePathname();
    const { user, logout, isLoading } = useAuth();

    const togglePopup = () => {
        setOpenPopup((prev) => !prev);
    };

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen((prev) => !prev);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    const handleLogout = () => {
        logout();
        togglePopup();
        // router.push("/Login");
    };

    const menuItems = [
        {
            label: "Home",
            href: "/main",
            icon: "mdi:home",
        },
        {
            label: "List",
            href: "/list",
            icon: "lucide:list-video",
        },
        {
            label: "History",
            href: "/history",
            icon: "mdi:history",
        },
    ];

    const isActive = (href: string) => pathname === href;

    const sidebarContent = (
        <>
            <div className="flex items-center justify-between p-4 border-b border-greay-custom">
                {isOpen && (
                    <Link href="/" className="text-lg font-bold whitespace-nowrap" onClick={closeMobileMenu}>LieDetect</Link>
                )}
                <button
                    onClick={toggleSidebar}
                    className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg hover:bg-slate-700 transition-colors duration-200 shrink-0"
                    title={isOpen ? "Close sidebar" : "Open sidebar"}
                >
                    <Icon
                        icon={isOpen ? "mdi:chevron-left" : "mdi:chevron-right"}
                        width="24"
                        height="24"
                    />
                </button>
                <button
                    onClick={closeMobileMenu}
                    className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-slate-700 transition-colors duration-200 shrink-0"
                    title="Close menu"
                >
                    <Icon icon="mdi:close" width="24" height="24" />
                </button>
            </div>

            <nav className="flex-1 px-3 py-6 space-y-3">
                {menuItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobileMenu}
                        className={`flex items-center gap-4 px-3 py-3 rounded-lg transition-colors duration-200 ${isActive(item.href)
                            ? "bg-greay-custom text-white"
                            : "hover:bg-slate-700"
                            }`}
                        title={!isOpen ? item.label : ""}
                    >
                        <Icon
                            icon={item.icon}
                            width="24"
                            height="24"
                            className="shrink-0"
                        />
                        {isOpen && (
                            <span className="whitespace-nowrap text-sm font-medium">
                                {item.label}
                            </span>
                        )}
                    </Link>
                ))}
            </nav>

            <div className="border-t border-greay-custom p-4">
                {user ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Icon
                                icon="mdi:account-circle"
                                width="32"
                                height="32"
                                className="shrink-0 text-white"
                            />
                            {isOpen && (
                                <span className="whitespace-nowrap text-sm font-medium">
                                    {isLoading ? "Loading..." : user?.email || "no token"}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            {isOpen && (
                                <>
                                    <button
                                        onClick={togglePopup}
                                        className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
                                    >
                                        <Icon
                                            icon="mdi:dots-vertical"
                                            width="24"
                                            height="24"
                                            className="text-white"
                                        />
                                    </button>

                                    {openPopup && (
                                        <div className="absolute bottom-full right-0 mb-2 bg-white text-black p-2 rounded-lg shadow-xl z-50 w-40">
                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-slate-200"
                                            >
                                                <Icon icon="mdi:logout" width="20" height="20" />
                                                <span className="text-sm">Logout</span>
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col justify-center items-center gap-4">
                        <Link
                            href="/Login"
                            onClick={closeMobileMenu}
                            className="flex justify-center items-center gap-3 py-3 w-full bg-greay-custom p-2 rounded-xl duration-300 hover:text-blue-200 hover:border-blue-200"
                        >
                            <Icon icon="material-symbols:login" width="24" height="24" />
                            {isOpen && (
                                <span className="whitespace-nowrap text-sm font-medium">
                                    {isLoading ? "Loading..." : "Sign in"}
                                </span>
                            )}
                        </Link>
                    </div>
                )}
            </div>
        </>
    );

    return (
        <div className="flex h-screen overflow-x-hidden">
            <div className={`hidden md:flex shadow-2xl text-white transition-all duration-300 ease-in-out overflow-hidden flex-col shrink-0 ${isOpen ? "w-64" : "w-fit"}`}>
                {sidebarContent}
            </div>

            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={closeMobileMenu} />
            )}

            <div
                className={`fixed top-0 left-0 z-40 h-screen w-72 bg-main-custom text-white shadow-2xl transition-transform duration-300 md:hidden ${
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="flex h-full flex-col">{sidebarContent}</div>
            </div>

            <div className="flex-1 min-w-0 overflow-auto bg-main-custom">
                <div className="sticky top-0 z-20 flex items-center justify-between border-b border-greay-custom bg-main-custom p-3 md:hidden">
                    <button
                        onClick={toggleMobileMenu}
                        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-slate-700 transition-colors duration-200"
                        title="Open menu"
                    >
                        <Icon icon="mdi:menu" width="24" height="24" className="text-white" />
                    </button>
                    <span className="text-white font-semibold">LieDetect</span>
                    <div className="w-10 h-10" />
                </div>
                {children}
            </div>
        </div>
    );
}
