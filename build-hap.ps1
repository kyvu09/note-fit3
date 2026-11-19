# Script 1-click: Đọc cấu hình từ .env, sinh sync_config.js, đồng bộ notes_txt/,
# biên dịch Release (.bc), chuẩn hóa config.json (API 4-6) và ký gói .hap cho Huawei Watch Fit 3
$ErrorActionPreference = "Stop"

function Load-DotEnv($envPath) {
  if (-not (Test-Path $envPath)) {
    throw "Không tìm thấy file .env tại $envPath. Hãy sao chép .env.example thành .env và điền thông tin ký + tên kênh đồng bộ trước khi build!"
  }
  $map = @{}
  foreach ($rawLine in Get-Content $envPath -Encoding UTF8) {
    $line = $rawLine.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#")) { continue }
    $eq = $line.IndexOf("=")
    if ($eq -gt 0) {
      $k = $line.Substring(0, $eq).Trim()
      $v = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
      $map[$k] = $v
    }
  }
  return $map
}

$envMap = Load-DotEnv (Join-Path $PSScriptRoot ".env")

$syncChannel   = $envMap["SYNC_CHANNEL_PREFIX"]
$watchP12Rel   = $envMap["WATCH_KEYSTORE_FILE"]
$watchCerRel   = $envMap["WATCH_CERT_FILE"]
$watchP7bRel   = $envMap["WATCH_PROFILE_FILE"]
$watchKeyAlias = $envMap["WATCH_KEY_ALIAS"]
$watchStorePwd = $envMap["WATCH_KEYSTORE_PASSWORD"]
$watchKeyPwd   = $envMap["WATCH_KEY_PASSWORD"]

if (-not $syncChannel -or -not $watchP12Rel -or -not $watchCerRel -or -not $watchP7bRel -or -not $watchKeyAlias -or -not $watchStorePwd -or -not $watchKeyPwd) {
  throw "Thiếu cấu hình bắt buộc trong file .env (SYNC_CHANNEL_PREFIX, WATCH_KEYSTORE_FILE, WATCH_CERT_FILE, WATCH_PROFILE_FILE, WATCH_KEY_ALIAS, WATCH_KEYSTORE_PASSWORD, WATCH_KEY_PASSWORD)."
}

# Sinh file sync_config.js cục bộ từ .env (file này đã nằm trong .gitignore)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$syncConfigPath = Join-Path $PSScriptRoot "entry\src\main\js\MainAbility\common\sync_config.js"
$syncConfigJs = @"
// File tự động sinh từ .env bởi build-hap.ps1 (không commit lên Git)
export default {
  CHANNEL_PREFIX: '$syncChannel',
  RELAY_BASE: 'https://ntfy.sh/'
};
"@
[System.IO.File]::WriteAllText($syncConfigPath, $syncConfigJs, $utf8NoBom)

& (Join-Path $PSScriptRoot "sync-notes.ps1")

$env:DEVECO_SDK_HOME = "C:\Program Files\Huawei\DevEco Studio\sdk"
$env:JAVA_HOME       = "C:\Program Files\Huawei\DevEco Studio\jbr"
$env:NODE_HOME       = "C:\Program Files\Huawei\DevEco Studio\tools\node"
$env:PATH            = "$env:NODE_HOME;$env:JAVA_HOME\bin;$env:PATH"

Write-Host "1. Đang biên dịch Release (.bc bytecode) bằng Hvigor..." -ForegroundColor Cyan
& "C:\Program Files\Huawei\DevEco Studio\tools\node\node.exe" "C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin\hvigorw.js" assembleHap -p buildMode=release --no-daemon

$java       = "C:\Program Files\Huawei\DevEco Studio\jbr\bin\java.exe"
$hapToBin   = "C:\Program Files\Huawei\DevEco Studio\sdk\default\openharmony\js\build-tools\binary-tools\haptobin_tool.jar"
$packTool   = "C:\Program Files\Huawei\DevEco Studio\sdk\default\openharmony\toolchains\lib\app_packing_tool.jar"
$signTool   = "C:\Program Files\Huawei\DevEco Studio\sdk\default\openharmony\toolchains\lib\hap-sign-tool.jar"

$liteSource = Join-Path $PSScriptRoot "entry\build\default\intermediates\lite_source\default"
$cfgPath    = Join-Path $liteSource "config.json"

Write-Host "2. Đang chuẩn hóa config.json (API 4-6) và icon.bin cho firmware Huawei Watch Fit 3..." -ForegroundColor Cyan
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$ability = $cfg.module.abilities[0]

