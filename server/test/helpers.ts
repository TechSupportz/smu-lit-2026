import { mkdir, rm } from "node:fs/promises"
import { mkdirSync, mkdtempSync } from "node:fs"
import { join, resolve } from "node:path"
import { afterEach } from "vitest"
import { CaseStore } from "../src/storage/case-store.js"
import type { AppConfig } from "../src/config.js"

export const mockRoot = resolve(process.cwd(), "mock")
export const mockTmpRoot = resolve(mockRoot, ".tmp")

const temporaryPaths: string[] = []

export async function makeTempDir(prefix: string): Promise<string> {
    await mkdir(mockTmpRoot, { recursive: true })
    const path = mkdtempSync(join(mockTmpRoot, `${prefix}-`))
    temporaryPaths.push(path)
    return path
}

export function makeTempDirSync(prefix: string): string {
    mkdirSync(mockTmpRoot, { recursive: true })
    const path = mkdtempSync(join(mockTmpRoot, `${prefix}-`))
    temporaryPaths.push(path)
    return path
}

export function makeStoreSync(prefix = "db"): { store: CaseStore; dir: string } {
    const dir = makeTempDirSync(prefix)
    return { store: new CaseStore(join(dir, "cases.db")), dir }
}

export function testConfig(dir: string, overrides: Partial<AppConfig> = {}): AppConfig {
    return {
        openCodeGoKey: "",
        openCodeGoBaseUrl: "https://openrouter.ai/api/v1",
        openCodeGoModel: "openai/gpt-5.6-luna",
        openRouterApiKey: "",
        openRouterBaseUrl: "https://openrouter.ai/api/v1",
        openRouterExtractionModel: "openai/gpt-5.6-luna",
        host: "127.0.0.1",
        port: 3000,
        corsOrigins: ["http://localhost:5173"],
        mcpEnabled: false,
        mcpAccessToken: "",
        dataDir: dir,
        flueDbPath: join(dir, "flue.db"),
        caseDbPath: join(dir, "cases.db"),
        evidenceDir: join(dir, "evidence"),
        snapshotDir: join(dir, "snapshots"),
        typstBin: "typst",
        maxUploadBytes: 10 * 1024 * 1024,
        maxEvidencePages: 80,
        maxModelCallsPerTurn: 8,
        providerTimeoutMs: 90_000,
        providerMaxRetries: 2,
        typstTimeoutMs: 20_000,
        ...overrides,
    }
}

export async function makeStore(prefix = "db"): Promise<{ store: CaseStore; dir: string }> {
    const dir = await makeTempDir(prefix)
    return { store: new CaseStore(join(dir, "cases.db")), dir }
}

export function closeStore(store: CaseStore): void {
    store.close()
}

export function createCase(
    store: CaseStore,
    input: Partial<Parameters<CaseStore["createCase"]>[0]> = {},
) {
    return store.createCase({
        title: "Test SCT case",
        claimantName: "Alex Claimant",
        category: "SALE_OF_GOODS",
        ...input,
    })
}

afterEach(async () => {
    for (const path of temporaryPaths.splice(0)) {
        await rm(path, { recursive: true, force: true })
    }
})
