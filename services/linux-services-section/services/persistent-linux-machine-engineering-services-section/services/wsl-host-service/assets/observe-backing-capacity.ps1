# Read-only. $expected is decoded by the owned Node caller from JSON data.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$r = Get-ItemProperty -LiteralPath $expected.registryKey
if ($r.DistributionName -cne $expected.distributionName -or
    $r.BasePath -ine $expected.basePath -or
    $r.VhdFileName -cne $expected.vhdFileName) { throw 'Registered distribution identity changed' }
$path = [IO.Path]::Combine($r.BasePath, $r.VhdFileName)
$f = Get-Item -LiteralPath $path -Force
if ($f.PSIsContainer -or ($f.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Invalid VHD file' }
$volumes = @(Get-Volume -FilePath $f.FullName)
if ($volumes.Count -ne 1) { throw 'Ambiguous backing volume' }
$v = $volumes[0]
if ($v.UniqueId -ine $expected.volumeId -or $v.HealthStatus.ToString() -ne 'Healthy') { throw 'Unknown or unhealthy backing volume' }
$root = [IO.Path]::GetPathRoot($f.FullName)
# The same FilePath observation carries its drive-letter association. A mounted
# folder or unlettered volume cannot borrow another drive's caller quota.
if (-not $v.DriveLetter -or $root -ine ($v.DriveLetter.ToString() + ':\')) { throw 'Caller quota capacity is unknown for this volume mount' }
$drive = [IO.DriveInfo]::new($root)
# AvailableFreeSpace includes the current Windows caller's disk quota.
$callerAvailable = $drive.AvailableFreeSpace
$available = [Math]::Min([UInt64]$v.SizeRemaining, [UInt64]$callerAvailable)
@{
  at = [DateTime]::UtcNow.ToString('o')
  distribution = @{ name = $r.DistributionName; basePath = $r.BasePath; vhdFileName = $r.VhdFileName }
  volume = @{ id = $v.UniqueId; totalBytes = $v.Size.ToString(); availableBytes = $available.ToString(); allocationUnitBytes = $v.AllocationUnitSize.ToString(); volumeFreeBytes = $v.SizeRemaining.ToString(); callerAvailableBytes = $callerAvailable.ToString() }
  vhd = @{ path = $f.FullName; lengthBytes = $f.Length.ToString(); attributes = [int]$f.Attributes; sparse = [bool]($f.Attributes -band [IO.FileAttributes]::SparseFile) }
} | ConvertTo-Json -Depth 5 -Compress
