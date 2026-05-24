param(
  [int]$Port = 4000
)

$ErrorActionPreference = 'Stop'

function Get-ListeningPids([int]$TargetPort) {
  $output = cmd /c "netstat -ano | findstr :$TargetPort" 2>$null

  if (-not $output) {
    return @()
  }

  return $output |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -match 'LISTENING' } |
    ForEach-Object { ($_ -split '\s+')[-1] } |
    Where-Object { $_ } |
    Select-Object -Unique
}

$listeners = Get-ListeningPids -TargetPort $Port

foreach ($listenerPid in $listeners) {
  try {
    & taskkill.exe /PID $listenerPid /T /F | Out-Null
  } catch {
    Write-Warning "Could not stop process $listenerPid on port $Port. You may need to close it manually or run the terminal as administrator."
  }
}

if ($listeners.Count -gt 0) {
  Start-Sleep -Milliseconds 500
}

& npm.cmd --prefix apps/api run start:dev:local
