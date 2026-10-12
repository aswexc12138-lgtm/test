; 编译期替换 electron-builder 的 extractUsing7za（app-builder-lib/templates/nsis/include/extractAppPackage.nsh），
; 让它在水墨界面驱动时用 Nsis7z::ExtractWithCallback 报告真实的解压字节数（规格 I-25）。
;
; 规则（Codex 必读）：
;   - 除了行尾带 ";XUYU" 的行，其余每一行都必须和 electron-builder 模板里的 extractUsing7za 一字不差。
;     scripts/installer-ui/check-extract-template.mjs 会逐行比对，不一致（比如升级了 electron-builder）就让打包失败。
;   - 本文件由 installer.nsh 的 customCheckAppRunning 在编译期 !include：那一刻模板已经定义了 extractUsing7za，
;     而 installApplicationFiles 还没展开，所以这里的新定义会被用上。
;   - 没有水墨界面时（静默安装、经典界面），走的仍是原来的 Nsis7z::Extract，行为不变。

!ifmacrodef extractUsing7za
!macroundef extractUsing7za
!endif

!macro extractUsing7za FILE
  Push $OUTDIR
  CreateDirectory "$PLUGINSDIR\7z-out"
  ClearErrors
  SetOutPath "$PLUGINSDIR\7z-out"
  ${If} $XuyuUiActive == "1" ;XUYU
    Push "extract" ;XUYU
    Call XuyuUiStatus ;XUYU
    GetFunctionAddress $R9 XuyuExtractProgress ;XUYU
    Nsis7z::ExtractWithCallback "${FILE}" $R9 ;XUYU
  ${Else} ;XUYU
  Nsis7z::Extract "${FILE}"
  ${EndIf} ;XUYU
  Pop $R0
  SetOutPath $R0
  Push "copy" ;XUYU
  Call XuyuUiStatus ;XUYU

  # Retry counter
  StrCpy $R1 0

  LoopExtract7za:
    IntOp $R1 $R1 + 1

    # Attempt to copy files in atomic way
    CopyFiles /SILENT "$PLUGINSDIR\7z-out\*" $OUTDIR
    IfErrors 0 DoneExtract7za

    DetailPrint `Can't modify "${PRODUCT_NAME}"'s files.`
    ${if} $R1 < 5
      # Try copying a few times before asking for a user action.
      Goto RetryExtract7za
    ${else}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDRETRY IDCANCEL AbortExtract7za
    ${endIf}

    # As an absolutely last resort after a few automatic attempts and user
    # intervention - we will just overwrite everything with `Nsis7z::Extract`
    # even though it is not atomic and will ignore errors.

    # Clear the temporary folder first to make sure we don't use twice as
    # much disk space.
    RMDir /r "$PLUGINSDIR\7z-out"

    Nsis7z::Extract "${FILE}"
    Goto DoneExtract7za

  AbortExtract7za:
    Quit

  RetryExtract7za:
    Sleep 1000
    Goto LoopExtract7za

  DoneExtract7za:
  Push "finish" ;XUYU
  Call XuyuUiStatus ;XUYU
!macroend
