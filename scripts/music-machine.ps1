[CmdletBinding(DefaultParameterSetName = "Show")]
param(
    [Parameter(Mandatory = $true, ParameterSetName = "Set")]
    [string]$SetMachine,

    [Parameter(ParameterSetName = "Assert")]
    [string]$RequireMachine,

    [Parameter(ParameterSetName = "Assert")]
    [string]$RequireCapability,

    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$manifestPath = Join-Path $repoRoot "config\music-machines.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Machine manifest not found: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$knownMachines = @($manifest.machines.PSObject.Properties.Name)

function Get-LocalGitConfig([string]$Key) {
    $value = (& git -C $repoRoot config --local --get $Key 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $value) {
        return ""
    }
    return ([string]$value).Trim()
}

if ($PSCmdlet.ParameterSetName -eq "Set") {
    if ($SetMachine -notin $knownMachines) {
        throw "Unknown machine '$SetMachine'. Known machines: $($knownMachines -join ', ')"
    }
    & git -C $repoRoot config --local music.machineName $SetMachine
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set music.machineName"
    }
    & git -C $repoRoot config --local music.machineHost $env:COMPUTERNAME
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set music.machineHost"
    }
}

$machineName = Get-LocalGitConfig "music.machineName"
$boundHost = Get-LocalGitConfig "music.machineHost"
$currentHost = [string]$env:COMPUTERNAME

if (-not $machineName) {
    throw "music.machineName is not configured. Run scripts\music-machine.ps1 -SetMachine <name>."
}
if ($machineName -notin $knownMachines) {
    throw "Unknown configured machine '$machineName'. Known machines: $($knownMachines -join ', ')"
}
if (-not $boundHost) {
    throw "music.machineHost is not configured. Rebind with scripts\music-machine.ps1 -SetMachine $machineName."
}
if (-not $boundHost.Equals($currentHost, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Machine host mismatch. '$machineName' is bound to '$boundHost', current host is '$currentHost'. Rebind only after confirming the physical PC."
}

$machine = $manifest.machines.$machineName
$capabilities = @($machine.capabilities)
if ($RequireMachine -and $machineName -ne $RequireMachine) {
    throw "Machine '$machineName' cannot run this command; required machine is '$RequireMachine'."
}
if ($RequireCapability -and $RequireCapability -notin $capabilities) {
    throw "Machine '$machineName' lacks required capability '$RequireCapability'."
}

$identity = [ordered]@{
    schema_version = $manifest.schema_version
    machine_name = $machineName
    bound_hostname = $boundHost
    current_hostname = $currentHost
    hostname_match = $true
    role = [string]$machine.role
    capabilities = $capabilities
    repo_root = $repoRoot
}

if ($Json) {
    $identity | ConvertTo-Json -Depth 5
} else {
    Write-Output "machineName: $machineName"
    Write-Output "hostname: $currentHost (bound)"
    Write-Output "role: $($machine.role)"
    Write-Output "capabilities: $($capabilities -join ', ')"
}
