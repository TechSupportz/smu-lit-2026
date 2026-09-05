import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { AppConfig } from '../config.js';
import { ProcessingError } from '../errors.js';

const AGENT_NAME = 'sct-prefiling-agent';
const ACTIVE_STATUSES = new Set(['queued', 'running', 'terminalizing', 'joining', 'joined']);

function streamPath(caseId: string): string {
  return `agents/${AGENT_NAME}/${caseId}`;
}

function sessionKey(caseId: string): string {
  return `agent-session:${JSON.stringify([AGENT_NAME, caseId, 'default', 'default'])}`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

/**
 * Flue 2.0.3 intentionally exposes abort but not conversation deletion. This
 * application-owned cleanup uses the documented durable stream/session keys
 * and the pinned SQLite schema after all active submissions have settled.
 */
export class FlueCleanupService {
  constructor(private readonly appConfig: AppConfig) {}

  async purgeCase(caseId: string, timeoutMs = 10_000): Promise<{ submissions: number; streamRemoved: boolean }> {
    const database = new DatabaseSync(this.appConfig.flueDbPath);
    try {
      database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      if (!this.hasTable(database, 'flue_agent_submissions')) {
        return { submissions: 0, streamRemoved: false };
      }
      const key = sessionKey(caseId);
      const deadline = Date.now() + timeoutMs;
      while (true) {
        const rows = database.prepare('SELECT status FROM flue_agent_submissions WHERE session_key = ?').all(key) as Array<{ status: string }>;
        if (!rows.some((row) => ACTIVE_STATUSES.has(row.status))) break;
        if (Date.now() >= deadline) {
          throw new ProcessingError('Timed out waiting for active agent work to stop; case deletion was not started.', {
            caseId,
            retryable: true,
          });
        }
        await sleep(50);
      }

      const path = streamPath(caseId);
      const submissionRows = database.prepare('SELECT submission_id FROM flue_agent_submissions WHERE session_key = ?')
        .all(key) as Array<{ submission_id: string }>;
      const submissionIds = submissionRows.map((row) => row.submission_id);
      const streamRemoved = this.hasTable(database, 'flue_conversation_streams')
        && database.prepare('SELECT 1 FROM flue_conversation_streams WHERE path = ?').get(path) !== undefined;

      database.exec('BEGIN IMMEDIATE');
      try {
        if (submissionIds.length > 0 && this.hasTable(database, 'flue_submission_chunks')) {
          const placeholders = submissionIds.map(() => '?').join(', ');
          database.prepare(`DELETE FROM flue_submission_chunks WHERE submission_id IN (${placeholders})`)
            .run(...submissionIds as SQLInputValue[]);
        }
        this.deleteByPath(database, 'flue_attachment_chunks', path);
        this.deleteByPath(database, 'flue_attachments', path);
        this.deleteByPath(database, 'flue_conversation_stream_batch_chunks', path);
        this.deleteByPath(database, 'flue_conversation_stream_batches', path);
        this.deleteByPath(database, 'flue_conversation_fold_checkpoint_chunks', path);
        this.deleteByPath(database, 'flue_conversation_fold_checkpoints', path);
        this.deleteByPath(database, 'flue_conversation_streams', path);
        database.prepare('DELETE FROM flue_agent_submissions WHERE session_key = ?').run(key);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      return { submissions: submissionIds.length, streamRemoved };
    } finally {
      database.close();
    }
  }

  private hasTable(database: DatabaseSync, table: string): boolean {
    return database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== undefined;
  }

  private deleteByPath(database: DatabaseSync, table: string, path: string): void {
    if (!this.hasTable(database, table)) return;
    const column = table.startsWith('flue_attachment') ? 'stream_path' : 'path';
    database.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).run(path);
  }
}
