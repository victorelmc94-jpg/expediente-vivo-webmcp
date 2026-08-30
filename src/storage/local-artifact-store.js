import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

export class LocalArtifactStore {
  constructor({rootDirectory = path.resolve('artifacts') } = {}) {
    this.rootDirectory = rootDirectory;
  }

  get kind() {
    return 'local-private-development';
  }

  runDirectory(runId) {
    return path.join(this.rootDirectory, 'runs', runId);
  }

  async saveInputs(runId, files) {
    const directory = path.join(this.runDirectory(runId), 'inputs');
    await mkdir(directory, {recursive: true});
    for (const file of files) {
      await writeFile(path.join(directory, file.name), file.data);
    }
  }

  async saveJson(runId, name, value) {
    const directory = this.runDirectory(runId);
    await mkdir(directory, {recursive: true});
    const target = path.join(directory, name);
    await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    return target;
  }

  async saveRun(runId, {files, dossier, report}) {
    await this.saveInputs(runId, files);
    const dossierPath = await this.saveJson(runId, 'dossier.json', dossier);
    const reportPath = path.join(this.runDirectory(runId), 'run_report.json');
    return {dossier_uri: dossierPath, report_uri: reportPath};
  }
}
