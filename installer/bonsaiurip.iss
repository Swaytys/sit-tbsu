; BonsaiUrip - skrip Inno Setup (K-188 v2). Dikompilasi oleh installer\buat-installer.ps1.
; Dipasang per pengguna (tanpa hak Administrator). Data (database, gambar, log) disimpan terpisah di
; %LOCALAPPDATA%\BonsaiUrip sehingga memasang ulang/memperbarui/menghapus aplikasi tidak menghapus data.
#ifndef Versi
  #define Versi "1.0.0"
#endif

[Setup]
AppId={{7B3A1E52-5C0D-4E8B-9A3F-2F6C81D0A5B7}
AppName=BonsaiUrip
AppVersion={#Versi}
AppVerName=BonsaiUrip {#Versi}
AppPublisher=UD. Sumber Urip
DefaultDirName={localappdata}\Programs\BonsaiUrip
DefaultGroupName=BonsaiUrip
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
OutputDir=keluaran
OutputBaseFilename=Setup-BonsaiUrip
SetupIconFile=bonsaiurip.ico
UninstallDisplayIcon={app}\BonsaiUrip.exe
UninstallDisplayName=BonsaiUrip
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
CloseApplications=no

[Languages]
Name: "id"; MessagesFile: "compiler:Default.isl"

[Messages]
WelcomeLabel2=Setup akan memasang BonsaiUrip (sistem penjualan dan persediaan UD. Sumber Urip) di komputer ini.%n%nDatabase sudah termasuk; tidak ada program lain yang perlu dipasang.
FinishedLabel=BonsaiUrip sudah terpasang. Buka lewat ikon BonsaiUrip di desktop atau menu Start.

[Tasks]
Name: "desktop"; Description: "Buat ikon di desktop"
Name: "otomatis"; Description: "Nyalakan BonsaiUrip otomatis saat Windows dimulai (disarankan untuk komputer kasir)"

[Files]
Source: "paket\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autodesktop}\BonsaiUrip"; Filename: "{app}\BonsaiUrip.exe"; Tasks: desktop
Name: "{group}\BonsaiUrip"; Filename: "{app}\BonsaiUrip.exe"
Name: "{group}\Matikan BonsaiUrip"; Filename: "{app}\BonsaiUrip.exe"; Parameters: "--berhenti"
Name: "{userstartup}\BonsaiUrip"; Filename: "{app}\BonsaiUrip.exe"; Parameters: "--latar"; Tasks: otomatis

[Run]
Filename: "{app}\BonsaiUrip.exe"; Description: "Buka BonsaiUrip sekarang"; Flags: postinstall nowait skipifsilent

[InstallDelete]
; Sisa pemasangan lama (v1, dengan PowerShell) tidak dipakai lagi.
Type: filesandordirs; Name: "{app}\scripts"

[UninstallRun]
Filename: "{app}\BonsaiUrip.exe"; Parameters: "--berhenti"; RunOnceId: "Matikan"; Flags: runhidden waituntilterminated

[Code]
// Sebelum menimpa berkas (pembaruan): matikan server dan database yang sedang berjalan agar berkasnya tidak terkunci.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Kode: Integer;
begin
  Result := '';
  if FileExists(ExpandConstant('{app}\BonsaiUrip.exe')) then
    Exec(ExpandConstant('{app}\BonsaiUrip.exe'), '--berhenti', '', SW_HIDE, ewWaitUntilTerminated, Kode);
end;
