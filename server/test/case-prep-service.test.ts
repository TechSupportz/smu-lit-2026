import { chmod, copyFile, readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CasePrepService } from "../src/services/case-prep.js"
import { EvidenceService } from "../src/services/evidence.js"
import { PdfService } from "../src/services/pdf.js"
import { SnapshotService } from "../src/services/snapshot.js"
import { createCase, makeStore, testConfig } from "./helpers.js"

describe("CasePrepService", () => {
    it("creates an indexed pack containing the cue card, pre-filing PDF, and evidence", async () => {
        const { store, dir } = await makeStore("case-prep")
        const config = testConfig(dir)
        const created = createCase(store)
        let revision = created.revision
        const party = store.upsertParty(created.id, {
            expectedRevision: revision,
            role: "RESPONDENT",
            kind: "ENTITY",
            name: "Respondent Ltd",
            identificationType: null,
            identificationNumber: null,
            phone: null,
            email: null,
            address: "Singapore",
            country: "Singapore",
            isPrimary: true,
        })
        revision = store.getCase(created.id).revision
        expect(party.name).toBe("Respondent Ltd")
        store.proposeFact(created.id, {
            expectedRevision: revision,
            statement: "The respondent promised to deliver the item on 1 September 2026.",
            sourceType: "USER_ASSERTION",
            sourceMessageId: null,
            structuredValue: { date: "2026-09-01", precision: "EXACT" },
            material: true,
        })
        revision = store.getCase(created.id).revision
        const fact = store.getCaseState(created.id).facts[0]!
        store.reviewFact(created.id, fact.id, {
            expectedRevision: revision,
            action: "CONFIRM",
        })
        revision = store.getCase(created.id).revision
        store.upsertRemedy(created.id, {
            expectedRevision: revision,
            type: "MONEY",
            description: "Refund the amount paid.",
            amountCents: 12000,
            basis: "The item was not delivered.",
        })
        revision = store.getCase(created.id).revision
        store.updateCase(created.id, { expectedRevision: revision, patch: { userReviewed: true } })
        revision = store.getCase(created.id).revision

        const evidenceService = new EvidenceService(store, config)
        const pdf = await readFile(join(process.cwd(), "mock/clean-snapshot.pdf"))
        const image = await readFile(join(process.cwd(), "mock/.qa/clean/page-1.png"))
        const text = new TextEncoder().encode("A short witness note.\nThe item was not delivered.\n")
        await evidenceService.upload(created.id, {
            name: "supporting.pdf",
            type: "application/pdf",
            arrayBuffer: () => Promise.resolve(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength)),
        }, { expectedRevision: revision, documentType: "support", description: "Supporting PDF", relevantPages: [1] })
        revision = store.getCase(created.id).revision
        await evidenceService.upload(created.id, {
            name: "note.txt",
            type: "text/plain",
            arrayBuffer: () => Promise.resolve(text.buffer.slice(text.byteOffset, text.byteOffset + text.byteLength)),
        }, { expectedRevision: revision, documentType: "note", description: "Witness note", relevantPages: [] })
        revision = store.getCase(created.id).revision
        await evidenceService.upload(created.id, {
            name: "screenshot.png",
            type: "image/png",
            arrayBuffer: () => Promise.resolve(image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength)),
        }, { expectedRevision: revision, documentType: "screenshot", description: "Screenshot", relevantPages: [] })
        revision = store.getCase(created.id).revision
        // LibreOffice is an optional external dependency. Enable this smoke path explicitly
        // on a host where its headless runtime is available (macOS app bundles may abort).
        if (process.env.CASE_PREP_OFFICE_SMOKE === "1") {
            const docx = await readFile(join(process.cwd(), "mock/word-evidence-source.docx"))
            await evidenceService.upload(created.id, {
                name: "word-evidence.docx",
                type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                arrayBuffer: () => Promise.resolve(docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength)),
            }, { expectedRevision: revision, documentType: "letter", description: "Word evidence", relevantPages: [] })
            revision = store.getCase(created.id).revision
        }
        store.updateCase(created.id, { expectedRevision: revision, patch: { userReviewed: true } })
        revision = store.getCase(created.id).revision
        const snapshotService = new SnapshotService(store, config)
        const snapshot = await snapshotService.create(created.id, revision)
        const compiled = await new PdfService(store, config).compile(created.id, snapshot.record.id)
        const prep = await new CasePrepService(store, config, new PdfService(store, config)).generate(created.id, revision)

        expect(compiled.snapshot.pdfPath).toBeTruthy()
        expect(prep.cuePageCount).toBe(1)
        expect(prep.stackPageCount).toBeGreaterThan(prep.cuePageCount)
        expect(prep.evidenceManifest).toHaveLength(process.env.CASE_PREP_OFFICE_SMOKE === "1" ? 4 : 3)
        expect(prep.evidenceManifest.map(item => item.conversion)).toEqual(process.env.CASE_PREP_OFFICE_SMOKE === "1" ? ["ORIGINAL_PDF", "TEXT_TO_PDF", "IMAGE_TO_PDF", "OFFICE_TO_PDF"] : ["ORIGINAL_PDF", "TEXT_TO_PDF", "IMAGE_TO_PDF"])
        expect((await readFile(prep.stackPdfPath)).subarray(0, 5).toString()).toBe("%PDF-")
        if (process.env.CASE_PREP_KEEP_SMOKE === "1") {
            const retained = [
                [prep.stackPdfPath, join(process.cwd(), "mock/case-prep-smoke.pdf")],
                [prep.cuePdfPath, join(process.cwd(), "mock/case-prep-smoke-cue-card.pdf")],
                [prep.stackManifestPath, join(process.cwd(), "mock/case-prep-smoke.manifest.json")],
            ] as const
            await Promise.all(
                retained.map(async ([source, target]) => {
                    await chmod(target, 0o600).catch(() => undefined)
                    await copyFile(source, target)
                }),
            )
        }
    }, 120_000)
})
