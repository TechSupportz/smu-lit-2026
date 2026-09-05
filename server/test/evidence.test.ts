import { readFile, stat, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ProcessingError } from '../src/errors.js';
import { EvidenceService, type UploadSource } from '../src/services/evidence.js';
import { createCase, makeStoreSync, testConfig } from './helpers.js';

function upload(name: string, type: string, value: string): UploadSource {
  const bytes = new TextEncoder().encode(value);
  return {
    name,
    type,
    arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
  };
}

describe('immutable evidence uploads', () => {
  it('stores a sanitized original filename, SHA-256, and read-only original', async () => {
    const { store, dir } = makeStoreSync('evidence-upload');
    try {
      const service = new EvidenceService(store, testConfig(dir));
      const created = createCase(store);
      const record = await service.upload(created.id, upload('../receipt.txt', 'text/plain', 'Paid SGD 500 on 2026-01-02.'), {
        expectedRevision: created.revision,
        documentType: 'RECEIPT',
        description: 'Payment receipt',
        relevantPages: [],
      });
      expect(record.originalFilename).toBe('receipt.txt');
      expect(record.storageKey).toMatch(new RegExp(`^${created.id}/.+\\.txt$`));
      expect(record.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(record.sizeBytes).toBeGreaterThan(0);
      expect(record.processingStatus).toBe('PENDING');

      const path = service.resolveEvidencePath(record);
      expect(await readFile(path, 'utf8')).toBe('Paid SGD 500 on 2026-01-02.');
      expect((await stat(path)).mode & 0o777).toBe(0o400);
      await expect(writeFile(path, 'replacement', { flag: 'wx' })).rejects.toMatchObject({ code: 'EEXIST' });
      expect(await readFile(path, 'utf8')).toBe('Paid SGD 500 on 2026-01-02.');
    } finally {
      store.close();
    }
  });

  it('rejects unsupported types and oversized uploads before touching storage', async () => {
    const { store, dir } = makeStoreSync('evidence-limits');
    try {
      const created = createCase(store);
      const service = new EvidenceService(store, testConfig(dir, { maxUploadBytes: 8 }));
      await expect(service.upload(created.id, upload('malware.exe', 'application/octet-stream', 'hello'), {
        expectedRevision: created.revision, documentType: null, description: null, relevantPages: [],
      })).rejects.toThrow(ProcessingError);
      await expect(service.upload(created.id, upload('too-large.txt', 'text/plain', '0123456789'), {
        expectedRevision: created.revision, documentType: null, description: null, relevantPages: [],
      })).rejects.toThrow(/upload limit/);
      expect(store.getCaseState(created.id).evidence).toEqual([]);
    } finally {
      store.close();
    }
  });

  it('requires an extraction provider key and leaves the original pending when extraction is unavailable', async () => {
    const { store, dir } = makeStoreSync('evidence-extraction');
    try {
      const service = new EvidenceService(store, testConfig(dir));
      const created = createCase(store);
      const record = await service.upload(created.id, upload('notes.txt', 'text/plain', 'Source notes.'), {
        expectedRevision: created.revision, documentType: 'NOTES', description: null, relevantPages: [],
      });
      await expect(service.extract(created.id, record.id, store.getCase(created.id).revision))
        .rejects.toThrow(/OPENROUTER_API_KEY/);
      expect(store.getEvidence(created.id, record.id).processingStatus).toBe('PENDING');
    } finally {
      store.close();
    }
  });
});
