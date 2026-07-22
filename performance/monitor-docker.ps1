param(
  [string]$Container = "value-finder",
  [int]$DurationSeconds = 15,
  [string]$OutputPath = "reports/container-metrics.csv"
)

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

'timestamp,cpu_percent,memory_usage,memory_limit,memory_percent,net_io,block_io,pids' |
  Set-Content -Path $OutputPath

for ($sample = 0; $sample -lt $DurationSeconds; $sample++) {
  $stats = docker stats $Container --no-stream --format '{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}},{{.PIDs}}'
  if ($LASTEXITCODE -ne 0) {
    throw "Could not collect Docker metrics for container '$Container'."
  }

  "$(Get-Date -Format o),$stats" | Add-Content -Path $OutputPath
  Start-Sleep -Seconds 1
}

Write-Host "Saved container metrics to $OutputPath"
