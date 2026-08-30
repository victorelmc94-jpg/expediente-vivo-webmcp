param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,
  [string]$Region = 'europe-west1',
  [string]$Service = 'expediente-vivo-judging-demo',
  [string]$ImageTag = 'readonly-demo-20260826-1'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$gcloud = Join-Path $projectRoot '.tools\gcloud-581.0.0\google-cloud-sdk\bin\gcloud.cmd'
if (-not (Test-Path -LiteralPath $gcloud)) {
  throw 'Bundled Google Cloud CLI was not found.'
}

$activeAccount = & $gcloud auth list --filter=status:ACTIVE --format='value(account)'
if ($LASTEXITCODE -ne 0 -or -not $activeAccount) {
  throw 'No active Google Cloud CLI account. Authenticate interactively before deployment.'
}

& $gcloud projects describe $ProjectId --format='value(projectId)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Project is not accessible: $ProjectId" }

$repository = 'expediente-vivo'
$demoServiceAccount = "expediente-vivo-demo@$ProjectId.iam.gserviceaccount.com"
$buildServiceAccount = "projects/$ProjectId/serviceAccounts/expediente-vivo-build@$ProjectId.iam.gserviceaccount.com"
$image = "$Region-docker.pkg.dev/$ProjectId/$repository/app:$ImageTag"
$stagingBucket = "gs://expediente-vivo-build-$ProjectId/source"

& $gcloud artifacts repositories describe $repository --project $ProjectId --location $Region --format='value(name)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Required existing Artifact Registry repository was not found: $repository" }

& $gcloud iam service-accounts describe $demoServiceAccount --project $ProjectId --format='value(email)' | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $gcloud iam service-accounts create expediente-vivo-demo --project $ProjectId --display-name 'Expediente Vivo read-only judging demo'
  if ($LASTEXITCODE -ne 0) { throw 'Unable to create the no-role demo runtime identity.' }
}

$projectRoles = & $gcloud projects get-iam-policy $ProjectId `
  --flatten='bindings[].members' `
  --filter="bindings.members:serviceAccount:$demoServiceAccount" `
  --format='value(bindings.role)'
if ($LASTEXITCODE -ne 0) { throw 'Unable to verify demo service-account roles.' }
if ($projectRoles) { throw "Demo runtime identity unexpectedly has project roles: $projectRoles" }

& $gcloud builds submit . `
  --project $ProjectId `
  --region $Region `
  --config cloudbuild.yaml `
  --service-account $buildServiceAccount `
  --gcs-source-staging-dir $stagingBucket `
  --substitutions "_IMAGE=$image"
if ($LASTEXITCODE -ne 0) { throw 'Cloud Build failed.' }

& $gcloud run deploy $Service `
  --project $ProjectId `
  --region $Region `
  --image $image `
  --service-account $demoServiceAccount `
  --no-allow-unauthenticated `
  --ingress all `
  --min-instances 0 `
  --max-instances 1 `
  --concurrency 20 `
  --cpu 1 `
  --memory 512Mi `
  --timeout 60 `
  --no-cpu-boost `
  --set-env-vars 'DEMO_MODE=true' `
  --labels 'purpose=hackathon-judging-demo,data=synthetic-readonly' `
  --quiet
if ($LASTEXITCODE -ne 0) { throw 'Private Cloud Run deployment failed.' }

$policy = & $gcloud run services get-iam-policy $Service --project $ProjectId --region $Region --format=json
if ($LASTEXITCODE -ne 0) { throw 'Unable to read back Cloud Run IAM.' }
if ($policy -match 'allUsers|allAuthenticatedUsers') {
  throw 'Unsafe public principal detected. Remove it before continuing.'
}

& $gcloud run services describe $Service `
  --project $ProjectId `
  --region $Region `
  --format='yaml(metadata.name,status.latestReadyRevisionName,status.url,spec.template.metadata.annotations,spec.template.spec.serviceAccountName,spec.template.spec.containers[0].env,spec.template.spec.containerConcurrency)'
