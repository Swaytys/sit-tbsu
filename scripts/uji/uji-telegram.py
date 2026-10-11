"""Uji mandiri bot Telegram toko, tanpa aplikasi BonsaiUrip (K-105).

Memastikan tiga hal secara terpisah:
  1. Token bot dikenal Telegram (getMe).
  2. Bot tidak sedang dipakai program lain (getWebhookInfo).
  3. Bot bisa mengirim pesan ke sebuah chat (sendMessage).

Cara pakai (PowerShell atau Command Prompt, dari folder mana pun):
    python D:\\sit-tbsu\\scripts\\uji\\uji-telegram.py

Token diketik saat diminta dan tidak disimpan di mana pun. Hanya memakai pustaka bawaan Python.
Panduan lengkap: docs/panduan/kode-persetujuan-telegram-email.md
"""

import getpass
import json
import sys
import urllib.error
import urllib.request


def panggil(token: str, metode: str, isi: dict | None = None) -> dict:
    """Memanggil Bot API. Mengembalikan jawaban JSON Telegram (kunci `ok`, `result`, `description`)."""
    permintaan = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{metode}",
        data=json.dumps(isi or {}).encode(),
        headers={"content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(permintaan, timeout=15) as jawaban:
            return json.load(jawaban)
    except urllib.error.HTTPError as galat:
        # Telegram menjawab galat dalam bentuk JSON juga (mis. 401 Unauthorized).
        return json.load(galat)
    except OSError as galat:
        sys.exit(
            f"GAGAL: Telegram tidak bisa dihubungi ({galat}).\n"
            "Periksa internet komputer ini. Bila internet jalan tetapi tetap gagal, jaringan/penyedia internet\n"
            "memblokir api.telegram.org; coba lewat jaringan lain (mis. hotspot HP)."
        )


def utama() -> None:
    print("=== Uji bot Telegram ===")
    token = getpass.getpass("Tempel token bot dari @BotFather lalu Enter (tidak tampil di layar): ").strip()
    if ":" not in token:
        sys.exit("GAGAL: itu bukan token. Token berbentuk angka, titik dua, lalu huruf acak: 1234567890:AAH...")

    # 1. Token dikenal?
    saya = panggil(token, "getMe")
    if not saya.get("ok"):
        sys.exit(
            f"GAGAL langkah 1: token ditolak Telegram ({saya.get('description')}).\n"
            "Salin ulang token dari @BotFather (kirim /mybots > pilih bot > API Token). Pastikan tersalin utuh."
        )
    bot = saya["result"]
    print(f"1. Token benar. Bot: {bot['first_name']} (@{bot['username']})")

    # 2. Bot dipakai program lain?
    kait = panggil(token, "getWebhookInfo").get("result", {})
    if kait.get("url"):
        print(
            f"2. PERINGATAN: bot ini memakai webhook ({kait['url']}), artinya dipakai program lain.\n"
            "   BonsaiUrip tidak bisa membaca pesan masuknya (langkah Hubungkan Telegram akan gagal).\n"
            "   Buat bot baru khusus toko di @BotFather dengan /newbot."
        )
    else:
        print("2. Bot tidak dipakai program lain (tanpa webhook).")

    # 3. Siapa saja yang sudah mengirim pesan ke bot? (tidak menandai pesan sebagai terbaca)
    masuk = panggil(token, "getUpdates", {"timeout": 0, "allowed_updates": ["message"]})
    if not masuk.get("ok"):
        sys.exit(f"GAGAL langkah 3: pesan masuk tidak bisa dibaca ({masuk.get('description')}).")
    obrolan: dict[int, str] = {}
    for pembaruan in masuk["result"]:
        pesan = pembaruan.get("message") or {}
        chat = pesan.get("chat") or {}
        if chat.get("type") == "private":
            nama = " ".join(x for x in [chat.get("first_name"), chat.get("last_name")] if x)
            obrolan[chat["id"]] = f"{nama} (@{chat.get('username', '-')}) pesan terakhir: {pesan.get('text', '')!r}"
    if not obrolan:
        print(
            "3. Belum ada pesan masuk yang menunggu dibaca.\n"
            f"   Buka Telegram, cari @{bot['username']}, tekan Start, kirim pesan apa saja (mis. halo),\n"
            "   lalu jalankan skrip ini lagi. Bot TIDAK BISA mengirim pesan ke orang yang belum pernah\n"
            "   menekan Start pada bot itu; ini aturan Telegram."
        )
        return
    print("3. Chat yang sudah mengirim pesan ke bot:")
    for id_chat, keterangan in obrolan.items():
        print(f"   chat id {id_chat}: {keterangan}")

    tujuan = input("Ketik chat id tujuan pesan uji lalu Enter (kosong = lewati): ").strip()
    if not tujuan:
        return
    kirim = panggil(token, "sendMessage", {"chat_id": tujuan, "text": "Pesan uji dari skrip uji-telegram.py"})
    if kirim.get("ok"):
        print("4. BERHASIL: pesan uji terkirim. Lihat Telegram Anda.")
    else:
        print(f"4. GAGAL mengirim: {kirim.get('description')}")


if __name__ == "__main__":
    utama()
