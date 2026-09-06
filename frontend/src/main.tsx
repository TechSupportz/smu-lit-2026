import React from "react"
import ReactDOM from "react-dom/client"
import "@fontsource/dm-sans/400.css"
import "@fontsource/dm-sans/500.css"
import "@fontsource/dm-sans/600.css"
import "@fontsource/dm-sans/700.css"
import "@fontsource/dm-serif-display/400.css"
import "./index.css"
import App from "./App"

if (import.meta.env.VITE_PREFILLED === "true") {
    void import("./lib/prefilled-console").then(({ installPrefilledConsole }) =>
        installPrefilledConsole(),
    )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
