; BonsaiUrip - skrip Inno Setup (K-188 v2, K-204 v3, K-213–K-215). Dikompilasi oleh installer\buat-installer.ps1.
; Dipasang per pengguna (tanpa hak Administrator). Data (database, gambar, log, Pustaka data) disimpan terpisah di
; %LOCALAPPDATA%\BonsaiUrip sehingga memasang ulang/memperbarui/menghapus aplikasi tidak menghapus data.
; K-214: wizard dwibahasa (Bahasa Indonesia / English), dipilih di awal.
#ifndef Versi
  #define Versi "1.0.0"
#endif

[Setup]
AppId={{7B3A1E52-5C0D-4E8B-9A3F-2F6C81D0A5B7}
AppName=BonsaiUrip
AppVersion={#Versi}
AppVerName=BonsaiUrip {#Versi}
AppPublisher=BonsaiUrip
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
ShowLanguageDialog=yes
UsePreviousLanguage=no

[Languages]
Name: "id"; MessagesFile: "bahasa\Indonesian.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[Messages]
id.WelcomeLabel2=Setup akan memasang BonsaiUrip (sistem penjualan, persediaan, dan kas toko) di komputer ini.%n%nDatabase dan program cadangan sudah termasuk; tidak ada program lain yang perlu dipasang. Tidak perlu hak Administrator.
en.WelcomeLabel2=Setup will install BonsaiUrip (store sales, inventory, and cash system) on this computer.%n%nThe database and backup program are included; nothing else needs to be installed. Administrator rights are not required.
id.SelectDirDesc=Di mana BonsaiUrip dipasang?
en.SelectDirDesc=Where should BonsaiUrip be installed?
id.SelectDirLabel3=Program BonsaiUrip dipasang di folder berikut (boleh di drive lain, mis. D:). Data toko (database, gambar, catatan) selalu disimpan terpisah di folder data pengguna, jadi memperbarui atau memasang ulang tidak menghapus data.
en.SelectDirLabel3=The BonsaiUrip program will be installed in the following folder (another drive such as D: is fine). Store data (database, images, logs) is always kept separately in the user data folder, so updating or reinstalling never deletes it.
id.FinishedHeadingLabel=BonsaiUrip sudah terpasang
en.FinishedHeadingLabel=BonsaiUrip is installed
id.FinishedLabel=Pemakaian pertama: peramban membuka Setup awal (data usaha dan akun Owner, atau lanjutkan data yang sudah ada). Ikon BonsaiUrip muncul di pojok kanan bawah layar: klik kanan › Matikan BonsaiUrip (hanya bisa setelah shift ditutup). Panduan: menu Start › BonsaiUrip › Panduan mulai pakai.
en.FinishedLabel=First use: the browser opens the initial setup (business details and Owner account, or continue existing data). The BonsaiUrip icon appears at the bottom right of the screen: right-click › Matikan BonsaiUrip (only after the cashier shift is closed). Guide: Start menu › BonsaiUrip › Panduan mulai pakai.

[CustomMessages]
id.TugasDesktop=Buat ikon di desktop
en.TugasDesktop=Create a desktop icon
id.TugasOtomatis=Nyalakan BonsaiUrip otomatis saat Windows dimulai (disarankan: juga menyala lagi setelah listrik/komputer mati)
en.TugasOtomatis=Start BonsaiUrip automatically when Windows starts (recommended: also restarts after a power cut)
id.MenuMatikan=Matikan BonsaiUrip
en.MenuMatikan=Matikan BonsaiUrip (Stop BonsaiUrip)
id.MenuPanduan=Panduan mulai pakai
en.MenuPanduan=Panduan mulai pakai (Quick start guide)
id.JalankanBuka=Buka BonsaiUrip sekarang
en.JalankanBuka=Open BonsaiUrip now
id.JalankanPanduan=Buka panduan mulai pakai
en.JalankanPanduan=Open the quick start guide
id.DataJudul=Data toko yang sudah ada
en.DataJudul=Existing store data
id.DataSub=Komputer ini sudah berisi data BonsaiUrip.
en.DataSub=This computer already has BonsaiUrip data.
id.DataKet=Pilih apa yang dilakukan dengan data itu. Bila ragu, pilih yang pertama.
en.DataKet=Choose what to do with that data. If unsure, choose the first option.
id.DataPakai=Pakai data yang sudah ada (memperbarui aplikasi; akun, barang, dan transaksi tetap)
en.DataPakai=Keep using the existing data (update the app; accounts, items, and transactions stay)
id.DataNol=Mulai dari nol: data lama DISIMPAN ke Pustaka data (bisa dipakai lagi dari Pengaturan › Data), lalu setup awal dari awal
en.DataNol=Start from scratch: the old data is SAVED to the Data Library (can be used again from Settings › Data), then the initial setup starts over
id.NolTanya1=Mulai dari nol?%n%nAplikasi akan kosong seperti baru dipasang. Data lama tidak dihapus: disimpan ke Pustaka data dan bisa dipakai lagi dari Pengaturan › Data.
en.NolTanya1=Start from scratch?%n%nThe app will be empty like a new installation. The old data is not deleted: it is saved to the Data Library and can be used again from Settings › Data.
id.NolTanya2=Yakin? Pilih Ya hanya bila data lama memang tidak dipakai lagi untuk sementara.
en.NolTanya2=Are you sure? Choose Yes only if the old data is not needed for now.
id.MemoProgram=Folder program:
en.MemoProgram=Program folder:
id.MemoData=Folder data toko (database, gambar, catatan, Pustaka data):
en.MemoData=Store data folder (database, images, logs, Data Library):
id.MemoTetap=(tidak ikut terhapus saat memperbarui/menghapus aplikasi)
en.MemoTetap=(kept when updating or uninstalling the app)
id.MemoNol=MULAI DARI NOL: data lama disimpan ke Pustaka data saat aplikasi pertama dibuka
en.MemoNol=START FROM SCRATCH: the old data is saved to the Data Library when the app first opens
id.ShiftTerbuka=Shift kasir di BonsaiUrip masih terbuka.%n%nTutup shift dulu (Shift & Clerical Check › Tutup shift) sampai selesai, lalu jalankan lagi.
en.ShiftTerbuka=A cashier shift is still open in BonsaiUrip.%n%nClose the shift first (Shift & Clerical Check › Tutup shift) until it is finished, then run this again.

[Tasks]
Name: "desktop"; Description: "{cm:TugasDesktop}"
Name: "otomatis"; Description: "{cm:TugasOtomatis}"

[Files]
Source: "paket\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autodesktop}\BonsaiUrip"; Filename: "{app}\BonsaiUrip.exe"; Tasks: desktop
Name: "{group}\BonsaiUrip"; Filename: "{app}\BonsaiUrip.exe"
Name: "{group}\{cm:MenuMatikan}"; Filename: "{app}\BonsaiUrip.exe"; Parameters: "--berhenti"
Name: "{group}\{cm:MenuPanduan}"; Filename: "{app}\panduan\mulai-pakai.html"
Name: "{userstartup}\BonsaiUrip"; Filename: "{app}\BonsaiUrip.exe"; Parameters: "--latar"; Tasks: otomatis

[Run]
Filename: "{app}\BonsaiUrip.exe"; Description: "{cm:JalankanBuka}"; Flags: postinstall nowait skipifsilent
Filename: "{app}\panduan\mulai-pakai.html"; Description: "{cm:JalankanPanduan}"; Flags: postinstall shellexec nowait skipifsilent unchecked

[InstallDelete]
; Sisa pemasangan lama (v1, dengan PowerShell) tidak dipakai lagi.
Type: filesandordirs; Name: "{app}\scripts"

[Code]
// K-213: bila data lama ada, pemasang memilih memakai data itu atau mulai dari nol. Mulai dari nol tidak menghapus
// apa pun: Setup meninggalkan tanda, lalu peluncur menyimpan data lama ke Pustaka data dan mengosongkan database.
var
  HalamanData: TInputOptionWizardPage;

const
  KODE_SHIFT_TERBUKA = 3;

function FolderData(): String;
begin
  Result := ExpandConstant('{localappdata}\BonsaiUrip');
end;

procedure InitializeWizard();
begin
  if DirExists(FolderData() + '\pgdata') then
  begin
    HalamanData := CreateInputOptionPage(wpSelectDir, CustomMessage('DataJudul'), CustomMessage('DataSub'),
      CustomMessage('DataKet'), True, False);
    HalamanData.Add(CustomMessage('DataPakai'));
    HalamanData.Add(CustomMessage('DataNol'));
    HalamanData.SelectedValueIndex := 0;
  end;
end;

function MulaiDariNol(): Boolean;
begin
  Result := (HalamanData <> nil) and (HalamanData.SelectedValueIndex = 1);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (HalamanData <> nil) and (CurPageID = HalamanData.ID) and MulaiDariNol() then
  begin
    Result := MsgBox(CustomMessage('NolTanya1'), mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES;
    if Result then
      Result := MsgBox(CustomMessage('NolTanya2'), mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and MulaiDariNol() then
    SaveStringToFile(FolderData() + '\mulai-dari-nol.flag', GetDateTimeString('yyyy-mm-dd hh:nn', '-', ':'), False);
end;

// K-204: halaman "Siap memasang" menyebut folder program dan folder data.
function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo,
  MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := CustomMessage('MemoProgram') + NewLine + Space + ExpandConstant('{app}') + NewLine + NewLine +
    CustomMessage('MemoData') + NewLine + Space + FolderData() + NewLine + Space + CustomMessage('MemoTetap') + NewLine;
  if MulaiDariNol() then Result := Result + Space + CustomMessage('MemoNol') + NewLine;
  if MemoTasksInfo <> '' then Result := Result + NewLine + MemoTasksInfo + NewLine;
end;

// Sebelum menimpa berkas (pembaruan): matikan server dan database. K-215: ditolak selama shift terbuka.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Kode: Integer;
begin
  Result := '';
  if FileExists(ExpandConstant('{app}\BonsaiUrip.exe')) then
    if Exec(ExpandConstant('{app}\BonsaiUrip.exe'), '--berhenti --diam', '', SW_HIDE, ewWaitUntilTerminated, Kode)
      and (Kode = KODE_SHIFT_TERBUKA) then
      Result := CustomMessage('ShiftTerbuka');
end;

// K-215: menghapus aplikasi juga ditolak selama shift terbuka; bila tidak, server dan database dimatikan dulu.
function InitializeUninstall(): Boolean;
var
  Kode: Integer;
begin
  Result := True;
  if Exec(ExpandConstant('{app}\BonsaiUrip.exe'), '--berhenti --diam', '', SW_HIDE, ewWaitUntilTerminated, Kode)
    and (Kode = KODE_SHIFT_TERBUKA) then
  begin
    MsgBox(CustomMessage('ShiftTerbuka'), mbError, MB_OK);
    Result := False;
  end;
end;
