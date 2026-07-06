const EXPECTED_UNIT_SHARD_COUNT = 4;
const UNIT_SHARD_JOB_PATTERN = /^unit-risk-shard-(\d+)$/;

/**
 * @typedef {object} CiRuntimeInputJob
 * @property {string} [name]
 * @property {string} [status]
 * @property {string} [conclusion]
 * @property {string} [startedAt]
 * @property {string} [completedAt]
 */

/**
 * @typedef {object} CiRuntimeShardJob
 * @property {string} name
 * @property {number} index
 * @property {string} status
 * @property {string} conclusion
 * @property {string} startedAt
 * @property {string} completedAt
 * @property {number} durationMs
 */

const roundOneDecimal = value => Math.round(Number(value || 0) * 10) / 10;

const formatMinutes = ms => `${(Number(ms || 0) / 60000).toFixed(1)}m`;

const parseTimeMs = value => {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const calculateSpread = shards => {
  const durations = shards.map(shard => Number(shard.durationMs || 0)).filter(duration => duration > 0);
  const slowestMs = Math.max(...durations, 0);
  const fastestMs = Math.min(...durations, slowestMs || 0);
  const spreadMs = Math.max(0, slowestMs - fastestMs);
  return {
    fastestMs,
    slowestMs,
    spreadMs,
    spreadPercent: fastestMs > 0 ? roundOneDecimal((spreadMs / fastestMs) * 100) : 0,
  };
};

const isCompletedJob = job => {
  const status = String(job?.status || '').toUpperCase();
  return status === 'COMPLETED' || status === 'COMPLETED_AT' || Boolean(job?.completedAt);
};

/**
 * @param {CiRuntimeInputJob[]} jobs
 * @returns {CiRuntimeShardJob[]}
 */
export const normalizeCiRuntimeJobs = jobs =>
  (jobs || [])
    .map(job => {
      const match = String(job?.name || '').match(UNIT_SHARD_JOB_PATTERN);
      if (!match || !isCompletedJob(job)) return null;
      const startedAtMs = parseTimeMs(job.startedAt);
      const completedAtMs = parseTimeMs(job.completedAt);
      const durationMs = Math.max(0, completedAtMs - startedAtMs);
      if (durationMs <= 0) return null;
      const index = Number(match[1]);
      if (index < 1 || index > EXPECTED_UNIT_SHARD_COUNT) return null;
      return {
        name: String(job.name),
        index,
        status: String(job.status || 'COMPLETED').toUpperCase(),
        conclusion: String(job.conclusion || '').toUpperCase(),
        startedAt: String(job.startedAt || ''),
        completedAt: String(job.completedAt || ''),
        durationMs,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);

/**
 * @param {CiRuntimeInputJob[]} jobs
 * @returns {string[]}
 */
const collectUnexpectedShardJobs = jobs =>
  (jobs || [])
    .filter(job => {
      const match = String(job?.name || '').match(UNIT_SHARD_JOB_PATTERN);
      if (!match || !isCompletedJob(job)) return false;
      const index = Number(match[1]);
      return index < 1 || index > EXPECTED_UNIT_SHARD_COUNT;
    })
    .map(job => String(job.name))
    .sort();

/**
 * @param {{ jobs?: CiRuntimeInputJob[], tolerancePercent?: number }} [options]
 */
export const buildCiRuntimeObservedProfile = ({ jobs = [], tolerancePercent = 25 } = {}) => {
  const normalizedJobs = normalizeCiRuntimeJobs(jobs);
  const unexpectedShardJobs = collectUnexpectedShardJobs(jobs);

  if (normalizedJobs.length === 0 && unexpectedShardJobs.length === 0) {
    return {
      reportId: 'ci-runtime-observed-profile',
      status: 'no_observed_ci_data',
      summary: {
        observedShardCount: 0,
        expectedShardCount: EXPECTED_UNIT_SHARD_COUNT,
        totalDurationMs: 0,
        spreadPercent: 0,
        tolerancePercent,
      },
      shards: [],
      unexpectedShardJobs: [],
      recommendation:
        'No observed CI unit shard data is available yet; keep this signal advisory until GitHub Actions data is captured.',
    };
  }

  const spread = calculateSpread(normalizedJobs);
  const totalDurationMs = normalizedJobs.reduce((sum, job) => sum + job.durationMs, 0);
  const slowestShard = normalizedJobs.reduce(
    (selected, shard) => (shard.durationMs > selected.durationMs ? shard : selected),
    normalizedJobs[0] || { index: 0, durationMs: 0 }
  );
  const fastestShard = normalizedJobs.reduce(
    (selected, shard) => (shard.durationMs < selected.durationMs ? shard : selected),
    normalizedJobs[0] || { index: 0, durationMs: 0 }
  );
  const outsideTolerance = spread.spreadPercent > Number(tolerancePercent || 0);

  return {
    reportId: 'ci-runtime-observed-profile',
    status: 'observed_ci_data',
    summary: {
      observedShardCount: normalizedJobs.length,
      expectedShardCount: EXPECTED_UNIT_SHARD_COUNT,
      totalDurationMs,
      slowestShard: {
        index: slowestShard.index,
        durationMs: slowestShard.durationMs,
      },
      fastestShard: {
        index: fastestShard.index,
        durationMs: fastestShard.durationMs,
      },
      ...spread,
      tolerancePercent: Number(tolerancePercent || 0),
    },
    shards: normalizedJobs,
    unexpectedShardJobs,
    recommendation: outsideTolerance
      ? 'Observed CI unit shard spread is outside tolerance; review perFileOverheadMs, durationHints, affinityGroups or lockedAssignments after more than one run.'
      : 'Observed CI unit shard spread is within observed tolerance; keep monitoring trend data.',
  };
};

export const collectCiRuntimeTelemetryIssues = profile => {
  const issues = [];
  if (!profile || typeof profile !== 'object') {
    return ['CI runtime telemetry report is missing or invalid.'];
  }
  if (profile.status === 'no_observed_ci_data') return issues;
  if (profile.status !== 'observed_ci_data') {
    issues.push(`CI runtime telemetry has unsupported status: ${String(profile.status || 'missing')}.`);
  }
  for (const name of profile.unexpectedShardJobs || []) {
    issues.push(`Observed CI runtime includes unexpected unit shard job: ${name}.`);
  }
  const observed = Number(profile.summary?.observedShardCount || 0);
  const expected = Number(profile.summary?.expectedShardCount || EXPECTED_UNIT_SHARD_COUNT);
  if (profile.status === 'observed_ci_data' && observed !== expected) {
    issues.push(`Observed CI runtime declares data but only includes ${observed}/${expected} unit shards.`);
  }
  return issues;
};

export const compareEstimatedAndObservedRuntime = ({ estimatedProfile, observedProfile }) => {
  if (!observedProfile || observedProfile.status === 'no_observed_ci_data') {
    return {
      status: 'no_observed_ci_data',
      blockingIssues: [],
      advisoryFindings: ['No observed CI runtime data is available yet.'],
    };
  }

  const blockingIssues = collectCiRuntimeTelemetryIssues(observedProfile);
  const advisoryFindings = [];
  const observedSpread = Number(observedProfile.summary?.spreadPercent || 0);
  const observedTolerance = Number(observedProfile.summary?.tolerancePercent || 0);
  const estimatedSpread = Number(estimatedProfile?.summary?.spreadPercent || 0);
  const estimatedTolerance = Number(estimatedProfile?.summary?.tolerancePercent || 0);

  if (observedSpread > observedTolerance) {
    advisoryFindings.push(
      `Observed CI shard spread ${observedSpread}% exceeds advisory tolerance ${observedTolerance}%.`
    );
  }
  if (estimatedSpread <= estimatedTolerance && observedSpread > observedTolerance) {
    advisoryFindings.push(
      `Observed CI runtime is imbalanced while estimated balance is still within tolerance (${estimatedSpread}%).`
    );
  }

  for (const observedShard of observedProfile.shards || []) {
    const estimatedShard = (estimatedProfile?.shards || []).find(
      shard => Number(shard.index) === Number(observedShard.index)
    );
    if (!estimatedShard) continue;
    const estimatedDurationMs = Number(estimatedShard.estimatedDurationMs || 0);
    const observedDurationMs = Number(observedShard.durationMs || 0);
    if (estimatedDurationMs > 0 && observedDurationMs > 0) {
      const ratio = roundOneDecimal((observedDurationMs / estimatedDurationMs) * 100);
      if (ratio >= 250) {
        advisoryFindings.push(
          `Observed shard ${observedShard.index} runtime is ${ratio}% of the estimated duration.`
        );
      }
    }
  }

  return {
    status: observedSpread > observedTolerance ? 'observed_outside_tolerance' : 'observed_within_tolerance',
    blockingIssues,
    advisoryFindings,
  };
};

export const formatCiRuntimeObservedProfileMarkdown = profile => {
  const lines = [
    '# CI Runtime Observed Profile',
    '',
  ];

  if (profile.generatedAt) {
    lines.push(`- Generated: ${profile.generatedAt}`);
  }
  if (profile.gitSha) {
    lines.push(`- Git SHA: \`${profile.gitSha}\``);
  }
  if (typeof profile.gitDirty === 'boolean') {
    lines.push(`- Worktree dirty: \`${profile.gitDirty}\``);
  }

  lines.push(
    `- Status: \`${profile.status}\``,
    `- Observed shards: ${profile.summary?.observedShardCount || 0}/${profile.summary?.expectedShardCount || EXPECTED_UNIT_SHARD_COUNT}`,
    `- Spread: ${profile.summary?.spreadPercent || 0}% (tolerance ${profile.summary?.tolerancePercent || 0}%)`,
    ''
  );

  if (profile.status === 'no_observed_ci_data') {
    lines.push(profile.recommendation, '');
    return `${lines.join('\n')}\n`;
  }

  lines.push(
    '## Observed Unit Shards',
    '',
    '| Shard | Job | Duration | Conclusion |',
    '| ---: | --- | ---: | --- |',
    ...(profile.shards || []).map(
      shard => `| ${shard.index} | ${shard.name} | ${formatMinutes(shard.durationMs)} | ${shard.conclusion || 'UNKNOWN'} |`
    ),
    '',
    '## Recommendation',
    '',
    profile.recommendation,
    ''
  );

  if ((profile.unexpectedShardJobs || []).length > 0) {
    lines.push('## Structural Warnings', '', ...profile.unexpectedShardJobs.map(name => `- ${name}`), '');
  }

  return `${lines.join('\n')}\n`;
};
