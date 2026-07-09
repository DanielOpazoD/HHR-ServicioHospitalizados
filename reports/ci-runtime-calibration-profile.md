# CI Runtime Calibration Profile

- Generated: 2026-07-07T00:38:20.909Z
- Git SHA: `e99a9a2e`
- Worktree dirty: `false`
- Status: `no_observed_ci_data`
- Calibration factor: `3.3x`
- Target accuracy tolerance: 20%
- Observed shard spread: 0%
- Estimator accuracy delta: 0%

## Totals

| Metric | Duration | Ratio |
| --- | ---: | ---: |
| Raw estimated | 6.8m | 0% |
| CI calibrated estimated | 22.4m | 0% |
| Observed CI | 0.0m | 100% |

## Per-Shard Calibration

| Shard | Raw Estimated | CI Estimated | Observed | CI Ratio |
| ---: | ---: | ---: | ---: | ---: |
| none | 0.0m | 0.0m | 0.0m | 0% |

## Concepts

- Shard balance: Shard balance tracks relative spread across unit shards.
- Estimator accuracy: Estimator accuracy compares estimated wall-clock runtime against observed CI.

## Recommendation

Collect observed CI runtime before calibrating the estimator.

## Advisory Findings

- No observed CI runtime data is available yet.

