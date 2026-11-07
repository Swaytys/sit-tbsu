// BonsaiUrip.exe - peluncur aplikasi desktop (K-188, K-191, K-204). Dikompilasi installer\buat-installer.ps1 dengan
// csc bawaan Windows (.NET Framework 4, sintaks C# 5). Menjalankan node\node.exe apps\api\dist\peluncur.js tanpa
// jendela terminal:
//   - layar pembuka bermerek dengan langkah yang sedang dikerjakan (dibaca dari <data>\status-peluncur.txt);
//   - setelah siap, ikon BonsaiUrip di area notifikasi Windows (system tray) dengan menu Buka / Matikan;
//   - satu ikon saja: membuka lagi hanya membuka peramban; "Matikan BonsaiUrip" dari menu Start ikut menutup ikon.
// Argumen: (kosong) = nyalakan + buka peramban; --latar = nyalakan tanpa peramban (saat Windows mulai);
// --berhenti = matikan server dan database; --pulihkan = pulihkan akses Owner bersama pengembang (K-211, K-232).
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

static class Program
{
    static string akar = AppDomain.CurrentDomain.BaseDirectory;
    static string data;
    static NotifyIcon ikon;
    static PenjagaShutdown penjaga;

    [STAThread]
    static int Main(string[] args)
    {
        string node = Path.Combine(akar, @"node\node.exe");
        string skrip = Path.Combine(akar, @"apps\api\dist\peluncur.js");
        data = Environment.GetEnvironmentVariable("BONSAIURIP_DATA");
        if (string.IsNullOrEmpty(data))
            data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BonsaiUrip");
        bool latar = Array.IndexOf(args, "--latar") >= 0;
        bool berhenti = Array.IndexOf(args, "--berhenti") >= 0;

        if (!File.Exists(node) || !File.Exists(skrip))
        {
            MessageBox.Show("Berkas aplikasi tidak lengkap. Pasang ulang BonsaiUrip.", "BonsaiUrip",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        Application.EnableVisualStyles();

        if (berhenti)
        {
            bool paksa = Array.IndexOf(args, "--paksa") >= 0;
            bool diam = Array.IndexOf(args, "--diam") >= 0;
            int k = Jalankan(node, skrip, paksa ? " --berhenti --paksa" : " --berhenti", null);
            if (k == KODE_SHIFT_TERBUKA)
            {
                // K-215: shift masih terbuka; aplikasi tetap menyala. Setup/pelepas memakai --diam dan kode keluar ini.
                if (!diam) TampilkanTolakMatikan();
                return k;
            }
            // Ikon tray (bila ada) ikut ditutup.
            EventWaitHandle sinyal;
            if (EventWaitHandle.TryOpenExisting("BonsaiUrip-Berhenti", out sinyal))
            {
                sinyal.Set();
                // Tunggu proses ikon benar-benar keluar (Setup pembaruan menimpa BonsaiUrip.exe sesudah ini).
                Mutex ikonJalan;
                if (Mutex.TryOpenExisting("BonsaiUrip-Ikon", out ikonJalan))
                {
                    try { if (ikonJalan.WaitOne(10000)) ikonJalan.ReleaseMutex(); }
                    catch (AbandonedMutexException) { ikonJalan.ReleaseMutex(); }
                }
            }
            return k;
        }

        if (Array.IndexOf(args, "--pulihkan") >= 0)
        {
            // Berhasil: lanjut menyalakan seperti biasa (layar pembuka, peramban, ikon).
            int h = PulihkanOwner(node, skrip);
            if (h != 0) return h < 0 ? 0 : h;
        }

        bool baru;
        var kunci = new Mutex(true, "BonsaiUrip-Ikon", out baru);
        if (!baru)
        {
            // Ikon sudah berjalan: cukup nyalakan (bila mati) dan buka peramban.
            return Nyalakan(node, skrip, latar, false);
        }
        int hasil = Nyalakan(node, skrip, latar, !latar);
        if (hasil != 0) return hasil;

        var berhentiSinyal = new EventWaitHandle(false, EventResetMode.AutoReset, "BonsaiUrip-Berhenti");
        TampilkanIkon(node, skrip, latar);
        var penunggu = new Thread(() =>
        {
            berhentiSinyal.WaitOne();
            if (ikon != null) ikon.Visible = false;
            Application.Exit();
        });
        penunggu.IsBackground = true;
        penunggu.Start();
        Application.Run();
        GC.KeepAlive(kunci);
        return 0;
    }

    /**
     * K-211/K-232: `BonsaiUrip.exe --pulihkan` (tidak ada di menu Start). Akses Owner hanya dipulihkan dengan kode
     * jawaban pengembang untuk kode tantangan komputer ini. Owner diberi password sementara (wajib diganti saat
     * masuk) dan kode pemulihan baru; hasil tampil sekali (Ctrl+C menyalin isi jendela pesan), berkasnya dihapus.
     */
    static int PulihkanOwner(string node, string skrip)
    {
        var yakin = MessageBox.Show(
            "Pulihkan akses Owner bersama pengembang?\n\nGunakan ini hanya bila password Owner terlupa, email tidak bisa " +
            "dipakai, dan kode pemulihan juga hilang.\n\nLangkahnya: (1) komputer ini menampilkan kode tantangan, " +
            "(2) kirim kode itu ke pengembang, (3) ketik kode jawaban dari pengembang. Tanpa kode jawaban yang benar, " +
            "akses Owner tidak bisa dipulihkan.",
            "Pulihkan akses Owner", MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2);
        if (yakin != DialogResult.Yes) return -1;
        // K-232 langkah 1: kode tantangan sekali pakai.
        string berkasTantangan = Path.Combine(data, "pulihkan-tantangan.json");
        string galatPeluncur = Path.Combine(data, "galat-peluncur.txt");
        if (Jalankan(node, skrip, " --pulihkan-owner --tantangan", null) != 0 || !File.Exists(berkasTantangan))
        {
            MessageBox.Show("Kode tantangan gagal dibuat:\n\n" +
                (File.Exists(galatPeluncur) ? File.ReadAllText(galatPeluncur) : "Sebab tidak diketahui."),
                "Pulihkan akses Owner", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        var cocok = System.Text.RegularExpressions.Regex.Match(
            File.ReadAllText(berkasTantangan), "\"kode\"\\s*:\\s*\"([^\"]+)\"");
        string jawaban = MintaJawaban(cocok.Groups[1].Value);
        if (jawaban == null) return -1;
        string berkas = Path.Combine(data, "pulihkan-owner.txt");
        try { File.Delete(berkas); } catch { }
        int kode = Jalankan(node, skrip, " --pulihkan-owner --jawaban=" + jawaban, null);
        if (kode != 0 || !File.Exists(berkas))
        {
            string galat = Path.Combine(data, "galat-peluncur.txt");
            MessageBox.Show("Pemulihan gagal:\n\n" + (File.Exists(galat) ? File.ReadAllText(galat) : "Sebab tidak diketahui."),
                "Pulihkan akses Owner", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        string isi = File.ReadAllText(berkas);
        try { File.Delete(berkas); } catch { }
        MessageBox.Show(isi + "\n\n(Tekan Ctrl+C untuk menyalin isi jendela ini.)\nSetelah OK, BonsaiUrip dibuka.",
            "Akses Owner dipulihkan", MessageBoxButtons.OK, MessageBoxIcon.Information);
        return 0;
    }

    /**
     * K-232: jendela kode tantangan (bisa disalin) dan isian kode jawaban pengembang. `null` = dibatalkan.
     * Kode jawaban hanya berisi huruf, angka, '-' dan '_' (base64url), jadi aman diteruskan sebagai argumen.
     */
    static string MintaJawaban(string tantangan)
    {
        var f = new Form
        {
            Text = "Pulihkan akses Owner",
            Width = 620, Height = 360,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            StartPosition = FormStartPosition.CenterScreen,
            MaximizeBox = false, MinimizeBox = false, TopMost = true,
            Font = new Font("Segoe UI", 10),
        };
        var l1 = new Label { Left = 16, Top = 14, Width = 570, Height = 40,
            Text = "1. Kirim kode tantangan ini ke pengembang (berlaku 60 menit, sekali pakai):" };
        var tTantangan = new TextBox { Left = 16, Top = 56, Width = 460, ReadOnly = true, Text = tantangan,
            Font = new Font("Consolas", 12, FontStyle.Bold) };
        var salin = new Button { Left = 486, Top = 54, Width = 100, Height = 30, Text = "Salin" };
        salin.Click += (s, e) => { Clipboard.SetText(tantangan); salin.Text = "Tersalin"; };
        var l2 = new Label { Left = 16, Top = 104, Width = 570, Height = 40,
            Text = "2. Tempel kode jawaban dari pengembang (± 86 huruf/angka):" };
        var tJawaban = new TextBox { Left = 16, Top = 146, Width = 570, Height = 60, Multiline = true,
            Font = new Font("Consolas", 10) };
        var ok = new Button { Left = 380, Top = 260, Width = 100, Height = 34, Text = "Pulihkan",
            DialogResult = DialogResult.OK };
        var batal = new Button { Left = 486, Top = 260, Width = 100, Height = 34, Text = "Batal",
            DialogResult = DialogResult.Cancel };
        f.Controls.AddRange(new Control[] { l1, tTantangan, salin, l2, tJawaban, ok, batal });
        f.AcceptButton = ok;
        f.CancelButton = batal;
        while (true)
        {
            if (f.ShowDialog() != DialogResult.OK) return null;
            string j = System.Text.RegularExpressions.Regex.Replace(tJawaban.Text, "\\s", "");
            if (System.Text.RegularExpressions.Regex.IsMatch(j, "^[A-Za-z0-9_-]{80,100}$")) return j;
            MessageBox.Show("Kode jawaban belum lengkap atau berisi tanda yang tidak dikenal. Salin ulang seluruh kode dari pengembang.",
                "Pulihkan akses Owner", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    /** Menjalankan peluncur Node; layar pembuka ditampilkan bila diminta. Mengembalikan kode keluar. */
    static int Nyalakan(string node, string skrip, bool latar, bool pembuka)
    {
        LayarPembuka layar = pembuka ? new LayarPembuka(Path.Combine(data, "status-peluncur.txt")) : null;
        if (layar != null) { layar.Show(); Application.DoEvents(); }
        int kode = Jalankan(node, skrip, latar ? " --latar" : "", layar);
        if (layar != null) layar.Close();
        if (kode != 0)
        {
            string berkas = Path.Combine(data, "galat-peluncur.txt");
            string pesan = File.Exists(berkas) ? File.ReadAllText(berkas) : "Sebab tidak diketahui.";
            if (!latar)
                MessageBox.Show("BonsaiUrip gagal dinyalakan:\n\n" + pesan + "\n\nCatatan lengkap: " +
                    Path.Combine(data, "log"), "BonsaiUrip", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        return kode;
    }

    static int Jalankan(string node, string skrip, string argumen, Form tetapHidup)
    {
        var info = new ProcessStartInfo(node, "\"" + skrip + "\"" + argumen)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = akar,
        };
        using (var p = Process.Start(info))
        {
            while (!p.WaitForExit(80)) Application.DoEvents();
            return p.ExitCode;
        }
    }

    /** K-215: kode keluar peluncur bila shift masih terbuka. */
    const int KODE_SHIFT_TERBUKA = 3;

    static void TampilkanTolakMatikan()
    {
        string berkas = Path.Combine(data, "galat-peluncur.txt");
        string pesan = File.Exists(berkas) ? File.ReadAllText(berkas) : "Shift masih terbuka.";
        MessageBox.Show(pesan + "\n\nBuka BonsaiUrip › Shift & Clerical Check › Tutup shift, selesaikan sampai shift tertutup, lalu matikan lagi.",
            "BonsaiUrip belum bisa dimatikan", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }

    static void TampilkanIkon(string node, string skrip, bool latar)
    {
        var menu = new ContextMenuStrip();
        var buka = new ToolStripMenuItem("Buka BonsaiUrip");
        buka.Font = new Font(buka.Font, FontStyle.Bold);
        buka.Click += (s, e) => Nyalakan(node, skrip, false, false);
        var mati = new ToolStripMenuItem("Matikan BonsaiUrip");
        mati.Click += (s, e) =>
        {
            var jawab = MessageBox.Show(
                "Matikan BonsaiUrip?\n\nKomputer kasir dan tablet lain tidak bisa memakai aplikasi sampai dinyalakan lagi " +
                "(ikon BonsaiUrip di desktop). Pastikan shift sudah ditutup.",
                "Matikan BonsaiUrip", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2);
            if (jawab != DialogResult.Yes) return;
            if (Jalankan(node, skrip, " --berhenti", null) == KODE_SHIFT_TERBUKA)
            {
                TampilkanTolakMatikan();
                return;
            }
            ikon.Visible = false;
            Application.Exit();
        };
        menu.Items.Add(buka);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(mati);

        ikon = new NotifyIcon();
        try { ikon.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { ikon.Icon = SystemIcons.Application; }
        ikon.Text = "BonsaiUrip berjalan";
        ikon.ContextMenuStrip = menu;
        ikon.DoubleClick += (s, e) => Nyalakan(node, skrip, false, false);
        ikon.Visible = true;
        penjaga = new PenjagaShutdown(node, skrip, data);
        if (!latar)
        {
            ikon.BalloonTipTitle = "BonsaiUrip berjalan";
            ikon.BalloonTipText = "Menutup peramban tidak mematikan aplikasi. Untuk mematikan: klik kanan ikon ini (panah ^ di pojok kanan bawah) › Matikan BonsaiUrip.";
            ikon.ShowBalloonTip(8000);
        }
    }
}

/** Layar pembuka bermerek: logo, nama, animasi, dan langkah yang sedang dikerjakan peluncur. */
class LayarPembuka : Form
{
    readonly string berkasStatus;
    readonly Label langkah;
    readonly System.Windows.Forms.Timer pewaktu;
    int detik;

    public LayarPembuka(string berkasStatus)
    {
        this.berkasStatus = berkasStatus;
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterScreen;
        Width = 520;
        Height = 300;
        BackColor = Color.FromArgb(54, 38, 28);
        TopMost = true;
        ShowInTaskbar = true;
        Text = "BonsaiUrip";
        Opacity = 0;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

        var gambar = new PictureBox
        {
            Width = 112,
            Height = 112,
            Left = (Width - 112) / 2,
            Top = 30,
            SizeMode = PictureBoxSizeMode.Zoom,
            BackColor = Color.Transparent,
        };
        try { gambar.Image = GambarLogo(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bonsaiurip.ico")); }
        catch { }
        Controls.Add(gambar);

        Controls.Add(new Label
        {
            Text = "BonsaiUrip",
            ForeColor = Color.FromArgb(245, 235, 215),
            Font = new Font("Segoe UI Semibold", 22),
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleCenter,
            Width = Width,
            Height = 44,
            Top = 148,
        });
        Controls.Add(new Label
        {
            Text = "Toko rapi, stok terkendali, untung terlihat.",
            ForeColor = Color.FromArgb(200, 185, 160),
            Font = new Font("Segoe UI", 9.5f),
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleCenter,
            Width = Width,
            Height = 22,
            Top = 190,
        });
        Controls.Add(new ProgressBar
        {
            Style = ProgressBarStyle.Marquee,
            MarqueeAnimationSpeed = 25,
            Width = 300,
            Height = 6,
            Left = (Width - 300) / 2,
            Top = 226,
        });
        langkah = new Label
        {
            Text = "Menyiapkan…",
            ForeColor = Color.FromArgb(220, 205, 180),
            Font = new Font("Segoe UI", 9),
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleCenter,
            Width = Width,
            Height = 40,
            Top = 240,
        };
        Controls.Add(langkah);

        pewaktu = new System.Windows.Forms.Timer { Interval = 50 };
        pewaktu.Tick += (s, e) =>
        {
            if (Opacity < 1) Opacity = Math.Min(1, Opacity + 0.08);
            if (++detik % 6 != 0) return;
            string teks = null;
            try { if (File.Exists(this.berkasStatus)) teks = File.ReadAllText(this.berkasStatus).Trim(); } catch { }
            int lama = detik / 20;
            if (!string.IsNullOrEmpty(teks)) langkah.Text = teks + (lama > 20 ? "\nPemakaian pertama bisa 1–2 menit." : "");
        };
        pewaktu.Start();
    }

    /// Gambar terbesar di berkas .ico. Bingkai PNG (ikon 256 px) dibaca langsung karena Icon.ToBitmap di .NET
    /// Framework tidak menampilkannya.
    static Image GambarLogo(string ico)
    {
        byte[] b = File.ReadAllBytes(ico);
        int jumlah = BitConverter.ToUInt16(b, 4), terbaik = -1, lebar = 0;
        for (int i = 0; i < jumlah; i++)
        {
            int w = b[6 + 16 * i] == 0 ? 256 : b[6 + 16 * i];
            if (w > lebar) { lebar = w; terbaik = i; }
        }
        if (terbaik < 0) return null;
        int ukuran = BitConverter.ToInt32(b, 6 + 16 * terbaik + 8);
        int awal = BitConverter.ToInt32(b, 6 + 16 * terbaik + 12);
        if (b[awal] == 0x89 && b[awal + 1] == (byte)'P')
            return Image.FromStream(new MemoryStream(b, awal, ukuran));
        return new Icon(ico, lebar, lebar).ToBitmap();
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        pewaktu.Stop();
        base.OnFormClosed(e);
    }
}

/**
 * K-215: jendela tak terlihat yang menerima pemberitahuan Windows akan dimatikan. Selama shift terbuka (dibaca dari
 * /api/health tiap 20 detik), Windows ditahan dengan alasan yang tampil di layar "aplikasi mencegah dimatikan".
 * Pengguna tetap bisa memaksa ("Matikan saja"); bila itu terjadi, layar pemulihan tampil saat menyala lagi (K-216).
 * Bila shift sudah ditutup, server dan database dimatikan rapi sebelum Windows mati.
 */
class PenjagaShutdown : Form
{
    const int WM_QUERYENDSESSION = 0x11;
    const int WM_ENDSESSION = 0x16;
    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
    static extern bool ShutdownBlockReasonCreate(IntPtr hWnd, string alasan);
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    static extern bool ShutdownBlockReasonDestroy(IntPtr hWnd);

    readonly string node, skrip, data;
    volatile bool shiftTerbuka;
    readonly System.Threading.Timer pemeriksa;

    public PenjagaShutdown(string node, string skrip, string data)
    {
        this.node = node;
        this.skrip = skrip;
        this.data = data;
        ShowInTaskbar = false;
        FormBorderStyle = FormBorderStyle.None;
        Opacity = 0;
        Size = new Size(1, 1);
        var h = Handle; // jendela dibuat tanpa ditampilkan
        pemeriksa = new System.Threading.Timer(_ => Periksa(), null, 2000, 20000);
    }

    void Periksa()
    {
        try
        {
            string konfig = File.ReadAllText(Path.Combine(data, "peluncur.json"));
            var m = System.Text.RegularExpressions.Regex.Match(konfig, "\"portAplikasi\"\\s*:\\s*(\\d+)");
            if (!m.Success) return;
            using (var web = new System.Net.WebClient())
            {
                string isi = web.DownloadString("http://localhost:" + m.Groups[1].Value + "/api/health");
                shiftTerbuka = isi.Contains("\"shiftTerbuka\":true");
            }
        }
        catch { }
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_QUERYENDSESSION)
        {
            Periksa();
            if (shiftTerbuka)
            {
                ShutdownBlockReasonCreate(Handle, "Shift BonsaiUrip masih terbuka. Tutup shift dulu agar uang tercatat lengkap.");
                m.Result = IntPtr.Zero;
                return;
            }
            ShutdownBlockReasonDestroy(Handle);
        }
        else if (m.Msg == WM_ENDSESSION && m.WParam != IntPtr.Zero && !shiftTerbuka)
        {
            // Windows benar-benar dimatikan dan shift sudah ditutup: matikan server dan database dengan rapi.
            try
            {
                var info = new ProcessStartInfo(node, "\"" + skrip + "\" --berhenti")
                {
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                using (var p = Process.Start(info)) { p.WaitForExit(20000); }
            }
            catch { }
        }
        base.WndProc(ref m);
    }
}
