import os
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
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
except Exception:
    FONT_NAME = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'


def generate_delivery_note_pdf(dn):
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="dodaci_list_{dn.delivery_note_number.replace("/", "_")}.pdf"'

    doc = SimpleDocTemplate(response, pagesize=A4,
                            topMargin=12*mm, bottomMargin=12*mm,
                            leftMargin=12*mm, rightMargin=12*mm)

    styles = getSampleStyleSheet()
    style_normal = ParagraphStyle('DNNormal', parent=styles['Normal'], fontName=FONT_NAME, fontSize=8.5, leading=11)
    style_bold   = ParagraphStyle('DNBold',   parent=styles['Normal'], fontName=FONT_BOLD,  fontSize=8.5, leading=11)
    style_title  = ParagraphStyle('DNTitle',  parent=styles['Title'],  fontName=FONT_BOLD,  fontSize=18, leading=22, alignment=0)
    style_center = ParagraphStyle('DNCenter', parent=style_bold, alignment=1, fontSize=8)
    style_center_line = ParagraphStyle('DNLine', parent=style_normal, alignment=1, textColor=colors.gray)

    elements = []
    partner = dn.partner

    # Resolve partner info
    p_name    = (partner.name      if partner else None) or dn.partner_name or ''
    p_street  = (partner.street    if partner else None) or ''
    p_zip     = (partner.zip_code  if partner else None) or ''
    p_city    = (partner.city      if partner else None) or ''
    p_ico     = (partner.ico       if partner else None) or dn.partner_ico or ''
    p_dic     = (partner.dic       if partner else None) or dn.partner_dic or ''
    p_address = f"{p_street}, {p_zip} {p_city}".strip(', ')

    # Header: Dodávateľ / Odberateľ
    supplier_info = [
        [Paragraph("<b>DODÁVATEĽ</b>", style_bold),          Paragraph("<b>ODBERATEĽ</b>", style_bold)],
        [Paragraph("Značka servis s. r. o.", style_normal),  Paragraph(p_name, style_normal)],
        [Paragraph("Veľká Okružná 17, 01001 Žilina", style_normal), Paragraph(p_address, style_normal)],
        [Paragraph("Slovensko", style_normal),               Paragraph("", style_normal)],
        [Paragraph("IČO: 57359202",   style_normal),         Paragraph(f"IČO: {p_ico}", style_normal)],
        [Paragraph("DIČ: 2122685136", style_normal),         Paragraph(f"DIČ: {p_dic}", style_normal)],
        [Paragraph("IČ DPH: SK2122685136", style_normal),    Paragraph("", style_normal)],
    ]
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

    # Title + meta
    elements.append(Paragraph(f"DODACÍ LIST č. {dn.delivery_note_number}", style_title))
    elements.append(Spacer(1, 3*mm))

    date_str = dn.date.strftime('%d.%m.%Y') if dn.date else dn.created_at.strftime('%d.%m.%Y')
    info_data = [
        [Paragraph("Dátum vystavenia:", style_bold), Paragraph(date_str, style_normal),
         Paragraph("Číslo dokladu:", style_bold), Paragraph(dn.delivery_note_number, style_normal)],
    ]
    if dn.invoice:
        info_data.append([
            Paragraph("Faktúra č.:", style_bold), Paragraph(dn.invoice.invoice_number, style_normal),
            Paragraph("", style_normal), Paragraph("", style_normal),
        ])
    table_info = Table(info_data, colWidths=[33*mm, 60*mm, 33*mm, 60*mm])
    table_info.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING',    (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(table_info)
    elements.append(Spacer(1, 5*mm))

    # Items table — NO PRICES
    table_data = [[
        Paragraph("<b>Č.</b>",        style_bold),
        Paragraph("<b>NÁZOV POLOŽKY</b>", style_bold),
        Paragraph("<b>MNOŽSTVO</b>",  style_bold),
        Paragraph("<b>MJ</b>",        style_bold),
    ]]
    for idx, di in enumerate(dn.items.order_by('pos'), 1):
        name = di.item_name or (di.item.name if di.item else '—')
        table_data.append([
            Paragraph(str(idx), style_normal),
            Paragraph(name,     style_normal),
            Paragraph(str(di.quantity).rstrip('0').rstrip('.'), style_normal),
            Paragraph(di.mj,    style_normal),
        ])

    col_widths = [10*mm, 115*mm, 30*mm, 31*mm]
    table_items = Table(table_data, colWidths=col_widths, repeatRows=1)
    table_items.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F5F5F7')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DCDCE0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(table_items)
    elements.append(Spacer(1, 8*mm))

    # Notes
    if dn.notes:
        elements.append(Paragraph(f"<i>Poznámka: {dn.notes}</i>", style_normal))
        elements.append(Spacer(1, 6*mm))

    # Signature section
    sig_data = [[
        [
            Spacer(1, 12*mm),
            Paragraph("___________________________________", style_center_line),
            Spacer(1, 1*mm),
            Paragraph("Odovzdal (pečiatka, podpis)", style_center),
        ],
        "",
        [
            Spacer(1, 12*mm),
            Paragraph("___________________________________", style_center_line),
            Spacer(1, 1*mm),
            Paragraph("Prevzal (pečiatka, podpis)", style_center),
        ],
    ]]
    table_sig = Table(sig_data, colWidths=[85*mm, 16*mm, 85*mm])
    table_sig.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('LEFTPADDING',  (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(table_sig)

    doc.build(elements)
    return response
