#!/usr/bin/env node

const readArgValue = (flag, fallback = '') => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
};

const expectedArtifact = readArgValue('--artifact', process.env.EXPECTED_ARTIFACT || 'dist');
const producerJob = readArgValue(
  '--producer',
  process.env.EXPECTED_ARTIFACT_PRODUCER || 'build-budget'
);

const {
  GITHUB_API_URL = 'https://api.github.com',
  GITHUB_REPOSITORY: repository,
  GITHUB_RUN_ID: runId,
  GITHUB_RUN_ATTEMPT: runAttempt = '1',
  GITHUB_SHA: commit,
  GITHUB_WORKFLOW: workflow,
  GITHUB_SERVER_URL = 'https://github.com',
  GITHUB_TOKEN: token,
} = process.env;

const fail = message => {
  console.error(`[postmerge-evidence] ${message}`);
  console.error(`[postmerge-evidence] expectedArtifact=${expectedArtifact}`);
  console.error(`[postmerge-evidence] expectedProducer=${producerJob}`);
  console.error(`[postmerge-evidence] workflow=${workflow || 'unknown'}`);
  console.error(`[postmerge-evidence] run=${runId || 'unknown'} attempt=${runAttempt}`);
  console.error(`[postmerge-evidence] commit=${commit || 'unknown'}`);
  if (repository && runId) {
    console.error(
      `[postmerge-evidence] runUrl=${GITHUB_SERVER_URL}/${repository}/actions/runs/${runId}`
    );
  }
  process.exit(1);
};

if (!repository || !runId || !token) {
  fail('Cannot verify artifact availability because GitHub Actions context is incomplete.');
}

const response = await fetch(
  `${GITHUB_API_URL}/repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`,
  {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  }
);

if (!response.ok) {
  const body = await response.text();
  fail(`GitHub artifact API returned ${response.status}: ${body.slice(0, 500)}`);
}

const payload = await response.json();
const artifacts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
const artifact = artifacts.find(candidate => candidate?.name === expectedArtifact);

if (!artifact) {
  const available = artifacts.map(candidate => candidate.name).filter(Boolean);
  fail(
    `Required artifact was not uploaded before post-merge evidence. Available artifacts: ${
      available.length > 0 ? available.join(', ') : 'none'
    }.`
  );
}

if (artifact.expired) {
  fail(`Required artifact "${expectedArtifact}" exists but is expired.`);
}

console.log(
  `[postmerge-evidence] Artifact "${expectedArtifact}" is available for run ${runId} (id=${artifact.id}).`
);
