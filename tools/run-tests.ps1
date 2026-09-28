# Runs tests.html in headless Chrome/Edge and prints the results.
# Usage (from the repo root):  powershell -ExecutionPolicy Bypass -File tools\run-tests.ps1
# Writes test-results.json next to tests.html. Exit code 1 if any test fails.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'No Chrome or Edge found. Open tests.html in a browser instead.' }
$url = 'file:///' + ((Join-Path $root 'tests.html') -replace '\\', '/')
$profile = Join-Path ([IO.Path]::GetTempPath()) ('solo-test-profile-' + [Guid]::NewGuid())
$dom = & $browser --headless=new --disable-gpu --no-first-run --user-data-dir="$profile" --allow-file-access-from-files --virtual-time-budget=60000 --dump-dom $url 2>$null | Out-String
Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
$m = [regex]::Match($dom, '<pre id="json">(.*?)</pre>', 'Singleline')
if (-not $m.Success -or -not $m.Groups[1].Value) { throw 'Could not read results from tests.html (did a script fail to load?)' }
$json = [Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
[IO.File]::WriteAllText((Join-Path $root 'test-results.json'), $json, (New-Object Text.UTF8Encoding($false)))
$r = $json | ConvertFrom-Json
foreach ($t in $r.results) {
  if (-not $t.pass) { Write-Host ("FAIL  [{0}] {1}`n      {2}" -f ($(if ($t.card) { $t.card } else { 'core' })), $t.name, $t.error) -ForegroundColor Red }
}
$cardsPass = @($r.perCard.PSObject.Properties | Where-Object { $_.Value }).Count
Write-Host ("{0}/{1} tests pass, {2} fail. Cards fully passing: {3}/150. Missing card tests: {4}" -f $r.pass, $r.total, $r.fail, $cardsPass, ($(if ($r.missing.Count) { $r.missing -join ', ' } else { 'none' })))
if ($r.fail -gt 0 -or $r.missing.Count -gt 0) { exit 1 }
