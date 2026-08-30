import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {inspectBatch} from '../pdf/ingest.js';
import {validateAssertionCandidates, assertCompleteProvenance} from '../provenance/validate.js';
import {groupDocuments} from '../matters/group.js';
import {reconstructDossier} from '../matters/reconstruct.js';

function stageRecorder(stages) {
  return async function runStage(name, operation) {
    const started = performance.now();
    try {
      const result = await operation();
      stages.push({name, status: 'PASS', duration_ms: Math.round(performance.now() - started)});
      return result;
    } catch (error) {
      stages.push({
        name,
        status: 'FAIL',
        duration_ms: Math.round(performance.now() - started),
        error_code: error.code ?? error.name,
        error_message: error.message,
      });
      throw error;
    }
  };
}

export async function runVerticalSlice({files, extractor, artifactStore, subjectParty = 'ALICIA DEMO'}) {
  const runId = randomUUID();
  const startedAt = new Date();
  const stages = [];
  const runStage = stageRecorder(stages);

  const manifest = await runStage('inspect_and_packetize_pdfs', () => inspectBatch(files));
  const extraction = await runStage('expediente_agent_extracts_candidates', () =>
    extractor.extract(manifest),
  );
  const validation = await runStage('deterministic_provenance_gate', async () =>
    validateAssertionCandidates(manifest, extraction.candidates),
  );
  await runStage('provenance_coverage_gate', async () =>
    assertCompleteProvenance(validation.accepted),
  );
  const grouping = await runStage('group_documents_by_matter', async () =>
    groupDocuments(manifest, extraction.analyses),
  );
  const dossier = await runStage('reconstruct_dossier', async () =>
    reconstructDossier({
      manifest,
      analyses: extraction.analyses,
      assertions: validation.accepted,
      grouping,
      subjectParty,
    }),
  );

  dossier.run_id = runId;
  dossier.extractor_mode = extractor.mode;
  const report = {
    run_id: runId,
    status: validation.rejected.length ? 'COMPLETED_WITH_REVIEW' : 'COMPLETED',
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    extractor_mode: extractor.mode,
    artifact_store: artifactStore.kind,
    model: extractor.model ?? null,
    stages,
    metrics: {
      input_files: manifest.total_files,
      canonical_files: manifest.canonical_files,
      duplicate_files: manifest.duplicate_files,
      canonical_pages: manifest.canonical_pages,
      matters: dossier.matters.length,
      accepted_assertions: validation.accepted.length,
      rejected_assertions: validation.rejected.length,
      supported_without_valid_citation: 0,
      critical_errors: 0,
    },
    rejected_candidates: validation.rejected,
    model_events: extraction.model_events,
  };

  const uris = await runStage('persist_dossier_and_report', () =>
    artifactStore.saveRun(runId, {files, dossier, report}),
  );
  report.artifacts = uris;
  await artifactStore.saveJson(runId, 'run_report.json', report);

  return {run_id: runId, dossier, report, manifest, extraction, validation};
}
