# Local development setup (Windows PowerShell)
# Prerequisites: Node.js, Docker Desktop (running), Supabase CLI

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $ProjectRoot

Write-Host "Checking Docker..."
docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker is not running. Start Docker Desktop, wait until it is ready, then re-run this script."
  exit 1
}

Write-Host "Starting Supabase..."
supabase start

Write-Host "Applying migrations and seed data..."
supabase db reset --yes

Write-Host "Reading Supabase keys..."
$status = supabase status -o json | ConvertFrom-Json
$anonKey = $status.ANON_KEY
$apiUrl = $status.API_URL

if (-not $anonKey) {
  Write-Host "Could not read anon key from supabase status."
  exit 1
}

$envContent = @"
NEXT_PUBLIC_SUPABASE_URL=$apiUrl
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anonKey
"@

# Write without BOM so Next.js can read env keys reliably
[System.IO.File]::WriteAllText((Join-Path $ProjectRoot ".env.local"), $envContent + "`n")
Write-Host "Wrote .env.local"

Write-Host ""
Write-Host "Setup complete. Run: npm run dev"
Write-Host ""
Write-Host "Seed users (password: Password123!):"
Write-Host "  requester@example.com"
Write-Host "  agent@example.com"
Write-Host "  approver@example.com"
