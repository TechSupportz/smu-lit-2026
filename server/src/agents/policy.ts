import type { CompactionConfig } from "@flue/runtime"

export const DEV_OVERRIDE_PREFIX = "<DEV OVERRIDE>"

// Leave headroom for tool results and reasoning while keeping the current
// intake step verbatim. Flue folds older turns into a durable summary.
export const AGENT_COMPACTION: CompactionConfig = {
    keepRecentTokens: 8_000,
    reserveTokens: 30_000,
}

export function developerOverrideInstruction(message: string): string | null {
    if (!message.startsWith(DEV_OVERRIDE_PREFIX)) return null

    const instruction = message.slice(DEV_OVERRIDE_PREFIX.length).trim()
    return instruction.length > 0 ? instruction : null
}
