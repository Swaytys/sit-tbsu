; BonsaiUrip - skrip Inno Setup (K-188). Dikompilasi oleh installer\buat-installer.ps1.
#ifndef Versi
  #define Versi "1.0.0"
#endif

[Setup]
AppId={{7B3A1E52-5C0D-4E8B-9A3F-2F6C81D0A5B7}
AppName=BonsaiUrip
AppVersion={#Versi}
AppPublisher=UD. Sumber Urip
DefaultDirName=C:\BonsaiUrip\aplikasi
DefaultGroupName=BonsaiUrip
DisableProgramGroupPage=yes
OutputDir=keluaran
OutputBaseFilename=Setup-BonsaiUrip
SetupIconFile=bonsaiurip.ico
UninstallDisplayIcon={app}\bonsaiurip.ico
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
DisableWelcomePage=no
; Data (database, storage, .env, sertifikat, log) berada di {app} tetapi TIDAK disentuh uninstaller/pembaruan.
UninstallFilesDir={app}\uninstall

[Languages]
Name: "id"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "paket\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion; Excludes: ".env,sertifikat\*,storage\*,log\*"

[Icons]
Name: "{commondesktop}\BonsaiUrip"; Filename: "https://localhost/"; IconFilename: "{app}\bonsaiurip.ico"
Name: "{group}\Buka BonsaiUrip"; Filename: "https://localhost/"; IconFilename: "{app}\bonsaiurip.ico"
Name: "{group}\Nyalakan / matikan server"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\server\copot-server.ps1"" -Nyalakan"; IconFilename: "{app}\bonsaiurip.ico"

[Run]
; Pemasang berjendela: membuat database, .env, sertifikat HTTPS, tugas otomatis, lalu membuka aplikasi.
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\server\pasang-server.ps1"""; \
  StatusMsg: "Menyiapkan database dan server BonsaiUrip (isi password PostgreSQL di jendela yang muncul)..."; Flags: waituntilterminated

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\server\copot-server.ps1"""; RunOnceId: "CopotServer"; Flags: runhidden

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
  if not FileExists(ExpandConstant('{commonpf}\PostgreSQL\17\bin\psql.exe')) and
     not FileExists('D:\PostgreSQL\17\bin\psql.exe') then
    Result := MsgBox('PostgreSQL 17 belum ditemukan di komputer ini.' + #13#10 + #13#10 +
      'BonsaiUrip membutuhkan PostgreSQL 17 (gratis: postgresql.org/download/windows). Pasang dulu, lalu jalankan Setup ini lagi.' + #13#10 + #13#10 +
      'Lanjutkan pemasangan tetap?', mbConfirmation, MB_YESNO) = IDYES;
end;
