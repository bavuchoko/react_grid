import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const peerDeps = ["react", "react-dom", "react/jsx-runtime", "@bavuchoko/js-tooltip"];

export default defineConfig({
    publicDir: false,
    plugins: [
        react(),
        dts({
            entryRoot: "src",
            tsconfigPath: path.resolve(__dirname, "tsconfig.app.json"),
            insertTypesEntry: false,
            exclude: ["src/App.tsx", "src/main.tsx"],
        }),
    ],
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            formats: ["es"],
            fileName: "index",
        },
        rollupOptions: {
            external: peerDeps,
        },
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: true,
    },
});
