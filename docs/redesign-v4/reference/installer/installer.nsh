; 胥宇安装器 · v4 改版（规格 I-01 – I-08 经典向导；I-20 – I-29 水墨界面）
; 替换 xuyu/build/installer.nsh。只扩展 electron-builder 自带的安装器，安装 / 升级 / 卸载 / 静默流程不动。
;
; 双击安装时先用水墨界面（installer-inkui.nsh + XuyuSetupUI.exe）；用不了水墨界面时就是下面这套经典向导。
; 两种界面用的是同一套默认位置逻辑（XuyuChooseDefaultInstallDirectory：优先剩余空间最大的非系统盘，自动建 XUYU 文件夹）。
;
; 与旧版相比：
;   - 欢迎页改用 MUI 欢迎页骨架（左侧位图 + 整页高度），不再在带横幅的普通页里塞 193u 高的内容（旧版下半截被裁掉）
;   - 修复：全新安装时默认路径（如 D:\XUYU）还不存在，旧版用 NSIS 的 GetFullPathName 会得到空值，点“开始安装”没反应
;   - 中文界面字体从语言文件默认的“宋体”改为“微软雅黑 UI”
;   - 去掉副标题“设备布设工作台”（规格 G-01），文案统一
;   - 安装进度页、完成页、卸载欢迎页给出明确的中文标题与说明；完成页可勾选“现在打开胥宇”
; 保留：智能选盘（优先非系统盘、剩余空间最大）、升级 / 指定 /D 时沿用原位置、“仅当前用户 / 所有用户”、自动建 XUYU 文件夹、静默安装。

!include FileFunc.nsh
!include LogicLib.nsh
!include WinMessages.nsh
!include nsDialogs.nsh
; 定义了 customCheckAppRunning 以后，electron-builder 不再自动引入进程检查库和 $pid，这里补上（下面的 _CHECK_APP_RUNNING 要用）。
!include "getProcessInfo.nsh"
Var pid
!include "installer-inkui.nsh"

; 本页负责选择位置；不要再出现第二个自带的目录页。
!ifdef allowToChangeInstallationDirectory
!undef allowToChangeInstallationDirectory
!endif

; ---------- 全局：中文字体 ----------
; addLangs 在 customHeader 之前执行，此处语言已加载。
!macro customHeader
  SetFont /LANG=${LANG_SIMPCHINESE} "Microsoft YaHei UI" 9
!macroend

; ---------- 页面 ----------
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "安装胥宇"
  !define MUI_WELCOMEPAGE_TEXT " "
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW XuyuWelcomeShow
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE XuyuWelcomeLeave
  !insertmacro MUI_PAGE_WELCOME
  ; $mui.WelcomePage.Text 由上面的 MUI_PAGE_WELCOME 声明，所以这个函数必须写在它后面。
  Function XuyuWelcomeShow
    ShowWindow $mui.WelcomePage.Text ${SW_HIDE}
    Call XuyuWelcomeBuild
  FunctionEnd
  ; 水墨界面的启动函数要用到 electron-builder 的 $installMode 等变量，那些变量到这里才全部声明，所以放在这里定义。
  !insertmacro XuyuInkUiFunctions
!macroend

!macro customInstallMode
!ifndef BUILD_UNINSTALLER
  ${If} $XuyuInstallAllUsers == "1"
    StrCpy $isForceMachineInstall "1"
  ${Else}
    StrCpy $isForceCurrentInstall "1"
  ${EndIf}
!endif
!macroend

; 自带的安装范围页即使跳过也会重置 INSTDIR。在它之后、正式安装计算 appExe 与注册表路径之前，写回最终选择。
; 这里也是 MUI_PAGE_INSTFILES 之前最后一个钩子，顺便给进度页设置标题。
!macro customPageAfterChangeDir
  Page custom XuyuApplyDirectory
  !define MUI_PAGE_HEADER_TEXT "正在安装胥宇"
  !define MUI_PAGE_HEADER_SUBTEXT "通常不到一分钟，请稍候。"
  !define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "安装完成"
  !define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "点“下一步”结束。"
  !define MUI_INSTFILESPAGE_ABORTHEADER_TEXT "安装没有完成"
  !define MUI_INSTFILESPAGE_ABORTHEADER_SUBTEXT "你的图纸、方案和设置都还在，可以重新运行安装程序。"
!macroend

