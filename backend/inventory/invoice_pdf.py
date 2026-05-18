import os
import tempfile
import qrcode
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
try:
    pdfmetrics.registerFont(TTFont('Roboto',      os.path.join(BASE_DIR, 'Roboto-Regular.ttf')))
    pdfmetrics.registerFont(TTFont('Roboto-Bold', os.path.join(BASE_DIR, 'Roboto-Bold.ttf')))
    FONT_NAME = 'Roboto'
    FONT_BOLD = 'Roboto-Bold'
except Exception as e:
    print(f"Roboto font chyba ({e}), záloha na Helvetica.")
    FONT_NAME = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'

IBAN  = "SK36 1100 0000 0029 4229 0477"
SWIFT = "TATRSKBX"

# ── Brand farby ────────────────────────────────────────────────
C_NAVY    = colors.HexColor('#1B3A6B')
C_AMBER   = colors.HexColor('#F59E0B')
C_LIGHT   = colors.HexColor('#F8FAFC')
C_BLUE_LT = colors.HexColor('#EFF6FF')
C_BORDER  = colors.HexColor('#CBD5E1')
C_TEXT    = colors.HexColor('#1E293B')
C_MUTED   = colors.HexColor('#64748B')
C_HDR_SUB = colors.HexColor('#93C5FD')   # svetlomodrý subtext v headeri


def _s(name, bold=False, size=8.5, leading=None, color=None, align=0):
    return ParagraphStyle(
        name,
        fontName=FONT_BOLD if bold else FONT_NAME,
        fontSize=size,
        leading=leading or round(size * 1.4, 1),
        alignment=align,
        textColor=color if color is not None else C_TEXT,
    )


