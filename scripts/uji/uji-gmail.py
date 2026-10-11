"""Uji mandiri pengiriman email lewat Gmail, tanpa aplikasi BonsaiUrip (K-105).

Memastikan alamat Gmail pengirim + "Sandi aplikasi" 16 huruf bisa dipakai mengirim email lewat
smtp.gmail.com port 465 (sama dengan yang dipakai aplikasi).

Cara pakai (PowerShell atau Command Prompt, dari folder mana pun):
    python D:\\sit-tbsu\\scripts\\uji\\uji-gmail.py

Sandi diketik saat diminta dan tidak disimpan di mana pun. Hanya memakai pustaka bawaan Python.
Panduan lengkap: docs/panduan/kode-persetujuan-telegram-email.md
"""

import getpass
import smtplib
import ssl
import sys
from email.message import EmailMessage

SERVER = "smtp.gmail.com"
PORT = 465


def utama() -> None:
    print("=== Uji kirim email lewat Gmail ===")
    pengirim = input("Alamat Gmail pengirim (mis. toko@gmail.com): ").strip()
    # Google menampilkan sandi aplikasi sebagai 4 kelompok huruf berspasi; spasinya bukan bagian sandi.
    sandi = "".join(getpass.getpass("Sandi aplikasi 16 huruf (tidak tampil di layar): ").split())
    penerima = input(f"Alamat penerima email uji (kosong = {pengirim}): ").strip() or pengirim
    if len(sandi) != 16:
        print(
            f"PERINGATAN: sandi yang diketik {len(sandi)} huruf, padahal sandi aplikasi Google selalu 16 huruf.\n"
            "Kemungkinan yang diketik adalah password Gmail biasa; Google akan menolaknya."
        )

    pesan = EmailMessage()
    pesan["From"] = pengirim
    pesan["To"] = penerima
    pesan["Subject"] = "Pesan uji dari skrip uji-gmail.py"
    pesan.set_content("Bila email ini sampai, akun Gmail dan sandi aplikasinya bisa dipakai BonsaiUrip.")

    try:
        with smtplib.SMTP_SSL(SERVER, PORT, timeout=20, context=ssl.create_default_context()) as smtp:
            print(f"1. Tersambung ke {SERVER}:{PORT}.")
            smtp.login(pengirim, sandi)
            print("2. Login diterima Google.")
            smtp.send_message(pesan)
    except smtplib.SMTPAuthenticationError as galat:
        sys.exit(
            f"GAGAL langkah 2: Google menolak login ({galat.smtp_code}).\n"
            "Penyebab yang paling sering:\n"
            "  - yang diketik password Gmail biasa, bukan Sandi aplikasi 16 huruf;\n"
            "  - Verifikasi 2 Langkah akun itu belum aktif (Sandi aplikasi tidak tersedia tanpa itu);\n"
            "  - sandi aplikasi sudah dicabut atau salah salin; buat yang baru di\n"
            "    https://myaccount.google.com/apppasswords\n"
            "  - alamat Gmail salah ketik."
        )
    except (OSError, smtplib.SMTPException) as galat:
        sys.exit(
            f"GAGAL: {galat}\n"
            f"Bila gagal sebelum 'Tersambung', komputer ini tidak bisa mencapai {SERVER} port {PORT}:\n"
            "periksa internet, atau coba jaringan lain (sebagian jaringan memblokir port email)."
        )
    print(f"3. BERHASIL: email uji dikirim ke {penerima}. Periksa kotak masuk; bila tidak ada, lihat folder Spam.")


if __name__ == "__main__":
    utama()
