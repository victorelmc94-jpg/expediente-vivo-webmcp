import path from 'node:path';

export function loadConfig(env = process.env) {
  const demoMode = env.DEMO_MODE === 'true';
  const vertexConfigured = Boolean(env.GOOGLE_CLOUD_PROJECT);
  const storageConfigured = Boolean(env.EXPEDIENTE_STORAGE_BUCKET);
  const requestedMode = demoMode
    ? 'demo-readonly'
    : env.EXPEDIENTE_EXTRACTOR ?? (vertexConfigured ? 'vertex' : 'deterministic-dev');
  return {
    port: Number(env.PORT ?? 8080),
    project: env.GOOGLE_CLOUD_PROJECT ?? null,
    location: env.GOOGLE_CLOUD_LOCATION ?? 'eu',
    model: env.EXPEDIENTE_MODEL ?? 'gemini-3.7-flash',
    bucket: env.EXPEDIENTE_STORAGE_BUCKET ?? null,
    extractorMode: requestedMode,
    demoMode,
    vertexConfigured,
    storageConfigured,
  };
}

export async function createRuntime(config) {
  if (config.demoMode) {
    return {
      mode: 'demo-readonly-precomputed',
      extractor: null,
      artifactStore: null,
    };
  }
  if (config.extractorMode === 'vertex') {
    if (!config.vertexConfigured) {
      throw new Error('Vertex mode requires GOOGLE_CLOUD_PROJECT and Application Default Credentials.');
    }
    if (!config.storageConfigured) {
      throw new Error('Vertex mode requires EXPEDIENTE_STORAGE_BUCKET.');
    }
    const [{VertexAdkExtractor}, {GcsArtifactStore}] = await Promise.all([
      import('./agent/expediente-agent.js'),
      import('./storage/gcs-artifact-store.js'),
    ]);
    return {
      mode: 'vertex-private',
      extractor: new VertexAdkExtractor(config),
      artifactStore: new GcsArtifactStore({
        bucketName: config.bucket,
        projectId: config.project,
      }),
    };
  }
  const [{DeterministicDevExtractor}, {LocalArtifactStore}] = await Promise.all([
    import('./agent/deterministic-dev-extractor.js'),
    import('./storage/local-artifact-store.js'),
  ]);
  return {
    mode: 'deterministic-local',
    extractor: new DeterministicDevExtractor(),
    artifactStore: new LocalArtifactStore({rootDirectory: path.resolve('artifacts')}),
  };
}