!macro customFinishPage
  Function XuyuStartApp
    ${If} ${isUpdated}
      StrCpy $1 "--updated"
    ${Else}
      StrCpy $1 ""
    ${EndIf}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd
  !define MUI_FINISHPAGE_TITLE "胥宇已经装好了"
  !define MUI_FINISHPAGE_TEXT "桌面和开始菜单里都有“胥宇”。$\r$\n$\r$\n以前的图纸、方案和设置都还在，打开就能接着用。"
  ; 跟随 package.json 的 nsis.runAfterFinish：为 false 时不显示“现在打开胥宇”（规格 I-05 建议改为 true）。
  !ifndef HIDE_RUN_AFTER_FINISH
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_TEXT "现在打开胥宇"
    !define MUI_FINISHPAGE_RUN_FUNCTION "XuyuStartApp"
  !endif
  !define MUI_FINISHPAGE_BUTTON "完成"
  !insertmacro MUI_PAGE_FINISH
!macroend

; ---------- 安装段：水墨界面的进度回报 ----------
; 关闭正在运行的胥宇：沿用 electron-builder 自带的检查（静默时自动关闭），只在前面报一下“准备”阶段。
!macro customCheckAppRunning
  !ifndef BUILD_UNINSTALLER
    Push "prepare"
    Call XuyuUiStatus
  !endif
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro _CHECK_APP_RUNNING
  !ifndef BUILD_UNINSTALLER
    ; 编译期：把解压宏换成会报进度的版本（这时模板的 extractUsing7za 已定义、还没被展开）
    !include "xuyu-extract-progress.nsh"
  !endif
!macroend

!macro customInstall
  !insertmacro XuyuInkUiAfterInstall
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "卸载胥宇"
  !define MUI_WELCOMEPAGE_TEXT "只删除程序本身。$\r$\n$\r$\n你的图纸、方案、设置和导出的成果都会保留，以后重新安装可以直接接着用。$\r$\n$\r$\n点“下一步”开始卸载。"
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

!macro customUninstallPage
  !define MUI_FINISHPAGE_TITLE "胥宇已卸载"
  !define MUI_FINISHPAGE_TEXT "你的数据仍保留在本机。需要时重新安装即可。"
!macroend

; ---------- 初始化：默认安装位置 ----------
!macro customInit
!ifndef BUILD_UNINSTALLER
  StrCpy $XuyuInstallAllUsers "0"
  ${If} $installMode == "all"
    StrCpy $XuyuInstallAllUsers "1"
  ${EndIf}
  !insertmacro GetDParameter $R0
  StrCpy $XuyuExactPath "0"
  StrCpy $XuyuHasPrevious "0"
  ${If} $installMode == "all"
  ${AndIf} $perMachineInstallationFolder != ""
    StrCpy $XuyuHasPrevious "1"
  ${ElseIf} $installMode != "all"
  ${AndIf} $perUserInstallationFolder != ""
    StrCpy $XuyuHasPrevious "1"
  ${EndIf}
  ${If} $R0 != ""
    StrCpy $XuyuExactPath "1"
    StrCpy $XuyuDirSource "param"
  ${ElseIf} $XuyuHasPrevious == "1"
    StrCpy $XuyuExactPath "1"
    StrCpy $XuyuDirSource "previous"
  ${Else}
    Call XuyuChooseDefaultInstallDirectory
  ${EndIf}
  StrCpy $XuyuChosenInstallDir $INSTDIR
  StrCpy $XuyuInitialInstallDir $INSTDIR

  ; 能用水墨界面就用（不能用时函数直接返回，下面照常显示经典向导）
  Call XuyuInkUiRun
  ${If} $XuyuUiActive == "1"
    SetSilent silent
  ${EndIf}
!endif
!macroend

!ifndef BUILD_UNINSTALLER
Var XuyuBestAnyDrive
Var XuyuBestAnyFree
Var XuyuBestDataDrive
Var XuyuBestDataFree
Var XuyuSystemDrive
Var XuyuExactPath
Var XuyuSelectedParent
Var XuyuChosenInstallDir
Var XuyuInitialInstallDir
Var XuyuInstallAllUsers
Var XuyuPath
Var XuyuBrowse
Var XuyuCurrentUser
Var XuyuAllUsers
Var XuyuNote
Var XuyuHint

