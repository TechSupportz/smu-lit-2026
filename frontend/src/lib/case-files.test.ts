import { describe, expect, it } from "vitest"
import { isPrefilingDocument } from "./case-files"
import type { CaseFile } from "./types"

describe("isPrefilingDocument", () => {
    it("shows a compiled backend snapshot regardless of its generated filename", () => {
        const snapshot: CaseFile = {
            id: "snapshot:summary",
            name: "case-20260906-prefilled-disputed-salon-package.pdf",
            size: 97 * 1024,
            kind: "generated",
            status: "ready",
            backendStored: true,
            backendSource: {
                caseId: "case_demo",
                type: "snapshot",
                recordId: "snapshot_summary",
            },
        }

        expect(isPrefilingDocument(snapshot)).toBe(true)
    })

    it("keeps the legacy filing-summary fallback but excludes unrelated generated files", () => {
        expect(
            isPrefilingDocument({
                id: "legacy",
                name: "filing-summary.pdf",
                size: 1024,
                kind: "generated",
                status: "ready",
            }),
        ).toBe(true)
        expect(
            isPrefilingDocument({
                id: "memo",
                name: "sample-legal-memo.pdf",
                size: 1024,
                kind: "generated",
                status: "ready",
            }),
        ).toBe(false)
    })
})
