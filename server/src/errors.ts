export class AppError extends Error {
    constructor(
        message: string,
        readonly code: string,
        readonly status: number,
        readonly details?: unknown,
    ) {
        super(message)
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, id: string) {
        super(`${resource} not found`, "NOT_FOUND", 404, { resource, id })
    }
}

export class RevisionConflictError extends AppError {
    constructor(caseId: string, expectedRevision: number, actualRevision: number) {
        super("Case revision is stale", "REVISION_CONFLICT", 409, {
            caseId,
            expectedRevision,
            actualRevision,
        })
    }
}

export class IdempotencyConflictError extends AppError {
    constructor(scope: string) {
        super(
            "Idempotency key was already used with a different request",
            "IDEMPOTENCY_CONFLICT",
            409,
            {
                scope,
            },
        )
    }
}

export class ProcessingError extends AppError {
    constructor(message: string, details?: unknown) {
        super(message, "PROCESSING_ERROR", 422, details)
    }
}
