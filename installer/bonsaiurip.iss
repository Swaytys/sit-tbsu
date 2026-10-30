; BonsaiUrip - skrip Inno Setup (K-188 v2, K-204 v3). Dikompilasi oleh installer\buat-installer.ps1.
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
; K-204: lokasi program boleh dipilih (mis. drive D:). Data tetap di %LOCALAPPDATA%\BonsaiUrip.
DisableDirPage=no
DisableWelcomePage=no
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
WelcomeLabel2=Setup akan memasang BonsaiUrip (sistem penjualan dan persediaan UD. Sumber Urip) di komputer ini.%n%nDatabase dan program cadangan sudah termasuk; tidak ada program lain yang perlu dipasang. Tidak perlu hak Administrator.
SelectDirDesc=Di mana BonsaiUrip dipasang?
SelectDirLabel3=Program BonsaiUrip dipasang di folder berikut (boleh di drive lain, mis. D:). Data toko (database, gambar, catatan) selalu disimpan terpisah di folder data pengguna, jadi memperbarui atau memasang ulang tidak menghapus data.
FinishedHeadingLabel=BonsaiUrip sudah terpasang
FinishedLabel=Pemakaian pertama: peramban terbuka di halaman "Buat akun pertama" (akun Owner), lalu "Panduan penyiapan". Ikon BonsaiUrip muncul di pojok kanan bawah layar (area notifikasi): klik kanan › Matikan BonsaiUrip untuk mematikan. Panduan lengkap: menu Start › BonsaiUrip › Panduan mulai pakai.

[Tasks]
Name: "desktop"; Description: "Buat ikon di desktop"
Name: "otomatis"; Description: "Nyalakan BonsaiUrip otomatis saat Windows dimulai (disarankan untuk komputer kasir)"

[Files]
Source: "paket\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autodesktop}\BonsaiUrip"; Filename: "{app}\BonsaiUrip.exe"; Tasks: desktop
Name: "{group}\BonsaiUrip"; Filename: "{app}\BonsaiUrip.exe"
Name: "{group}\Matikan BonsaiUrip"; Filename: "{app}\BonsaiUrip.exe"; Parameters: "--berhenti"
Name: "{group}\Panduan mulai pakai"; Filename: "{app}\panduan\mulai-pakai.html"
Name: "{userstartup}\BonsaiUrip"; Filename: "{app}\BonsaiUrip.exe"; Parameters: "--latar"; Tasks: otomatis

[Run]
Filename: "{app}\BonsaiUrip.exe"; Description: "Buka BonsaiUrip sekarang"; Flags: postinstall nowait skipifsilent
Filename: "{app}\panduan\mulai-pakai.html"; Description: "Buka panduan mulai pakai"; Flags: postinstall shellexec nowait skipifsilent unchecked

[InstallDelete]
; Sisa pemasangan lama (v1, dengan PowerShell) tidak dipakai lagi.
Type: filesandordirs; Name: "{app}\scripts"

[UninstallRun]
Filename: "{app}\BonsaiUrip.exe"; Parameters: "--berhenti"; RunOnceId: "Matikan"; Flags: runhidden waituntilterminated

[Code]
// K-204: halaman "Siap memasang" menyebut folder program dan folder data.
function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo,
  MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := 'Folder program:' + NewLine + Space + ExpandConstant('{app}') + NewLine + NewLine +
    'Folder data toko (database, gambar, catatan, pengaturan cadangan):' + NewLine + Space +
    ExpandConstant('{localappdata}\BonsaiUrip') + NewLine + Space +
    '(tidak ikut terhapus saat memperbarui/menghapus aplikasi)' + NewLine;
  if MemoTasksInfo <> '' then Result := Result + NewLine + MemoTasksInfo + NewLine;
end;

// Sebelum menimpa berkas (pembaruan): matikan server dan database yang sedang berjalan agar berkasnya tidak terkunci.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Kode: Integer;
begin
  Result := '';
  if FileExists(ExpandConstant('{app}\BonsaiUrip.exe')) then
    Exec(ExpandConstant('{app}\BonsaiUrip.exe'), '--berhenti', '', SW_HIDE, ewWaitUntilTerminated, Kode);
end;
