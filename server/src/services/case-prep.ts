import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import {
    chmod,
    cp,
    mkdtemp,
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    stat,
    writeFile,
} from "node:fs/promises"
import { basename, dirname, extname, relative, resolve, sep } from "node:path"
import { promisify } from "node:util"
import { nanoid } from "nanoid"
import type { AppConfig } from "../config.js"
import type { EvidenceRecord, SnapshotRecord } from "../domain/schemas.js"
import { ProcessingError } from "../errors.js"
import type { CasePrepEvidenceItem, CasePrepRecord, CaseState, CaseStore } from "../storage/case-store.js"
import { EvidenceService } from "./evidence.js"
import { PdfService } from "./pdf.js"

const execFileAsync = promisify(execFile)

type Conversion = CasePrepEvidenceItem["conversion"]

interface PreparedPdf {
    evidenceId: string | null
    title: string
    path: string
    sha256: string
    pageCount: number
    conversion: Conversion | "PREFILING" | "COVER" | "CUE_CARD"
}

interface PackDocument {
    sequence: number
    kind: string
    title: string
    sha256: string
    pageCount: number
    startPage: number
    endPage: number
}

interface PackManifest {
    schemaVersion: "1.0.0"
    displayName: string
    caseId: string
    snapshotId: string
    caseRevision: number
    createdAt: string
    documents: PackDocument[]
}

function hash(value: Uint8Array | string): string {
    return createHash("sha256").update(value).digest("hex")
}

function isInside(root: string, candidate: string): boolean {
    const base = resolve(root)
    const path = resolve(candidate)
    return path === base || path.startsWith(`${base}${sep}`)
}

function commandError(command: string, error: unknown): ProcessingError {
    const message = error instanceof Error ? error.message : String(error)
    return new ProcessingError(`${command} failed while building the tribunal case pack.`, {
        command,
        cause: message.slice(0, 2_000),
        retryable: true,
    })
}

function shellPath(path: string): string {
    return path.split(sep).join("/")
}

function titleForEvidence(evidence: EvidenceRecord): string {
    return evidence.originalFilename || "Evidence"
}

function isImage(mimeType: string): boolean {
    return mimeType.startsWith("image/")
}

function isOffice(mimeType: string): boolean {
    return new Set([
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/rtf",
        "text/rtf",
        "application/vnd.oasis.opendocument.text",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]).has(mimeType)
}

async function fileHash(path: string): Promise<string> {
    return hash(await readFile(path))
}

export class CasePrepService {
    private readonly projectRoot = process.cwd()
    private readonly cueTemplatePath = resolve(this.projectRoot, "skills/typst/cue-card.typ")
    private readonly coverTemplatePath = resolve(this.projectRoot, "skills/typst/stack-cover.typ")
    private readonly imageTemplatePath = resolve(this.projectRoot, "skills/typst/evidence-image.typ")
    private readonly textTemplatePath = resolve(this.projectRoot, "skills/typst/evidence-text.typ")
    private readonly evidenceService: EvidenceService

    constructor(
        private readonly store: CaseStore,
        private readonly appConfig: AppConfig,
        private readonly pdfService = new PdfService(store, appConfig),
    ) {
        this.evidenceService = new EvidenceService(store, appConfig)
    }

