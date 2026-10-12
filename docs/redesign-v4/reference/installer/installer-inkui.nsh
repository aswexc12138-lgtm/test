; 水墨安装界面的 NSIS 一侧（规格 I-20 – I-29）。由 installer.nsh 在最前面 !include。
;
; 分工：NSIS 仍是唯一的安装引擎；交互界面换成 XuyuSetupUI.exe（WebView2，见 host/）。流程：
;   .onInit → customInit：先按原逻辑算好默认位置（优先剩余空间最大的非系统盘），
;            再判断能不能用水墨界面（XuyuInkUiRun）。能用就解出宿主、写 init.ini、启动它，等它给出决定：
;              install → 把位置写回 $INSTDIR，SetSilent silent，之后整个安装过程不再出现 NSIS 窗口；
;              cancel  → 退出（退出码 1）；
;              classic → 照常显示经典向导（“给所有用户安装”、WebView2 不可用、宿主出错，都走这里）。
;   安装段里：customCheckAppRunning 写 phase=prepare；extractUsing7za 换成会报进度的版本（xuyu-extract-progress.nsh）
;            写 extract（字节数来自 7-Zip 解压器本身）/ copy / finish；customInstall 写 done，
;            然后等用户在水墨界面上点“打开胥宇”或“完成”（宿主退出），按 after.ini 决定是否以普通用户身份打开胥宇。
;
; 不用水墨界面的情况（直接走经典向导，行为与改版前完全一样）：
;   /S 静默安装（含应用内更新）、UAC 提权后的内层进程、命令行带 /classic、已经有“所有用户”安装或当前选的是所有用户、
;   不是 64 位 Windows 10 及以上、找不到 WebView2 运行时、宿主文件缺失或启动失败、宿主 20 秒内没有出界面。

!ifndef BUILD_UNINSTALLER

!include x64.nsh
!include WinVer.nsh

!define XUYU_UI_PROTOCOL "1"
!define XUYU_UI_READY_TIMEOUT_MS 20000
!define XUYU_WEBVIEW2_CLIENT "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

Var XuyuUiSession       ; 会话目录 $TEMP\XuyuSetupUI-<pid>
Var XuyuUiActive        ; "1" = 本次由水墨界面驱动（已切成静默安装，要回报进度）
Var XuyuUiHost          ; 宿主进程句柄
Var XuyuUiTick          ; 上次写解压进度的时间（GetTickCount）
Var XuyuDirSource       ; auto / auto-system / default / previous / param：默认位置是怎么来的，界面据此说明
Var XuyuHasPrevious     ; "1" = 本机已经装过（按当前用户）

; 写 status.ini 的 phase（栈顶是阶段名）
Function XuyuUiStatus
  Exch $0
  ${If} $XuyuUiActive == "1"
    WriteINIStr "$XuyuUiSession\status.ini" status phase $0
  ${EndIf}
  Pop $0
FunctionEnd

; Nsis7z::ExtractWithCallback 的回调：栈上依次是已解压字节、总字节。最多每 150ms 写一次，最后一次一定写。
Function XuyuExtractProgress
  Pop $R8
  Pop $R9
  Push $0
  System::Call 'kernel32::GetTickCount() i.r0'
  IntOp $0 $0 - $XuyuUiTick
  ${If} $0 >= 150
  ${OrIf} $0 < 0
  ${OrIf} $R8 == $R9
    System::Call 'kernel32::GetTickCount() i.r0'
    StrCpy $XuyuUiTick $0
    WriteINIStr "$XuyuUiSession\status.ini" status extractDone $R8
    WriteINIStr "$XuyuUiSession\status.ini" status extractTotal $R9
  ${EndIf}
  Pop $0
FunctionEnd

; 新建一个 UTF-16LE（带 BOM）的空文件，之后 WriteINIStr 才会按 Unicode 写，中文路径不会变成问号
!macro XuyuNewUnicodeIni PATH
  FileOpen $0 "${PATH}" w
  FileWriteWord $0 0xFEFF
  FileClose $0
!macroend

; 删除以前残留的会话目录（宿主退出后会自己删；删不掉的在这里补）
Function XuyuUiCleanStale
  Push $0
  Push $1
  FindFirst $0 $1 "$TEMP\XuyuSetupUI-*"
  ${DoWhile} $1 != ""
    ${If} "$TEMP\$1" != $XuyuUiSession
      RMDir /r "$TEMP\$1"
    ${EndIf}
    FindNext $0 $1
  ${Loop}
  FindClose $0
  Pop $1
  Pop $0
