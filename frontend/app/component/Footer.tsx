import React from 'react'

function Footer() {
    return (
        <footer id="footer" className="mt-20 border-t border-white/10 pt-6 pb-12 text-sm text-white/70">
            <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>© {new Date().getFullYear()} LieDetection — All rights reserved</div>
                <div className="flex gap-4">
                    <a href="#" className="hover:underline">About</a>
                    <a href="#" className="hover:underline">Privacy</a>
                    <a href="#" className="hover:underline">GitHub</a>
                </div>
            </div>
        </footer>
    )
}

export default Footer