    /** Build (or return) the immutable pack for the reviewed snapshot at expectedRevision. */
    async generate(caseId: string, expectedRevision: number): Promise<CasePrepRecord> {
        // PdfService owns its own mutation lock. Ensure the prerequisite before taking ours,
        // otherwise nested MutationCoordinator.run calls would deadlock.
        const initial = this.requireCurrentReviewedSnapshot(caseId, expectedRevision)
        let snapshot = initial.snapshot
        await this.assertSnapshotJson(snapshot)
        if (!snapshot.pdfPath || !snapshot.pdfSha256) {
            const compiled = await this.pdfService.compile(caseId, snapshot.id)
            snapshot = compiled.snapshot
        }

        return this.store.mutations.run(caseId, async () => {
            const current = this.requireCurrentReviewedSnapshot(caseId, expectedRevision)
            if (current.snapshot.id !== snapshot.id) {
                throw new ProcessingError("The reviewed snapshot changed while its PDF was being compiled; retry case preparation.", { retryable: true })
            }
            snapshot = this.requireSnapshotPdf(snapshot)
            await this.assertSnapshotJson(snapshot)

            const existing = this.store.getLatestCasePrep(caseId)
            if (existing?.snapshotId === snapshot.id) {
                if (await this.validRecord(existing)) return existing
                throw new ProcessingError("The existing tribunal case pack failed its integrity check; delete the corrupted pack before retrying.", { retryable: false })
            }

            const state = this.store.getCaseState(caseId)
            const packId = `caseprep_${nanoid(16)}`
            const outputDirectory = resolve(this.appConfig.snapshotDir, caseId)
            if (!isInside(this.appConfig.snapshotDir, outputDirectory)) throw new ProcessingError("Case pack path escaped its artifact workspace.")
            await mkdir(outputDirectory, { recursive: true })
            const temporaryDirectory = await mkdtemp(resolve(outputDirectory, `.${packId}-`))
            const packBasename = `${snapshot.basename}-tribunal-pack`
            const cueTypPath = resolve(outputDirectory, `${packBasename}-cue-card.typ`)
            const cuePdfPath = resolve(outputDirectory, `${packBasename}-cue-card.pdf`)
            const manifestPath = resolve(outputDirectory, `${packBasename}.manifest.json`)
            const stackPdfPath = resolve(outputDirectory, `${packBasename}.pdf`)
            const createdAt = new Date().toISOString()

            try {
                const cuePdf = await this.buildCueCard(snapshot, cueTypPath, cuePdfPath, temporaryDirectory)
                const prefiling = await this.validatePdf(snapshot.pdfPath!, "prefiling summary")
                if (prefiling.sha256 !== snapshot.pdfSha256) throw new ProcessingError("The reviewed pre-filing summary PDF failed its integrity check.")
                const normalized: PreparedPdf[] = []
                for (const evidence of state.evidence) {
                    normalized.push(await this.normalizeEvidence(evidence, temporaryDirectory))
                }

                const documents: PackDocument[] = []
                let nextPage = 2 // Cover is expected to be one page; corrected below if it wraps.
                const addDocument = (kind: string, title: string, item: PreparedPdf): void => {
                    const document: PackDocument = {
                        sequence: documents.length + 1,
                        kind,
                        title,
                        sha256: item.sha256,
                        pageCount: item.pageCount,
                        startPage: nextPage,
                        endPage: nextPage + item.pageCount - 1,
                    }
                    documents.push(document)
                    nextPage = document.endPage + 1
                }
                addDocument("CUE_CARD", "Tribunal cue cards", {
                    ...cuePdf,
                    evidenceId: null,
                    conversion: "CUE_CARD",
                })
                addDocument("PREFILING_SUMMARY", "Pre-filing case summary", {
                    ...prefiling,
                    evidenceId: null,
                    title: "Pre-filing case summary",
                    conversion: "PREFILING",
                })
                normalized.forEach((item, index) => addDocument("EVIDENCE", state.evidence[index]!.originalFilename, item))

                let manifest: PackManifest = {
                    schemaVersion: "1.0.0",
                    displayName: snapshot.displayName,
                    caseId,
                    snapshotId: snapshot.id,
                    caseRevision: snapshot.caseRevision,
                    createdAt,
                    documents,
                }
                let cover = await this.buildCover(manifest, temporaryDirectory)
                for (let attempt = 0; attempt < 3; attempt += 1) {
                    nextPage = cover.pageCount + 1
                    documents.forEach(document => {
                        document.startPage = nextPage
                        document.endPage = nextPage + document.pageCount - 1
                        nextPage = document.endPage + 1
                    })
                    manifest = { ...manifest, documents: [...documents] }
                    const nextCover = await this.buildCover(manifest, temporaryDirectory)
                    if (nextCover.pageCount === cover.pageCount) {
                        cover = nextCover
                        break
                    }
                    cover = nextCover
                }

                const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`
                await this.writeImmutable(manifestPath, manifestJson)
                const mergeInput = [cover.path, cuePdf.path, prefiling.path, ...normalized.map(item => item.path)]
                await this.mergePdfs(mergeInput, stackPdfPath, temporaryDirectory)
                const stack = await this.validatePdf(stackPdfPath, "tribunal case pack")
                const expectedPages = cover.pageCount + cuePdf.pageCount + prefiling.pageCount + normalized.reduce((sum, item) => sum + item.pageCount, 0)
                if (stack.pageCount !== expectedPages) throw new ProcessingError(`Tribunal case pack page count mismatch: expected ${expectedPages}, got ${stack.pageCount}.`)

                const evidenceManifest: CasePrepEvidenceItem[] = normalized.map((item, index) => {
                    const document = documents[index + 2]!
                    const evidence = state.evidence[index]!
                    return {
                        evidenceId: evidence.id,
                        originalFilename: evidence.originalFilename,
                        mimeType: evidence.mimeType,
                        sha256: evidence.sha256,
                        normalizedPageCount: item.pageCount,
                        stackStartPage: document.startPage,
                        stackEndPage: document.endPage,
                        conversion: item.conversion as Conversion,
                    }
                })
                const record = this.store.saveCasePrep({
                    id: packId,
                    caseId,
                    snapshotId: snapshot.id,
                    caseRevision: snapshot.caseRevision,
                    basename: packBasename,
                    cueTypPath,
                    cueTypSha256: await fileHash(cueTypPath),
                    cuePdfPath,
                    cuePdfSha256: cuePdf.sha256,
                    cuePageCount: cuePdf.pageCount,
                    stackManifestPath: manifestPath,
                    stackManifestSha256: hash(manifestJson),
                    stackPdfPath,
                    stackPdfSha256: stack.sha256,
                    stackPageCount: stack.pageCount,
                    evidenceManifest,
                    createdAt,
                })
                return record
            } catch (error) {
                await Promise.all([
                    rm(cueTypPath, { force: true }),
                    rm(cuePdfPath, { force: true }),
                    rm(manifestPath, { force: true }),
                    rm(stackPdfPath, { force: true }),
                ])
                if (error instanceof ProcessingError) throw error
                throw commandError("Case pack generation", error)
            } finally {
                await rm(temporaryDirectory, { recursive: true, force: true })
            }
        })
    }

    get(caseId: string): CasePrepRecord | null {
        return this.store.getLatestCasePrep(caseId)
    }

    private requireCurrentReviewedSnapshot(caseId: string, expectedRevision: number): { state: CaseState; snapshot: SnapshotRecord } {
        const state = this.store.getCaseState(caseId)
        if (state.case.revision !== expectedRevision) throw new ProcessingError("Case revision is stale; refresh the case before preparing the tribunal pack.", { retryable: false })
        if (!state.case.userReviewed) throw new ProcessingError("Complete the final case review before preparing a tribunal pack.")
        const snapshot = state.snapshots[0]
        if (!snapshot || snapshot.caseRevision !== state.case.revision) throw new ProcessingError("Create a reviewed pre-filing snapshot for the current case revision before preparing a tribunal pack.")
        return { state, snapshot }
    }

    private requireSnapshotPdf(snapshot: SnapshotRecord): SnapshotRecord {
        if (!snapshot.pdfPath || !snapshot.pdfSha256) throw new ProcessingError("The reviewed pre-filing summary PDF is not available; retry generation.", { retryable: true })
        if (!isInside(this.appConfig.snapshotDir, snapshot.jsonPath) || !isInside(this.appConfig.snapshotDir, snapshot.pdfPath)) throw new ProcessingError("The reviewed snapshot points outside the artifact workspace.")
        return snapshot
    }

    private async assertSnapshotJson(snapshot: SnapshotRecord): Promise<void> {
        if (!isInside(this.appConfig.snapshotDir, snapshot.jsonPath) || (await fileHash(snapshot.jsonPath)) !== snapshot.jsonSha256) {
            throw new ProcessingError("The reviewed snapshot JSON failed its integrity check; case preparation was refused.")
        }
    }

    private async validRecord(record: CasePrepRecord): Promise<boolean> {
        try {
            const checks: Array<[string, string]> = [
                [record.cueTypPath, record.cueTypSha256],
                [record.cuePdfPath, record.cuePdfSha256],
                [record.stackManifestPath, record.stackManifestSha256],
                [record.stackPdfPath, record.stackPdfSha256],
            ]
            for (const [path, expected] of checks) {
                if (!isInside(this.appConfig.snapshotDir, path) || (await fileHash(path)) !== expected) return false
            }
            const state = this.store.getCaseState(record.caseId)
            for (const item of record.evidenceManifest) {
                const evidence = state.evidence.find(candidate => candidate.id === item.evidenceId)
                if (!evidence || evidence.sha256 !== item.sha256) return false
                if ((await fileHash(this.evidenceService.resolveEvidencePath(evidence))) !== evidence.sha256) return false
            }
            const stack = await this.validatePdf(record.stackPdfPath, "stored tribunal case pack")
            return stack.pageCount === record.stackPageCount
        } catch {
            return false
        }
    }

    private async writeImmutable(path: string, data: string | Uint8Array): Promise<void> {
        await writeFile(path, data, { flag: "wx", mode: 0o400 })
        await chmod(path, 0o400)
    }

    private async command(command: string, args: string[], cwd = this.projectRoot): Promise<void> {
        try {
            await execFileAsync(command, args, {
                cwd,
                timeout: this.appConfig.casePrepTimeoutMs,
                maxBuffer: 2 * 1024 * 1024,
                env: { PATH: process.env.PATH, LANG: process.env.LANG ?? "en_US.UTF-8" },
            })
        } catch (error) {
            throw commandError(basename(command), error)
        }
    }

    private async compileTypst(template: string, output: string, inputs: Record<string, string>): Promise<void> {
        if (!isInside(this.projectRoot, template) || !isInside(this.projectRoot, output)) throw new ProcessingError("Typst compilation path escaped its artifact workspace.")
        const args = ["compile", "--root", this.projectRoot]
        for (const [key, value] of Object.entries(inputs)) args.push("--input", `${key}=${value}`)
        args.push(template, output)
        await this.command(this.appConfig.typstBin, args)
    }

    private async buildCueCard(snapshot: SnapshotRecord, cueTypPath: string, cuePdfPath: string, temp: string): Promise<PreparedPdf> {
        const snapshotPath = snapshot.jsonPath
        const importPath = shellPath(relative(dirname(cueTypPath), this.cueTemplatePath))
        const inputPath = shellPath(relative(dirname(cueTypPath), snapshotPath))
        const source = `#import "${importPath}": render-cue-card\n#let data = json(sys.inputs.at("snapshot"))\n#render-cue-card(data)\n`
        await this.writeImmutable(cueTypPath, source)
        const temporaryPdf = resolve(temp, "cue-card.pdf")
        await this.compileTypst(cueTypPath, temporaryPdf, { snapshot: inputPath })
        const result = await this.validatePdf(temporaryPdf, "cue card")
        await cp(temporaryPdf, cuePdfPath, { errorOnExist: true })
        await chmod(cuePdfPath, 0o400)
        return { evidenceId: null, title: "Tribunal cue cards", path: cuePdfPath, sha256: await fileHash(cuePdfPath), pageCount: result.pageCount, conversion: "CUE_CARD" }
    }

    private async buildCover(manifest: PackManifest, temp: string): Promise<PreparedPdf> {
        const manifestPath = resolve(temp, "manifest.json")
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
        const output = resolve(temp, `cover-${nanoid(6)}.pdf`)
        const inputPath = shellPath(relative(dirname(this.coverTemplatePath), manifestPath))
        await this.compileTypst(this.coverTemplatePath, output, { manifest: inputPath })
        const result = await this.validatePdf(output, "case pack index")
        return { evidenceId: null, title: "Case pack index", path: output, sha256: await fileHash(output), pageCount: result.pageCount, conversion: "COVER" }
    }

    private async normalizeEvidence(evidence: EvidenceRecord, temp: string): Promise<PreparedPdf> {
        const originalPath = this.evidenceService.resolveEvidencePath(evidence)
        const bytes = await readFile(originalPath)
        if (hash(bytes) !== evidence.sha256) throw new ProcessingError(`Evidence original failed its integrity check: ${evidence.originalFilename}.`)
        if (evidence.mimeType === "application/pdf") {
            const result = await this.validatePdf(originalPath, evidence.originalFilename)
            return { evidenceId: evidence.id, title: titleForEvidence(evidence), path: originalPath, sha256: evidence.sha256, pageCount: result.pageCount, conversion: "ORIGINAL_PDF" }
        }
        if (isImage(evidence.mimeType)) return this.imageToPdf(evidence, originalPath, temp)
        if (evidence.mimeType === "text/plain") return this.textToPdf(evidence, originalPath, temp)
        if (isOffice(evidence.mimeType)) return this.officeToPdf(evidence, originalPath, temp)
        throw new ProcessingError(`Unsupported evidence type cannot be included in the tribunal pack: ${evidence.mimeType}.`)
    }

    private async imageToPdf(evidence: EvidenceRecord, source: string, temp: string): Promise<PreparedPdf> {
        const output = resolve(temp, `${evidence.id}-image.pdf`)
        const sourcePath = shellPath(relative(dirname(this.imageTemplatePath), source))
        await this.compileTypst(this.imageTemplatePath, output, { source: sourcePath, title: evidence.originalFilename })
        const result = await this.validatePdf(output, evidence.originalFilename)
        return { evidenceId: evidence.id, title: titleForEvidence(evidence), path: output, sha256: await fileHash(output), pageCount: result.pageCount, conversion: "IMAGE_TO_PDF" }
    }

    private async textToPdf(evidence: EvidenceRecord, source: string, temp: string): Promise<PreparedPdf> {
        const output = resolve(temp, `${evidence.id}-text.pdf`)
        const sourcePath = shellPath(relative(dirname(this.textTemplatePath), source))
        await this.compileTypst(this.textTemplatePath, output, { source: sourcePath, title: evidence.originalFilename })
        const result = await this.validatePdf(output, evidence.originalFilename)
        return { evidenceId: evidence.id, title: titleForEvidence(evidence), path: output, sha256: await fileHash(output), pageCount: result.pageCount, conversion: "TEXT_TO_PDF" }
    }

    private async officeToPdf(evidence: EvidenceRecord, source: string, temp: string): Promise<PreparedPdf> {
        const outputDirectory = resolve(temp, `${evidence.id}-office`)
        const profileDirectory = resolve(temp, `${evidence.id}-profile`)
        await mkdir(outputDirectory, { recursive: true })
        await mkdir(profileDirectory, { recursive: true })
        await this.command(this.appConfig.sofficeBin, [
            `-env:UserInstallation=file://${shellPath(profileDirectory)}`,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            outputDirectory,
            source,
        ])
        const expected = resolve(outputDirectory, `${basename(source, extname(source))}.pdf`)
        const candidates = (await readdir(outputDirectory)).filter(name => name.toLowerCase().endsWith(".pdf"))
        const output = candidates.length === 1 ? resolve(outputDirectory, candidates[0]!) : expected
        if (!(await stat(output).catch(() => null))) throw new ProcessingError(`LibreOffice did not produce a PDF for ${evidence.originalFilename}.`, { retryable: true })
        const result = await this.validatePdf(output, evidence.originalFilename)
        return { evidenceId: evidence.id, title: titleForEvidence(evidence), path: output, sha256: await fileHash(output), pageCount: result.pageCount, conversion: "OFFICE_TO_PDF" }
    }

    private async mergePdfs(inputs: string[], output: string, temp: string): Promise<void> {
        if (inputs.length === 0) throw new ProcessingError("Cannot build an empty tribunal case pack.")
        const temporary = resolve(temp, "merged-pack.pdf")
        await this.command(this.appConfig.pdfUniteBin, [...inputs, temporary])
        const result = await this.validatePdf(temporary, "merged tribunal case pack")
        if (result.pageCount < 1) throw new ProcessingError("Merged tribunal case pack contains no pages.")
        await rename(temporary, output)
        await chmod(output, 0o400)
    }

    private async validatePdf(path: string, title: string): Promise<{ pageCount: number; sha256: string; path: string }> {
        const bytes = await readFile(path)
        if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new ProcessingError(`${title} did not produce a valid PDF header.`)
        try {
            const { stdout } = await execFileAsync("pdfinfo", [path], { timeout: Math.min(5_000, this.appConfig.casePrepTimeoutMs), maxBuffer: 256 * 1024 })
            const match = /^Pages:\s+(\d+)$/m.exec(stdout)
            const pageCount = match ? Number.parseInt(match[1]!, 10) : 0
            if (pageCount < 1) throw new Error("missing page count")
            return { pageCount, sha256: hash(bytes), path }
        } catch (error) {
            if (error instanceof ProcessingError) throw error
            throw new ProcessingError(`${title} failed PDF page-count validation.`, { cause: error instanceof Error ? error.message : String(error), retryable: true })
        }
    }
}
