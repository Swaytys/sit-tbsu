// BonsaiUrip.exe - peluncur aplikasi desktop (K-188 v2). Dikompilasi installer\buat-installer.ps1 dengan csc bawaan
// Windows (.NET Framework 4). Menjalankan node\node.exe apps\api\dist\peluncur.js tanpa jendela terminal,
// menampilkan jendela "Menyiapkan..." selama menunggu, lalu pesan galat bila gagal. Akun pertama dibuat di peramban (K-191).
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        string akar = AppDomain.CurrentDomain.BaseDirectory;
        string node = Path.Combine(akar, @"node\node.exe");
        string skrip = Path.Combine(akar, @"apps\api\dist\peluncur.js");
        string data = Environment.GetEnvironmentVariable("BONSAIURIP_DATA");
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
        Form tunggu = null;
        if (!latar && !berhenti)
        {
            tunggu = new Form
            {
                Text = "BonsaiUrip",
                Width = 380,
                Height = 130,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                StartPosition = FormStartPosition.CenterScreen,
                ControlBox = false,
                TopMost = true,
            };
            try { tunggu.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            tunggu.Controls.Add(new Label
            {
                Text = "Menyiapkan BonsaiUrip...\nPemakaian pertama bisa memakan 1-2 menit.",
                AutoSize = false,
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter,
                Font = new Font("Segoe UI", 10),
            });
            tunggu.Show();
            Application.DoEvents();
        }

        var info = new ProcessStartInfo(node, "\"" + skrip + "\"" + (latar ? " --latar" : "") + (berhenti ? " --berhenti" : ""))
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = akar,
        };
        int kode;
        using (var p = Process.Start(info))
        {
            while (!p.WaitForExit(100)) Application.DoEvents();
            kode = p.ExitCode;
        }
        if (tunggu != null) tunggu.Close();

        if (kode != 0)
        {
            string berkas = Path.Combine(data, "galat-peluncur.txt");
            string pesan = File.Exists(berkas) ? File.ReadAllText(berkas) : "Sebab tidak diketahui.";
            if (!latar)
                MessageBox.Show("BonsaiUrip gagal dinyalakan:\n\n" + pesan + "\n\nCatatan lengkap: " +
                    Path.Combine(data, "log"), "BonsaiUrip", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return kode;
        }

        // K-191: tidak ada lagi password awal di jendela pesan; akun pertama dibuat di halaman "Buat akun pertama".
        // Sisa berkas password dari Setup v2 dihapus agar tidak tertinggal di disk.
        string sandiLama = Path.Combine(data, "password-awal-owner.txt");
        if (File.Exists(sandiLama)) { try { File.Delete(sandiLama); } catch { } }
        return 0;
    }
}
