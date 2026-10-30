// BonsaiUrip.exe - peluncur aplikasi desktop (K-188, K-191, K-204). Dikompilasi installer\buat-installer.ps1 dengan
// csc bawaan Windows (.NET Framework 4, sintaks C# 5). Menjalankan node\node.exe apps\api\dist\peluncur.js tanpa
// jendela terminal:
//   - layar pembuka bermerek dengan langkah yang sedang dikerjakan (dibaca dari <data>\status-peluncur.txt);
//   - setelah siap, ikon BonsaiUrip di area notifikasi Windows (system tray) dengan menu Buka / Matikan;
//   - satu ikon saja: membuka lagi hanya membuka peramban; "Matikan BonsaiUrip" dari menu Start ikut menutup ikon.
// Argumen: (kosong) = nyalakan + buka peramban; --latar = nyalakan tanpa peramban (saat Windows mulai);
// --berhenti = matikan server dan database.
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
            int k = Jalankan(node, skrip, " --berhenti", null);
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
            Jalankan(node, skrip, " --berhenti", null);
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
        try
        {
            string ico = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bonsaiurip.ico");
            gambar.Image = File.Exists(ico) ? new Icon(ico, 256, 256).ToBitmap() : Icon.ToBitmap();
        }
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
            Text = "UD. Sumber Urip · Peterongan, Jombang",
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

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        pewaktu.Stop();
        base.OnFormClosed(e);
    }
}
