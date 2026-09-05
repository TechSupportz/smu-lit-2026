import type { DatabaseSync } from "node:sqlite"

const migrations = [
    `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    title TEXT,
    display_name TEXT NOT NULL,
    stage TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    category TEXT,
    category_confidence REAL,
    category_user_confirmed INTEGER NOT NULL DEFAULT 0,
    model_data_json TEXT,
    subtype TEXT,
    factual_summary TEXT,
    cause_of_action_date TEXT,
    cause_of_action_date_original TEXT,
    cause_of_action_date_precision TEXT NOT NULL DEFAULT 'UNKNOWN',
    claim_amount_cents INTEGER,
    consent_status TEXT NOT NULL DEFAULT 'UNKNOWN',
    respondent_location_status TEXT NOT NULL DEFAULT 'UNKNOWN',
    official_assessment_completed INTEGER NOT NULL DEFAULT 0,
    official_assessment_reference TEXT,
    eligibility_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
    preparation_status TEXT NOT NULL DEFAULT 'NOT_READY',
    user_reviewed INTEGER NOT NULL DEFAULT 0,
    can_proceed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS idempotency_records (
    scope TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (scope, idempotency_key)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT,
    identification_type TEXT,
    identification_number TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    country TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS facts (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    statement TEXT NOT NULL,
    structured_value_json TEXT,
    source_type TEXT NOT NULL,
    source_message_id TEXT,
    review_status TEXT NOT NULL DEFAULT 'PENDING',
    evidence_assessment TEXT NOT NULL DEFAULT 'UNASSESSED',
    material INTEGER NOT NULL DEFAULT 1,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS evidence_documents (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    sha256 TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    document_type TEXT,
    description TEXT,
    relevant_pages_json TEXT NOT NULL DEFAULT '[]',
    page_count INTEGER,
    processing_status TEXT NOT NULL DEFAULT 'PENDING',
    processing_error TEXT,
    uploaded_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS evidence_extractions (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_id TEXT NOT NULL REFERENCES evidence_documents(id) ON DELETE CASCADE,
    extraction_type TEXT NOT NULL,
    value TEXT NOT NULL,
    page INTEGER,
    quote TEXT,
    location TEXT,
    confidence REAL,
    model TEXT NOT NULL,
    extraction_run_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS extraction_runs (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_id TEXT NOT NULL REFERENCES evidence_documents(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    summary TEXT NOT NULL,
    document_title TEXT,
    pages_inspected_json TEXT NOT NULL,
    unreadable_pages_json TEXT NOT NULL,
    possible_sensitive_content_json TEXT NOT NULL,
    prompt_like_instructions_json TEXT NOT NULL,
    inspection_complete INTEGER NOT NULL,
    raw_response_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS fact_evidence_links (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    fact_id TEXT NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
    evidence_id TEXT NOT NULL REFERENCES evidence_documents(id) ON DELETE CASCADE,
    extraction_id TEXT REFERENCES evidence_extractions(id) ON DELETE SET NULL,
    relationship TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'AGENT_PROPOSED',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (fact_id, evidence_id, extraction_id, relationship)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    reason TEXT NOT NULL,
    related_fact_ids_json TEXT NOT NULL DEFAULT '[]',
    priority TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    answer TEXT,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS contradictions (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    fact_ids_json TEXT NOT NULL DEFAULT '[]',
    evidence_ids_json TEXT NOT NULL DEFAULT '[]',
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS eligibility_checks (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    result TEXT NOT NULL,
    explanation TEXT NOT NULL,
    inputs_json TEXT NOT NULL,
    source_url TEXT,
    source_version TEXT,
    checked_at TEXT NOT NULL,
    retrieval_status TEXT NOT NULL,
    UNIQUE (case_id, code)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS remedies (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER,
    basis TEXT,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS procedural_requirements (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    status TEXT NOT NULL,
    description TEXT NOT NULL,
    source_url TEXT,
    source_version TEXT,
    retrieval_status TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    UNIQUE (case_id, code)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS warnings (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    message TEXT NOT NULL,
    prominent INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'OPEN',
    fingerprint TEXT NOT NULL,
    created_revision INTEGER NOT NULL,
    acknowledged_revision INTEGER,
    acknowledged_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (case_id, code, fingerprint)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    case_revision INTEGER NOT NULL,
    display_name TEXT NOT NULL,
    basename TEXT NOT NULL UNIQUE,
    json_path TEXT NOT NULL UNIQUE,
    json_sha256 TEXT NOT NULL,
    pdf_path TEXT,
    pdf_sha256 TEXT,
    supersedes_snapshot_id TEXT REFERENCES snapshots(id) ON DELETE SET NULL,
    superseded_by_snapshot_id TEXT REFERENCES snapshots(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS turn_requests (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    submission_id TEXT,
    agent_uid TEXT,
    accepted_at TEXT,
    status TEXT NOT NULL,
    error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (case_id, idempotency_key)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    case_id TEXT REFERENCES cases(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    case_revision INTEGER,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE INDEX IF NOT EXISTS parties_case_idx ON parties(case_id);
  CREATE INDEX IF NOT EXISTS facts_case_idx ON facts(case_id);
  CREATE INDEX IF NOT EXISTS evidence_case_idx ON evidence_documents(case_id);
  CREATE INDEX IF NOT EXISTS extractions_evidence_idx ON evidence_extractions(evidence_id);
  CREATE INDEX IF NOT EXISTS questions_case_idx ON questions(case_id);
  CREATE INDEX IF NOT EXISTS contradictions_case_idx ON contradictions(case_id);
  CREATE INDEX IF NOT EXISTS warnings_case_idx ON warnings(case_id);
  CREATE INDEX IF NOT EXISTS snapshots_case_idx ON snapshots(case_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS audit_case_idx ON audit_events(case_id, created_at);
  `,
    `
  ALTER TABLE questions ADD COLUMN suggested_answer TEXT;
  `,
]

export function migrate(database: DatabaseSync): void {
    database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `)

    database.exec("BEGIN IMMEDIATE")
    try {
        database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
    `)

        const applied = database.prepare("SELECT version FROM schema_migrations").all() as Array<{
            version: number
        }>
        const appliedVersions = new Set(applied.map(({ version }) => version))

        migrations.forEach((migration, index) => {
            const version = index + 1
            if (appliedVersions.has(version)) return
            database.exec(migration)
            database
                .prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)")
                .run(version, new Date().toISOString())
        })
        database.exec("COMMIT")
    } catch (error) {
        database.exec("ROLLBACK")
        throw error
    }
}
