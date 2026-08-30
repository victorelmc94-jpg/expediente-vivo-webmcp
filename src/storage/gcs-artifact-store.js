import {Storage} from '@google-cloud/storage';

export class GcsArtifactStore {
  constructor({bucketName, projectId}) {
    if (!bucketName) throw new Error('EXPEDIENTE_STORAGE_BUCKET is required.');
    this.bucketName = bucketName;
    this.storage = new Storage({projectId});
  }

  get kind() {
    return 'gcs-private-temporary';
  }

  async saveInputs(runId, files) {
    const bucket = this.storage.bucket(this.bucketName);
    for (const file of files) {
      await bucket.file(`runs/${runId}/inputs/${file.name}`).save(file.data, {
        resumable: false,
        contentType: 'application/pdf',
        metadata: {cacheControl: 'no-store'},
      });
    }
  }

  async saveJson(runId, name, value) {
    const objectName = `runs/${runId}/${name}`;
    await this.storage.bucket(this.bucketName).file(objectName).save(
      `${JSON.stringify(value, null, 2)}\n`,
      {
        resumable: false,
        contentType: 'application/json; charset=utf-8',
        metadata: {cacheControl: 'no-store'},
      },
    );
    return `gs://${this.bucketName}/${objectName}`;
  }

  async saveRun(runId, {files, dossier, report}) {
    await this.saveInputs(runId, files);
    const dossierUri = await this.saveJson(runId, 'dossier.json', dossier);
    const reportUri = `gs://${this.bucketName}/runs/${runId}/run_report.json`;
    return {dossier_uri: dossierUri, report_uri: reportUri};
  }
}
