# Load-test runbook

This runbook assumes all required values are already configured in
`performance\.env`, including `BASE_URL`, test credentials, browser settings,
the test vehicle, and load settings. Do not put credentials in this file.

## 1. Start and verify the Docker application

Run these commands from Command Prompt or PowerShell at the repository root:

```cmd
cd /d "D:\projects\Value Finder"
docker compose up -d --build
docker compose ps
curl http://localhost:3001/api/health
```

The health request must return JSON with `"status":"UP"` before running k6.

## 2. Open the performance folder

### Command Prompt

```cmd
cd /d "D:\projects\Value Finder\performance"
```

### PowerShell

```powershell
Set-Location "D:\projects\Value Finder\performance"
```

## 3. Run the tests

Run these in order. In PowerShell, use `npm.cmd` if `npm` is blocked by the
execution policy.

| Test | Command Prompt | PowerShell |
| --- | --- | --- |
| HTTP smoke test | `npm run smoke` | `npm.cmd run smoke` |
| 50 users x 4 requests = 200 requests | `npm run concurrent:50x200` | `npm.cmd run concurrent:50x200` |
| Browser admin login | `npm run smoke:browser` | `npm.cmd run smoke:browser` |
| One branch login and value-search workflow | `npm run workflow:smoke` | `npm.cmd run workflow:smoke` |
| Configured browser workflow load | `npm run workflow:load` | `npm.cmd run workflow:load` |
| Baseline HTTP load | `npm run baseline` | `npm.cmd run baseline` |
| Stress HTTP load | `npm run stress` | `npm.cmd run stress` |
| Spike HTTP load | `npm run spike` | `npm.cmd run spike` |
| Soak HTTP load | `npm run soak` | `npm.cmd run soak` |

Recommended progression:

1. `smoke`
2. `concurrent:50x200`
3. `workflow:smoke`
4. `workflow:load` with a small configured browser-user count
5. Increase configured browser users gradually: 1, 5, 10, then 20.

Do not begin at 50 browser users on one laptop. Each browser virtual user
launches Chromium and can overload the load-generator instead of the app.

## 4. Capture Docker resource metrics

Open a second terminal in the `performance` folder before running a load test:

```powershell
powershell -ExecutionPolicy Bypass -File .\monitor-docker.ps1 -Container value-finder -DurationSeconds 30
```

While it runs, execute the desired k6 command in the first terminal. The
monitor saves CPU, memory, network I/O, disk I/O, and process-count samples.

## 5. Review reports

| Report | Location |
| --- | --- |
| 50 x 200 k6 results | `reports\concurrent-50x200-summary.json` |
| Workflow k6 results | `reports\value-finder-workflow-summary.json` |
| Docker resource samples | `reports\container-metrics.csv` |

Review request failures, p95 response time, Docker CPU/memory, and database
metrics together before deciding whether the target load is acceptable.
