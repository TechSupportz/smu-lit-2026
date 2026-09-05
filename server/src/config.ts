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
