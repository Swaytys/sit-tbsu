"""Alat bantu penyusun dokumen proposal (python-docx)."""
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

G = r'C:\Users\LEONAR~1\AppData\Local\Temp\claude\d--sit-tbsu\6674e442-ae89-4859-8501-29d0007c9f62\scratchpad\proposal'
BIRU = RGBColor(0x1D, 0x4E, 0xD8)
KAYU = RGBColor(0x36, 0x26, 0x1C)
ABU = RGBColor(0x47, 0x55, 0x69)
PUTIH = RGBColor(0xFF, 0xFF, 0xFF)

d = Document()
_nomor_gambar = [0]
_nomor_tabel = [0]


def siapkan():
    sec = d.sections[0]
    sec.page_height, sec.page_width = Cm(29.7), Cm(21)
    sec.left_margin = sec.right_margin = Cm(2.2)
    sec.top_margin, sec.bottom_margin = Cm(2), Cm(2)
    st = d.styles['Normal']
    st.font.name = 'Calibri'
    st.font.size = Pt(11)
    st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Calibri')
    st.paragraph_format.space_after = Pt(5)
    st.paragraph_format.line_spacing = 1.15
    for n, ukuran, warna in (('Heading 1', 18, KAYU), ('Heading 2', 13.5, BIRU), ('Heading 3', 12, KAYU)):
        h = d.styles[n]
        h.font.name = 'Calibri'
        h.font.size = Pt(ukuran)
        h.font.bold = True
        h.font.color.rgb = warna
        h.paragraph_format.space_before = Pt(0 if n == 'Heading 1' else 10)
        h.paragraph_format.space_after = Pt(6)
        h.paragraph_format.keep_with_next = True
    d.styles['Heading 1'].paragraph_format.page_break_before = True
    # kaki halaman
    fp = sec.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = fp.add_run('Proposal Implementasi Sistem Informasi BonsaiUrip · UD. Sumber Urip · halaman ')
    r.font.size = Pt(8.5)
    r.font.color.rgb = ABU
    _field(fp, 'PAGE', 8.5)


def _field(para, kode, ukuran=None):
    for jenis in ('begin', None, 'separate', 'end'):
        rr = para.add_run()
        if jenis is None:
            it = OxmlElement('w:instrText')
            it.set(qn('xml:space'), 'preserve')
            it.text = kode
            rr._r.append(it)
        else:
            fc = OxmlElement('w:fldChar')
            fc.set(qn('w:fldCharType'), jenis)
            rr._r.append(fc)
        if ukuran:
            rr.font.size = Pt(ukuran)


def daftar_isi():
    p = d.add_paragraph()
    _field(p, 'TOC \\o "1-2" \\h \\z \\u')


def warna_sel(sel, hexwarna):
    tcPr = sel._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear')
    sh.set(qn('w:color'), 'auto')
    sh.set(qn('w:fill'), hexwarna)
    tcPr.append(sh)


def teks(para, isi, tebal=False, miring=False, ukuran=None, warna=None):
    for i, b in enumerate(isi.split('**')):
        if not b:
            continue
        r = para.add_run(b)
        r.bold = tebal or (i % 2 == 1)
        r.italic = miring
        if ukuran:
            r.font.size = Pt(ukuran)
        if warna:
            r.font.color.rgb = warna


def p(isi='', tebal=False, miring=False, ukuran=None, warna=None, rata=None, setelah=None, sebelum=None):
    para = d.add_paragraph()
    if rata == 'tengah':
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    elif rata == 'kanan':
        para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    elif rata == 'rata':
        para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    teks(para, isi, tebal, miring, ukuran, warna)
    if setelah is not None:
        para.paragraph_format.space_after = Pt(setelah)
    if sebelum is not None:
        para.paragraph_format.space_before = Pt(sebelum)
    return para


def h1(judul):
    return d.add_heading(judul, level=1)


def h2(judul):
    return d.add_heading(judul, level=2)


def h3(judul):
    return d.add_heading(judul, level=3)


def poin(isi, tingkat=0):
    para = d.add_paragraph(style='List Bullet' if tingkat == 0 else 'List Bullet 2')
    para.paragraph_format.space_after = Pt(2)
    teks(para, isi)
    return para


