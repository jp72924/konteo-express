[CmdletBinding()]
param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 8080,
    [string]$Dir,
    [string]$PythonCommand = "python"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
if (-not $Dir) { $Dir = $repoRoot }

if (-not (Get-Command $PythonCommand -ErrorAction SilentlyContinue)) {
    throw "Python command not found: $PythonCommand"
}

Write-Host "Serving RetailOps Kiosk from: $Dir"
Write-Host "Open: http://$HostName`:$Port/"
& $PythonCommand -m http.server $Port --bind $HostName --directory $Dir
