param(
  [int]$ApiPort = 4001,
  [int]$TenantPort = 3061,
  [string]$ApiBase = '',
  [string]$TenantBase = '',
  [int]$CdpPort = 9234
)

$ErrorActionPreference = 'Stop'
if ($ApiBase.Trim() -eq '') {
  $ApiBase = "http://127.0.0.1:$ApiPort/api/v1/v2/tenant/onboarding"
}
if ($TenantBase.Trim() -eq '') {
  $TenantBase = "http://127.0.0.1:$TenantPort"
}
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$apiDirectory = Join-Path $repoRoot 'apps\api'
$tenantDirectory = Join-Path $repoRoot 'apps\tenant'
$uploadRoot = Join-Path $apiDirectory 'uploads\tenant-onboarding'
$runId = [guid]::NewGuid().ToString('N')
$testFileName = "slice101-smoke-$runId.txt"
$testFile = Join-Path $env:TEMP $testFileName
$profilePath = Join-Path $env:TEMP "lieferzonen-chrome-slice101-$runId"
$cdpScript = Join-Path $env:TEMP "lieferzonen-cdp-slice101-$runId.js"
$apiLog = Join-Path $env:TEMP "lieferzonen-api-slice101-$runId.log"
$apiErrorLog = Join-Path $env:TEMP "lieferzonen-api-slice101-$runId.err.log"
$tenantLog = Join-Path $env:TEMP "lieferzonen-tenant-slice101-$runId.log"
$tenantErrorLog = Join-Path $env:TEMP "lieferzonen-tenant-slice101-$runId.err.log"
$ownedPids = [System.Collections.Generic.HashSet[int]]::new()
$scriptSucceeded = $false

function Wait-Port([int]$Port, [int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($listener) {
      [void]$ownedPids.Add([int]$listener.OwningProcess)
      return
    }
    Start-Sleep -Milliseconds 250
  }
  throw "Timed out waiting for port $Port."
}

function Post-Json([string]$Uri, [object]$Payload) {
  return Invoke-RestMethod -Method Post -Uri $Uri -ContentType 'application/json' -Body ($Payload | ConvertTo-Json -Depth 6) -TimeoutSec 10
}

function Wait-PortsFree([int[]]$Ports, [int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $occupied = foreach ($port in $Ports) {
      Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    }
    if (-not $occupied) {
      return
    }
    Start-Sleep -Milliseconds 300
  } while ((Get-Date) -lt $deadline)

  $busyPorts = $occupied | Select-Object -ExpandProperty LocalPort -Unique
  throw "Smoke ports must be free before starting: $($busyPorts -join ', ')."
}

