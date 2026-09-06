import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter"
import { setProvider } from "@flue/runtime"
import { config } from "../config.js"
import { createMockAgentProvider, mockModelSpecifier } from "./mock-provider.js"

let liveConfigured = false
let modelSpecifier = `openrouter/${config.openCodeGoModel}`

export function configureOpenRouterProvider(): void {
    if (liveConfigured) return
    liveConfigured = true

    const base = openrouterProvider()
    const baseApiKey = base.auth.apiKey
    if (!baseApiKey) throw new Error("OpenRouter provider is missing API-key authentication")

    const provider: typeof base = {
        ...base,
        name: "OpenRouter for SCT pre-filing",
        headers: {
            ...base.headers,
            "HTTP-Referer": "https://github.com/smu-lit-2026/sct-prefiling",
            "X-Title": "SMU LIT SCT Pre-Filing Harness",
        },
        getModels: () =>
            base.getModels().map(model => ({
                ...model,
                baseUrl: config.openCodeGoBaseUrl,
            })),
        auth: {
            ...base.auth,
            apiKey: {
                ...baseApiKey,
                name: "OpenRouter API key for SCT pre-filing",
                check: () =>
                    Promise.resolve(
                        config.openCodeGoKey
                            ? { source: "OPENCODE_GO_KEY", type: "api_key" as const }
                            : undefined,
                    ),
                resolve: () =>
                    Promise.resolve(
                        config.openCodeGoKey
                            ? {
                                  auth: { apiKey: config.openCodeGoKey },
                                  source: "OPENCODE_GO_KEY",
                              }
                            : undefined,
                    ),
            },
        },
    }
    setProvider(provider)
}

export function configureAgentProvider(mockDataMode: boolean): void {
    if (mockDataMode) {
        setProvider(createMockAgentProvider())
        modelSpecifier = mockModelSpecifier
        return
    }
    configureOpenRouterProvider()
    modelSpecifier = `openrouter/${config.openCodeGoModel}`
}

export function getAgentModelSpecifier(): string {
    return modelSpecifier
}
