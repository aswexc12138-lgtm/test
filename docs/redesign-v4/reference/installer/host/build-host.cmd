@echo off
chcp 65001 >nul
rem 编译胥宇安装界面宿主，并把它和界面文件一起放进 build\installer-ui\（electron-builder 打包时由 installer.nsh 嵌入安装包）
rem 只用 Windows 自带的 .NET Framework 4.8 编译器，不需要装 Visual Studio / .NET SDK。
rem 用法（在 xuyu 仓库根目录）：  scripts\installer-ui\host\build-host.cmd
rem 依赖：vendor\ 下的 WebView2 SDK 文件；缺了就自动运行 fetch-webview2.ps1 下载（版本和 SHA-512 固定）

setlocal
set HERE=%~dp0
set ROOT=%HERE%..\..\..
set OUT=%ROOT%\build\installer-ui
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
set VENDOR=%HERE%vendor

if not exist "%CSC%" ( echo 找不到 %CSC% & exit /b 1 )
if not exist "%VENDOR%\WebView2Loader.dll" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%fetch-webview2.ps1" || exit /b 1
)
for %%F in (Microsoft.Web.WebView2.Core.dll Microsoft.Web.WebView2.WinForms.dll WebView2Loader.dll LICENSE.txt) do (
  if not exist "%VENDOR%\%%F" ( echo 缺少 %VENDOR%\%%F & exit /b 1 )
)

if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\ui" || exit /b 1

"%CSC%" /nologo /noconfig /langversion:5 /target:winexe /platform:x64 /optimize+ /warnaserror+ ^
  /out:"%OUT%\XuyuSetupUI.exe" /win32manifest:"%HERE%app.manifest" /win32icon:"%ROOT%\build\icon.ico" ^
  /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll ^
  /r:"%VENDOR%\Microsoft.Web.WebView2.Core.dll" /r:"%VENDOR%\Microsoft.Web.WebView2.WinForms.dll" ^
  "%HERE%XuyuSetupUI.cs" || exit /b 1

copy /y "%VENDOR%\Microsoft.Web.WebView2.Core.dll" "%OUT%\" >nul || exit /b 1
copy /y "%VENDOR%\Microsoft.Web.WebView2.WinForms.dll" "%OUT%\" >nul || exit /b 1
copy /y "%VENDOR%\WebView2Loader.dll" "%OUT%\" >nul || exit /b 1
copy /y "%VENDOR%\LICENSE.txt" "%OUT%\WebView2-LICENSE.txt" >nul || exit /b 1
xcopy /y /q /e "%HERE%..\ui\*" "%OUT%\ui\" >nul || exit /b 1
echo 已生成 %OUT%
endlocal
