import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/IGACMAP/" : "/", // Solo cambia en producción
  plugins: [react()],
  resolve: {
    alias: {
      "react-map-gl": path.resolve(__dirname, "node_modules/react-map-gl"),
    },
  },
});
