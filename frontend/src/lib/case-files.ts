import type { CaseFile } from "./types"

export function isPrefilingDocument(file: CaseFile) {
    return (
        file.kind === "generated" &&
        (file.backendSource?.type === "snapshot" || file.name.includes("filing"))
    )
}
