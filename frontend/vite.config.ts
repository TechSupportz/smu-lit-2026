import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"

function parseAllowedHosts(value: string | undefined): string[] {
    return (value ?? "")
        .split(",")
        .map(host => host.trim())
        .filter(Boolean)
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "")

    return {
        plugins: [react(), tailwindcss()],
        resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
        server: {
            allowedHosts: parseAllowedHosts(env.VITE_ALLOWED_HOSTS),
            proxy: {
                "/api": {
                    target: "http://127.0.0.1:3000",
                    changeOrigin: true,
                    rewrite: path => path.replace(/^\/api/, ""),
                },
            },
        },
    }
})