Function XuyuChooseDefaultInstallDirectory
  StrCpy $XuyuBestAnyDrive ""
  StrCpy $XuyuBestAnyFree "0"
  StrCpy $XuyuBestDataDrive ""
  StrCpy $XuyuBestDataFree "0"
  StrCpy $XuyuSystemDrive $WINDIR 1
  ${GetDrives} "HDD" XuyuInspectDrive
  StrCpy $XuyuDirSource "default"
  ${If} $XuyuBestDataDrive != ""
    StrCpy $INSTDIR "$XuyuBestDataDrive\XUYU"
    StrCpy $XuyuDirSource "auto"
  ${ElseIf} $XuyuBestAnyDrive != ""
    StrCpy $INSTDIR "$XuyuBestAnyDrive\XUYU"
    StrCpy $XuyuDirSource "auto-system"
  ${EndIf}
FunctionEnd

Function XuyuInspectDrive
  ${DriveSpace} "$9" "/D=F /S=B" $1
  ${If} $1 != ""
    ; 64 位比较：NSIS 普通整数比较超过 2 GiB 会溢出。
    ${If} $1 L> $XuyuBestAnyFree
      StrCpy $XuyuBestAnyFree $1
      StrCpy $XuyuBestAnyDrive $9 2
    ${EndIf}
    StrCpy $2 $9 1
    ${If} $2 != $XuyuSystemDrive
    ${AndIf} $1 L> $XuyuBestDataFree
      StrCpy $XuyuBestDataFree $1
      StrCpy $XuyuBestDataDrive $9 2
    ${EndIf}
  ${EndIf}
  Push ""
FunctionEnd

; 把用户输入或选择的父目录规范化成最终安装目录（末级固定为 XUYU）。
; 输入无效时 $XuyuChosenInstallDir 为空。
Function XuyuSetPathFromParent
  StrCpy $XuyuChosenInstallDir ""
  ${If} $XuyuSelectedParent == ""
    Return
  ${EndIf}
  System::Call 'shlwapi::PathIsRelativeW(w "$XuyuSelectedParent") i.r0'
  ${If} $0 != 0
    Return
  ${EndIf}
  ; 用 Win32 GetFullPathNameW：只做规范化，不要求目录已存在。
  ; （NSIS 自带的 GetFullPathName 在末级目录不存在时返回空值，旧版因此全新安装点“开始安装”没反应。）
  System::Call 'kernel32::GetFullPathNameW(w "$XuyuSelectedParent", i ${NSIS_MAX_STRLEN}, w .r1, i 0) i.r0'
  ${If} $0 == 0
    Return
  ${EndIf}
  ${If} $0 >= ${NSIS_MAX_STRLEN}
    Return
  ${EndIf}
  ; 盘符或共享根必须真实存在。
  ${GetRoot} "$1" $2
  ${If} $2 == ""
    Return
  ${EndIf}
  IfFileExists "$2\*.*" +2 0
    Return
  ; 去掉末尾的反斜杠（保留 D:\ 这种根目录的写法由下面的拼接处理）。
  ${Do}
    StrCpy $3 $1 1 -1
    ${If} $3 != "\"
      ${ExitDo}
    ${EndIf}
    StrCpy $1 $1 -1
  ${Loop}
  ${GetFileName} "$1" $0
  ${If} $0 == "XUYU"
    StrCpy $XuyuChosenInstallDir $1
  ${Else}
    StrCpy $XuyuChosenInstallDir "$1\XUYU"
  ${EndIf}
FunctionEnd

Function XuyuResolveInput
  ${NSD_GetText} $XuyuPath $XuyuSelectedParent
  ${If} $XuyuExactPath == "1"
  ${AndIf} $XuyuSelectedParent == $XuyuInitialInstallDir
    StrCpy $XuyuChosenInstallDir $XuyuInitialInstallDir
  ${Else}
    Call XuyuSetPathFromParent
  ${EndIf}
FunctionEnd

; 路径下方那行说明：有效时写清最终位置和剩余空间，无效时用红字说明原因。
Function XuyuUpdateNote
  ${If} $XuyuChosenInstallDir == ""
    ${NSD_SetText} $XuyuNote "这个位置用不了。请填写完整路径，例如 D:\，或点“更改…”选择。"
    SetCtlColors $XuyuNote B42318 FFFFFF
    Return
  ${EndIf}
  ${GetRoot} "$XuyuChosenInstallDir" $0
  ${DriveSpace} "$0\" "/D=F /S=G" $1
  ${If} $1 != ""
    ${NSD_SetText} $XuyuNote "将安装到 $XuyuChosenInstallDir$\r$\n$0 盘剩余 $1 GB"
  ${Else}
    ${NSD_SetText} $XuyuNote "将安装到 $XuyuChosenInstallDir"
  ${EndIf}
  SetCtlColors $XuyuNote 6B6C66 FFFFFF
