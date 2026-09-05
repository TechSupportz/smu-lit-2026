import { flue } from "@flue/vite"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "")
    const port = Number.parseInt(env.PORT || "3000", 10)

    return {
        plugins: mode === "test" ? [] : [flue()],
        server: {
            host: env.HOST || "127.0.0.1",
            port: Number.isFinite(port) ? port : 3000,
        },
    }
})
