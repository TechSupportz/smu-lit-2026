import { isAbsolute, resolve } from "node:path"
import * as v from "valibot"

const integerFromString = (fallback: number) =>
    v.pipe(
        v.optional(v.string(), String(fallback)),
        v.transform(value => Number.parseInt(value, 10)),
        v.number(),
        v.integer(),
        v.minValue(1),
    )

const booleanFromString = (fallback: boolean) =>
    v.pipe(
        v.optional(v.string(), String(fallback)),
        v.transform(value => value.toLowerCase()),
        v.picklist(["true", "false"]),
        v.transform(value => value === "true"),
    )

const ConfigSchema = v.object({
    OPENCODE_GO_KEY: v.optional(v.string(), ""),
    OPENCODE_GO_BASE_URL: v.optional(v.pipe(v.string(), v.url()), "https://openrouter.ai/api/v1"),
    OPENCODE_GO_MODEL: v.optional(v.string(), "openai/gpt-5.6-luna"),
    OPENROUTER_API_KEY: v.optional(v.string(), ""),
    OPENROUTER_BASE_URL: v.optional(v.pipe(v.string(), v.url()), "https://openrouter.ai/api/v1"),
    OPENROUTER_EXTRACTION_MODEL: v.optional(v.string(), "openai/gpt-5.6-luna"),
    HOST: v.optional(v.string(), "127.0.0.1"),
    PORT: integerFromString(3000),
    CORS_ORIGINS: v.optional(v.string(), "http://localhost:5173,http://127.0.0.1:5173"),
    MCP_ENABLED: booleanFromString(false),
    MCP_ACCESS_TOKEN: v.optional(v.union([v.literal(""), v.pipe(v.string(), v.minLength(32))]), ""),
    DATA_DIR: v.optional(v.string(), "./data"),
    FLUE_DB_PATH: v.optional(v.string(), "./data/flue.db"),
    CASE_DB_PATH: v.optional(v.string(), "./data/cases.db"),
    EVIDENCE_DIR: v.optional(v.string(), "./data/evidence"),
    SNAPSHOT_DIR: v.optional(v.string(), "./data/snapshots"),
    TYPST_BIN: v.optional(v.string(), "typst"),
    MAX_UPLOAD_BYTES: integerFromString(10 * 1024 * 1024),
    MAX_EVIDENCE_PAGES: integerFromString(80),
    MAX_MODEL_CALLS_PER_TURN: integerFromString(8),
    PROVIDER_TIMEOUT_MS: integerFromString(90_000),
    PROVIDER_MAX_RETRIES: integerFromString(2),
    TYPST_TIMEOUT_MS: integerFromString(20_000),
})

export interface AppConfig {
    openCodeGoKey: string
    openCodeGoBaseUrl: string
    openCodeGoModel: string
    openRouterApiKey: string
    openRouterBaseUrl: string
    openRouterExtractionModel: string
    host: string
    port: number
    corsOrigins: string[]
    mcpEnabled: boolean
    mcpAccessToken: string
    dataDir: string
    flueDbPath: string
    caseDbPath: string
    evidenceDir: string
    snapshotDir: string
    typstBin: string
    maxUploadBytes: number
    maxEvidencePages: number
    maxModelCallsPerTurn: number
    providerTimeoutMs: number
    providerMaxRetries: number
    typstTimeoutMs: number
}

function absolute(path: string, root: string): string {
    return isAbsolute(path) ? path : resolve(root, path)
}

export function loadConfig(
    environment: NodeJS.ProcessEnv = process.env,
    root = process.cwd(),
): AppConfig {
    const parsed = v.safeParse(ConfigSchema, environment)
    if (!parsed.success) {
        const details = parsed.issues.map(issue => issue.message).join("; ")
        throw new Error(`Invalid server configuration: ${details}`)
    }

    const source = parsed.output
    const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"])
    if (source.MCP_ENABLED && !source.MCP_ACCESS_TOKEN && !loopbackHosts.has(source.HOST)) {
        throw new Error(
            "Invalid server configuration: MCP_ACCESS_TOKEN is required when MCP is enabled on a non-loopback host.",
        )
    }

    return {
        openCodeGoKey: source.OPENCODE_GO_KEY,
        openCodeGoBaseUrl: source.OPENCODE_GO_BASE_URL.replace(/\/$/, ""),
        openCodeGoModel: source.OPENCODE_GO_MODEL,
        openRouterApiKey: source.OPENROUTER_API_KEY,
        openRouterBaseUrl: source.OPENROUTER_BASE_URL.replace(/\/$/, ""),
        openRouterExtractionModel: source.OPENROUTER_EXTRACTION_MODEL,
        host: source.HOST,
        port: source.PORT,
        corsOrigins: source.CORS_ORIGINS.split(",")
            .map(origin => origin.trim())
            .filter(Boolean),
        mcpEnabled: source.MCP_ENABLED,
        mcpAccessToken: source.MCP_ACCESS_TOKEN,
        dataDir: absolute(source.DATA_DIR, root),
        flueDbPath: absolute(source.FLUE_DB_PATH, root),
        caseDbPath: absolute(source.CASE_DB_PATH, root),
        evidenceDir: absolute(source.EVIDENCE_DIR, root),
        snapshotDir: absolute(source.SNAPSHOT_DIR, root),
        typstBin: source.TYPST_BIN,
        maxUploadBytes: source.MAX_UPLOAD_BYTES,
        maxEvidencePages: source.MAX_EVIDENCE_PAGES,
        maxModelCallsPerTurn: source.MAX_MODEL_CALLS_PER_TURN,
        providerTimeoutMs: source.PROVIDER_TIMEOUT_MS,
        providerMaxRetries: source.PROVIDER_MAX_RETRIES,
        typstTimeoutMs: source.TYPST_TIMEOUT_MS,
    }
}

export const config = loadConfig()
