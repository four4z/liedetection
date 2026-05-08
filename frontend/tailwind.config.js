/** @type {import('tailwindcss').Config} */
const config = {
    content: ["./**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                "dark-custom": "#1C1C1C",
            },
        },
    },
    plugins: [],
};

export default config;