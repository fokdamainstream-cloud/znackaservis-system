import os
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
try:
    pdfmetrics.registerFont(TTFont('Roboto',      os.path.join(BASE_DIR, 'Roboto-Regular.ttf')))
    pdfmetrics.registerFont(TTFont('Roboto-Bold', os.path.join(BASE_DIR, 'Roboto-Bold.ttf')))
    FONT_NAME = 'Roboto'
    FONT_BOLD = 'Roboto-Bold'
except Exception:
    FONT_NAME = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'

# ── Brand farby (rovnaké ako faktúra) ──────────────────────────
C_NAVY    = colors.HexColor('#1B3A6B')
C_AMBER   = colors.HexColor('#F59E0B')
C_LIGHT   = colors.HexColor('#F8FAFC')
C_BLUE_LT = colors.HexColor('#EFF6FF')
C_BORDER  = colors.HexColor('#CBD5E1')
C_TEXT    = colors.HexColor('#1E293B')
C_MUTED   = colors.HexColor('#64748B')
C_HDR_SUB = colors.HexColor('#93C5FD')


def _s(name, bold=False, size=8.5, leading=None, color=None, align=0):
    return ParagraphStyle(
        name,
        fontName=FONT_BOLD if bold else FONT_NAME,
        fontSize=size,
        leading=leading or round(size * 1.4, 1),
        alignment=align,
        textColor=color if color is not None else C_TEXT,
    )


