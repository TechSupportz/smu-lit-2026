import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { chmod, readFile, rename, unlink } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"
import { promisify } from "node:util"
import { nanoid } from "nanoid"
import type { AppConfig } from "../config.js"
import type { SnapshotRecord } from "../domain/schemas.js"
import { ProcessingError } from "../errors.js"
import type { CaseStore } from "../storage/case-store.js"

const execFileAsync = promisify(execFile)

function sha256(value: Uint8Array): string {
    return createHash("sha256").update(value).digest("hex")
}

function inside(root: string, path: string): boolean {
    const normalizedRoot = resolve(root)
    const candidate = resolve(path)
    return candidate === normalizedRoot || candidate.startsWith(`${normalizedRoot}${sep}`)
}

export interface PdfCompilationResult {
    snapshot: SnapshotRecord
    pageCount: number
    snapshotHashMatched: true
    pdfHeaderValid: true
}

export class PdfService {
    private readonly projectRoot = process.cwd()
    private readonly templatePath = resolve(process.cwd(), "skills/typst/case-summary.typ")

    constructor(
        private readonly store: CaseStore,
        private readonly appConfig: AppConfig,
    ) {}

    async compile(caseId: string, snapshotId: string): Promise<PdfCompilationResult> {
        return this.store.mutations.run(caseId, async () => {
            const snapshot = this.store.getSnapshot(caseId, snapshotId)
            if (snapshot.pdfPath) {
                const bytes = await readFile(snapshot.pdfPath)
                if (bytes.subarray(0, 5).toString() !== "%PDF-") {
                    throw new ProcessingError("Stored snapshot PDF failed its integrity check.")
                }
                return {
                    snapshot,
                    pageCount: await this.pageCount(snapshot.pdfPath),
                    snapshotHashMatched: true,
                    pdfHeaderValid: true,
                }
            }
            if (
                !inside(this.projectRoot, snapshot.jsonPath) ||
                !inside(this.projectRoot, this.templatePath)
            ) {
                throw new ProcessingError(
                    "Typst compilation is restricted to the repository artifact workspace.",
                )
            }
            const jsonBytes = await readFile(snapshot.jsonPath)
            if (sha256(jsonBytes) !== snapshot.jsonSha256) {
                throw new ProcessingError(
                    "Snapshot JSON failed its integrity check; PDF compilation was refused.",
                )
            }

            const outputDirectory = dirname(snapshot.jsonPath)
            const finalPath = resolve(outputDirectory, `${snapshot.basename}.pdf`)
            const temporaryPath = resolve(
                outputDirectory,
                `.${snapshot.basename}.${nanoid(8)}.tmp.pdf`,
            )
            const typstSnapshotPath = relative(dirname(this.templatePath), snapshot.jsonPath)
            try {
                await execFileAsync(
                    this.appConfig.typstBin,
                    [
                        "compile",
                        "--root",
                        this.projectRoot,
                        "--input",
                        `snapshot=${typstSnapshotPath}`,
                        this.templatePath,
                        temporaryPath,
                    ],
                    {
                        cwd: this.projectRoot,
                        timeout: this.appConfig.typstTimeoutMs,
                        maxBuffer: 2 * 1024 * 1024,
                        env: {
                            PATH: process.env.PATH,
                            LANG: process.env.LANG ?? "en_US.UTF-8",
                        },
                    },
                )
                const pdfBytes = await readFile(temporaryPath)
                if (pdfBytes.subarray(0, 5).toString() !== "%PDF-") {
                    throw new ProcessingError("Typst did not produce a valid PDF header.")
                }
                const pageCount = await this.pageCount(temporaryPath)
                if (pageCount < 1) throw new ProcessingError("Compiled PDF contains no pages.")
                await chmod(temporaryPath, 0o400)
                await rename(temporaryPath, finalPath)
                const updated = this.store.attachSnapshotPdf(
                    caseId,
                    snapshotId,
                    finalPath,
                    sha256(pdfBytes),
                )
                return {
                    snapshot: updated,
                    pageCount,
                    snapshotHashMatched: true,
                    pdfHeaderValid: true,
                }
            } catch (error) {
                await unlink(temporaryPath).catch(() => undefined)
                if (error instanceof ProcessingError) throw error
                throw new ProcessingError(
                    "Typst compilation failed; the immutable JSON snapshot was preserved.",
                    {
                        cause: error instanceof Error ? error.message : String(error),
                        retryable: true,
                    },
                )
            }
        })
    }

    private async pageCount(path: string): Promise<number> {
        const { stdout } = await execFileAsync("pdfinfo", [path], {
            timeout: 5_000,
            maxBuffer: 256 * 1024,
        })
        const match = /^Pages:\s+(\d+)$/m.exec(stdout)
        if (!match)
            throw new ProcessingError("pdfinfo could not verify the compiled PDF page count.")
        return Number.parseInt(match[1]!, 10)
    }
}
