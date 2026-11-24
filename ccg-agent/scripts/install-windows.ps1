<#
CCG Agent — one-time setup on a Windows PC.

Prerequisites (install once, then open a NEW PowerShell window):
  winget install --id Git.Git -e
  winget install --id Python.Python.3.13 -e

Run (copy the key from Admin > CCG Agent when you create the instance):
  powershell -ExecutionPolicy Bypass -File install-windows.ps1 -Key ccga_xxx -Ref ccg-agent-foundation

What it does:
  1. Sparse-clones the CCG repo (only the ccg-agent folder) to $RepoDir. Git Credential Manager
     opens a browser once to sign in to GitHub (the repo is private).
  2. Saves CCG_AGENT_KEY / CCG_BASE_URL as user environment variables.
  3. Registers a Task Scheduler task "CCG Agent" that starts launcher.py at logon, in a visible
     console window (handy over RDP), and starts it now.
Safe to re-run (e.g. to change the key).
#>
param(
  [Parameter(Mandatory = $true)][string]$Key,
  [string]$Ref = "main",
  [string]$RepoDir = "$env:USERPROFILE\ccg",
  [string]$BaseUrl = "https://www.coalcreekguitars.com",
  [string]$RepoUrl = "https://github.com/dhopper55/ccg.git"
)
$ErrorActionPreference = "Stop"

function Need($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd not found. $hint" }
}
Need git "Run: winget install --id Git.Git -e   (then open a new PowerShell window)"
Need python "Run: winget install --id Python.Python.3.13 -e   (then open a new PowerShell window)"

$python = (Get-Command python).Source
if ($python -like "*WindowsApps*") {
  throw "python points at the Microsoft Store stub ($python). Install Python with winget (above), or turn off the 'python.exe' App execution alias in Settings."
}
if (-not $Key.StartsWith("ccga_")) { throw "That doesn't look like an agent key (should start with ccga_)." }

# 1. Code
if (-not (Test-Path "$RepoDir\.git")) {
  Write-Host "Cloning $RepoUrl (ccg-agent folder only) into $RepoDir ..."
  git clone --filter=blob:none --no-checkout --sparse $RepoUrl $RepoDir
  git -C $RepoDir sparse-checkout set ccg-agent
}
Write-Host "Checking out '$Ref' ..."
git -C $RepoDir fetch --quiet origin $Ref
git -C $RepoDir checkout --quiet --force --detach FETCH_HEAD
$agentDir = Join-Path $RepoDir "ccg-agent"
if (-not (Test-Path "$agentDir\launcher.py")) { throw "'$Ref' doesn't contain ccg-agent/launcher.py." }

# 2. Config (user environment variables; the scheduled task inherits them at logon)
[Environment]::SetEnvironmentVariable("CCG_AGENT_KEY", $Key, "User")
[Environment]::SetEnvironmentVariable("CCG_BASE_URL", $BaseUrl, "User")
$env:CCG_AGENT_KEY = $Key
$env:CCG_BASE_URL = $BaseUrl

# 3. Start at logon
$taskName = "CCG Agent"
$action = New-ScheduledTaskAction -Execute $python -Argument "`"$agentDir\launcher.py`"" -WorkingDirectory $agentDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $taskName
Write-Host ""
Write-Host "Done. A 'CCG Agent' console window should open; it creates its .venv on first start."
Write-Host "In Admin > CCG Agent, this instance should show up within a minute. Click Activate to give it jobs."
