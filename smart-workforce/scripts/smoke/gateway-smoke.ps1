$ErrorActionPreference = 'Stop'

Write-Host '[1/4] Gateway health should be internal-only (external => 403)...'
try {
  Invoke-WebRequest -Uri 'http://localhost:8080/health' -UseBasicParsing | Out-Null
  throw 'Expected 403 for /health but request succeeded'
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -ne 403) { throw "Expected 403 from /health, got $status" }
  Write-Host "OK /health => $status"
}

Write-Host '[2/4] Protected route without token should return 401...'
try {
  Invoke-WebRequest -Uri 'http://localhost:8080/api/users' -UseBasicParsing | Out-Null
  throw 'Expected 401 for /api/users without token but request succeeded'
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -ne 401) { throw "Expected 401 for /api/users without token, got $status" }
  Write-Host "OK /api/users => $status"
}

Write-Host '[3/4] Internal auth endpoint should not be externally reachable...'
try {
  Invoke-WebRequest -Uri 'http://localhost:8080/_auth' -UseBasicParsing | Out-Null
  throw 'Expected 404 for /_auth but request succeeded'
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -ne 404) { throw "Expected 404 for /_auth, got $status" }
  Write-Host "OK /_auth => $status"
}

Write-Host '[4/4] Public login route should hit auth service (empty body => 400)...'
try {
  Invoke-WebRequest -Uri 'http://localhost:8080/api/auth/login' -Method POST -ContentType 'application/json' -Body '{}' -UseBasicParsing | Out-Null
  throw 'Expected 400 for /api/auth/login with empty body but request succeeded'
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -ne 400) { throw "Expected 400 for /api/auth/login empty body, got $status" }
  Write-Host "OK /api/auth/login => $status"
}

Write-Host 'Gateway smoke tests passed.'
