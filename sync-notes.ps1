# Script tự động nạp toàn bộ file .txt trong thư mục notes_txt/ vào ứng dụng Ghi Chú Fit 3
# Quy ước mỗi file .txt:
# - Dòng đầu tiên là Tiêu đề ghi chú
# - Từ dòng thứ 2 trở đi là Nội dung ghi chú (dài bao nhiêu cũng được)

$ErrorActionPreference = "Stop"
$notesDir = Join-Path $PSScriptRoot "notes_txt"
$outFile  = Join-Path $PSScriptRoot "entry\src\main\js\MainAbility\common\notes_data.js"

if (-not (Test-Path $notesDir)) {
    New-Item -ItemType Directory -Path $notesDir | Out-Null
}

$txtFiles = Get-ChildItem -Path $notesDir -Filter "*.txt" | Sort-Object Name
$notesArray = @()
$idx = 1

foreach ($f in $txtFiles) {
    $rawLines = Get-Content -Path $f.FullName -Encoding UTF8
    if ($null -eq $rawLines -or $rawLines.Count -eq 0) {
        continue
    }
    if ($rawLines -is [string]) {
        $title = $rawLines
        $body  = $rawLines
    } else {
        $title = $rawLines[0].Trim()
        if ($rawLines.Count -gt 1) {
            $body = ($rawLines[1..($rawLines.Count - 1)] -join "`n")
        } else {
            $body = ""
        }
    }
    if ([string]::IsNullOrWhiteSpace($title)) {
        $title = $f.BaseName
    }

    $notesArray += [ordered]@{
        id        = "note_$idx"
        title     = $title
        updatedAt = $f.LastWriteTime.ToString("dd/MM HH:mm")
        content   = $body
    }
    $idx++
}

$json = $notesArray | ConvertTo-Json -Depth 5
$jsContent = @"
/**
 * File này được tạo tự động bởi sync-notes.ps1 từ thư mục notes_txt/
 */
var DEFAULT_NOTES = $json;

export default {
  DEFAULT_NOTES: DEFAULT_NOTES
};
"@

Set-Content -Path $outFile -Value $jsContent -Encoding UTF8
Write-Host "Đã đồng bộ $($notesArray.Count) ghi chú từ notes_txt/ vào $outFile" -ForegroundColor Green