def generate_invoice_pdf(invoice):
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="faktura_{invoice.invoice_number}.pdf"'

    doc = SimpleDocTemplate(response, pagesize=A4,
                            topMargin=14*mm, bottomMargin=14*mm,
                            leftMargin=14*mm, rightMargin=14*mm)
    elements = []
    partner = invoice.partner

    pn   = (partner.name      if partner else '') or ''
    pst  = (partner.street    if partner else '') or ''
    pz   = (partner.zip_code  if partner else '') or ''
    pc   = (partner.city      if partner else '') or ''
    pi   = (partner.ico       if partner else '') or ''
    pd   = (partner.dic       if partner else '') or ''
    pid  = (partner.ic_dph    if partner else '') or ''
    padr = f"{pst}, {pz} {pc}".strip(', ')

    # ── Štýly ──────────────────────────────────────────────────
    sN    = _s('iN')
    sMut  = _s('iMut',  color=C_MUTED, size=7.5)
    # header bar
    sHCo  = _s('iHCo',  bold=True,  size=13,   color=colors.white)
    sHTg  = _s('iHTg',  size=7.5,              color=C_HDR_SUB)
    sHLb  = _s('iHLb',  size=8,                color=C_HDR_SUB,    align=2)
    sHNm  = _s('iHNm',  bold=True,  size=16,   color=C_AMBER,      align=2)
    # address cards
    sALb  = _s('iALb',  bold=True,  size=7,    color=C_MUTED)
    sAFm  = _s('iAFm',  bold=True,  size=10,   color=C_TEXT)
    sALn  = _s('iALn',  size=8,                color=C_TEXT)
    sAReg = _s('iAReg', size=7,                color=C_MUTED)
    # meta strip
    sMlb  = _s('iMlb',  size=7,                color=C_MUTED)
    sMvl  = _s('iMvl',  bold=True,  size=8.5,  color=C_TEXT)
    # items table header
    sTH   = _s('iTH',   bold=True,  size=8,    color=colors.white)
    sTHR  = _s('iTHR',  bold=True,  size=8,    color=colors.white, align=2)
    sTDR  = _s('iTDR',  size=8.5,              align=2)
    # totals
    sTlb  = _s('iTlb',  size=8.5,              color=C_TEXT)
    sTvl  = _s('iTvl',  size=8.5,              color=C_TEXT,       align=2)
    sTLB  = _s('iTLB',  bold=True,  size=9,    color=colors.white)
    sTVB  = _s('iTVB',  bold=True,  size=11,   color=C_AMBER,      align=2)
    # payment
    sPLb  = _s('iPLb',  size=7,                color=C_MUTED)
    sPVl  = _s('iPVl',  bold=True,  size=8.5,  color=C_TEXT)
    # signature
    sSig  = _s('iSig',  size=7.5,              color=C_MUTED,      align=1)

    # ── 1. HEADER BAR ─────────────────────────────────────────
    # PAGE_W = 210 - 14 - 14 = 182mm  →  [110, 72] = 182 ✓
    hdr_tbl = Table([[
        [
            Paragraph("Znacka servis s. r. o.", sHCo),
            Spacer(1, 1.5*mm),
            Paragraph("Velka Okruzna 17, 01001 Zilina  ·  ICO: 57359202", sHTg),
            Paragraph("DIC: 2122685136  ·  IC DPH: SK2122685136", sHTg),
        ],
        [
            Paragraph("FAKTURA", sHLb),
            Spacer(1, 1*mm),
            Paragraph(f"c. {invoice.invoice_number}", sHNm),
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
    # [91, 91] = 182 ✓
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
    if pi:  cust_cell.append(Paragraph(f"ICO: {pi}", sALn))
    if pd:  cust_cell.append(Paragraph(f"DIC: {pd}", sALn))
    if pid: cust_cell.append(Paragraph(f"IC DPH: {pid}", sALn))
    for lbl, val in [("Kontakt", invoice.contact_person),
                     ("E-mail",  invoice.contact_email),
                     ("Tel.",    invoice.contact_phone)]:
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

    # ── 3. META INFO STRIP ─────────────────────────────────────
    # [36.4 * 5] ≈ 182 ✓
    ds = invoice.date_of_supply.strftime('%d.%m.%Y') if invoice.date_of_supply else '—'

    def mc(label, val):
        return [Paragraph(label, sMlb), Paragraph(str(val), sMvl)]

    meta_tbl = Table([[
        mc("Datum vystavenia",   invoice.created_at.strftime('%d.%m.%Y')),
        mc("Datum splatnosti",   invoice.due_date.strftime('%d.%m.%Y')),
        mc("Datum dodania",      ds),
        mc("Variabilny symbol",  invoice.invoice_number),
        mc("Cislo obj. / zakazky",
           f"{invoice.customer_order_number or '—'} / {invoice.job_number or '—'}"),
    ]], colWidths=[36.4*mm] * 5)
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
    # [10, 74, 26, 30, 16, 26] = 182 ✓
    vat_rate   = invoice.vat_rate
    items_list = list(invoice.items.all())

    rows = [[
        Paragraph("C.",       sTH),
        Paragraph("Nazov / popis tovaru alebo sluzby", sTH),
        Paragraph("Mn.",      sTHR),
        Paragraph("J. cena",  sTHR),
        Paragraph("DPH",      sTHR),
        Paragraph("Celkom",   sTHR),
    ]]
    for idx, it in enumerate(items_list, 1):
        nm = it.item.name if it.item else getattr(it, 'description', '—')
        rows.append([
            Paragraph(str(idx),                    sN),
            Paragraph(nm,                          sN),
            Paragraph(f"{it.quantity} ks",         sTDR),
            Paragraph(f"{it.unit_price:.2f} €", sTDR),
            Paragraph(f"{vat_rate} %",             sTDR),
            Paragraph(f"{it.total_price:.2f} €", sTDR),
        ])

    tbl_items = Table(rows, colWidths=[10*mm, 74*mm, 26*mm, 30*mm, 16*mm, 26*mm], repeatRows=1)
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
    elements.append(Spacer(1, 5*mm))

    if invoice.customer_note:
        elements.append(Paragraph(f"Poznamka: {invoice.customer_note}", sMut))
        elements.append(Spacer(1, 4*mm))

    # ── 5. BOTTOM: PAYMENT BOX (ľavá) + SÚČTY (pravá) ─────────
    # [100, 8, 74] = 182 ✓
    vs  = invoice.invoice_number
    tot = float(invoice.total)
    sub = float(invoice.subtotal)
    vat = float(invoice.vat_amount)

    # QR kód
    qr_text = (f"SPD*1.0*IBAN:{IBAN.replace(' ', '')}*AMT:{tot:.2f}"
               f"*CC:EUR*X-VS:{vs}*X-SS:0*X-RS:0*MSG:Platba za fakturu {vs}")
    qr = qrcode.QRCode(box_size=3, border=1)
    qr.add_data(qr_text)
    qr.make(fit=True)
    qi = qr.make_image(fill_color="black", back_color="white")
    tf = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    qi.save(tf.name)
    tf.close()
    qr_img = Image(tf.name, width=26*mm, height=26*mm)

    # Platobné info — ako zoznam paragrafov v bunke (70mm)
    pay_cell = [
        Paragraph("Sposob ukrady", sPLb),
        Paragraph(invoice.payment_method or 'Bankovy prevod', sPVl),
        Spacer(1, 2*mm),
        Paragraph("Variabilny symbol", sPLb),
        Paragraph(vs, sPVl),
        Spacer(1, 2*mm),
        Paragraph("IBAN", sPLb),
        Paragraph(IBAN, sPVl),
        Spacer(1, 2*mm),
        Paragraph("SWIFT / BIC", sPLb),
        Paragraph(SWIFT, sPVl),
    ]
    # pay_box: [70, 30] = 100mm ✓
    pay_box = Table([[pay_cell, qr_img]], colWidths=[70*mm, 30*mm])
    pay_box.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), C_LIGHT),
        ('BOX',           (0, 0), (-1, -1), 0.5, C_BORDER),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN',         (1, 0), (1, 0),   'CENTER'),
        ('TOPPADDING',    (0, 0), (-1, -1), 4*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4*mm),
        ('LEFTPADDING',   (0, 0), (0, 0),   4*mm),
        ('RIGHTPADDING',  (0, 0), (0, 0),   2*mm),
        ('LEFTPADDING',   (1, 0), (1, 0),   2*mm),
        ('RIGHTPADDING',  (1, 0), (1, 0),   2*mm),
    ]))

    # Tabuľka súčtov: [44, 30] = 74mm ✓
    if invoice.is_vat_payer and vat_rate > 0:
        tot_rows = [
            [Paragraph(f"Zaklad DPH ({vat_rate} %)", sTlb), Paragraph(f"{sub:.2f} €", sTvl)],
            [Paragraph(f"DPH ({vat_rate} %)",         sTlb), Paragraph(f"{vat:.2f} €", sTvl)],
            [Paragraph("SUMA NA UHRADU",               sTLB), Paragraph(f"{tot:.2f} €", sTVB)],
        ]
    else:
        tot_rows = [
            [Paragraph("Bez DPH (§ 4 ZDPH)", sTlb), Paragraph(f"{sub:.2f} €", sTvl)],
            [Paragraph("SUMA NA UHRADU",      sTLB), Paragraph(f"{tot:.2f} €", sTVB)],
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

    # Bottom row [100, 8, 74] = 182mm ✓
    bottom = Table([[pay_box, "", tbl_tot]], colWidths=[100*mm, 8*mm, 74*mm])
    bottom.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'BOTTOM'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(bottom)
    elements.append(Spacer(1, 10*mm))

    # Podpis
    sig_tbl = Table(
        [[Paragraph("_" * 38, sSig), "", ""]],
        colWidths=[100*mm, 8*mm, 74*mm]
    )
    sig_tbl.setStyle(TableStyle([
        ('LEFTPADDING',  (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING',   (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 0),
    ]))
    elements.append(sig_tbl)
    elements.append(Paragraph("Peciatka a podpis", sSig))

    doc.build(elements)

    try:
        os.unlink(tf.name)
    except Exception:
        pass

    return response