FunctionEnd

Function XuyuPathChanged
  Pop $0
  Call XuyuResolveInput
  Call XuyuUpdateNote
FunctionEnd

; MUI 欢迎页骨架：左侧 0–109u 是位图，右侧 120u 起是内容区，整页高 193u（没有顶部横幅）。
; 欢迎页内容（MUI 自带的正文标签已在 XuyuWelcomeShow 里隐藏，这里自己排版）。
Function XuyuWelcomeBuild
  ${NSD_CreateLabel} 120u 38u 190u 12u "选好安装位置，点“开始安装”。"
  Pop $0
  SetCtlColors $0 6B6C66 transparent

  ${NSD_CreateLabel} 120u 62u 190u 11u "安装位置"
  Pop $0
  SetCtlColors $0 1C1D1B transparent
  ${NSD_CreateText} 120u 75u 146u 14u "$XuyuChosenInstallDir"
  Pop $XuyuPath
  ${NSD_CreateButton} 270u 74u 45u 16u "更改…"
  Pop $XuyuBrowse
  ${NSD_OnClick} $XuyuBrowse XuyuBrowseClicked
  ${NSD_CreateLabel} 120u 93u 195u 20u ""
  Pop $XuyuNote
  ${NSD_OnChange} $XuyuPath XuyuPathChanged

  ${NSD_CreateLabel} 120u 122u 190u 11u "给谁用"
  Pop $0
  SetCtlColors $0 1C1D1B transparent
  ${NSD_CreateRadioButton} 120u 135u 80u 12u "仅当前用户"
  Pop $XuyuCurrentUser
  SetCtlColors $XuyuCurrentUser 1C1D1B transparent
  ${NSD_CreateRadioButton} 204u 135u 111u 12u "这台电脑的所有用户"
  Pop $XuyuAllUsers
  SetCtlColors $XuyuAllUsers 1C1D1B transparent
  ${If} $XuyuInstallAllUsers == "1"
    ${NSD_Check} $XuyuAllUsers
  ${Else}
    ${NSD_Check} $XuyuCurrentUser
  ${EndIf}

  ${If} $XuyuExactPath == "1"
    ${NSD_CreateLabel} 120u 170u 195u 20u "检测到已安装的胥宇，沿用原来的位置升级。"
  ${Else}
    ${NSD_CreateLabel} 120u 170u 195u 20u "默认选了剩余空间最大的非系统盘，会自动建一个 XUYU 文件夹。"
  ${EndIf}
  Pop $XuyuHint
  SetCtlColors $XuyuHint 6B6C66 transparent

  Call XuyuResolveInput
  Call XuyuUpdateNote

  GetDlgItem $0 $HWNDPARENT 1
  ${NSD_SetText} $0 "开始安装"
FunctionEnd

Function XuyuBrowseClicked
  Pop $0
  ${NSD_GetText} $XuyuPath $XuyuSelectedParent
  nsDialogs::SelectFolderDialog "选一个文件夹，胥宇会装在它下面的 XUYU 文件夹里" "$XuyuSelectedParent"
  Pop $0
  ${If} $0 != error
    StrCpy $XuyuExactPath "0"
    StrCpy $XuyuSelectedParent $0
    Call XuyuSetPathFromParent
    ${NSD_SetText} $XuyuPath $XuyuChosenInstallDir
    Call XuyuUpdateNote
  ${EndIf}
FunctionEnd

Function XuyuWelcomeLeave
  Call XuyuResolveInput
  ${If} $XuyuChosenInstallDir == ""
    Call XuyuUpdateNote
    Abort
  ${EndIf}
  ${NSD_GetState} $XuyuAllUsers $1
  StrCpy $XuyuInstallAllUsers "0"
  ${If} $1 == ${BST_CHECKED}
    StrCpy $XuyuInstallAllUsers "1"
  ${EndIf}
  StrCpy $INSTDIR $XuyuChosenInstallDir
FunctionEnd

Function XuyuApplyDirectory
  StrCpy $INSTDIR $XuyuChosenInstallDir
  Abort
FunctionEnd
!endif
