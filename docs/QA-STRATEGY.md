# Paw Mall — Quality Assurance Strategy

## 1. Purpose

This document defines the quality engineering approach for Paw Mall, a mobile application
designed to help pet owners discover relevant pet businesses and pet-friendly places in Mexico.

Quality assurance focuses on search relevance, business-data integrity, application reliability,
security, and a consistent mobile user experience.

The work is organized around five quality pillars, used in this document and in the
[README](../README.md#quality-engineering), where each pillar is mapped to its current evidence:

| Pillar                                   | Objectives (§2)                                                      | Main risks (§3)                                                       | Strategy sections |
| ---------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------- |
| **Search quality and relevance**         | Multi-token search, relevance, consistency across platforms          | Search failures, ranking, missing results, false positives            | §4, §5            |
| **Business-data integrity and trust**    | Trustworthy listings with provenance and verification                | Emergency information, duplicate or stale listings, importer failures | §4, §6            |
| **API, database and mobile reliability** | Regressions detected; consistent mobile behavior                     | Database or API failures, location and navigation defects, load       | §4                |
| **Security and privacy**                 | User data protected; no unauthorized API operations                  | Unauthorized write or administrative operations                       | §4, §7            |
| **Continuous and AI-assisted quality**   | Automated regression detection; measurable criteria before the pilot | All of the above, caught before merge                                 | §7, §8, §9        |

## 2. Quality objectives

- Enable users to discover relevant businesses through flexible multi-token searches.
- Maximize the relevance and completeness of search results while minimizing false positives.
- Maintain trustworthy business listings with clear data provenance and verification status.
- Ensure consistent search behavior across supported mobile platforms.
- Protect user data and prevent unauthorized API operations.
- Detect regressions through automated testing and continuous integration.
- Establish measurable quality criteria before pilot deployment.

## 3. Risk-based testing priorities

| Priority     | Risks                                                                                                                                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Critical** | Incorrect or misleading emergency veterinary information. Unauthorized administrative or write operations. Search failures that prevent users from discovering relevant businesses. Database or API failures that cause data loss or uncontrolled application errors. |
| **High**     | Incorrect search ranking, missing relevant results, or excessive false positives. Duplicate, stale, or incomplete business listings. Geographic filtering and location-permission failures. Importer failures that leave inconsistent data.                           |
| **Medium**   | Mobile navigation, accessibility, and presentation defects. Incorrect map/list synchronization, favorites, or sharing behavior. Performance degradation under increased search load.                                                                                  |

## 4. Test strategy

- **Unit testing.** Validate tokenization, text normalization, search matching, ranking rules,
  input validation, and shared business-data schemas.
- **API and database integration testing.** Validate search filters, pagination, geographic
  boundaries, API error handling, rate limits, database outages, and migration behavior.
- **Data quality testing.** Validate required fields, geographic coordinates, duplicate
  detection, source attribution, verification status, and importer recovery.
- **Mobile end-to-end testing.** Validate critical user journeys on Android and iOS, including
  search, result selection, place details, map/list navigation, location permissions, and error
  recovery.
- **Nonfunctional testing.** Evaluate search latency, API reliability, concurrency, security
  controls, and recovery from dependency failures.

## 5. Search quality evaluation

Maintain a version-controlled benchmark of representative Spanish-language queries from the
target pilot regions. The benchmark should include multi-token searches, synonyms, accents,
spelling variations, service-specific queries, geographic filters, and negative cases. Expected
results must be independently reviewed and labeled for relevance.

Track:

- Recall@10
- Precision@10
- Zero-result rate
- Search latency
- Search regression rate
- Relevant-business discovery compared with selected alternative services

Establish baseline measurements before setting release thresholds. Search changes must be
evaluated against the benchmark to identify improvements and regressions.

## 6. Data quality and trust

Data validation covers completeness, validity, uniqueness, freshness, provenance, and
verification status.

Priority listings, particularly emergency services, require appropriate evidence for critical
claims such as telephone numbers and operating hours.

Data-quality reports should identify duplicate candidates, missing fields, invalid coordinates,
stale verification, and importer failures. Reports must distinguish confirmed defects from
limitations in source coverage.

## 7. Continuous integration and release gates

Pull requests should pass formatting, linting, type checking, relevant automated tests, and
search regression checks when search behavior changes.

Release candidates should undergo platform-appropriate end-to-end testing, database migration
validation, API failure testing, and smoke testing.

Pilot deployment additionally requires documented backup and restoration procedures, security
configuration, monitoring, privacy disclosures, and verification of priority listings.

Every release should record the tested build or commit, test outcomes, known defects, accepted
risks, and release decision.

## 8. AI-assisted quality engineering

AI-assisted tools may support test design, boundary-case discovery, test implementation, failure
analysis, and data-quality automation.

AI-generated test cases and code require human review. Expected results must be independently
validated, and automated execution must provide evidence of actual behavior. Sensitive data and
secrets must not be exposed to AI tools.

## 9. Quality reporting

Quality reporting should distinguish:

- Automated test coverage and pass/fail results.
- Search relevance and performance measurements.
- Data-quality findings and resolution status.
- Open defects by severity and risk.
- Known limitations and untested areas.
- Release readiness and accepted risks.

No quality metric should be reported as achieved until supported by reproducible test evidence.

## 10. Current project status

Paw Mall is in development. Production readiness, pilot quality thresholds, and
search-performance baselines must be established and verified before public rollout.

Status of each part of this strategy on 2026-10-14. The measured results are in the
[README's current baseline](../README.md#quality-engineering); the README's known gaps are the
rows below that are not yet in place.

| Strategy area                        | Status      | Evidence or gap                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit testing (§4)                    | In place    | 373 Vitest tests across the four packages, including tokenization, normalization, search matching and shared schemas                                                                                                                                                                                 |
| API and database integration (§4)    | In place    | API tests on their own database (`paw_mall_test`, migrated by the test setup): filters, paging, radius, errors, rate limits, CORS, the database down                                                                                                                                                 |
| Data quality testing (§4, §6)        | In place    | `pnpm places:integrity`; importer tests with sample files, including an interrupted import; verification status on every place                                                                                                                                                                       |
| Mobile end-to-end testing (§4)       | Partial     | 31 Maestro flows, 36 journeys on Android; iOS in Expo Go (all but `offline`), not a development build; the CI end-to-end workflow has not run yet ([TESTING-E2E.md](TESTING-E2E.md))                                                                                                                 |
| Nonfunctional testing (§4)           | Partial     | Local k6 load test, p95 229 ms ([DEVELOPMENT.md](DEVELOPMENT.md#load-test)); failure tests for the API and database; no measurement of a deployed system                                                                                                                                             |
| Search quality benchmark (§5)        | Partial     | `pnpm search:bench` (Phases 17–19): 49 labeled queries with precision@10, recall@10, zero results, known items, negative cases, place intent, latency and regressions against a committed baseline; labels await the owner's review, so no release thresholds yet; no comparison with other services |
| Priority-listing evidence (§6)       | Partial     | Urgencias cards show their verification status; 162 Urgencias places still have no phone                                                                                                                                                                                                             |
| Pull request gates (§7)              | Partial     | CI runs lint, type checks and tests on every pull request; formatting is checked locally (`pnpm format:check`), not in CI; the search regression check (`pnpm search:bench --check`) runs locally, since it needs the dev data                                                                       |
| Release records (§7)                 | Partial     | Each phase records its branch, merge commit, checks, "Done when" outcome and follow-ups in [DEPLOYMENT.md](DEPLOYMENT.md); nothing has been released yet                                                                                                                                             |
| Pilot requirements (§7)              | Not started | No production database, backup and restore procedure, monitoring or privacy disclosure yet                                                                                                                                                                                                           |
| AI-assisted quality engineering (§8) | In place    | Built with Claude Code under [CLAUDE.md](../CLAUDE.md); every change is reviewed in a pull request and merged on the owner's approval; keys are never printed or committed                                                                                                                           |
| Quality reporting (§9)               | Partial     | Test results in CI and in [DEPLOYMENT.md](DEPLOYMENT.md); open issues are tracked as phase follow-ups and open decisions there, not yet by severity                                                                                                                                                  |

This strategy is a living document and should evolve as test evidence, user feedback, and pilot
results become available.
