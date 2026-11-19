$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

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

$envMap = Load-DotEnv (Join-Path $projectRoot ".env")

$syncChannel     = $envMap["SYNC_CHANNEL_PREFIX"]
$androidKsRel    = $envMap["ANDROID_KEYSTORE_FILE"]
$androidAlias    = $envMap["ANDROID_KEY_ALIAS"]
$androidStorePwd = $envMap["ANDROID_KEYSTORE_PASSWORD"]
$androidKeyPwd   = $envMap["ANDROID_KEY_PASSWORD"]

if (-not $syncChannel -or -not $androidKsRel -or -not $androidAlias -or -not $androidStorePwd -or -not $androidKeyPwd) {
    throw "Thiếu cấu hình bắt buộc trong file .env (SYNC_CHANNEL_PREFIX, ANDROID_KEYSTORE_FILE, ANDROID_KEY_ALIAS, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_PASSWORD)."
}

$androidDir = Join-Path $projectRoot "android-sender"
$buildDir   = Join-Path $androidDir "build_cli"

# Sinh file SyncConfig.java cục bộ từ .env (file này đã nằm trong .gitignore)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$syncConfigJavaPath = Join-Path $androidDir "app\src\main\java\com\kyvu\fit3notessender\SyncConfig.java"
$syncConfigJava = @"
package com.kyvu.fit3notessender;

// File tự động sinh từ .env bởi build-android-apk.ps1 (không commit lên Git)
public final class SyncConfig {
    public static final String CHANNEL_PREFIX = "$syncChannel";
    public static final String RELAY_BASE = "https://ntfy.sh/";
}
"@
[System.IO.File]::WriteAllText($syncConfigJavaPath, $syncConfigJava, $utf8NoBom)

$jbrBin  = "C:\Program Files\Android\Android Studio\jbr\bin"
$javac   = Join-Path $jbrBin "javac.exe"
$jarTool = Join-Path $jbrBin "jar.exe"
$keytool = Join-Path $jbrBin "keytool.exe"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$jbrBin;$env:PATH"

$sdkRoot    = "C:\Users\kyvu\AppData\Local\Android\Sdk"
$androidJar = Join-Path $sdkRoot "platforms\android-37.0\android.jar"
$buildTools = Join-Path $sdkRoot "build-tools\36.0.0"
$aapt2      = Join-Path $buildTools "aapt2.exe"
$d8         = Join-Path $buildTools "d8.bat"
$zipalign   = Join-Path $buildTools "zipalign.exe"
$apksigner  = Join-Path $buildTools "apksigner.bat"

if (Test-Path $buildDir) {
    Remove-Item $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $buildDir "gen") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildDir "classes") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildDir "dex") -Force | Out-Null

Write-Host "1. Đang biên dịch tài nguyên Android bằng aapt2..." -ForegroundColor Cyan
$compiledResZip = Join-Path $buildDir "compiled_res.zip"
$resDir = Join-Path $androidDir "app\src\main\res"
& $aapt2 compile --dir $resDir -o $compiledResZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

$unalignedApk = Join-Path $buildDir "unaligned.apk"
$manifestPath = Join-Path $androidDir "app\src\main\AndroidManifest.xml"
& $aapt2 link -o $unalignedApk -I $androidJar --manifest $manifestPath --java (Join-Path $buildDir "gen") $compiledResZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "2. Đang biên dịch mã nguồn Java (SyncConfig.java + MainActivity.java)..." -ForegroundColor Cyan
$javaFiles = @(
    (Join-Path $buildDir "gen\com\kyvu\fit3notessender\R.java"),
    $syncConfigJavaPath,
    (Join-Path $androidDir "app\src\main\java\com\kyvu\fit3notessender\MainActivity.java")
)
& $javac --release 8 -encoding UTF-8 -cp $androidJar -d (Join-Path $buildDir "classes") $javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

Write-Host "3. Đang chuyển đổi bytecode sang Dalvik DEX (d8)..." -ForegroundColor Cyan
$classFiles = Get-ChildItem -Path (Join-Path $buildDir "classes") -Recurse -Filter "*.class" | ForEach-Object { $_.FullName }
& $d8 --lib $androidJar --min-api 26 --output (Join-Path $buildDir "dex") $classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Write-Host "4. Đang đóng gói classes.dex vào APK và căn chỉnh zipalign..." -ForegroundColor Cyan
& $jarTool -uf $unalignedApk -C (Join-Path $buildDir "dex") "classes.dex"
if ($LASTEXITCODE -ne 0) { throw "jar update failed" }

$alignedApk = Join-Path $buildDir "aligned.apk"
& $zipalign -f -p 4 $unalignedApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

Write-Host "5. Đang ký chứng chỉ APK (v2 + v3) từ cấu hình .env..." -ForegroundColor Cyan
$keystorePath = Join-Path $projectRoot $androidKsRel
New-Item -ItemType Directory -Path (Split-Path -Parent $keystorePath) -Force | Out-Null
if (-not (Test-Path $keystorePath)) {
    & $keytool -genkeypair -v -keystore $keystorePath -alias $androidAlias -keyalg RSA -keysize 2048 -validity 10000 -storepass $androidStorePwd -keypass $androidKeyPwd -dname "CN=Fit3Sender, OU=Dev, O=Personal, L=HN, ST=HN, C=VN"
}

$outputApk = Join-Path $projectRoot "Fit3NotesSender.apk"
& $apksigner sign --ks $keystorePath --ks-key-alias $androidAlias --ks-pass "pass:$androidStorePwd" --key-pass "pass:$androidKeyPwd" --out $outputApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

& $apksigner verify --verbose $outputApk
if ($LASTEXITCODE -ne 0) { throw "apksigner verify failed" }

Write-Host "HOÀN TẤT! File APK sẵn sàng cài lên điện thoại Android tại: $outputApk" -ForegroundColor Green
