$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptRoot
$backendPort = 8080
$frontendPort = 4173

function Stop-ListeningProcess {
    param(
        [int]$Port
    )

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $connection) {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped process on port $Port." -ForegroundColor Yellow
    } else {
        Write-Host "No process found on port $Port." -ForegroundColor DarkGray
    }
}

Stop-ListeningProcess -Port $backendPort
Stop-ListeningProcess -Port $frontendPort

Write-Host "Dev processes stopped." -ForegroundColor Green