try {
  $ports = @($ApiPort, $TenantPort, $CdpPort)
  Wait-PortsFree -Ports $ports -TimeoutSeconds 10

  $previousPort = $env:PORT
  $previousCorsOrigins = $env:CORS_ORIGINS
  $env:PORT = [string]$ApiPort
  $env:CORS_ORIGINS = "http://127.0.0.1:$TenantPort,http://localhost:$TenantPort"
  $apiProcess = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'node dist/main.js' `
    -WorkingDirectory $apiDirectory -RedirectStandardOutput $apiLog -RedirectStandardError $apiErrorLog `
    -WindowStyle Hidden -PassThru
  $env:PORT = $previousPort
  $env:CORS_ORIGINS = $previousCorsOrigins
  Wait-Port -Port $ApiPort -TimeoutSeconds 15

  $previousApiBase = $env:NEXT_PUBLIC_API_BASE_URL
  $env:NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:$ApiPort/api/v1"
  $tenantProcess = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "npm run dev -- --port $TenantPort" `
    -WorkingDirectory $tenantDirectory -RedirectStandardOutput $tenantLog -RedirectStandardError $tenantErrorLog `
    -WindowStyle Hidden -PassThru
  $env:NEXT_PUBLIC_API_BASE_URL = $previousApiBase
  Wait-Port -Port $TenantPort -TimeoutSeconds 35

  $stamp = (Get-Date).ToString('yyyyMMddHHmmss')
  $start = Post-Json "$ApiBase/start" @{
    firstName = 'Smoke'
    lastName = 'Documents'
    phoneNumber = '+41791234567'
    email = "slice101-$stamp-$runId@example.test"
    companyName = 'Slice Documents AG'
    companyAddress = 'Bahnhofstrasse 10, 8001 Zurich'
    tenantType = 'food_service'
    deliveryModel = 'own_fleet'
  }
  $token = [string]$start.stateToken
  $encodedToken = [Uri]::EscapeDataString($token)
  $base = "$ApiBase/$encodedToken"

  $challenge = Post-Json "$base/phone/send-code" @{ phoneNumber = '+41791234567' }
  if (-not $challenge.debugCode) {
    throw 'Smoke requires local debug OTP mode.'
  }
  [void](Post-Json "$base/phone/verify-code" @{ code = $challenge.debugCode })
  [void](Post-Json "$base/welcome/complete" @{})
  [void](Post-Json "$base/location" @{
    locationLabel = 'Bahnhofstrasse 10, 8001 Zurich'
    rawInput = 'Bahnhofstrasse 10, 8001 Zurich'
    country = 'CH'
    city = 'Zurich'
    postalCode = '8001'
  })
  [void](Post-Json "$base/address" @{
    addressLine1 = 'Bahnhofstrasse 10'
    city = 'Zurich'
    postalCode = '8001'
    country = 'CH'
  })
  [void](Post-Json "$base/business-details" @{
    registrationNumber = 'CHE-123.456.789'
    registeredBusinessName = 'Slice Documents AG'
    legalForm = 'AG'
    taxNumber = 'CHE-123.456.789'
    vatRegistered = $false
    registrationCountry = 'CH'
    registeredAddress = 'Bahnhofstrasse 10, 8001 Zurich'
  })
  [void](Post-Json "$base/authorized-person" @{
    fullName = 'Smoke Documents'
    email = "representative-$runId@example.test"
    phoneNumber = '+41791234567'
    roleTitle = 'Authorized representative'
  })
  [void](Post-Json "$base/bank-details" @{
    bankName = 'Smoke Bank'
    accountHolderName = 'Slice Documents AG'
    iban = 'CH9300762011623852957'
    currency = 'CHF'
  })
  [void](Post-Json "$base/billing-address" @{
    useBusinessAddress = $true
    billingName = 'Slice Documents AG'
    country = 'CH'
    city = 'Zurich'
    postalCode = '8001'
    addressLine1 = 'Bahnhofstrasse 10'
  })
  [void](Post-Json "$base/plan-selection" @{ planKey = 'growth' })
  [void](Post-Json "$base/operations" @{
    primaryCity = 'Zurich'
    primaryPostalCode = '8001'
    deliveryModel = 'own_fleet'
    supportsPickup = $true
  })

  Set-Content -LiteralPath $testFile -Value 'Bounded onboarding V2 document verification smoke file.' -Encoding ASCII
  $chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
  if (-not (Test-Path -LiteralPath $chrome)) {
    throw 'Chrome is not installed at the expected path.'
  }
  $chromeProcess = Start-Process -FilePath $chrome -ArgumentList @(
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--no-first-run',
    "--remote-debugging-port=$CdpPort",
    "--user-data-dir=$profilePath",
    'about:blank'
  ) -WindowStyle Hidden -PassThru
  Wait-Port -Port $CdpPort -TimeoutSeconds 10

  $env:SLICE101_REVIEW_URL = "$TenantBase/onboarding/$encodedToken/review"
  $env:SLICE101_VERIFICATION_URL = "$TenantBase/onboarding/$encodedToken/verification"
  $env:SLICE101_WAITING_URL = "$TenantBase/onboarding/$encodedToken/waiting"
  $env:SLICE101_DOCUMENT_FILE = $testFile
  $env:SLICE101_CDP_PORT = [string]$CdpPort
  @'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForValue(send, expression, predicate, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  let value;
  while (Date.now() < deadline) {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true });
    value = response.result.result.value;
    if (predicate(value)) return value;
    await delay(250);
  }
  return value;
}
async function openTab(url) {
  return fetch(`http://127.0.0.1:${process.env.SLICE101_CDP_PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then(r => r.json());
}
(async () => {
  const reviewUrl = process.env.SLICE101_REVIEW_URL;
  const verificationUrl = process.env.SLICE101_VERIFICATION_URL;
  const waitingUrl = process.env.SLICE101_WAITING_URL;
  const tab = await openTab('about:blank');
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const waiting = new Map();
  const requests = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && waiting.has(message.id)) {
      waiting.get(message.id)(message);
      waiting.delete(message.id);
    }
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
  };
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const send = (method, params = {}) => new Promise(resolve => {
    const requestId = ++id;
    waiting.set(requestId, resolve);
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  await send('Network.enable');
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  await send('Page.navigate', { url: verificationUrl });
  const verification = await waitForValue(
    send,
    '({ path: location.pathname, search: location.search, text: document.body.innerText })',
    value => value && value.path.endsWith('/verification') && value.search === '' && value.text.includes('Documents and verification') && value.text.includes('Country-pack document guidance'),
  );
  if (!verification.path.endsWith('/verification') || verification.search !== '' || !verification.text.includes('Documents and verification') || !verification.text.includes('Country-pack document guidance')) {
    throw new Error(`Custom verification route did not render in forward flow. Last state: ${JSON.stringify(verification)}`);
  }

  const root = await send('DOM.getDocument', { depth: -1, pierce: true });
  const input = await send('DOM.querySelector', { nodeId: root.result.root.nodeId, selector: 'input[type="file"]' });
  if (!input.result.nodeId) throw new Error('Document file input was not found.');
  await send('DOM.setFileInputFiles', { nodeId: input.result.nodeId, files: [process.env.SLICE101_DOCUMENT_FILE] });
  await delay(500);
  const clickedUpload = await send('Runtime.evaluate', {
    expression: `(() => {
      const button = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Upload document'));
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`,
    returnByValue: true,
  });
  if (!clickedUpload.result.result.value) throw new Error('Upload action was unavailable.');
  const uploadComplete = await waitForValue(
    send,
    'document.body.innerText',
    text => (text || '').includes('Return to review'),
  );
  if (!uploadComplete.includes('Return to review')) throw new Error('Uploaded document did not enable review continuation.');
  const returnClicked = await send('Runtime.evaluate', {
    expression: `(() => {
      const button = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Return to review'));
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`,
    returnByValue: true,
  });
  if (!returnClicked.result.result.value) throw new Error('Return to review action was unavailable after upload.');
  const reviewAfterUpload = await waitForValue(
    send,
    '({ path: location.pathname, text: document.body.innerText })',
    value => value && value.path.endsWith('/review') && value.text.includes('Submit application') && value.text.includes('Acknowledgements and consent') && !value.text.includes('Required documents\nMissing'),
  );
  if (!reviewAfterUpload.path.endsWith('/review') || !reviewAfterUpload.text.includes('Submit application') || reviewAfterUpload.text.includes('Required documents,') || reviewAfterUpload.text.includes('Required documents\nMissing')) {
    throw new Error(`Upload did not return to a complete review screen. Last state: ${JSON.stringify(reviewAfterUpload)}`);
  }
  const clickedEditAgain = await send('Runtime.evaluate', {
    expression: `(() => {
      const card = Array.from(document.querySelectorAll('section')).find(x => x.querySelector('h3')?.innerText === 'Required documents');
      const button = card && Array.from(card.querySelectorAll('button')).find(x => x.innerText.trim() === 'Edit');
      if (!button) return false;
      button.click();
      return true;
    })()`,
    returnByValue: true,
  });
  if (!clickedEditAgain.result.result.value) throw new Error('Second required documents edit action was unavailable.');
  const repeatedEdit = await waitForValue(
    send,
    '({ path: location.pathname, search: location.search, text: document.body.innerText })',
    value => value && value.path.endsWith('/verification') && value.search === '?returnTo=review' && value.text.includes('Documents and verification'),
  );
  if (!repeatedEdit.path.endsWith('/verification') || repeatedEdit.search !== '?returnTo=review') {
    throw new Error('Repeated returnToReview edit route was blocked.');
  }
  await send('Page.navigate', { url: reviewUrl });
  await waitForValue(
    send,
    '({ path: location.pathname, text: document.body.innerText })',
    value => value && value.path.endsWith('/review') && value.text.includes('Submit application'),
  );
  const submitBlockedBeforeConsents = await send('Runtime.evaluate', {
    expression: `(() => {
      const button = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Submit application'));
      return Boolean(button && button.disabled);
    })()`,
    returnByValue: true,
  });
  if (!submitBlockedBeforeConsents.result.result.value) throw new Error('Submit was not blocked before required acknowledgements.');
  const selectedConsents = await send('Runtime.evaluate', {
    expression: `(() => {
      const section = Array.from(document.querySelectorAll('section')).find(x => x.querySelector('h3')?.innerText === 'Acknowledgements and consent');
      const boxes = section ? Array.from(section.querySelectorAll('input[type="checkbox"]')) : [];
      boxes.filter(box => !box.checked && !box.disabled).forEach(box => box.click());
      const save = section && Array.from(section.querySelectorAll('button')).find(x => x.innerText.includes('Save acknowledgements'));
      if (!save || save.disabled) return false;
      save.click();
      return true;
    })()`,
    returnByValue: true,
  });
  if (!selectedConsents.result.result.value) throw new Error('Required acknowledgement save action was unavailable.');
  await waitForValue(
    send,
    `(() => {
      const button = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Submit application'));
      return { enabled: Boolean(button && !button.disabled), text: document.body.innerText };
    })()`,
    value => value && value.enabled && value.text.includes('Accepted and saved'),
  );
  const submitClicked = await send('Runtime.evaluate', {
    expression: `(() => {
      const button = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Submit application'));
      if (!button || button.disabled) return { clicked: false, disabled: button?.disabled ?? null, text: document.body.innerText };
      button.click();
      return { clicked: true, disabled: false, text: document.body.innerText };
    })()`,
    returnByValue: true,
  });
  if (!submitClicked.result.result.value.clicked) {
    throw new Error(`Review submit action remained disabled. State: ${JSON.stringify(submitClicked.result.result.value)}`);
  }
  const submitted = await waitForValue(
    send,
    '({ path: location.pathname, text: document.body.innerText })',
    value => value && value.path.endsWith('/submitted') && value.text.includes('Application submitted'),
  );
  if (!submitted.path.endsWith('/submitted') || !submitted.text.includes('Application submitted')) throw new Error('Submitted page did not render.');
  await send('Page.reload', { ignoreCache: true });
  const submittedAfterRefresh = await waitForValue(
    send,
    '({ path: location.pathname, text: document.body.innerText })',
    value => value && value.path.endsWith('/submitted') && value.text.includes('Application submitted'),
  );
  if (!submittedAfterRefresh.path.endsWith('/submitted') || !submittedAfterRefresh.text.includes('Application submitted')) throw new Error('Submitted refresh regressed.');
  await send('Page.navigate', { url: waitingUrl });
  const waitingRedirectPath = await waitForValue(send, 'location.pathname', value => (value || '').endsWith('/submitted'));
  if (!waitingRedirectPath.endsWith('/submitted')) throw new Error('Waiting alias did not reach submitted.');
  const settledAt = requests.length;
  await delay(2200);
  const result = {
    verificationShownBeforeReview: true,
    countryPackDocumentGuidanceRendered: true,
    verificationReturnToReview: true,
    repeatedVerificationEdit: true,
    uploadReturnedToReview: true,
    submitBlockedBeforeConsents: true,
    consentsSavedBeforeSubmit: true,
    submittedRendered: true,
    waitingRedirectedToSubmitted: true,
    sessionRequests: requests.filter(url => url.includes('/session?step=')).length,
    reviewRequests: requests.filter(url => url.includes('/review')).length,
    uploadRequests: requests.filter(url => url.includes('/documents/upload')).length,
    consentRequests: requests.filter(url => url.includes('/consents')).length,
    workspaceRequests: requests.filter(url => url.includes('/workspace')).length,
    lateRequests: requests.length - settledAt,
  };
  console.log(JSON.stringify(result));
  socket.close();
})().catch(error => { console.error(error.stack || error); process.exit(1); });
'@ | Set-Content -LiteralPath $cdpScript -Encoding ASCII
  $result = & node $cdpScript
  if ($LASTEXITCODE -ne 0) {
    throw 'CDP smoke validation failed.'
  }
  Write-Output $result
  $scriptSucceeded = $true
}
finally {
  foreach ($ownedProcessId in $ownedPids) {
    if ($ownedProcessId -ne $PID) {
      Stop-Process -Id $ownedProcessId -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Milliseconds 500
  $profileLeaf = [System.IO.Path]::GetFileName($profilePath)
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profileLeaf) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 500
  $tempRoot = (Resolve-Path $env:TEMP).Path
  foreach ($temporaryFile in @($testFile, $cdpScript)) {
    if ($temporaryFile.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $temporaryFile)) {
      Remove-Item -LiteralPath $temporaryFile -Force
    }
  }
  if ($scriptSucceeded) {
    foreach ($logFile in @($apiLog, $apiErrorLog, $tenantLog, $tenantErrorLog)) {
      if ($logFile.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $logFile)) {
        Remove-Item -LiteralPath $logFile -Force
      }
    }
  } else {
    Write-Warning "Smoke failed. Runtime logs retained in TEMP: $apiLog, $apiErrorLog, $tenantLog, $tenantErrorLog"
  }
  if ($profilePath.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $profilePath)) {
    for ($attempt = 0; $attempt -lt 5 -and (Test-Path -LiteralPath $profilePath); $attempt++) {
      Remove-Item -LiteralPath $profilePath -Recurse -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 300
    }
  }
  if (Test-Path -LiteralPath $uploadRoot) {
    $testUploads = Get-ChildItem -LiteralPath $uploadRoot -Recurse -File -Filter "*-$testFileName" -ErrorAction SilentlyContinue
    foreach ($testUpload in $testUploads) {
      if ($testUpload.FullName.StartsWith($uploadRoot, [StringComparison]::OrdinalIgnoreCase)) {
        $parent = $testUpload.Directory.FullName
        Remove-Item -LiteralPath $testUpload.FullName -Force
        if (-not (Get-ChildItem -LiteralPath $parent -Force -ErrorAction SilentlyContinue)) {
          Remove-Item -LiteralPath $parent -Force
        }
      }
    }
  }
}
