import os
import tempfile
import qrcode
from django.http import HttpResponse

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_PATH_REGULAR = os.path.join(BASE_DIR, 'Roboto-Regular.ttf')
FONT_PATH_BOLD = os.path.join(BASE_DIR, 'Roboto-Bold.ttf')

try:
    pdfmetrics.registerFont(TTFont('Roboto', FONT_PATH_REGULAR))
    pdfmetrics.registerFont(TTFont('Roboto-Bold', FONT_PATH_BOLD))
    FONT_NAME = 'Roboto'
    FONT_BOLD = 'Roboto-Bold'
except Exception as e:
    print(f"Nepodarilo sa načítať Roboto fonty ({e}), prepínam na zálohu.")
    FONT_NAME = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'

IBAN = "SK36 1100 0000 0029 4229 0477"
SWIFT = "TATRSKBX"


def generate_invoice_pdf(invoice):
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="faktura_{invoice.invoice_number}.pdf"'

    doc = SimpleDocTemplate(response, pagesize=A4,
                            topMargin=12*mm, bottomMargin=12*mm,
                            leftMargin=12*mm, rightMargin=12*mm)

    styles = getSampleStyleSheet()
    style_normal = ParagraphStyle('InvNormal', parent=styles['Normal'], fontName=FONT_NAME, fontSize=8.5, leading=11)
    style_bold   = ParagraphStyle('InvBold',   parent=styles['Normal'], fontName=FONT_BOLD,  fontSize=8.5, leading=11)
    style_title  = ParagraphStyle('InvTitle',  parent=styles['Title'],  fontName=FONT_BOLD,  fontSize=15, leading=18, alignment=0)

    elements = []
    partner = invoice.partner

    # --- HLAVIČKA: DODÁVATEĽ / ODBERATEĽ ---
    partner_name    = partner.name    if partner else ''
    partner_street  = partner.street  if partner else ''
    partner_zip     = partner.zip_code if partner else ''
    partner_city    = partner.city    if partner else ''
    partner_ico     = partner.ico     if partner else ''
    partner_dic     = partner.dic     if partner else ''
    partner_ic_dph  = partner.ic_dph  if partner else ''

    partner_address = f"{partner_street}, {partner_zip} {partner_city}".strip(', ')

    supplier_info = [
        [Paragraph("<b>DODÁVATEĽ</b>", style_bold),          Paragraph("<b>ODBERATEĽ</b>", style_bold)],
        [Paragraph("Značka servis s. r. o.", style_normal),  Paragraph(partner_name, style_normal)],
        [Paragraph("Veľká Okružná 17, 01001 Žilina", style_normal), Paragraph(partner_address, style_normal)],
        [Paragraph("Slovensko", style_normal),               Paragraph("", style_normal)],
        [Paragraph("IČO: 57359202",   style_normal),         Paragraph(f"IČO: {partner_ico}", style_normal)],
        [Paragraph("DIČ: 2122685136", style_normal),         Paragraph(f"DIČ: {partner_dic}", style_normal)],
        [Paragraph("IČ DPH: SK2122685136", style_normal),    Paragraph(f"IČ DPH: {partner_ic_dph}", style_normal)],
        [Paragraph("Zapísaná v OR OS Žilina, oddiel: Sro,<br/>vložka č.: 89577/L", style_normal), Paragraph("", style_normal)],
    ]
    # Kontaktné údaje partnera (len ak sú vyplnené)
    if invoice.contact_person:
        supplier_info.append([Paragraph("", style_normal), Paragraph(f"Kontakt: {invoice.contact_person}", style_normal)])
    if invoice.contact_email:
        supplier_info.append([Paragraph("", style_normal), Paragraph(f"E-mail: {invoice.contact_email}", style_normal)])
    if invoice.contact_phone:
        supplier_info.append([Paragraph("", style_normal), Paragraph(f"Tel.: {invoice.contact_phone}", style_normal)])

    table_header = Table(supplier_info, colWidths=[93*mm, 93*mm])
    table_header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#F5F5F7')),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#F5F5F7')),
        ('TOPPADDING',    (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(table_header)
    elements.append(Spacer(1, 5*mm))

    # --- NÁZOV DOKUMENTU ---
    elements.append(Paragraph(f"FAKTÚRA č. {invoice.invoice_number}", style_title))
    elements.append(Spacer(1, 4*mm))

    # --- INFORMÁCIE O FAKTÚRE ---
    date_of_supply_str = invoice.date_of_supply.strftime('%d.%m.%Y') if invoice.date_of_supply else '—'

    info_data = [
        [Paragraph("Dátum vystavenia:", style_bold),
         Paragraph(invoice.created_at.strftime('%d.%m.%Y'), style_normal),
         Paragraph("Variabilný symbol:", style_bold),
         Paragraph(invoice.invoice_number, style_normal)],
        [Paragraph("Dátum splatnosti:", style_bold),
         Paragraph(invoice.due_date.strftime('%d.%m.%Y'), style_normal),
         Paragraph("Číslo objednávky:", style_bold),
         Paragraph(invoice.customer_order_number or '—', style_normal)],
        [Paragraph("Dátum dodania:", style_bold),
         Paragraph(date_of_supply_str, style_normal),
         Paragraph("Zákazka:", style_bold),
         Paragraph(invoice.job_number or '—', style_normal)],
        [Paragraph("Miesto dodania:", style_bold),
         Paragraph(invoice.place_of_supply or '—', style_normal),
         Paragraph("Dodací list:", style_bold),
         Paragraph(invoice.delivery_note or '—', style_normal)],
    ]
    table_info = Table(info_data, colWidths=[33*mm, 60*mm, 33*mm, 60*mm])
    table_info.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING',    (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(table_info)
    elements.append(Spacer(1, 5*mm))

    elements.append(Paragraph("Faktúrujeme Vám za:", style_normal))
    elements.append(Spacer(1, 3*mm))

    # --- TABUĽKA POLOŽIEK ---
    vat_rate = invoice.vat_rate
    table_data = [[
        Paragraph("<b>Č.</b>",                            style_bold),
        Paragraph("<b>NÁZOV (popis tovaru/služby)</b>",   style_bold),
        Paragraph("<b>MNOŽSTVO</b>",                      style_bold),
        Paragraph("<b>JEDN. CENA</b>",                    style_bold),
        Paragraph(f"<b>DPH %</b>",                        style_bold),
        Paragraph("<b>CELKOM</b>",                        style_bold),
    ]]

    for idx, inv_item in enumerate(invoice.items.all(), 1):
        item_name = inv_item.item.name if inv_item.item else getattr(inv_item, 'description', '—')
        table_data.append([
            Paragraph(str(idx),                          style_normal),
            Paragraph(item_name,                         style_normal),
            Paragraph(f"{inv_item.quantity} ks",         style_normal),
            Paragraph(f"{inv_item.unit_price:.2f} €",    style_normal),
            Paragraph(f"{vat_rate}",                     style_normal),
            Paragraph(f"{inv_item.total_price:.2f} €",   style_normal),
        ])

    col_widths = [10*mm, 76*mm, 25*mm, 30*mm, 15*mm, 30*mm]
    table_items = Table(table_data, colWidths=col_widths, repeatRows=1)
    table_items.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F5F5F7')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DCDCE0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(table_items)
    elements.append(Spacer(1, 5*mm))

    # Poznámka pre zákazníka (ak je vyplnená)
    if invoice.customer_note:
        elements.append(Paragraph(f"<i>Poznámka: {invoice.customer_note}</i>", style_normal))
        elements.append(Spacer(1, 4*mm))

    # --- QR KÓD + PLATOBNÉ ÚDAJE ---
    vs   = invoice.invoice_number
    total_amount = float(invoice.total)
    qr_text = (
        f"SPD*1.0*IBAN:{IBAN.replace(' ', '')}*AMT:{total_amount:.2f}"
        f"*CC:EUR*X-VS:{vs}*X-SS:0*X-RS:0*MSG:Platba za faktúru {vs}"
    )
    qr = qrcode.QRCode(box_size=3, border=1)
    qr.add_data(qr_text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    img.save(temp_file.name)
    temp_file.close()
    qr_element = Image(temp_file.name, width=28*mm, height=28*mm)

    # --- SÚČTY (ľavá strana) ---
    subtotal_val = float(invoice.subtotal)
    vat_val      = float(invoice.vat_amount)
    total_val    = float(invoice.total)

    if invoice.is_vat_payer and vat_rate > 0:
        total_rows = [
            [Paragraph(f"Základ DPH ({vat_rate} %)", style_normal), Paragraph(f"{subtotal_val:.2f} €", style_normal)],
            [Paragraph(f"Výška DPH ({vat_rate} %)", style_normal), Paragraph(f"{vat_val:.2f} €", style_normal)],
            [Paragraph("<b>Celková suma</b>", style_bold), Paragraph(f"<b>{total_val:.2f} €</b>", style_bold)],
        ]
    else:
        total_rows = [
            [Paragraph("Základ (bez DPH)", style_normal), Paragraph(f"{subtotal_val:.2f} €", style_normal)],
            [Paragraph("<b>Celková suma</b>", style_bold), Paragraph(f"<b>{total_val:.2f} €</b>", style_bold)],
        ]

    table_total = Table(total_rows, colWidths=[50*mm, 35*mm])
    table_total.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -2), 0.5, colors.HexColor('#EBEBEF')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F5F5F7')),
        ('TOPPADDING',    (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))

    style_center_line = ParagraphStyle('CenterLine', parent=style_normal, alignment=1, textColor=colors.gray)
    style_center_text = ParagraphStyle('CenterText', parent=style_bold,   alignment=1, fontSize=8)
    left_elements = [
        table_total,
        Spacer(1, 12*mm),
        Paragraph("___________________________________", style_center_line),
        Spacer(1, 1*mm),
        Paragraph("Pečiatka a podpis", style_center_text),
    ]

    # --- PLATOBNÝ BOX (pravá strana) ---
    payment_method = invoice.payment_method or 'Bankový prevod'
    payment_html = (
        f"<b>Spôsob úhrady:</b> {payment_method}<br/>"
        f"<font size='10'><b>Suma na úhradu: {total_val:.2f} EUR</b></font><br/><br/>"
        f"<b>Variabilný symbol:</b> {vs}<br/>"
        f"<b>IBAN:</b> {IBAN}<br/>"
        f"<b>SWIFT / BIC:</b> {SWIFT}"
    )
    table_payment_box = Table(
        [[Paragraph(payment_html, style_normal), qr_element]],
        colWidths=[62*mm, 28*mm]
    )
    table_payment_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F5F5F7')),
        ('BOX',        (0, 0), (-1, -1), 0.5, colors.HexColor('#DCDCE0')),
        ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN',      (1, 0), (1, 0),   'RIGHT'),
        ('TOPPADDING',    (0, 0), (-1, -1), 4*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4*mm),
        ('LEFTPADDING',   (0, 0), (-1, -1), 4*mm),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 2*mm),
    ]))

    # --- SPODNÁ ČASŤ (súčty + platba vedľa seba) ---
    table_bottom = Table(
        [[left_elements, "", table_payment_box]],
        colWidths=[85*mm, 11*mm, 90*mm]
    )
    table_bottom.setStyle(TableStyle([
        ('VALIGN',       (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',  (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(table_bottom)

    doc.build(elements)

    try:
        os.unlink(temp_file.name)
    except Exception:
        pass

    return response
