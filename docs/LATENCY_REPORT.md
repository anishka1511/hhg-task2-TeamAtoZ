# Latency report

Owner: **Builder 2**

## Method
- TBD: hardware, N queries, warm-up, text vs voice

## Results
| Stage | P50 | P70 | P100 |
|-------|-----|-----|------|
| retrieve | — | — | — |
| generate | — | — | — |
| guardrail | — | — | — |
| total (post-STT) | — | — | — |
| stt (sampled) | — | — | — |

## Notes
- Target: retrieve + generate + guardrails → final answer under 200ms when possible.
- Report STT separately and honestly.
- Numbers must come from `eval/latency_bench.js`, not a single cherry-picked run.
