import { config } from "./config.js"
import { EvidenceService } from "./services/evidence.js"
import { GuidanceService } from "./services/guidance.js"
import { SnapshotService } from "./services/snapshot.js"
import { PdfService } from "./services/pdf.js"
import { FlueCleanupService } from "./services/flue-cleanup.js"
import { CasePrepService } from "./services/case-prep.js"
import { CaseStore } from "./storage/case-store.js"

export const caseStore = new CaseStore(config.caseDbPath)
export const evidenceService = new EvidenceService(caseStore, config)
export const guidanceService = new GuidanceService(config)
export const snapshotService = new SnapshotService(caseStore, config)
export const pdfService = new PdfService(caseStore, config)
export const flueCleanupService = new FlueCleanupService(config)
export const casePrepService = new CasePrepService(caseStore, config, pdfService)
