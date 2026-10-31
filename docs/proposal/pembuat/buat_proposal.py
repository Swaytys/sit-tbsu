"""Penyusun proposal implementasi BonsaiUrip (Word). Jalankan: python buat_proposal.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pr_alat import d  # noqa: E402
import pr_isi1  # noqa: E402,F401
import pr_isi2  # noqa: E402,F401

OUT = r'D:\sit-tbsu\docs\proposal\Proposal-Implementasi-BonsaiUrip-UD-Sumber-Urip.docx'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
d.save(OUT)
print('ok', OUT)