FunctionEnd

!endif

; ---------------------------------------------------------------------------
; 下面这个宏由 installer.nsh 的 customWelcomePage 插入：那时 electron-builder 的 $installMode 等变量都已声明。
!macro XuyuInkUiFunctions
Function XuyuInkUiRun
  StrCpy $XuyuUiActive "0"
  StrCpy $XuyuUiHost "0"

  ; ---------- 能不能用水墨界面 ----------
  ${If} ${Silent}
    Return
  ${EndIf}
  ${If} ${UAC_IsInnerInstance}
    Return
  ${EndIf}
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/classic" $R1
  ${IfNot} ${Errors}
    Return
  ${EndIf}
  ${If} $installMode == "all"
  ${OrIf} $hasPerMachineInstallation == "1"
    Return
  ${EndIf}
  ${IfNot} ${RunningX64}
    Return
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    Return
  ${EndIf}
  ReadRegStr $R1 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${XUYU_WEBVIEW2_CLIENT}" "pv"
  ${If} $R1 == ""
  ${OrIf} $R1 == "0.0.0.0"
    ReadRegStr $R1 HKCU "Software\Microsoft\EdgeUpdate\Clients\${XUYU_WEBVIEW2_CLIENT}" "pv"
  ${EndIf}
  ${If} $R1 == ""
  ${OrIf} $R1 == "0.0.0.0"
    Return
  ${EndIf}

  ; ---------- 解出宿主和界面 ----------
  System::Call 'kernel32::GetCurrentProcessId() i.r2'
  StrCpy $XuyuUiSession "$TEMP\XuyuSetupUI-$2"
  Call XuyuUiCleanStale
  RMDir /r $XuyuUiSession
  ClearErrors
  CreateDirectory "$XuyuUiSession\ui"
  ${If} ${Errors}
    Return
  ${EndIf}
  Push $OUTDIR
  SetOutPath $XuyuUiSession
  File "${BUILD_RESOURCES_DIR}\installer-ui\XuyuSetupUI.exe"
  File "${BUILD_RESOURCES_DIR}\installer-ui\Microsoft.Web.WebView2.Core.dll"
  File "${BUILD_RESOURCES_DIR}\installer-ui\Microsoft.Web.WebView2.WinForms.dll"
  File "${BUILD_RESOURCES_DIR}\installer-ui\WebView2Loader.dll"
  SetOutPath "$XuyuUiSession\ui"
  File /r "${BUILD_RESOURCES_DIR}\installer-ui\ui\*.*"
  Pop $R1
  SetOutPath $R1

  ; ---------- init.ini ----------
  StrCpy $R2 "$XuyuUiSession\init.ini"
  !insertmacro XuyuNewUnicodeIni $R2
  WriteINIStr $R2 init protocol "${XUYU_UI_PROTOCOL}"
  WriteINIStr $R2 init nsisPid $2
  WriteINIStr $R2 init setupExe "$EXEPATH"
  WriteINIStr $R2 init version "${VERSION}"
  ${If} $XuyuHasPrevious == "1"
    WriteINIStr $R2 init mode "upgrade"
    ReadRegStr $R3 HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
    WriteINIStr $R2 init installedVersion $R3
  ${Else}
    WriteINIStr $R2 init mode "fresh"
  ${EndIf}
  WriteINIStr $R2 init dir $INSTDIR
  WriteINIStr $R2 init dirSource $XuyuDirSource
  !ifdef APP_64_UNPACKED_SIZE
    WriteINIStr $R2 init needKB "${APP_64_UNPACKED_SIZE}"
  !endif
  WriteINIStr $R2 init allUsersAvailable "1"
  ; 完成页要不要“打开胥宇”跟 package.json 的 nsis.runAfterFinish 走（经典完成页同一个开关，规格 I-05）
  !ifdef HIDE_RUN_AFTER_FINISH
    WriteINIStr $R2 init canLaunch "0"
  !else
    WriteINIStr $R2 init canLaunch "1"
  !endif
  !insertmacro XuyuNewUnicodeIni "$XuyuUiSession\status.ini"

  ; ---------- 启动宿主，等决定 ----------
  ; 用 CreateProcessW 直接拿宿主的进程句柄。不要换成 ShellExecute / StdUtils::ExecShellWaitEx：
  ; 它们可能经由别的进程转启动，拿到的句柄不一定是宿主本身（Wine 实测会提前“退出”，NSIS 就不等了）。
  System::Alloc 68                    ; STARTUPINFOW（32 位安装程序里是 68 字节），GPTR 已清零
  Pop $R3
  System::Call '*$R3(i 68)'
  System::Alloc 16                    ; PROCESS_INFORMATION
  Pop $R4
  System::Call 'kernel32::CreateProcessW(w "$XuyuUiSession\XuyuSetupUI.exe", w `"$XuyuUiSession\XuyuSetupUI.exe" --session "$XuyuUiSession"`, p 0, p 0, i 0, i 0, p 0, w "$XuyuUiSession", p $R3, p $R4) i.r3'
  ${If} $3 == 0
    System::Free $R3
    System::Free $R4
    Return
  ${EndIf}
  System::Call '*$R4(p .r6, p .r7)'
  System::Call 'kernel32::CloseHandle(p r7)'
  System::Free $R3
  System::Free $R4
  StrCpy $XuyuUiHost $6
  StrCpy $R5 0
  ${Do}
    IfFileExists "$XuyuUiSession\decision.ini" xuyu_ui_decided
    System::Call 'kernel32::WaitForSingleObject(p $XuyuUiHost, i 100) i.r3'
    ${If} $3 == 0
      ; 宿主退出了：再看一眼有没有刚写下的决定，没有就用经典界面
      IfFileExists "$XuyuUiSession\decision.ini" xuyu_ui_decided
      Goto xuyu_ui_classic
    ${EndIf}
    ${IfNot} ${FileExists} "$XuyuUiSession\ready.flag"
      IntOp $R5 $R5 + 100
      ${If} $R5 >= ${XUYU_UI_READY_TIMEOUT_MS}
        Goto xuyu_ui_timeout
      ${EndIf}
    ${EndIf}
  ${Loop}

  xuyu_ui_timeout:
    System::Call 'kernel32::TerminateProcess(p $XuyuUiHost, i 1)'
    Goto xuyu_ui_classic

  xuyu_ui_decided:
    ReadINIStr $R6 "$XuyuUiSession\decision.ini" decision action
    ${If} $R6 == "install"
      ReadINIStr $R7 "$XuyuUiSession\decision.ini" decision dir
      ${If} $R7 == ""
        Goto xuyu_ui_classic
      ${EndIf}
      StrCpy $INSTDIR $R7
      StrCpy $XuyuChosenInstallDir $R7
      StrCpy $XuyuUiActive "1"
      System::Call 'kernel32::GetTickCount() i.r3'
      StrCpy $XuyuUiTick $3
      Push "prepare"
      Call XuyuUiStatus
      Return                ; customInit 看到 $XuyuUiActive == 1 后执行 SetSilent silent（SetSilent 只能直接写在 .onInit 里）
    ${ElseIf} $R6 == "cancel"
      System::Call 'kernel32::WaitForSingleObject(p $XuyuUiHost, i 3000)'
      System::Call 'kernel32::CloseHandle(p $XuyuUiHost)'
      SetErrorLevel 1
      Quit
    ${EndIf}
    ReadINIStr $R7 "$XuyuUiSession\decision.ini" decision allUsers
    ${If} $R7 == "1"
      StrCpy $XuyuInstallAllUsers "1"
    ${EndIf}

  xuyu_ui_classic:
    ; 经典界面接手：等宿主窗口关掉（最多 3 秒）再出向导，避免两个窗口叠在一起
    System::Call 'kernel32::WaitForSingleObject(p $XuyuUiHost, i 3000)'
    System::Call 'kernel32::CloseHandle(p $XuyuUiHost)'
    StrCpy $XuyuUiHost "0"
FunctionEnd
!macroend

; 安装段结束时由 customInstall 调用：告诉界面装好了，等用户点“打开胥宇 / 完成”，再按选择启动。
!macro XuyuInkUiAfterInstall
  ${If} $XuyuUiActive == "1"
    Push "done"
    Call XuyuUiStatus
    System::Call 'kernel32::WaitForSingleObject(p $XuyuUiHost, i -1)'
    System::Call 'kernel32::CloseHandle(p $XuyuUiHost)'
    Push $0
    ReadINIStr $0 "$XuyuUiSession\after.ini" after action
    ${If} $0 == "launch"
      ; 和经典完成页的“现在打开胥宇”一样：从提权的安装程序里也以普通用户身份启动
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
      WriteINIStr "$XuyuUiSession\status.ini" status launchResult $0   ; 只为排查留痕：ok / fallback / error
    ${EndIf}
    Pop $0
  ${EndIf}
!macroend
