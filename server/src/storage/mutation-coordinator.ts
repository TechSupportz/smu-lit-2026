export class MutationCoordinator {
    readonly #tails = new Map<string, Promise<void>>()
    readonly #deleting = new Set<string>()

    async run<T>(caseId: string, operation: () => Promise<T> | T): Promise<T> {
        if (this.#deleting.has(caseId)) {
            throw new Error("Case deletion is in progress")
        }

        const previous = this.#tails.get(caseId) ?? Promise.resolve()
        let release: (() => void) | undefined
        const current = new Promise<void>(resolve => {
            release = resolve
        })
        const queued = previous.then(() => current)
        this.#tails.set(caseId, queued)

        await previous
        try {
            if (this.#deleting.has(caseId)) throw new Error("Case deletion is in progress")
            return await operation()
        } finally {
            release?.()
            if (this.#tails.get(caseId) === queued) this.#tails.delete(caseId)
        }
    }

    async delete<T>(caseId: string, operation: () => Promise<T> | T): Promise<T> {
        this.#deleting.add(caseId)
        const previous = this.#tails.get(caseId) ?? Promise.resolve()
        await previous
        try {
            return await operation()
        } finally {
            this.#tails.delete(caseId)
            this.#deleting.delete(caseId)
        }
    }
}
