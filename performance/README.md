# Performance tests

This folder contains k6 tests for Value Finder. The default HTTP scenarios call
`GET /api/health`, so they are safe to run repeatedly and do not create or
modify application data. They confirm the service is reachable; they do not
replace load tests for authenticated valuation workflows.

## Prerequisites

- Start the application first. Docker maps it to `http://localhost:3001`; the
  Vite development server uses `http://localhost:3002`.
- Install the [k6 executable](https://grafana.com/docs/k6/latest/set-up/install-k6/)
  and confirm with `k6 version`.
- Copy `.env.example` to `.env` and set `BASE_URL`. Keep `.env` private.

On Windows PowerShell, if script execution is blocked, run npm through its CMD
shim:

```powershell
npm.cmd run smoke
```

## Test commands

- `npm run smoke` — five requests from one virtual user; run this first.
- `npm run baseline` — 5 virtual users for one minute.
- `npm run stress` — ramps from 10 to 50 virtual users.
- `npm run spike` — rapidly increases to 50 virtual users.
- `npm run soak` — holds 10 virtual users for one hour.
- `npm run smoke:browser` — one real admin login; requires `ADMIN_EMAIL` and
  `ADMIN_PASSWORD` in `.env` and a Chromium-capable k6 installation.

Run only against a local, staging, or explicitly approved environment. Observe
application, database, and container CPU/memory/error metrics alongside the
k6 results. Expand the HTTP suite with read-only authenticated user flows
before using these figures as capacity results.

## 50 users and 200 requests

Run `npm run concurrent:50x200` for 50 concurrent virtual users, each making
4 requests, for 200 requests in total. The k6 report is saved to
`reports/concurrent-50x200-summary.json`. It includes request count, failures,
response-time percentiles, data transfer, and virtual-user metrics.

To record Docker resource usage, start this in a second terminal before the
load test:

```powershell
powershell -ExecutionPolicy Bypass -File .\monitor-docker.ps1 -Container value-finder -DurationSeconds 20
```

It saves CPU, memory, network I/O, block I/O, and process-count samples to
`reports/container-metrics.csv`.

This profile means 200 total requests, not 200 requests in flight at once. It
has up to 50 simultaneous requests per round. A test for 200 requests per
second or 200 in-flight requests needs a target response-time SLO and an
arrival-rate scenario.

## Login and vehicle-search workflow

`npm run workflow:smoke` runs a real branch-user workflow: sign in, load the
Make/Model/Variant/Year options from the database, and submit one vehicle
value search. It requires `BRANCH_EMPLOYEE_CODE` and `BRANCH_PASSWORD` in
`.env` and writes a browser-performance report to
`reports/value-finder-workflow-summary.json`.

Set these to one valid row in the target database. They prevent the test from
combining valid individual dropdown values into a vehicle combination that
does not exist:

```env
TEST_VEHICLE_MAKE=Eicher
TEST_VEHICLE_MODEL=188
TEST_VEHICLE_VARIANT=188
TEST_VEHICLE_YEAR=2023
```

Start with the defaults below, then use `npm run workflow:load` and increase
them carefully:

```env
WORKFLOW_USERS=1
WORKFLOW_ITERATIONS=1
```

Browser users consume substantially more load-generator CPU and memory than
HTTP users. Begin with 1, then 5, then 10 browser users; use a separate
arrival-rate HTTP test for high-volume capacity testing once a supported API
contract is available. Each workflow search writes an audit-log record, so
use an approved test environment and test account.
