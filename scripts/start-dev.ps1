$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptRoot
$frontendRoot = Join-Path $projectRoot "web"
$nodePath = "C:\Program Files\nodejs"
$backendPort = 8080
$frontendPort = 4173
$postgresService = "postgresql-x64-17"

function Test-PortListening {
    param(
        [int]$Port
    )

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $connection
}

Write-Host "Checking PostgreSQL service..." -ForegroundColor Cyan
$service = Get-Service -Name $postgresService -ErrorAction Stop
if ($service.Status -ne "Running") {
    Write-Host "Starting PostgreSQL..." -ForegroundColor Yellow
    Start-Service -Name $postgresService
}

Write-Host "PostgreSQL is running." -ForegroundColor Green

if (-not (Test-PortListening -Port $backendPort)) {
    Write-Host "Starting backend on port $backendPort..." -ForegroundColor Cyan

    $backendCommand = @"
Set-Location '$projectRoot'
`$env:APP_ENV='development'
`$env:APP_HOST='127.0.0.1'
`$env:APP_PORT='$backendPort'
`$env:APP_LOG_LEVEL='info'
`$env:APP_SEED_MOCK_DATA='true'
`$env:DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/network_monitoring?sslmode=disable'
go run ./cmd/api
"@

    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null
} else {
    Write-Host "Backend is already running on port $backendPort." -ForegroundColor Green
}

Start-Sleep -Seconds 3

if (-not (Test-PortListening -Port $frontendPort)) {
    Write-Host "Starting frontend on port $frontendPort..." -ForegroundColor Cyan

    $frontendCommand = @"
Set-Location '$frontendRoot'
`$env:Path='$nodePath;' + `$env:Path
npm run dev -- --host 127.0.0.1 --port $frontendPort
"@

    Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand | Out-Null
} else {
    Write-Host "Frontend is already running on port $frontendPort." -ForegroundColor Green
}

Start-Sleep -Seconds 5

Write-Host "Opening frontend in browser..." -ForegroundColor Cyan
Start-Process "http://127.0.0.1:$frontendPort"

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:$frontendPort"
Write-Host "Backend health: http://127.0.0.1:$backendPort/api/v1/health"

