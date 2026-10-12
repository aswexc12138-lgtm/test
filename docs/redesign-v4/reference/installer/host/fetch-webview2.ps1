# 下载并校验 WebView2 SDK（只取宿主需要的 4 个文件），放进 vendor\。版本和 SHA-512 固定，校验不过就失败。
# 由 build-host.cmd 在 vendor\ 缺文件时调用；也可以手动运行：powershell -NoProfile -ExecutionPolicy Bypass -File fetch-webview2.ps1
$ErrorActionPreference = 'Stop'
$Version = '1.0.4191.47'      # 2026-08-28 发布；升级时同时改下面的 SHA-512（NuGet 目录里的 packageHash 转成十六进制）
$Sha512  = 'ADF91BDA1A71D860C098CD0E426B5A238E187EA73C694832F8FDE36809A9165FDA8844FC9C2B9FC8A870B0DA53CD9EB97EC140D9A2F104A228301FFAE841DB8C'
$Here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$Vendor  = Join-Path $Here 'vendor'
$Work    = Join-Path ([IO.Path]::GetTempPath()) ("xuyu-webview2-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $Vendor, $Work | Out-Null
try {
  $Zip = Join-Path $Work 'webview2.zip'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing -Uri "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$Version/microsoft.web.webview2.$Version.nupkg" -OutFile $Zip
  $Actual = (Get-FileHash -Algorithm SHA512 -Path $Zip).Hash
  if ($Actual -ne $Sha512) { throw "WebView2 SDK 校验失败：$Actual" }
  Expand-Archive -Path $Zip -DestinationPath (Join-Path $Work 'x')
  Copy-Item (Join-Path $Work 'x\lib\net462\Microsoft.Web.WebView2.Core.dll')      $Vendor -Force
  Copy-Item (Join-Path $Work 'x\lib\net462\Microsoft.Web.WebView2.WinForms.dll')  $Vendor -Force
  Copy-Item (Join-Path $Work 'x\runtimes\win-x64\native\WebView2Loader.dll')      $Vendor -Force
  Copy-Item (Join-Path $Work 'x\LICENSE.txt')                                     $Vendor -Force
  Set-Content -Path (Join-Path $Vendor 'VERSION.txt') -Value "Microsoft.Web.WebView2 $Version" -Encoding UTF8
  Write-Host "WebView2 SDK $Version -> $Vendor"
} finally {
  Remove-Item -Recurse -Force $Work -ErrorAction SilentlyContinue
}