def langkah(daftar):
    """Langkah bernomor (nomor ditulis sendiri agar tiap daftar mulai dari 1)."""
    for i, isi in enumerate(daftar, 1):
        para = d.add_paragraph()
        para.paragraph_format.left_indent = Cm(0.9)
        para.paragraph_format.first_line_indent = Cm(-0.6)
        para.paragraph_format.space_after = Pt(2)
        teks(para, f'{i}.  {isi}')


def tabel(kepala, baris, lebar=None, warna_kepala='1E3A8A', ukuran=9.5, judul=None):
    if judul:
        _nomor_tabel[0] += 1
        jp = p(f'Tabel {_nomor_tabel[0]}. {judul}', tebal=True, ukuran=9.5, warna=ABU, setelah=2)
        jp.paragraph_format.keep_with_next = True
    t = d.add_table(rows=1, cols=len(kepala))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, k in enumerate(kepala):
        sel = t.rows[0].cells[i]
        sel.text = ''
        teks(sel.paragraphs[0], k, tebal=True, ukuran=ukuran, warna=PUTIH)
        warna_sel(sel, warna_kepala)
    # baris kepala diulang di halaman berikut
    trPr = t.rows[0]._tr.get_or_add_trPr()
    th = OxmlElement('w:tblHeader')
    th.set(qn('w:val'), 'true')
    trPr.append(th)
    for j, br in enumerate(baris):
        sel_baris = t.add_row().cells
        for i, isi in enumerate(br):
            sel_baris[i].text = ''
            for k, bt in enumerate(str(isi).split('\n')):
                para = sel_baris[i].paragraphs[0] if k == 0 else sel_baris[i].add_paragraph()
                para.paragraph_format.space_after = Pt(1)
                para.paragraph_format.line_spacing = 1.0
                teks(para, bt, ukuran=ukuran)
            if j % 2 == 1:
                warna_sel(sel_baris[i], 'F1F5F9')
    if lebar:
        lebar_tetap(t, lebar)
    d.add_paragraph().paragraph_format.space_after = Pt(1)
    return t


def lebar_tetap(t, lebar):
    t.autofit = False
    tblPr = t._tbl.tblPr
    lay = OxmlElement('w:tblLayout')
    lay.set(qn('w:type'), 'fixed')
    tblPr.append(lay)
    tw = OxmlElement('w:tblW')
    tw.set(qn('w:w'), str(int(sum(lebar) * 567)))
    tw.set(qn('w:type'), 'dxa')
    for lama in tblPr.findall(qn('w:tblW')):
        tblPr.remove(lama)
    tblPr.append(tw)
    for i, w in enumerate(lebar):
        t.columns[i].width = Cm(w)
    for row in t.rows:
        for i, w in enumerate(lebar):
            row.cells[i].width = Cm(w)


def kotak(judul, isi, warna='FEF3C7'):
    t = d.add_table(rows=1, cols=1)
    t.style = 'Table Grid'
    sel = t.rows[0].cells[0]
    warna_sel(sel, warna)
    lebar_tetap(t, [16.6])
    sel.text = ''
    teks(sel.paragraphs[0], judul, tebal=True)
    for b in isi:
        para = sel.add_paragraph()
        para.paragraph_format.space_after = Pt(1)
        teks(para, b)
    d.add_paragraph().paragraph_format.space_after = Pt(1)


def gambar(nama, lebar=16.4, keterangan=None):
    d.add_picture(f'{G}\\{nama}', width=Cm(lebar))
    d.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    d.paragraphs[-1].paragraph_format.keep_with_next = True
    if keterangan:
        _nomor_gambar[0] += 1
        p(f'Gambar {_nomor_gambar[0]}. {keterangan}', miring=True, ukuran=9, warna=ABU, rata='tengah', setelah=8)


def dua_gambar(a, b, ka, kb, lebar=7.9):
    t = d.add_table(rows=1, cols=2)
    for i, (n, k) in enumerate(((a, ka), (b, kb))):
        sel = t.rows[0].cells[i]
        sel.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        sel.paragraphs[0].add_run().add_picture(f'{G}\\{n}', width=Cm(lebar))
        _nomor_gambar[0] += 1
        q = sel.add_paragraph()
        q.alignment = WD_ALIGN_PARAGRAPH.CENTER
        teks(q, f'Gambar {_nomor_gambar[0]}. {k}', miring=True, ukuran=9, warna=ABU)
    d.add_paragraph().paragraph_format.space_after = Pt(1)


def ganti_halaman():
    d.paragraphs[-1].add_run().add_break(WD_BREAK.PAGE)