def generate_delivery_note_pdf(dn):
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = (
        f'attachment; filename="dodaci_list_{dn.delivery_note_number.replace("/", "_")}.pdf"'
    )

    doc = SimpleDocTemplate(response, pagesize=A4,
                            topMargin=14*mm, bottomMargin=14*mm,
                            leftMargin=14*mm, rightMargin=14*mm)
    elements = []
    partner = dn.partner

    pn   = (partner.name      if partner else None) or dn.partner_name or ''
    pst  = (partner.street    if partner else None) or ''
    pz   = (partner.zip_code  if partner else None) or ''
    pc   = (partner.city      if partner else None) or ''
    pi   = (partner.ico       if partner else None) or dn.partner_ico or ''
    pd   = (partner.dic       if partner else None) or dn.partner_dic or ''
    padr = f"{pst}, {pz} {pc}".strip(', ')

    # ── Štýly ──────────────────────────────────────────────────
    sN    = _s('dN')
    sMut  = _s('dMut',  color=C_MUTED, size=7.5)
    # header bar
    sHCo  = _s('dHCo',  bold=True,  size=13,   color=colors.white)
    sHTg  = _s('dHTg',  size=7.5,              color=C_HDR_SUB)
    sHLb  = _s('dHLb',  size=8,                color=C_HDR_SUB,    align=2)
    sHNm  = _s('dHNm',  bold=True,  size=16,   color=C_AMBER,      align=2)
    # address cards
    sALb  = _s('dALb',  bold=True,  size=7,    color=C_MUTED)
    sAFm  = _s('dAFm',  bold=True,  size=10,   color=C_TEXT)
    sALn  = _s('dALn',  size=8,                color=C_TEXT)
    sAReg = _s('dAReg', size=7,                color=C_MUTED)
    # meta strip
    sMlb  = _s('dMlb',  size=7,                color=C_MUTED)
    sMvl  = _s('dMvl',  bold=True,  size=8.5,  color=C_TEXT)
    # items table
    sTH   = _s('dTH',   bold=True,  size=8,    color=colors.white)
    sTHR  = _s('dTHR',  bold=True,  size=8,    color=colors.white, align=2)
    sTDR  = _s('dTDR',  size=8.5,              align=2)
    # signature
    sSig  = _s('dSig',  size=7.5,              color=C_MUTED,      align=1)

    # ── 1. HEADER BAR ─────────────────────────────────────────
    # [110, 72] = 182mm ✓
    hdr_tbl = Table([[
        [
            Paragraph("Znacka servis s. r. o.", sHCo),
            Spacer(1, 1.5*mm),
            Paragraph("Velka Okruzna 17, 01001 Zilina  ·  ICO: 57359202", sHTg),
            Paragraph("DIC: 2122685136  ·  IC DPH: SK2122685136", sHTg),
        ],
        [
            Paragraph("DODACI LIST", sHLb),
            Spacer(1, 1*mm),
            Paragraph(f"c. {dn.delivery_note_number}", sHNm),
        ],
    ]], colWidths=[110*mm, 72*mm])
    hdr_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), C_NAVY),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0), (-1, -1), 5*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5*mm),
        ('LEFTPADDING',   (0, 0), (-1, -1), 5*mm),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 5*mm),
    ]))
    elements.append(hdr_tbl)
    elements.append(HRFlowable(width="100%", thickness=3, color=C_AMBER, spaceAfter=5*mm))

    # ── 2. ADDRESS CARDS ──────────────────────────────────────
    # [91, 91] = 182mm ✓
    sup_cell = [
        Paragraph("DODAVATEL", sALb),
        Spacer(1, 1.5*mm),
        Paragraph("Znacka servis s. r. o.", sAFm),
        Paragraph("Velka Okruzna 17, 01001 Zilina", sALn),
        Paragraph("Slovensko", sALn),
        Spacer(1, 2*mm),
        Paragraph("ICO: 57359202  ·  DIC: 2122685136", sALn),
        Paragraph("IC DPH: SK2122685136", sALn),
        Paragraph("OR OS Zilina, Sro, vl. c. 89577/L", sAReg),
    ]
    cust_cell = [
        Paragraph("ODBERATEL", sALb),
        Spacer(1, 1.5*mm),
        Paragraph(pn, sAFm),
        Paragraph(padr, sALn),
        Spacer(1, 2*mm),
    ]
    if pi: cust_cell.append(Paragraph(f"ICO: {pi}", sALn))
    if pd: cust_cell.append(Paragraph(f"DIC: {pd}", sALn))

    addr_tbl = Table([[sup_cell, cust_cell]], colWidths=[91*mm, 91*mm])
    addr_tbl.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND',    (0, 0), (0, 0),   C_LIGHT),
        ('BACKGROUND',    (1, 0), (1, 0),   C_BLUE_LT),
        ('BOX',           (0, 0), (0, 0),   0.5, C_BORDER),
        ('BOX',           (1, 0), (1, 0),   0.5, C_BORDER),
        ('TOPPADDING',    (0, 0), (-1, -1), 4*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4*mm),
        ('LEFTPADDING',   (0, 0), (-1, -1), 4*mm),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 4*mm),
        ('LINEAFTER',     (0, 0), (0, -1),  3, C_AMBER),
    ]))
    elements.append(addr_tbl)
    elements.append(Spacer(1, 5*mm))

    # ── 3. META INFO STRIP ─────────────────────────────────────
    # [45.5 * 4] = 182mm ✓
    date_str = dn.date.strftime('%d.%m.%Y') if dn.date else dn.created_at.strftime('%d.%m.%Y')

    def mc(label, val):
        return [Paragraph(label, sMlb), Paragraph(str(val), sMvl)]

    meta_cols = [
        mc("Datum vystavenia", date_str),
        mc("Cislo dokladu",    dn.delivery_note_number),
        mc("Faktura c.",       dn.invoice.invoice_number if dn.invoice else '—'),
        mc("Miesto dodania",   getattr(dn, 'place_of_delivery', None) or '—'),
    ]
    meta_tbl = Table([meta_cols], colWidths=[45.5*mm] * 4)
    meta_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), C_LIGHT),
        ('BOX',           (0, 0), (-1, -1), 0.5, C_BORDER),
        ('LINEAFTER',     (0, 0), (-2, -1), 0.5, C_BORDER),
        ('TOPPADDING',    (0, 0), (-1, -1), 3*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3*mm),
        ('LEFTPADDING',   (0, 0), (-1, -1), 3*mm),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 2*mm),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(meta_tbl)
    elements.append(Spacer(1, 6*mm))

    # ── 4. ITEMS TABLE ─────────────────────────────────────────
    # [10, 116, 32, 24] = 182mm ✓
    items_list = list(dn.items.order_by('pos'))
    rows = [[
        Paragraph("C.",           sTH),
        Paragraph("Nazov polozky", sTH),
        Paragraph("Mnozstvo",      sTHR),
        Paragraph("MJ",            sTH),
    ]]
    for idx, di in enumerate(items_list, 1):
        name = di.item_name or (di.item.name if di.item else '—')
        qty  = str(di.quantity).rstrip('0').rstrip('.')
        rows.append([
            Paragraph(str(idx), sN),
            Paragraph(name,     sN),
            Paragraph(qty,      sTDR),
            Paragraph(di.mj,    sN),
        ])

    tbl_items = Table(rows, colWidths=[10*mm, 116*mm, 32*mm, 24*mm], repeatRows=1)
    item_st = [
        ('BACKGROUND',    (0, 0),  (-1, 0),  C_NAVY),
        ('LINEBELOW',     (0, 0),  (-1, 0),  2, C_AMBER),
        ('GRID',          (0, 1),  (-1, -1), 0.5, C_BORDER),
        ('LINEBELOW',     (0, -1), (-1, -1), 0.5, C_BORDER),
        ('VALIGN',        (0, 0),  (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0),  (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0),  (-1, -1), 4),
        ('LEFTPADDING',   (0, 0),  (-1, -1), 3*mm),
        ('RIGHTPADDING',  (0, 0),  (-1, -1), 3*mm),
    ]
    for i in range(len(items_list)):
        if i % 2 == 1:
            item_st.append(('BACKGROUND', (0, i + 1), (-1, i + 1), C_LIGHT))
    tbl_items.setStyle(TableStyle(item_st))
    elements.append(tbl_items)
    elements.append(Spacer(1, 6*mm))

    if dn.notes:
        elements.append(Paragraph(f"Poznamka: {dn.notes}", sMut))
        elements.append(Spacer(1, 6*mm))

    # ── 5. PODPISOVÁ SEKCIA ────────────────────────────────────
    # [85, 12, 85] = 182mm ✓
    def sig_cell(label):
        return [
            Spacer(1, 14*mm),
            Paragraph("_" * 38, sSig),
            Spacer(1, 1*mm),
            Paragraph(label, sSig),
        ]

    sig_tbl = Table(
        [[sig_cell("Odovzdal (peciatka, podpis)"), "", sig_cell("Prevzal (peciatka, podpis)")]],
        colWidths=[85*mm, 12*mm, 85*mm]
    )
    sig_tbl.setStyle(TableStyle([
        ('VALIGN',       (0, 0), (-1, -1), 'BOTTOM'),
        ('LEFTPADDING',  (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING',   (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 0),
    ]))
    elements.append(sig_tbl)

    doc.build(elements)
    return response
