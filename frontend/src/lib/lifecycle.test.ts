import { describe, expect, it, vi } from "vitest"
import { teardownCase } from "./lifecycle"

describe("teardownCase", () => {
    it("removes local blobs only when there is no backend case", async () => {
        const deleteCase = vi.fn(async () => {})
        const removeFile = vi.fn(async () => {})

        const result = await teardownCase({
            backendCaseId: null,
            fileIds: ["a", "b"],
            deleteCase,
            removeFile,
        })

        expect(result.problems).toEqual([])
        expect(result.remaining).toEqual({ backendCaseId: null, fileIds: [] })
        expect(deleteCase).not.toHaveBeenCalled()
        expect(removeFile.mock.calls.flat()).toEqual(["a", "b"])
    })

    it("deletes the backend case before the local blobs", async () => {
        const order: string[] = []
        const result = await teardownCase({
            backendCaseId: "case_1234",
            fileIds: ["a"],
            deleteCase: async id => {
                order.push(`delete:${id}`)
            },
            removeFile: async id => {
                order.push(`blob:${id}`)
            },
        })

        expect(result.problems).toEqual([])
        expect(order).toEqual(["delete:case_1234", "blob:a"])
    })

    it("reports a failed backend delete, keeps it retryable, and still clears blobs", async () => {
        const removeFile = vi.fn(async () => {})

        const result = await teardownCase({
            backendCaseId: "case_1234",
            fileIds: ["a"],
            deleteCase: async () => {
                throw new Error("Backend request failed (500).")
            },
            removeFile,
        })

        expect(result.problems).toEqual([
            "The backend case could not be deleted: Backend request failed (500).",
        ])
        expect(result.remaining).toEqual({ backendCaseId: "case_1234", fileIds: [] })
        expect(removeFile).toHaveBeenCalledWith("a")
    })

    it("reports partial blob failures and returns only the blobs still present", async () => {
        const removed: string[] = []

        const result = await teardownCase({
            backendCaseId: null,
            fileIds: ["a", "b"],
            deleteCase: async () => {},
            removeFile: async id => {
                if (id === "a") throw new Error("blocked")
                removed.push(id)
            },
        })

        expect(result.problems).toEqual([
            "Some downloaded copies could not be removed from this browser.",
        ])
        expect(result.remaining).toEqual({ backendCaseId: null, fileIds: ["a"] })
        expect(removed).toEqual(["b"])
    })

    it("clears the remainder once a retry succeeds", async () => {
        const result = await teardownCase({
            backendCaseId: "case_1234",
            fileIds: ["a"],
            deleteCase: async () => {},
            removeFile: async () => {},
        })

        expect(result).toEqual({
            problems: [],
            remaining: { backendCaseId: null, fileIds: [] },
        })
    })
})
