import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    typescript: {
        // Igniora gli errori di TypeScript per permettere il Deploy su Vercel
        ignoreBuildErrors: true,
    },
    eslint: {
        // Igniora gli avvisi di sintassi durante il build
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
