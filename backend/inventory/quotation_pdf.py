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


def generate_quotation_pdf(quotation):
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="ponuka_{quotation.quotation_number}.pdf"'

    doc = SimpleDocTemplate(response, pagesize=A4,
                            topMargin=14*mm, bottomMargin=14*mm,
                            leftMargin=14*mm, rightMargin=14*mm)
    elements = []
    partner = quotation.partner

    pn  = (partner.name     if partner else '') or ''
    pst = (partner.street   if partner else '') or ''
    pz  = (partner.zip_code if partner else '') or ''
    pc  = (partner.city     if partner else '') or ''
    pi  = (partner.ico      if partner else '') or ''
    pd  = (partner.dic      if partner else '') or ''
    pid = (partner.ic_dph   if partner else '') or ''
    padr = f"{pst}, {pz} {pc}".strip(', ')

    sN    = _s('qN')
    sMut  = _s('qMut',  color=C_MUTED, size=7.5)
    sHCo  = _s('qHCo',  bold=True,  size=13,   color=colors.white)
    sHTg  = _s('qHTg',  size=7.5,              color=C_HDR_SUB)
    sHLb  = _s('qHLb',  size=8,                color=C_HDR_SUB,  align=2)
    sHNm  = _s('qHNm',  bold=True,  size=14,   color=C_AMBER,    align=2)
    sALb  = _s('qALb',  bold=True,  size=7,    color=C_MUTED)
    sAFm  = _s('qAFm',  bold=True,  size=10,   color=C_TEXT)
    sALn  = _s('qALn',  size=8,                color=C_TEXT)
    sAReg = _s('qAReg', size=7,                color=C_MUTED)
    sMlb  = _s('qMlb',  size=7,                color=C_MUTED)
    sMvl  = _s('qMvl',  bold=True,  size=8.5,  color=C_TEXT)
    sTH   = _s('qTH',   bold=True,  size=8,    color=colors.white)
    sTHR  = _s('qTHR',  bold=True,  size=8,    color=colors.white, align=2)
    sTDR  = _s('qTDR',  size=8.5,              align=2)
    sTlb  = _s('qTlb',  size=8.5,              color=C_TEXT)
    sTvl  = _s('qTvl',  size=8.5,              color=C_TEXT,       align=2)
    sTLB  = _s('qTLB',  bold=True,  size=9,    color=colors.white)
    sTVB  = _s('qTVB',  bold=True,  size=11,   color=C_AMBER,      align=2)
    sSig  = _s('qSig',  size=7.5,              color=C_MUTED,      align=1)

    # ── 1. HEADER ──────────────────────────────────────────────
    hdr_tbl = Table([[
        [
            Paragraph("Značka servis s. r. o.", sHCo),
            Spacer(1, 1.5*mm),
            Paragraph("Veľká Okružná 17, 01001 Žilina  ·  IČO: 57359202", sHTg),
            Paragraph("DIČ: 2122685136  ·  IČ DPH: SK2122685136", sHTg),
        ],
        [
            Paragraph("CENOVÁ PONUKA", sHLb),
            Spacer(1, 1*mm),
            Paragraph(f"č. {quotation.quotation_number}", sHNm),
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

    # ── 2. ADRESY ──────────────────────────────────────────────
    sup_cell = [
        Paragraph("DODÁVATEĽ", sALb),
        Spacer(1, 1.5*mm),
        Paragraph("Značka servis s. r. o.", sAFm),
        Paragraph("Veľká Okružná 17, 01001 Žilina", sALn),
        Paragraph("Slovensko", sALn),
        Spacer(1, 2*mm),
        Paragraph("IČO: 57359202  ·  DIČ: 2122685136", sALn),
        Paragraph("IČ DPH: SK2122685136", sALn),
        Paragraph("OR OS Žilina, s.r.o., vl.č. 89577/L", sAReg),
    ]
    cust_cell = [
        Paragraph("ODBERATEĽ", sALb),
        Spacer(1, 1.5*mm),
        Paragraph(pn or '—', sAFm),
        Paragraph(padr, sALn),
        Spacer(1, 2*mm),
    ]
    if pi:  cust_cell.append(Paragraph(f"IČO: {pi}", sALn))
    if pd:  cust_cell.append(Paragraph(f"DIČ: {pd}", sALn))
    if pid: cust_cell.append(Paragraph(f"IČ DPH: {pid}", sALn))
    for lbl, val in [("Kontakt", quotation.contact_person),
                     ("E-mail",  quotation.contact_email),
                     ("Tel.",    quotation.contact_phone)]:
        if val:
            cust_cell.append(Paragraph(f"{lbl}: {val}", sALn))

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

    # ── 3. META ────────────────────────────────────────────────
    def mc(label, val):
        return [Paragraph(label, sMlb), Paragraph(str(val), sMvl)]

    meta_cols = [
        mc("Dátum vystavenia", quotation.created_at.strftime('%d.%m.%Y')),
        mc("Platnosť do",      quotation.valid_until.strftime('%d.%m.%Y')),
        mc("Číslo ponuky",     quotation.quotation_number),
    ]
    if quotation.customer_order_number:
        meta_cols.append(mc("Č. objednávky", quotation.customer_order_number))
    if quotation.job_number:
        meta_cols.append(mc("Zákazka", quotation.job_number))

    n_cols = len(meta_cols)
    col_w  = 182 / n_cols
    meta_tbl = Table([meta_cols], colWidths=[col_w*mm] * n_cols)
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

    # ── 4. POLOŽKY ─────────────────────────────────────────────
    vat_rate   = quotation.vat_rate
    items_list = list(quotation.items.all())

    rows = [[
        Paragraph("Č.",     sTH),
        Paragraph("Názov / popis tovaru alebo služby", sTH),
        Paragraph("Mn.",    sTHR),
        Paragraph("MJ",     sTHR),
        Paragraph("J. cena", sTHR),
        Paragraph("DPH",    sTHR),
        Paragraph("Celkom", sTHR),
    ]]
    for idx, it in enumerate(items_list, 1):
        nm = it.item.name if it.item else getattr(it, 'description', '—')
        rows.append([
            Paragraph(str(idx),                        sN),
            Paragraph(nm,                              sN),
            Paragraph(f"{it.quantity}",                sTDR),
            Paragraph(f"{it.mj or 'ks'}",             sTDR),
            Paragraph(f"{it.unit_price:.2f} €",        sTDR),
            Paragraph(f"{vat_rate} %",                 sTDR),
            Paragraph(f"{it.total_price:.2f} €",       sTDR),
        ])

    tbl_items = Table(rows, colWidths=[10*mm, 68*mm, 18*mm, 14*mm, 28*mm, 16*mm, 28*mm], repeatRows=1)
    item_st = [
        ('BACKGROUND',    (0, 0),  (-1, 0),  C_NAVY),
        ('LINEBELOW',     (0, 0),  (-1, 0),  2, C_AMBER),
        ('GRID',          (0, 1),  (-1, -1), 0.5, C_BORDER),
        ('VALIGN',        (0, 0),  (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0),  (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0),  (-1, -1), 4),
        ('LEFTPADDING',   (0, 0),  (-1, -1), 3*mm),
        ('RIGHTPADDING',  (0, 0),  (-1, -1), 3*mm),
    ]
    for i in range(len(items_list)):
        if i % 2 == 1:
            item_st.append(('BACKGROUND', (0, i+1), (-1, i+1), C_LIGHT))
    tbl_items.setStyle(TableStyle(item_st))
    elements.append(tbl_items)
    elements.append(Spacer(1, 5*mm))

    if quotation.customer_note:
        elements.append(Paragraph(f"Poznámka: {quotation.customer_note}", sMut))
        elements.append(Spacer(1, 4*mm))

    # ── 5. SÚČTY + PODMIENKY ───────────────────────────────────
    tot  = float(quotation.total)
    sub  = float(quotation.subtotal)
    vat  = float(quotation.vat_amount)

    cond_cell = [
        Paragraph("Podmienky ponuky", _s('qCH', bold=True, size=8, color=C_MUTED)),
        Spacer(1, 2*mm),
        Paragraph(f"Platnosť ponuky do: {quotation.valid_until.strftime('%d.%m.%Y')}", _s('qCL', size=8)),
        Paragraph(f"Spôsob úhrady: {quotation.payment_method or 'Bankový prevod'}", _s('qCL2', size=8)),
        Spacer(1, 2*mm),
        Paragraph("Táto ponuka je nezáväzná.", _s('qCM', size=7.5, color=C_MUTED)),
    ]
    cond_tbl = Table([[cond_cell]], colWidths=[100*mm])
    cond_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), C_LIGHT),
        ('BOX',           (0, 0), (-1, -1), 0.5, C_BORDER),
        ('TOPPADDING',    (0, 0), (-1, -1), 4*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4*mm),
        ('LEFTPADDING',   (0, 0), (-1, -1), 4*mm),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 4*mm),
    ]))

    if quotation.is_vat_payer and vat_rate > 0:
        tot_rows = [
            [Paragraph(f"Základ DPH ({vat_rate} %)", sTlb), Paragraph(f"{sub:.2f} €", sTvl)],
            [Paragraph(f"DPH ({vat_rate} %)",         sTlb), Paragraph(f"{vat:.2f} €", sTvl)],
            [Paragraph("CENA CELKOM",                  sTLB), Paragraph(f"{tot:.2f} €", sTVB)],
        ]
    else:
        tot_rows = [
            [Paragraph("Základ bez DPH", sTlb), Paragraph(f"{sub:.2f} €", sTvl)],
            [Paragraph("CENA CELKOM",          sTLB), Paragraph(f"{tot:.2f} €", sTVB)],
        ]

    tbl_tot = Table(tot_rows, colWidths=[44*mm, 30*mm])
    tot_st = [
        ('VALIGN',        (0, 0),  (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0),  (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0),  (-1, -1), 3),
        ('LEFTPADDING',   (0, 0),  (-1, -1), 3*mm),
        ('RIGHTPADDING',  (0, 0),  (-1, -1), 3*mm),
        ('BACKGROUND',    (0, -1), (-1, -1), C_NAVY),
        ('LINEABOVE',     (0, -1), (-1, -1), 2, C_AMBER),
        ('TOPPADDING',    (0, -1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 4),
        ('BOX',           (0, 0),  (-1, -1), 0.5, C_BORDER),
    ]
    if len(tot_rows) > 1:
        tot_st.append(('LINEBELOW', (0, 0), (-1, -2), 0.5, C_BORDER))
    tbl_tot.setStyle(TableStyle(tot_st))

    bottom = Table([[cond_tbl, "", tbl_tot]], colWidths=[100*mm, 8*mm, 74*mm])
    bottom.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(bottom)
    elements.append(Spacer(1, 20*mm))

    # ── 6. PODPIS (vpravo) ─────────────────────────────────────
    sig_tbl = Table(
        [["", "", [Paragraph("_" * 32, sSig), Spacer(1, 1.5*mm), Paragraph("Pečiatka a podpis", sSig)]]],
        colWidths=[100*mm, 8*mm, 74*mm]
    )
    sig_tbl.setStyle(TableStyle([
        ('LEFTPADDING',  (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING',   (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 0),
    ]))
    elements.append(sig_tbl)

    doc.build(elements)
    return response