$cleanConfig = [ordered]@{
  app = [ordered]@{
    bundleName = "com.kyvu.fit3notes"
    vendor     = "kyvu"
    version    = [ordered]@{
      code = 1000000
      name = "1.0.0"
    }
    apiVersion = [ordered]@{
      compatible  = 4
      target      = 6
      releaseType = "Release"
    }
  }
  deviceConfig = [ordered]@{}
  module = [ordered]@{
    deviceType = @("liteWearable")
    distro     = [ordered]@{
      deliveryWithInstall = $true
      moduleName          = "entry"
      moduleType          = "entry"
    }
    abilities  = @(
      [ordered]@{
        name          = ".MainAbility"
        srcLanguage   = "js"
        srcPath       = "MainAbility"
        icon          = "`$media:icon"
        description   = "`$string:MainAbility_desc"
        label         = "`$string:MainAbility_label"
        type          = "page"
        iconId        = $ability.iconId
        descriptionId = $ability.descriptionId
        labelId       = $ability.labelId
      }
    )
    reqPermissions = @(
      [ordered]@{
        name      = "ohos.permission.INTERNET"
        reason    = "Sync notes from phone"
        usedScene = [ordered]@{
          ability = @(".MainAbility")
          when    = "inuse"
        }
      }
    )
    js         = @(
      [ordered]@{
        pages = @(
          "pages/index/index",
          "pages/reader/reader",
          "pages/sync/sync"
        )
        name  = ".MainAbility"
      }
    )
  }
}

[System.IO.File]::WriteAllText($cfgPath, ($cleanConfig | ConvertTo-Json -Depth 6), $utf8NoBom)

$mediaDir = Join-Path $liteSource "assets\entry\resources\base\media"
if (Test-Path (Join-Path $mediaDir "icon.png.bin")) {
  Copy-Item (Join-Path $mediaDir "icon.png.bin") (Join-Path $mediaDir "icon.bin") -Force
}
if (Test-Path (Join-Path $mediaDir "icon_small.png.bin")) {
  Copy-Item (Join-Path $mediaDir "icon_small.png.bin") (Join-Path $mediaDir "icon_small.bin") -Force
}
Get-ChildItem -Path $liteSource -Recurse -Filter "*.map" | Remove-Item -Force

$unsignedBin = Join-Path $PSScriptRoot "entry\build\default\outputs\default\bin\entry-default-unsigned.bin"
$signedBin   = Join-Path $PSScriptRoot "entry\build\default\outputs\default\bin\entry-default-signed.bin"
$unsignedHap = Join-Path $PSScriptRoot "entry\build\default\outputs\default\entry-default-unsigned.hap"
$signedHap   = Join-Path $PSScriptRoot "entry\build\default\outputs\default\entry-default-signed.hap"
$rootHap     = Join-Path $PSScriptRoot "GhiChuFit3-signed.hap"

New-Item -ItemType Directory -Path (Split-Path -Parent $unsignedBin) -Force | Out-Null

$p12 = Join-Path $PSScriptRoot $watchP12Rel
$p7b = Join-Path $PSScriptRoot $watchP7bRel
$cer = Join-Path $PSScriptRoot $watchCerRel

Write-Host "3. Đang đóng gói và ký chứng chỉ .bin + .hap từ cấu hình .env..." -ForegroundColor Cyan
& $java "-Dfile.encoding=UTF-8" -jar $hapToBin --project-path $liteSource --bin-path $unsignedBin
& $java -jar $signTool sign-app -mode localSign -keyAlias $watchKeyAlias -keyPwd $watchKeyPwd -appCertFile $cer -profileFile $p7b -inForm bin -inFile $unsignedBin -signAlg SHA256withECDSA -keystoreFile $p12 -keystorePwd $watchStorePwd -outFile $signedBin -signCode 0
& $java "-Dfile.encoding=UTF-8" -jar $packTool --mode hap --bin-path $signedBin --out-path $unsignedHap --force true
& $java -jar $signTool sign-app -mode localSign -keyAlias $watchKeyAlias -keyPwd $watchKeyPwd -appCertFile $cer -profileFile $p7b -inForm zip -inFile $unsignedHap -signAlg SHA256withECDSA -keystoreFile $p12 -keystorePwd $watchStorePwd -outFile $signedHap -signCode 0

Copy-Item $signedHap $rootHap -Force
Write-Host "HOÀN TẤT! File .hap đã ký chuẩn cho Watch Fit 3 sẵn sàng tại: $rootHap" -ForegroundColor Green
