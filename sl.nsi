OutFile "sl-win64.exe"
PageEx license
    LicenseData "LICENSE"
PageExEnd
InstallDir "$PROGRAMFILES64\sl"
Section
SetOutPath "$INSTDIR\bin"
File ".\target\release\sl.exe"
WriteUninstaller "$INSTDIR\uninstaller.exe"
SectionEnd
Section "Uninstall"
Delete "$INSTDIR\bin\sl.exe"
RMDir "$INSTDIR\bin"
Delete "$INSTDIR\uninstaller.exe"
RMDir "$INSTDIR"
SectionEnd