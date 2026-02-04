/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            backgroundImage: {
                'dark-gradient-custom':
                    'linear-gradient(175deg, rgba(15, 23, 42, 1) 30%, rgba(23, 23, 23, 1) 100%)',
            },

            colors: {
                'glass-custom': 'rgba(255, 255, 255, 0.08)',
            },

            borderColor: {
                'glass-custom': 'rgba(255, 255, 255, 0.15)',
            },
        },
    },
    plugins: [],

}
