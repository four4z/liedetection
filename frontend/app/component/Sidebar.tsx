"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

interface SidebarProps {
    children?: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [openPopup, setOpenPopup] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, isLoading } = useAuth();

    const togglePopup = () => {
        setOpenPopup((prev) => !prev);
    };

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
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
            label: "รายการ",
            href: "/list",
            icon: "lucide:list-video",
        },
    ];

    const isActive = (href: string) => pathname === href;

    return (
        // outer flex container hides any x‑overflow and allows children to shrink properly
        <div className="flex h-screen overflow-x-hidden">

            <div
                className={` shadow-2xl text-white transition-all duration-300 ease-in-out overflow-hidden  flex flex-col shrink-0 ${isOpen ? "w-64" : "w-fit"
                    }`}
            >

                <div className="flex items-center justify-between p-4 border-b border-greay-custom">
                    {isOpen && (
                        <Link href="/" className="text-lg font-bold whitespace-nowrap">LieDetect</Link>
                    )}
                    <button
                        onClick={toggleSidebar}
                        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-slate-700 transition-colors duration-200 shrink-0"
                        title={isOpen ? "Close sidebar" : "Open sidebar"}
                    >
                        <Icon
                            icon={isOpen ? "mdi:chevron-left" : "mdi:chevron-right"}
                            width="24"
                            height="24"
                        />
                    </button>
                </div>

                <nav className="flex-1 px-3 py-6 space-y-3">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
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

                {/* user/profile section */}
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
                                className="flex justify-center items-center gap-3 py-3 w-full bg-greay-custom p-2  rounded-xl duration-300 hover:text-blue-200 hover:border-blue-200"
                            >
                                <Icon icon="material-symbols:login" width="24" height="24"   />
                                {isOpen && (
                                    <span className="whitespace-nowrap text-sm font-medium">
                                        {isLoading ? "Loading..." : user?.username || user?.email || "Sign in"}
                                    </span>
                                )}
                            </Link>
                        </div>
                    )}

                </div>


            </div>


            <div className="flex-1 min-w-0 overflow-auto bg-main-custom">
                {children}
            </div>
        </div>
    );
}
