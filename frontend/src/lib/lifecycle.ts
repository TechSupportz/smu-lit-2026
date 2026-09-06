export type TeardownRequest = {
    backendCaseId: string | null
    fileIds: string[]
    deleteCase: (caseId: string) => Promise<void>
    removeFile: (fileId: string) => Promise<void>
}

/** What is still attached after a partially failed teardown, so it can be retried. */
export type TeardownRemainder = { backendCaseId: string | null; fileIds: string[] }

export type TeardownResult = { problems: string[]; remaining: TeardownRemainder }

/**
 * Removes everything attached to a case: the backend record first, then the
 * locally stored blobs. Cleanup always runs to completion so the caller can
 * reset local state unconditionally; anything that failed is returned as a
 * message together with the leftovers, so the user can be offered a retry
 * instead of a message that disappears.
 */
export async function teardownCase({
    backendCaseId,
    fileIds,
    deleteCase,
    removeFile,
}: TeardownRequest): Promise<TeardownResult> {
    const problems: string[] = []
    let remainingCaseId: string | null = null
    if (backendCaseId) {
        try {
            await deleteCase(backendCaseId)
        } catch (error) {
            remainingCaseId = backendCaseId
            problems.push(
                error instanceof Error
                    ? `The backend case could not be deleted: ${error.message}`
                    : "The backend case could not be deleted.",
            )
        }
    }
    const removals = await Promise.allSettled(fileIds.map(id => removeFile(id)))
    const remainingFileIds = fileIds.filter((_, index) => removals[index]?.status === "rejected")
    if (remainingFileIds.length > 0)
        problems.push("Some downloaded copies could not be removed from this browser.")
    return {
        problems,
        remaining: { backendCaseId: remainingCaseId, fileIds: remainingFileIds },
    }
}
