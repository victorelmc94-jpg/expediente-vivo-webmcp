import {stableId} from '../core/hash.js';
import {normalizeReference} from '../core/text.js';

function normalizedReferences(analysis) {
  return (analysis.references ?? []).map((reference) => ({
    kind: reference.kind,
    value: normalizeReference(reference.value),
  }));
}

export function groupDocuments(manifest, analyses) {
  const analysisByDocument = new Map(analyses.map((analysis) => [analysis.document_id, analysis]));
  const canonical = manifest.documents.filter((document) => !document.duplicate_of);
  const groups = new Map();
  const contractOnly = [];
  const unclassified = [];
  const reviewLinks = [];

  for (const document of canonical) {
    const analysis = analysisByDocument.get(document.document_id);
    const refs = normalizedReferences(analysis ?? {references: []});
    const procedures = refs.filter((ref) => ref.kind === 'PROCEDURE');
    const contracts = refs.filter((ref) => ref.kind === 'CONTRACT');
    if (procedures.length) {
      const procedure = procedures[0].value;
      const key = `PROCEDURE:${procedure}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          procedure_refs: new Set(),
          contract_refs: new Set(),
          document_ids: [],
        });
      }
      const group = groups.get(key);
      group.procedure_refs.add(procedure);
      for (const contract of contracts) group.contract_refs.add(contract.value);
      group.document_ids.push(document.document_id);
    } else if (contracts.length) {
      contractOnly.push({document, analysis, contracts});
    } else {
      unclassified.push(document.document_id);
    }
  }

  for (const entry of contractOnly) {
    const matches = [...groups.values()].filter((group) =>
      entry.contracts.some((contract) => group.contract_refs.has(contract.value)),
    );
    if (matches.length === 1) {
      matches[0].document_ids.push(entry.document.document_id);
      for (const contract of entry.contracts) matches[0].contract_refs.add(contract.value);
    } else if (matches.length > 1) {
      unclassified.push(entry.document.document_id);
      reviewLinks.push({
        document_id: entry.document.document_id,
        reason: 'CONTRACT_LINKS_MULTIPLE_PROCEDURES',
        candidate_group_keys: matches.map((group) => group.key),
      });
    } else {
      const contract = entry.contracts[0].value;
      const key = `CONTRACT:${contract}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          procedure_refs: new Set(),
          contract_refs: new Set(),
          document_ids: [],
        });
      }
      const group = groups.get(key);
      group.document_ids.push(entry.document.document_id);
      for (const ref of entry.contracts) group.contract_refs.add(ref.value);
    }
  }

  const matters = [...groups.values()].map((group) => {
    const anchors = [
      ...[...group.procedure_refs].map((value) => ({kind: 'PROCEDURE', value})),
      ...[...group.contract_refs].map((value) => ({kind: 'CONTRACT', value})),
    ];
    const primary = anchors.find((anchor) => anchor.kind === 'PROCEDURE') ?? anchors[0];
    return {
      matter_id: stableId('matter', ...anchors.map((anchor) => `${anchor.kind}:${anchor.value}`).sort()),
      label: primary?.value ?? 'UNLABELED',
      anchor_keys: anchors,
      document_ids: [...new Set(group.document_ids)].sort(),
      related_matter_ids: [],
    };
  });

  const matterByDocument = new Map();
  for (const matter of matters) {
    for (const documentId of matter.document_ids) matterByDocument.set(documentId, matter.matter_id);
  }

  const duplicateAssignments = [];
  for (const document of manifest.documents.filter((item) => item.duplicate_of)) {
    duplicateAssignments.push({
      document_id: document.document_id,
      duplicate_of: document.duplicate_of,
      matter_id: matterByDocument.get(document.duplicate_of) ?? null,
    });
  }

  return {matters, matterByDocument, unclassified, duplicateAssignments, reviewLinks};
}

