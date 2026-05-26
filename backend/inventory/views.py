import requests
from decimal import Decimal
from datetime import datetime
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.mail import EmailMessage
from django.db import models

from .models import Item, StockMovement, Invoice, InvoiceItem, Partner, Quotation, QuotationItem, DeliveryNote, DeliveryNoteItem, Project, RentalItem, RentalMovement, BOMItem, OrderNeed, OrderNeedProject, StockDelivery, StockDeliveryItem, SentOrder, SentOrderItem, SentOrderAttachment
from .serializers import ItemSerializer, InvoiceSerializer, PartnerSerializer, QuotationSerializer, DeliveryNoteSerializer, ProjectSerializer, RentalItemSerializer, RentalMovementSerializer, BOMItemSerializer, OrderNeedSerializer, OrderNeedProjectSerializer, StockDeliverySerializer, StockDeliveryItemSerializer, SentOrderSerializer, SentOrderItemSerializer, SentOrderAttachmentSerializer
from .invoice_pdf import generate_invoice_pdf
from .delivery_note_pdf import generate_delivery_note_pdf
from .quotation_pdf import generate_quotation_pdf


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['post'])
    def remove(self, request, pk=None):
        item = self.get_object()
        quantity = request.data.get('quantity', 1)
        
        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            return Response({'error': 'Množstvo musí byť číslo'}, status=status.HTTP_400_BAD_REQUEST)
        
        if quantity <= 0:
            return Response({'error': 'Množstvo musí byť kladné'}, status=status.HTTP_400_BAD_REQUEST)
        
        if item.quantity < quantity:
            return Response({'error': f'Nedostatok skladu. K dispozícii: {item.quantity}'}, status=status.HTTP_400_BAD_REQUEST)
        
        item.quantity -= quantity
        item.save()
        
        StockMovement.objects.create(
            item=item,
            quantity=quantity,
            movement_type='OUT',
            source_type='MANUAL',
            created_by=request.user if request.user.is_authenticated else None
        )
        
        return Response({'status': 'ok', 'new_quantity': item.quantity})


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        try:
            return self._create_invoice(request, *args, **kwargs)
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return Response({'error': f'Chyba: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _create_invoice(self, request, *args, **kwargs):
        data = request.data
        items_data = data.get('items', [])
        partner_data = data.get('partner') or {}

        if not items_data:
            return Response({'error': 'Faktúra musí obsahovať aspoň jednu položku'}, status=status.HTTP_400_BAD_REQUEST)

        due_date = data.get('due_date') or None
        if not due_date:
            return Response({'error': 'Zadajte dátum splatnosti'}, status=status.HTTP_400_BAD_REQUEST)

        vat_rate = data.get('vat_rate', 23)
        is_vat_payer = data.get('is_vat_payer', True)
        manual_discount_percent = float(data.get('discount_percent', 0))
        manual_discount_amount = float(data.get('discount_amount', 0))
        use_partner_discount = data.get('use_partner_discount', True)
        
        invoice_discount_percent = 0
        invoice_discount_amount = 0
        discount_source = 'none'
        
        with transaction.atomic():
            ico = partner_data.get('ico', '')
            partner = None
            
            if ico:
                partner, created = Partner.objects.get_or_create(
                    ico=ico,
                    defaults={
                        'name': partner_data.get('name', ''),
                        'dic': partner_data.get('dic', ''),
                        'ic_dph': partner_data.get('ic_dph', ''),
                        'street': partner_data.get('street', ''),
                        'city': partner_data.get('city', ''),
                        'zip_code': partner_data.get('zip', ''),
                    }
                )
                if not created:
                    partner.name = partner_data.get('name', partner.name)
                    partner.dic = partner_data.get('dic', partner.dic)
                    partner.ic_dph = partner_data.get('ic_dph', partner.ic_dph)
                    partner.street = partner_data.get('street', partner.street)
                    partner.city = partner_data.get('city', partner.city)
                    partner.zip_code = partner_data.get('zip', partner.zip_code)
                    partner.save()
                
                if manual_discount_percent > 0 or manual_discount_amount > 0:
                    invoice_discount_percent = manual_discount_percent
                    invoice_discount_amount = manual_discount_amount
                    discount_source = 'manual'
                elif use_partner_discount and partner.default_discount_active and partner.default_discount_percent > 0:
                    invoice_discount_percent = float(partner.default_discount_percent)
                    discount_source = 'partner'
            
            last_invoice = Invoice.objects.order_by('-id').first()
            if last_invoice and last_invoice.invoice_number:
                try:
                    num = int(last_invoice.invoice_number.split('/')[0]) + 1
                except:
                    num = 1
            else:
                num = 1
            invoice_number = f"{num:04d}/{datetime.now().year}"
            delivery_note = f"DL/{num:04d}/{datetime.now().year}"
            
            p_name = partner_data.get('name', '') if partner_data else ''
            p_ico = partner_data.get('ico', '') if partner_data else ''
            p_dic = partner_data.get('dic', '') if partner_data else ''
            p_addr_parts = [partner_data.get('street', ''), partner_data.get('zip', ''), partner_data.get('city', '')] if partner_data else []
            p_addr = ' '.join(x for x in p_addr_parts if x).strip()

            invoice = Invoice.objects.create(
                partner=partner,
                partner_name=p_name,
                partner_ico=p_ico,
                partner_dic=p_dic,
                partner_address=p_addr,
                invoice_number=invoice_number,
                delivery_note=delivery_note,
                due_date=due_date,
                vat_rate=vat_rate,
                is_vat_payer=is_vat_payer,
                discount_percent=invoice_discount_percent,
                discount_amount=invoice_discount_amount,
                payment_method=data.get('payment_method', 'Bankový prevod'),
                customer_order_number=data.get('customer_order_number', ''),
                job_number=data.get('job_number', ''),
                date_of_supply=data.get('date_of_supply') or None,
                place_of_supply=data.get('place_of_supply', ''),
                contact_person=data.get('contact_person', ''),
                contact_email=data.get('contact_email', ''),
                contact_phone=data.get('contact_phone', ''),
                customer_note=data.get('customer_note', ''),
                internal_note=data.get('internal_note', ''),
            )
            
            subtotal = 0
            total_discount = 0
            total_vat_rows = 0

            for item_data in items_data:
                item_id = item_data.get('item_id')
                stock_item = None

                if item_id:
                    try:
                        stock_item = Item.objects.get(id=item_id)
                    except Item.DoesNotExist:
                        return Response({'error': f"Položka s ID {item_id} neexistuje"}, status=status.HTTP_400_BAD_REQUEST)

                description = item_data.get('description', '') or (stock_item.name if stock_item else '')
                if not description:
                    return Response({'error': 'Každá položka musí mať názov'}, status=status.HTTP_400_BAD_REQUEST)

                qty = float(item_data.get('quantity', 1))
                unit_price = float(item_data.get('unit_price', 0))
                mj = item_data.get('mj', 'ks')
                discount_percent = float(item_data.get('discount_percent', 0))
                discount_amount_item = float(item_data.get('discount_amount', 0))

                item_total = qty * unit_price

                if discount_percent > 0:
                    item_discount = item_total * (discount_percent / 100)
                else:
                    item_discount = discount_amount_item

                item_total_after_discount = item_total - item_discount
                subtotal += item_total_after_discount
                total_discount += item_discount

                item_vat_rate = float(item_data.get('vat_rate', vat_rate)) if is_vat_payer else 0
                if is_vat_payer:
                    vat_amount_item = item_total_after_discount * (item_vat_rate / 100)
                    unit_price_with_vat = unit_price * (1 + item_vat_rate / 100)
                    total_with_vat = item_total_after_discount + vat_amount_item
                    total_vat_rows += vat_amount_item
                else:
                    item_vat_rate = 0
                    unit_price_with_vat = unit_price
                    total_with_vat = item_total_after_discount

                InvoiceItem.objects.create(
                    invoice=invoice,
                    item=stock_item,
                    description=description,
                    mj=mj,
                    quantity=qty,
                    unit_price=unit_price,
                    discount_percent=discount_percent,
                    discount_amount=item_discount,
                    total_price=item_total_after_discount,
                    vat_rate=item_vat_rate,
                    unit_price_with_vat=unit_price_with_vat,
                    total_with_vat=total_with_vat
                )

                # Odpis skladu iba ak je položka viazaná na sklad
                if stock_item:
                    qty_dec = Decimal(str(qty))
                    if stock_item.quantity < qty_dec:
                        return Response({'error': f"Nedostatok na sklade: {stock_item.name} (dostupné: {stock_item.quantity})"}, status=status.HTTP_400_BAD_REQUEST)
                    stock_item.quantity -= qty_dec
                    stock_item.save()
                    StockMovement.objects.create(
                        item=stock_item,
                        quantity=qty,
                        movement_type='OUT',
                        source_type='INVOICE',
                        source_id=invoice.id,
                        created_by=request.user if request.user.is_authenticated else None,
                        note=f"Výdaj k faktúre č. {invoice.invoice_number}"
                    )
            
            if invoice_discount_percent > 0:
                invoice_discount = subtotal * (invoice_discount_percent / 100)
            else:
                invoice_discount = invoice_discount_amount

            total_after_invoice_discount = subtotal - invoice_discount
            total_discount += invoice_discount

            # VAT = súčet per-row VAT; pri doc-zľave znížime proporcionálne
            if is_vat_payer:
                discount_ratio = (invoice_discount / subtotal) if subtotal > 0 else 0
                vat_total = total_vat_rows * (1 - discount_ratio)
                grand_total = total_after_invoice_discount + vat_total
            else:
                vat_total = 0
                grand_total = total_after_invoice_discount

            invoice.subtotal = subtotal
            invoice.discount_total = total_discount
            invoice.vat_amount = vat_total
            invoice.total = grand_total
            invoice.save()

            return Response({
                "status": "Faktúra úspešne vystavená",
                "invoice_number": invoice.invoice_number,
                "delivery_note": invoice.delivery_note,
                "id": invoice.id,
                "discount_applied": {
                    "source": discount_source,
                    "percent": invoice_discount_percent,
                    "amount": float(invoice_discount)
                },
                "summary": {
                    "subtotal": float(subtotal),
                    "discount": float(total_discount),
                    "vat": float(vat_total),
                    "total": float(grand_total)
                }
            }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        invoice = self.get_object()
        return generate_invoice_pdf(invoice)

    @action(detail=True, methods=['post'])
    def send_email(self, request, pk=None):
        invoice = self.get_object()
        recipient_email = request.data.get('email')
        
        if not recipient_email:
            return Response({'error': 'Nebol zadaný e-mail príjemcu'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            response = generate_invoice_pdf(invoice)
            pdf_data = response.content
            
            subject = f"Faktúra č. {invoice.invoice_number} - Značka servis s. r. o."
            body = f"Dobrý deň,\n\nV prílohe Vám zasielame faktúru č. {invoice.invoice_number}.\n\nS pozdravom,\nZnačka servis s. r. o."
            
            email_msg = EmailMessage(
                subject=subject,
                body=body,
                to=[recipient_email],
                bcc=['obchod@znackaservis.sk']
            )
            
            email_msg.attach(f"faktura_{invoice.invoice_number}.pdf", pdf_data, "application/pdf")
            email_msg.send(fail_silently=False)
            
            return Response({'status': 'E-mail bol úspešne odoslaný'})
            
        except Exception as e:
            return Response({'error': f'Chyba pri odosielaní: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def partial_update(self, request, *args, **kwargs):
        invoice = self.get_object()
        data = request.data
        items_data = data.get('items', None)
        partner_data = data.get('partner') or {}

        with transaction.atomic():
            ico = partner_data.get('ico', '')
            if ico:
                partner, created = Partner.objects.get_or_create(
                    ico=ico,
                    defaults={
                        'name': partner_data.get('name', ''),
                        'dic': partner_data.get('dic', ''),
                        'ic_dph': partner_data.get('ic_dph', ''),
                        'street': partner_data.get('street', ''),
                        'city': partner_data.get('city', ''),
                        'zip_code': partner_data.get('zip', ''),
                    }
                )
                if not created:
                    partner.name = partner_data.get('name', partner.name)
                    partner.save()
                invoice.partner = partner
            elif not partner_data:
                invoice.partner = None

            # Vždy ukladaj textové polia partnera
            if partner_data:
                invoice.partner_name = partner_data.get('name', '')
                invoice.partner_ico = partner_data.get('ico', '')
                invoice.partner_dic = partner_data.get('dic', '')
                addr_parts = [partner_data.get('street', ''), partner_data.get('zip', ''), partner_data.get('city', '')]
                invoice.partner_address = ' '.join(x for x in addr_parts if x).strip()

            for field in ['due_date', 'vat_rate', 'is_vat_payer', 'payment_method',
                          'customer_order_number', 'job_number', 'date_of_supply',
                          'place_of_supply', 'contact_person', 'contact_email',
                          'contact_phone', 'customer_note', 'internal_note']:
                if field in data:
                    val = data[field]
                    if field in ('date_of_supply', 'due_date') and val == '':
                        val = None
                    if field == 'due_date' and not val:
                        continue
                    setattr(invoice, field, val)

            if items_data is not None:
                invoice.items.all().delete()
                vat_rate = int(data.get('vat_rate', invoice.vat_rate))
                is_vat_payer = data.get('is_vat_payer', invoice.is_vat_payer)
                subtotal = 0
                total_vat_rows = 0
                for item_data in items_data:
                    item_id = item_data.get('item_id')
                    stock_item = None
                    if item_id:
                        try:
                            stock_item = Item.objects.get(id=item_id)
                        except Item.DoesNotExist:
                            pass
                    description = item_data.get('description', '') or (stock_item.name if stock_item else '')
                    qty = float(item_data.get('quantity', 1))
                    unit_price = float(item_data.get('unit_price', 0))
                    mj = item_data.get('mj', 'ks')
                    item_total = qty * unit_price
                    subtotal += item_total
                    item_vat_rate = float(item_data.get('vat_rate', vat_rate)) if is_vat_payer else 0
                    if is_vat_payer:
                        vat_item = item_total * (item_vat_rate / 100)
                        unit_price_with_vat = unit_price * (1 + item_vat_rate / 100)
                        total_with_vat = item_total + vat_item
                        total_vat_rows += vat_item
                    else:
                        item_vat_rate = 0
                        unit_price_with_vat = unit_price
                        total_with_vat = item_total
                    InvoiceItem.objects.create(
                        invoice=invoice,
                        item=stock_item,
                        description=description,
                        mj=mj,
                        quantity=qty,
                        unit_price=unit_price,
                        discount_percent=0,
                        discount_amount=0,
                        total_price=item_total,
                        vat_rate=item_vat_rate,
                        unit_price_with_vat=unit_price_with_vat,
                        total_with_vat=total_with_vat,
                    )
                invoice.subtotal = subtotal
                invoice.discount_total = 0
                invoice.vat_amount = total_vat_rows
                invoice.total = subtotal + total_vat_rows

            invoice.save()
            serializer = self.get_serializer(invoice)
            return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='lookup-company')
    def lookup_company(self, request):
        query = request.query_params.get('q', '').strip()
        
        if not query:
            return Response({'error': 'Zadajte IČO alebo názov firmy'}, status=status.HTTP_400_BAD_REQUEST)
        
        search_url = f"https://api.subjekt.sk/v1/search?q={query}"
        
        try:
            headers = {'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'}
            search_response = requests.get(search_url, headers=headers, timeout=10)
            
            if search_response.status_code == 200:
                data = search_response.json()
                results = data.get('results', [])
                
                if not results:
                    return Response({'error': 'Žiadna firma nebola nájdená'}, status=status.HTTP_404_NOT_FOUND)
                
                formatted_results = []
                for company in results[:10]:
                    ico = company.get('ico', '')
                    if ico:
                        detail_url = f"https://api.subjekt.sk/v1/entity/{ico}"
                        detail_response = requests.get(detail_url, headers=headers, timeout=5)
                        
                        if detail_response.status_code == 200:
                            detail = detail_response.json()
                            address = detail.get('address', {})
                            street = address.get('street', '')
                            building_no = address.get('building_no', '')
                            city = address.get('city', '')
                            zip_code = address.get('zip', '')
                            
                            full_street = f"{street} {building_no}".strip() if street else ''
                            
                            formatted_results.append({
                                'name': detail.get('name', company.get('name', '')),
                                'ico': ico,
                                'dic': detail.get('dic', ''),
                                'ic_dph': detail.get('ic_dph', ''),
                                'street': full_street,
                                'city': city,
                                'zip': zip_code,
                                'full_address': f"{full_street}, {zip_code} {city}".strip(', ')
                            })
                return Response(formatted_results)
            else:
                return Response({'error': 'API neodpovedá'}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception:
            return Response({'error': 'Chyba pripojenia'}, status=status.HTTP_502_BAD_GATEWAY)

    @action(detail=False, methods=['get'], url_path='search-partner')
    def search_partner(self, request):
        query = request.query_params.get('q', '').strip()
        
        if not query:
            return Response({'error': 'Zadajte IČO alebo názov firmy'}, status=status.HTTP_400_BAD_REQUEST)
        
        partners = Partner.objects.filter(
            models.Q(ico=query) | models.Q(name__icontains=query)
        )[:10]
        
        if partners.exists():
            serializer = PartnerSerializer(partners, many=True)
            return Response(serializer.data)
        
        search_url = f"https://api.subjekt.sk/v1/search?q={query}"
        
        try:
            headers = {'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'}
            search_response = requests.get(search_url, headers=headers, timeout=10)
            
            if search_response.status_code == 200:
                data = search_response.json()
                results = data.get('results', [])
                
                if not results:
                    return Response([], status=status.HTTP_404_NOT_FOUND)
                
                formatted_results = []
                for company in results[:10]:
                    ico = company.get('ico', '')
                    if ico:
                        detail_url = f"https://api.subjekt.sk/v1/entity/{ico}"
                        detail_response = requests.get(detail_url, headers=headers, timeout=5)
                        
                        if detail_response.status_code == 200:
                            detail = detail_response.json()
                            address = detail.get('address', {})
                            street = address.get('street', '')
                            building_no = address.get('building_no', '')
                            city = address.get('city', '')
                            zip_code = address.get('zip', '')
                            
                            full_street = f"{street} {building_no}".strip() if street else ''
                            
                            formatted_results.append({
                                'id': None,
                                'name': detail.get('name', company.get('name', '')),
                                'ico': ico,
                                'dic': detail.get('dic', ''),
                                'ic_dph': detail.get('ic_dph', ''),
                                'street': full_street,
                                'city': city,
                                'zip_code': zip_code,
                                'default_discount_percent': 0,
                                'default_discount_active': False,
                                'full_address': f"{full_street}, {zip_code} {city}".strip(', ')
                            })
                return Response(formatted_results)
        except Exception as e:
            print(f"Chyba: {e}")
        
        return Response([], status=status.HTTP_404_NOT_FOUND)


class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.all()
    serializer_class = QuotationSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        data = request.data
        items_data = data.get('items', [])
        partner_data = data.get('partner') or {}

        if not items_data:
            return Response({'error': 'Ponuka musí obsahovať aspoň jednu položku'}, status=status.HTTP_400_BAD_REQUEST)
        
        vat_rate = data.get('vat_rate', 23)
        is_vat_payer = data.get('is_vat_payer', True)
        manual_discount_percent = float(data.get('discount_percent', 0))
        manual_discount_amount = float(data.get('discount_amount', 0))
        use_partner_discount = data.get('use_partner_discount', True)
        
        quotation_discount_percent = 0
        quotation_discount_amount = 0
        discount_source = 'none'
        
        with transaction.atomic():
            ico = partner_data.get('ico', '')
            partner = None
            
            if ico:
                partner, created = Partner.objects.get_or_create(
                    ico=ico,
                    defaults={
                        'name': partner_data.get('name', ''),
                        'dic': partner_data.get('dic', ''),
                        'ic_dph': partner_data.get('ic_dph', ''),
                        'street': partner_data.get('street', ''),
                        'city': partner_data.get('city', ''),
                        'zip_code': partner_data.get('zip', ''),
                    }
                )
                if not created:
                    partner.name = partner_data.get('name', partner.name)
                    partner.dic = partner_data.get('dic', partner.dic)
                    partner.ic_dph = partner_data.get('ic_dph', partner.ic_dph)
                    partner.street = partner_data.get('street', partner.street)
                    partner.city = partner_data.get('city', partner.city)
                    partner.zip_code = partner_data.get('zip', partner.zip_code)
                    partner.save()
                
                if manual_discount_percent > 0 or manual_discount_amount > 0:
                    quotation_discount_percent = manual_discount_percent
                    quotation_discount_amount = manual_discount_amount
                    discount_source = 'manual'
                elif use_partner_discount and partner.default_discount_active and partner.default_discount_percent > 0:
                    quotation_discount_percent = float(partner.default_discount_percent)
                    discount_source = 'partner'
            
            last_quotation = Quotation.objects.order_by('-id').first()
            if last_quotation and last_quotation.quotation_number:
                try:
                    num = int(last_quotation.quotation_number.split('/')[0]) + 1
                except:
                    num = 1
            else:
                num = 1
            quotation_number = f"{num:04d}/{datetime.now().year}"
            
            q_p_name = partner_data.get('name', '') if partner_data else ''
            q_p_ico = partner_data.get('ico', '') if partner_data else ''
            q_p_dic = partner_data.get('dic', '') if partner_data else ''
            q_p_addr_parts = [partner_data.get('street', ''), partner_data.get('zip', ''), partner_data.get('city', '')] if partner_data else []
            q_p_addr = ' '.join(x for x in q_p_addr_parts if x).strip()

            quotation = Quotation.objects.create(
                partner=partner,
                partner_name=q_p_name,
                partner_ico=q_p_ico,
                partner_dic=q_p_dic,
                partner_address=q_p_addr,
                quotation_number=quotation_number,
                valid_until=data.get('valid_until'),
                vat_rate=vat_rate,
                is_vat_payer=is_vat_payer,
                discount_percent=quotation_discount_percent,
                discount_amount=quotation_discount_amount,
                status=data.get('status', 'draft'),
                notes=data.get('notes', ''),
                payment_method=data.get('payment_method', 'Bankový prevod'),
                customer_order_number=data.get('customer_order_number', ''),
                job_number=data.get('job_number', ''),
                place_of_supply=data.get('place_of_supply', ''),
                contact_person=data.get('contact_person', ''),
                contact_email=data.get('contact_email', ''),
                contact_phone=data.get('contact_phone', ''),
                customer_note=data.get('customer_note', ''),
            )

            subtotal = 0
            total_discount = 0
            total_vat_rows = 0

            for item_data in items_data:
                item_id = item_data.get('item_id')
                item = None

                if item_id:
                    try:
                        item = Item.objects.get(id=item_id)
                    except Item.DoesNotExist:
                        return Response({'error': f"Položka s ID {item_id} neexistuje"}, status=status.HTTP_400_BAD_REQUEST)

                description = item_data.get('description', '') or (item.name if item else '')
                if not description:
                    return Response({'error': 'Každá položka musí mať názov (description)'}, status=status.HTTP_400_BAD_REQUEST)

                qty = float(item_data.get('quantity', 1))
                unit_price = float(item_data.get('unit_price', 0))
                mj = item_data.get('mj', 'ks')
                discount_percent = float(item_data.get('discount_percent', 0))
                discount_amount_item = float(item_data.get('discount_amount', 0))

                item_total = qty * unit_price

                if discount_percent > 0:
                    item_discount = item_total * (discount_percent / 100)
                else:
                    item_discount = discount_amount_item

                item_total_after_discount = item_total - item_discount
                subtotal += item_total_after_discount
                total_discount += item_discount

                item_vat_rate = float(item_data.get('vat_rate', vat_rate)) if is_vat_payer else 0
                if is_vat_payer:
                    vat_amount_item = item_total_after_discount * (item_vat_rate / 100)
                    unit_price_with_vat = unit_price * (1 + item_vat_rate / 100)
                    total_with_vat = item_total_after_discount + vat_amount_item
                    total_vat_rows += vat_amount_item
                else:
                    item_vat_rate = 0
                    unit_price_with_vat = unit_price
                    total_with_vat = item_total_after_discount

                QuotationItem.objects.create(
                    quotation=quotation,
                    item=item,
                    description=description,
                    mj=mj,
                    quantity=qty,
                    unit_price=unit_price,
                    discount_percent=discount_percent,
                    discount_amount=item_discount,
                    total_price=item_total_after_discount,
                    vat_rate=item_vat_rate,
                    unit_price_with_vat=unit_price_with_vat,
                    total_with_vat=total_with_vat
                )

            if quotation_discount_percent > 0:
                quotation_discount = subtotal * (quotation_discount_percent / 100)
            else:
                quotation_discount = quotation_discount_amount

            total_after_quotation_discount = subtotal - quotation_discount
            total_discount += quotation_discount

            if is_vat_payer:
                discount_ratio = (quotation_discount / subtotal) if subtotal > 0 else 0
                vat_total = total_vat_rows * (1 - discount_ratio)
                grand_total = total_after_quotation_discount + vat_total
            else:
                vat_total = 0
                grand_total = total_after_quotation_discount
            
            quotation.subtotal = subtotal
            quotation.discount_total = total_discount
            quotation.vat_amount = vat_total
            quotation.total = grand_total
            quotation.save()
            
            return Response({
                "status": "Cenová ponuka úspešne vytvorená",
                "quotation_number": quotation.quotation_number,
                "id": quotation.id,
                "discount_applied": {
                    "source": discount_source,
                    "percent": quotation_discount_percent,
                    "amount": float(quotation_discount)
                },
                "summary": {
                    "subtotal": float(subtotal),
                    "discount": float(total_discount),
                    "vat": float(vat_total),
                    "total": float(grand_total)
                }
            }, status=status.HTTP_201_CREATED)
    
    def partial_update(self, request, *args, **kwargs):
        quotation = self.get_object()
        data = request.data
        items_data = data.get('items', None)
        partner_data = data.get('partner') or {}

        with transaction.atomic():
            ico = partner_data.get('ico', '')
            if ico:
                partner, created = Partner.objects.get_or_create(
                    ico=ico,
                    defaults={
                        'name': partner_data.get('name', ''),
                        'dic': partner_data.get('dic', ''),
                        'ic_dph': partner_data.get('ic_dph', ''),
                        'street': partner_data.get('street', ''),
                        'city': partner_data.get('city', ''),
                        'zip_code': partner_data.get('zip', ''),
                    }
                )
                if not created:
                    partner.name = partner_data.get('name', partner.name)
                    partner.save()
                quotation.partner = partner
            elif not partner_data:
                quotation.partner = None

            if partner_data:
                quotation.partner_name = partner_data.get('name', '')
                quotation.partner_ico = partner_data.get('ico', '')
                quotation.partner_dic = partner_data.get('dic', '')
                addr_parts = [partner_data.get('street', ''), partner_data.get('zip', ''), partner_data.get('city', '')]
                quotation.partner_address = ' '.join(x for x in addr_parts if x).strip()

            for field in ['valid_until', 'vat_rate', 'is_vat_payer', 'status', 'notes',
                          'payment_method', 'customer_order_number', 'job_number',
                          'place_of_supply', 'contact_person', 'contact_email',
                          'contact_phone', 'customer_note']:
                if field in data:
                    setattr(quotation, field, data[field])

            if items_data is not None:
                quotation.items.all().delete()
                vat_rate = int(data.get('vat_rate', quotation.vat_rate))
                is_vat_payer = data.get('is_vat_payer', quotation.is_vat_payer)
                subtotal = 0
                total_vat_rows = 0
                for item_data in items_data:
                    item_id = item_data.get('item_id')
                    stock_item = None
                    if item_id:
                        try:
                            stock_item = Item.objects.get(id=item_id)
                        except Item.DoesNotExist:
                            pass
                    description = item_data.get('description', '') or (stock_item.name if stock_item else '')
                    qty = float(item_data.get('quantity', 1))
                    unit_price = float(item_data.get('unit_price', 0))
                    mj = item_data.get('mj', 'ks')
                    item_total = qty * unit_price
                    subtotal += item_total
                    item_vat_rate = float(item_data.get('vat_rate', vat_rate)) if is_vat_payer else 0
                    if is_vat_payer:
                        vat_item = item_total * (item_vat_rate / 100)
                        unit_price_with_vat = unit_price * (1 + item_vat_rate / 100)
                        total_with_vat = item_total + vat_item
                        total_vat_rows += vat_item
                    else:
                        item_vat_rate = 0
                        unit_price_with_vat = unit_price
                        total_with_vat = item_total
                    QuotationItem.objects.create(
                        quotation=quotation,
                        item=stock_item,
                        description=description,
                        mj=mj,
                        quantity=qty,
                        unit_price=unit_price,
                        discount_percent=0,
                        discount_amount=0,
                        total_price=item_total,
                        vat_rate=item_vat_rate,
                        unit_price_with_vat=unit_price_with_vat,
                        total_with_vat=total_with_vat,
                    )
                quotation.subtotal = subtotal
                quotation.discount_total = 0
                quotation.vat_amount = total_vat_rows
                quotation.total = subtotal + total_vat_rows

            quotation.save()
            serializer = self.get_serializer(quotation)
            return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def convert_to_invoice(self, request, pk=None):
        quotation = self.get_object()
        
        if quotation.status == 'converted':
            return Response({'error': 'Táto ponuka už bola konvertovaná na faktúru'}, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            last_invoice = Invoice.objects.order_by('-id').first()
            if last_invoice and last_invoice.invoice_number:
                try:
                    num = int(last_invoice.invoice_number.split('/')[0]) + 1
                except:
                    num = 1
            else:
                num = 1
            invoice_number = f"{num:04d}/{datetime.now().year}"
            delivery_note = f"DL/{num:04d}/{datetime.now().year}"
            
            invoice = Invoice.objects.create(
                invoice_number=invoice_number,
                delivery_note=delivery_note,
                due_date=request.data.get('due_date', datetime.now().date()),
                partner=quotation.partner,
                partner_name=quotation.partner_name,
                partner_ico=quotation.partner_ico,
                partner_dic=quotation.partner_dic,
                partner_address=quotation.partner_address,
                vat_rate=quotation.vat_rate,
                is_vat_payer=quotation.is_vat_payer,
                discount_percent=quotation.discount_percent,
                discount_amount=quotation.discount_amount,
                subtotal=quotation.subtotal,
                discount_total=quotation.discount_total,
                vat_amount=quotation.vat_amount,
                total=quotation.total
            )

            for q_item in quotation.items.all():
                InvoiceItem.objects.create(
                    invoice=invoice,
                    item=q_item.item,
                    description=q_item.description,
                    mj=q_item.mj,
                    quantity=q_item.quantity,
                    unit_price=q_item.unit_price,
                    discount_percent=q_item.discount_percent,
                    discount_amount=q_item.discount_amount,
                    total_price=q_item.total_price,
                    vat_rate=q_item.vat_rate,
                    unit_price_with_vat=q_item.unit_price_with_vat,
                    total_with_vat=q_item.total_with_vat
                )

                stock_item = q_item.item
                if stock_item:
                    if stock_item.quantity < q_item.quantity:
                        return Response({'error': f"Nedostatok na sklade: {stock_item.name}"}, status=status.HTTP_400_BAD_REQUEST)
                    stock_item.quantity -= q_item.quantity
                    stock_item.save()
                    StockMovement.objects.create(
                        item=stock_item,
                        quantity=q_item.quantity,
                        movement_type='OUT',
                        source_type='INVOICE',
                        source_id=invoice.id,
                        created_by=request.user if request.user.is_authenticated else None,
                        note=f"Výdaj z konvertovanej ponuky {quotation.quotation_number}"
                    )
            
            quotation.status = 'converted'
            quotation.converted_to_invoice = invoice
            quotation.save()
            
            return Response({
                "status": "Ponuka bola konvertovaná na faktúru",
                "invoice_id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "delivery_note": invoice.delivery_note
            }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        quotation = self.get_object()
        new_status = request.data.get('status')
        
        if new_status not in ['draft', 'sent', 'accepted', 'rejected']:
            return Response({'error': 'Neplatný status'}, status=status.HTTP_400_BAD_REQUEST)
        
        quotation.status = new_status
        quotation.save()
        
        return Response({
            "status": f"Status ponuky zmenený na {quotation.get_status_display()}",
            "quotation_id": quotation.id,
            "new_status": quotation.status
        })

    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        quotation = self.get_object()
        return generate_quotation_pdf(quotation)

    @action(detail=True, methods=['post'])
    def send_email(self, request, pk=None):
        quotation = self.get_object()
        recipient_email = request.data.get('email')
        if not recipient_email:
            return Response({'error': 'Nebol zadaný e-mail príjemcu'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            response = generate_quotation_pdf(quotation)
            pdf_data = response.content
            subject = f"Cenová ponuka č. {quotation.quotation_number} - Značka servis s. r. o."
            body = f"Dobrý deň,\n\nV prílohe Vám zasielame cenovú ponuku č. {quotation.quotation_number}.\n\nS pozdravom,\nZnačka servis s. r. o."
            email_msg = EmailMessage(subject=subject, body=body, to=[recipient_email],
                                     bcc=['obchod@znackaservis.sk'])
            email_msg.attach(f"ponuka_{quotation.quotation_number}.pdf", pdf_data, "application/pdf")
            email_msg.send(fail_silently=False)
            return Response({'status': 'E-mail bol úspešne odoslaný'})
        except Exception as e:
            return Response({'error': f'Chyba pri odosielaní: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PartnerViewSet(viewsets.ModelViewSet):
    queryset = Partner.objects.all()
    serializer_class = PartnerSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['patch'], url_path='update-discount')
    def update_discount(self, request, pk=None):
        partner = self.get_object()

        discount_percent = request.data.get('default_discount_percent')
        discount_active = request.data.get('default_discount_active')

        if discount_percent is not None:
            partner.default_discount_percent = float(discount_percent)
        if discount_active is not None:
            partner.default_discount_active = bool(discount_active)

        partner.save()

        return Response({
            'status': 'Zľava aktualizovaná',
            'partner_id': partner.id,
            'name': partner.name,
            'default_discount_percent': float(partner.default_discount_percent),
            'default_discount_active': partner.default_discount_active
        })


class DeliveryNoteViewSet(viewsets.ModelViewSet):
    queryset = DeliveryNote.objects.all()
    serializer_class = DeliveryNoteSerializer
    permission_classes = [permissions.AllowAny]

    def _next_number(self):
        year = datetime.now().year
        last = DeliveryNote.objects.filter(
            delivery_note_number__endswith=f'/{year}'
        ).order_by('-id').first()
        if last and last.delivery_note_number:
            try:
                num = int(last.delivery_note_number.split('/')[1]) + 1
            except Exception:
                num = 1
        else:
            num = 1
        return f"DL/{num:04d}/{year}"

    def _resolve_partner(self, partner_data):
        if not partner_data:
            return None, '', '', '', ''
        ico = partner_data.get('ico', '')
        partner = None
        if ico:
            partner, created = Partner.objects.get_or_create(
                ico=ico,
                defaults={
                    'name': partner_data.get('name', ''),
                    'dic': partner_data.get('dic', ''),
                    'street': partner_data.get('street', ''),
                    'city': partner_data.get('city', ''),
                    'zip_code': partner_data.get('zip', ''),
                }
            )
            if not created:
                partner.name = partner_data.get('name', partner.name)
                partner.save()
        p_name = partner_data.get('name', '')
        p_ico = partner_data.get('ico', '')
        p_dic = partner_data.get('dic', '')
        addr_parts = [partner_data.get('street', ''), partner_data.get('zip', ''), partner_data.get('city', '')]
        p_addr = ' '.join(x for x in addr_parts if x).strip()
        return partner, p_name, p_ico, p_dic, p_addr

    def create(self, request, *args, **kwargs):
        data = request.data
        items_data = data.get('items', [])
        partner_data = data.get('partner') or {}
        dn_type = data.get('type', 'standard')
        project_id = data.get('project_id')

        with transaction.atomic():
            partner, p_name, p_ico, p_dic, p_addr = self._resolve_partner(partner_data)

            project = None
            if project_id:
                try:
                    project = Project.objects.get(id=project_id)
                except Project.DoesNotExist:
                    pass

            dn = DeliveryNote.objects.create(
                delivery_note_number=self._next_number(),
                partner=partner,
                partner_name=p_name,
                partner_ico=p_ico,
                partner_dic=p_dic,
                partner_address=p_addr,
                notes=data.get('notes', ''),
                type=dn_type,
                project=project,
            )

            for row in items_data:
                item_id = row.get('item_id')
                rental_item_id = row.get('rental_item_id')
                stock_item = None
                rental_item = None

                if item_id:
                    try:
                        stock_item = Item.objects.get(id=item_id)
                    except Item.DoesNotExist:
                        pass

                if rental_item_id:
                    try:
                        rental_item = RentalItem.objects.get(id=rental_item_id)
                    except RentalItem.DoesNotExist:
                        pass

                item_name = row.get('item_name', '') or (rental_item.name if rental_item else '') or (stock_item.name if stock_item else '')
                qty = float(row.get('quantity', 1))

                dni = DeliveryNoteItem.objects.create(
                    delivery_note=dn,
                    item=stock_item,
                    rental_item=rental_item,
                    item_name=item_name,
                    quantity=qty,
                    mj=row.get('mj', 'ks'),
                    pos=int(row.get('pos', 1)),
                    unit_price=float(row.get('unit_price', 0)),
                    is_complete_set=row.get('is_complete_set', False),
                    minus_stand=row.get('minus_stand', False),
                    minus_pole=row.get('minus_pole', False),
                    minus_clamps=row.get('minus_clamps', False),
                )

                # Rentálova logika
                is_complete = row.get('is_complete_set', False)
                m_stand = row.get('minus_stand', False)
                m_pole = row.get('minus_pole', False)
                m_clamps = row.get('minus_clamps', False)

                if dn_type == 'rental_out' and rental_item:
                    avail = float(rental_item.total_qty) - float(rental_item.rented_qty)
                    if avail < qty:
                        return Response({'error': f'Nedostatok na prenájomnom sklade: {rental_item.name} (dostupné: {avail})'}, status=status.HTTP_400_BAD_REQUEST)
                    rental_item.rented_qty = float(rental_item.rented_qty) + qty
                    rental_item.save()
                    RentalMovement.objects.create(
                        rental_item=rental_item,
                        project=project,
                        delivery_note_out=dn,
                        quantity=qty,
                        date_out=datetime.now().date(),
                        contract_number=RentalMovement.generate_contract_number(),
                        is_complete_set=is_complete,
                        minus_stand=m_stand,
                        minus_pole=m_pole,
                        minus_clamps=m_clamps,
                    )
                    # Mínusový systém: odpisuj komponenty ak je kompletná zostava
                    if is_complete:
                        component_rules = []
                        if not m_pole:
                            component_rules.append(('COMP-STLPIK-2M', qty))
                        if not m_clamps:
                            component_rules.append(('COMP-SVORKA', qty * 2))
                        if not m_stand:
                            component_rules.append(('COMP-PODSTAVEC-M', qty))
                        for comp_sku, comp_qty in component_rules:
                            try:
                                comp = RentalItem.objects.get(sku=comp_sku)
                                comp.rented_qty = float(comp.rented_qty) + comp_qty
                                comp.save()
                                RentalMovement.objects.create(
                                    rental_item=comp,
                                    project=project,
                                    delivery_note_out=dn,
                                    quantity=comp_qty,
                                    date_out=datetime.now().date(),
                                    contract_number=RentalMovement.generate_contract_number(),
                                    is_complete_set=False,
                                )
                            except RentalItem.DoesNotExist:
                                pass  # Komponent neexistuje, preskočíme

                elif dn_type == 'rental_return' and rental_item:
                    # Uzatvor otvorené pohyby (FIFO) a vráť komponenty
                    open_mvs = RentalMovement.objects.filter(
                        rental_item=rental_item,
                        project=project,
                        date_in__isnull=True,
                    ).order_by('date_out')
                    remaining = qty
                    for mv in open_mvs:
                        if remaining <= 0:
                            break
                        close_qty = min(float(mv.quantity), remaining)
                        if close_qty >= float(mv.quantity):
                            mv.date_in = datetime.now().date()
                            mv.delivery_note_in = dn
                            # Vráť komponenty podľa pôvodnej konfigurácie
                            if mv.is_complete_set:
                                comp_returns = []
                                if not mv.minus_pole:
                                    comp_returns.append(('COMP-STLPIK-2M', float(mv.quantity)))
                                if not mv.minus_clamps:
                                    comp_returns.append(('COMP-SVORKA', float(mv.quantity) * 2))
                                if not mv.minus_stand:
                                    comp_returns.append(('COMP-PODSTAVEC-M', float(mv.quantity)))
                                for comp_sku, comp_qty in comp_returns:
                                    try:
                                        comp = RentalItem.objects.get(sku=comp_sku)
                                        comp_mv = RentalMovement.objects.filter(
                                            rental_item=comp, project=project, date_in__isnull=True
                                        ).order_by('date_out').first()
                                        if comp_mv:
                                            comp_mv.date_in = datetime.now().date()
                                            comp_mv.delivery_note_in = dn
                                            comp_mv.save()
                                        comp.rented_qty = max(0, float(comp.rented_qty) - comp_qty)
                                        comp.save()
                                    except RentalItem.DoesNotExist:
                                        pass
                            mv.save()
                        remaining -= close_qty
                    returned = qty - max(0, remaining)
                    rental_item.rented_qty = max(0, float(rental_item.rented_qty) - returned)
                    rental_item.save()

            invoice_id = data.get('invoice_id')
            if invoice_id:
                try:
                    inv = Invoice.objects.get(id=invoice_id)
                    dn.invoice = inv
                    dn.save()
                except Invoice.DoesNotExist:
                    pass

            serializer = self.get_serializer(dn)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        dn = self.get_object()
        data = request.data
        partner_data = data.get('partner') or {}
        items_data = data.get('items', None)

        with transaction.atomic():
            if partner_data:
                partner, p_name, p_ico, p_dic, p_addr = self._resolve_partner(partner_data)
                dn.partner = partner
                dn.partner_name = p_name
                dn.partner_ico = p_ico
                dn.partner_dic = p_dic
                dn.partner_address = p_addr
            if 'notes' in data:
                dn.notes = data['notes']
            if 'type' in data:
                dn.type = data['type']
            if 'project_id' in data:
                try:
                    dn.project = Project.objects.get(id=data['project_id']) if data['project_id'] else None
                except Project.DoesNotExist:
                    dn.project = None
            if items_data is not None:
                dn.items.all().delete()
                for row in items_data:
                    item_id = row.get('item_id')
                    rental_item_id = row.get('rental_item_id')
                    stock_item = None
                    rental_item = None
                    if item_id:
                        try:
                            stock_item = Item.objects.get(id=item_id)
                        except Item.DoesNotExist:
                            pass
                    if rental_item_id:
                        try:
                            rental_item = RentalItem.objects.get(id=rental_item_id)
                        except RentalItem.DoesNotExist:
                            pass
                    item_name = row.get('item_name', '') or (rental_item.name if rental_item else '') or (stock_item.name if stock_item else '')
                    DeliveryNoteItem.objects.create(
                        delivery_note=dn,
                        item=stock_item,
                        rental_item=rental_item,
                        item_name=item_name,
                        quantity=float(row.get('quantity', 1)),
                        mj=row.get('mj', 'ks'),
                        pos=int(row.get('pos', 1)),
                        unit_price=float(row.get('unit_price', 0)),
                    )
            dn.save()
            serializer = self.get_serializer(dn)
            return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        dn = self.get_object()
        return generate_delivery_note_pdf(dn)


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-id')
    serializer_class = ProjectSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        data = request.data
        partner_data = data.get('partner') or {}
        ico = partner_data.get('ico', '')
        partner = None
        if ico:
            partner, created = Partner.objects.get_or_create(
                ico=ico,
                defaults={
                    'name': partner_data.get('name', ''),
                    'dic': partner_data.get('dic', ''),
                    'street': partner_data.get('street', ''),
                    'city': partner_data.get('city', ''),
                    'zip_code': partner_data.get('zip', ''),
                }
            )
            if not created:
                partner.name = partner_data.get('name', partner.name)
                partner.save()
        project = Project.objects.create(
            name=data.get('name', ''),
            partner=partner,
            partner_name=partner_data.get('name', '') if partner_data else '',
            status=data.get('status', 'open'),
            notes=data.get('notes', ''),
            project_number=Project.generate_project_number(),
            customer_order_number=data.get('customer_order_number', ''),
        )
        serializer = self.get_serializer(project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        project = self.get_object()
        data = request.data
        partner_data = data.get('partner') or {}
        ico = partner_data.get('ico', '')
        if ico:
            partner, created = Partner.objects.get_or_create(
                ico=ico,
                defaults={
                    'name': partner_data.get('name', ''),
                    'dic': partner_data.get('dic', ''),
                    'street': partner_data.get('street', ''),
                    'city': partner_data.get('city', ''),
                    'zip_code': partner_data.get('zip', ''),
                }
            )
            if not created:
                partner.name = partner_data.get('name', partner.name)
                partner.save()
            project.partner = partner
            project.partner_name = partner_data.get('name', '')
        for field in ['name', 'status', 'notes', 'customer_order_number']:
            if field in data:
                setattr(project, field, data[field])
        project.save()
        serializer = self.get_serializer(project)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def linked_docs(self, request, pk=None):
        project = self.get_object()
        from .serializers import InvoiceSerializer, QuotationSerializer, DeliveryNoteSerializer
        invoices = InvoiceSerializer(project.invoices.all().order_by('-id'), many=True).data
        quotations = QuotationSerializer(project.quotations.all().order_by('-id'), many=True).data
        delivery_notes = DeliveryNoteSerializer(project.delivery_notes.all().order_by('-id'), many=True).data
        return Response({
            'invoices': invoices,
            'quotations': quotations,
            'delivery_notes': delivery_notes,
        })

    @action(detail=True, methods=['get'])
    def rental_summary(self, request, pk=None):
        project = self.get_object()
        open_movements = RentalMovement.objects.filter(
            project=project,
            date_in__isnull=True,
        ).select_related('rental_item')
        summary = []
        for mv in open_movements:
            from datetime import date
            days = max(1, (date.today() - mv.date_out).days)
            total_cost = days * float(mv.quantity) * float(mv.rental_item.daily_rate)
            summary.append({
                'movement_id': mv.id,
                'rental_item_id': mv.rental_item.id,
                'name': mv.rental_item.name,
                'quantity': float(mv.quantity),
                'mj': mv.rental_item.mj,
                'daily_rate': float(mv.rental_item.daily_rate),
                'date_out': mv.date_out.isoformat(),
                'days': days,
                'total_cost': round(total_cost, 2),
            })
        return Response({
            'project_id': project.id,
            'project_name': project.name,
            'partner_name': project.partner.name if project.partner_id else project.partner_name,
            'items': summary,
        })

    @action(detail=True, methods=['post'])
    def close_rental(self, request, pk=None):
        project = self.get_object()
        from datetime import date
        open_movements = RentalMovement.objects.filter(
            project=project,
            date_in__isnull=True,
        ).select_related('rental_item')
        invoice_items = []
        for mv in open_movements:
            days = max(1, (date.today() - mv.date_out).days)
            mv.date_in = date.today()
            mv.save()
            mv.rental_item.rented_qty = max(0, float(mv.rental_item.rented_qty) - float(mv.quantity))
            mv.rental_item.save()
            invoice_items.append({
                'item_name': f"{mv.rental_item.name} – prenájom {days} dní x {mv.quantity} {mv.rental_item.mj}",
                'description': f"{mv.rental_item.name} – prenájom {days} dní x {mv.quantity} {mv.rental_item.mj}",
                'quantity': days,
                'mj': 'dní',
                'unit_price': float(mv.quantity) * float(mv.rental_item.daily_rate),
                'vat_rate': 23,
                'item_id': None,
            })
        return Response({
            'project_id': project.id,
            'project_name': project.name,
            'partner': {
                'name': project.partner.name if project.partner_id else project.partner_name,
                'ico': project.partner.ico if project.partner_id else '',
                'dic': project.partner.dic if project.partner_id else '',
                'street': project.partner.street if project.partner_id else '',
                'city': project.partner.city if project.partner_id else '',
                'zip': project.partner.zip_code if project.partner_id else '',
            },
            'items': invoice_items,
        })

    @action(detail=True, methods=['get', 'post'])
    def bom(self, request, pk=None):
        project = self.get_object()
        if request.method == 'GET':
            items = BOMItem.objects.filter(project=project).order_by('created_at')
            return Response(BOMItemSerializer(items, many=True).data)
        # POST - add BOM item
        data = request.data
        item_id = data.get('item_id')
        item = None
        item_name = data.get('item_name', '')
        if item_id:
            try:
                item = Item.objects.get(id=item_id)
                item_name = item_name or item.name
            except Item.DoesNotExist:
                pass
        qty = float(data.get('quantity_needed', 1))
        mj = data.get('mj', 'ks')
        bom_item = BOMItem.objects.create(
            project=project,
            item=item,
            item_name=item_name,
            quantity_needed=qty,
            mj=mj,
            notes=data.get('notes', ''),
        )
        # Auto-create or update OrderNeed if needed
        if item:
            avail = float(item.quantity)
            deficit = max(0, qty - avail)
            if deficit > 0:
                # Check if OrderNeed already exists for this item
                existing = OrderNeed.objects.filter(item=item, status__in=['pending', 'ordered', 'partial']).first()
                if existing:
                    existing.total_qty_needed = float(existing.total_qty_needed) + deficit
                    existing.save()
                    order_need = existing
                else:
                    order_need = OrderNeed.objects.create(
                        item=item,
                        item_name=item_name,
                        total_qty_needed=deficit,
                        mj=mj,
                        order_number=OrderNeed.generate_order_number(),
                    )
                OrderNeedProject.objects.create(
                    order_need=order_need,
                    project=project,
                    bom_item=bom_item,
                    quantity=deficit,
                )
        elif not item:
            # No stock item - always create order need
            order_need = OrderNeed.objects.create(
                item=None,
                item_name=item_name,
                total_qty_needed=qty,
                mj=mj,
                order_number=OrderNeed.generate_order_number(),
            )
            OrderNeedProject.objects.create(
                order_need=order_need,
                project=project,
                bom_item=bom_item,
                quantity=qty,
            )
        return Response(BOMItemSerializer(bom_item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='bom/(?P<bom_id>[^/.]+)')
    def bom_delete(self, request, pk=None, bom_id=None):
        project = self.get_object()
        try:
            bom_item = BOMItem.objects.get(id=bom_id, project=project)
            bom_item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except BOMItem.DoesNotExist:
            return Response({'error': 'BOM položka nenájdená'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'])
    def margin(self, request, pk=None):
        project = self.get_object()
        # Revenue: sum of invoice totals
        invoice_revenue = sum(float(inv.total) for inv in project.invoices.all())
        # Rental revenue: accrued from open movements
        from datetime import date
        rental_revenue = 0
        for mv in RentalMovement.objects.filter(project=project).select_related('rental_item'):
            end = mv.date_in if mv.date_in else date.today()
            days = max(1, (end - mv.date_out).days)
            rental_revenue += days * float(mv.quantity) * float(mv.rental_item.daily_rate)
        total_revenue = invoice_revenue + rental_revenue
        # Cost: sum of (qty * avg_purchase_price) for items in delivery notes of this project
        cost = 0
        for dn in project.delivery_notes.filter(type='standard').prefetch_related('items__item'):
            for dni in dn.items.all():
                if dni.item:
                    cost += float(dni.quantity) * float(dni.item.avg_purchase_price)
        margin_net = total_revenue - cost
        margin_pct = round((margin_net / total_revenue * 100), 1) if total_revenue > 0 else 0
        return Response({
            'invoice_revenue': round(invoice_revenue, 2),
            'rental_revenue': round(rental_revenue, 2),
            'total_revenue': round(total_revenue, 2),
            'total_cost': round(cost, 2),
            'margin_net': round(margin_net, 2),
            'margin_pct': margin_pct,
        })


class RentalItemViewSet(viewsets.ModelViewSet):
    queryset = RentalItem.objects.all().order_by('name')
    serializer_class = RentalItemSerializer
    permission_classes = [permissions.AllowAny]


class BOMItemViewSet(viewsets.ModelViewSet):
    queryset = BOMItem.objects.all().order_by('-created_at')
    serializer_class = BOMItemSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'])
    def deficits(self, request):
        """Zoznam všetkých deficitov zo všetkých otvorených zákaziek, zoskupený podľa položky."""
        bom_items = (
            BOMItem.objects
            .filter(project__status='open')
            .select_related('project', 'item')
            .order_by('item_name')
        )

        # Zoskupenie podľa item_id (alebo item_name pre manuálne položky)
        from collections import defaultdict
        groups = defaultdict(lambda: {
            'item_id': None, 'item_name': '', 'sku': '',
            'stock_qty': None, 'mj': 'ks',
            'total_needed': 0.0, 'projects': [],
        })

        for bom in bom_items:
            key = str(bom.item_id) if bom.item_id else f'__{bom.item_name}'
            g = groups[key]
            g['item_id'] = bom.item_id
            g['item_name'] = bom.item_name
            g['sku'] = bom.item.sku if bom.item else ''
            g['stock_qty'] = float(bom.item.quantity) if bom.item else None
            g['mj'] = bom.mj
            g['total_needed'] += float(bom.quantity_needed)
            g['projects'].append({
                'project_id': bom.project_id,
                'project_number': bom.project.project_number or '',
                'project_name': bom.project.name,
                'quantity_needed': float(bom.quantity_needed),
            })

        result = []
        for g in groups.values():
            stock = g['stock_qty'] if g['stock_qty'] is not None else 0.0
            deficit = max(0.0, g['total_needed'] - stock)
            if deficit > 0:
                result.append({**g, 'deficit': round(deficit, 3)})

        result.sort(key=lambda x: -x['deficit'])
        return Response(result)


class OrderNeedViewSet(viewsets.ModelViewSet):
    queryset = OrderNeed.objects.exclude(status='done').order_by('-created_at')
    serializer_class = OrderNeedSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = OrderNeed.objects.order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=False, methods=['post'])
    def receive_delivery(self, request):
        """
        Receive a stock delivery. Creates StockDelivery + items, updates Item.quantity,
        avg_purchase_price, OrderNeed.qty_received, and returns a picking list.
        """
        data = request.data
        items_data = data.get('items', [])
        if not items_data:
            return Response({'error': 'Žiadne položky'}, status=status.HTTP_400_BAD_REQUEST)

        partner_id = data.get('supplier_id')
        supplier = None
        if partner_id:
            try:
                supplier = Partner.objects.get(id=partner_id)
            except Partner.DoesNotExist:
                pass

        with transaction.atomic():
            delivery = StockDelivery.objects.create(
                supplier=supplier,
                supplier_name=data.get('supplier_name', supplier.name if supplier else ''),
                supplier_invoice_number=data.get('supplier_invoice_number', ''),
                delivery_date=data.get('delivery_date', datetime.now().date()),
                notes=data.get('notes', ''),
            )

            picking_list = []

            for row in items_data:
                item_id = row.get('item_id')
                order_need_id = row.get('order_need_id')
                qty_received = float(row.get('quantity_received', 0))
                purchase_price = float(row.get('purchase_price', 0))
                item_name = row.get('item_name', '')
                mj = row.get('mj', 'ks')

                item = None
                order_need = None

                if item_id:
                    try:
                        item = Item.objects.get(id=item_id)
                    except Item.DoesNotExist:
                        pass

                if order_need_id:
                    try:
                        order_need = OrderNeed.objects.get(id=order_need_id)
                    except OrderNeed.DoesNotExist:
                        pass

                target_stock = row.get('target_stock', 'sale')
                rental_item_target_id = row.get('rental_item_target_id')

                StockDeliveryItem.objects.create(
                    delivery=delivery,
                    item=item,
                    order_need=order_need,
                    item_name=item_name or (item.name if item else ''),
                    quantity_received=qty_received,
                    purchase_price=purchase_price,
                    mj=mj,
                    target_stock=target_stock,
                )

                # Update stock based on target
                if target_stock == 'rental':
                    # Route to Požičovňa stock
                    r_target = None
                    if rental_item_target_id:
                        try:
                            r_target = RentalItem.objects.get(id=rental_item_target_id)
                        except RentalItem.DoesNotExist:
                            pass
                    if r_target:
                        r_target.total_qty = float(r_target.total_qty) + qty_received
                        r_target.save()
                elif item:
                    # Route to classic Sklad (sale)
                    old_qty = float(item.quantity)
                    old_avg = float(item.avg_purchase_price)
                    new_total_value = (old_qty * old_avg) + (qty_received * purchase_price)
                    new_total_qty = old_qty + qty_received
                    item.quantity = new_total_qty
                    item.avg_purchase_price = (new_total_value / new_total_qty) if new_total_qty > 0 else purchase_price
                    item.save()
                    StockMovement.objects.create(
                        item=item,
                        quantity=qty_received,
                        movement_type='IN',
                        source_type='MANUAL',
                        note=f"Príjem dodávky – {delivery.supplier_name or ''} č. {delivery.supplier_invoice_number or ''}",
                    )

                # Update OrderNeed
                if order_need:
                    order_need.qty_received = float(order_need.qty_received) + qty_received
                    remaining = float(order_need.total_qty_needed) - float(order_need.qty_received)
                    if remaining <= 0:
                        order_need.status = 'done'
                    elif float(order_need.qty_received) > 0:
                        order_need.status = 'partial'
                    order_need.save()

                    # Build picking list for this item
                    item_picking = {
                        'item_name': item_name or (item.name if item else ''),
                        'qty_received': qty_received,
                        'mj': mj,
                        'project_allocations': [],
                        'free_stock': 0,
                    }
                    allocated = 0
                    for share in order_need.project_shares.select_related('project').all():
                        alloc_qty = min(float(share.quantity), qty_received - allocated)
                        if alloc_qty > 0:
                            item_picking['project_allocations'].append({
                                'project_name': share.project.name,
                                'project_number': share.project.project_number,
                                'quantity': round(alloc_qty, 3),
                                'mj': mj,
                            })
                            allocated += alloc_qty
                    item_picking['free_stock'] = round(max(0, qty_received - allocated), 3)
                    picking_list.append(item_picking)
                else:
                    picking_list.append({
                        'item_name': item_name or (item.name if item else ''),
                        'qty_received': qty_received,
                        'mj': mj,
                        'project_allocations': [],
                        'free_stock': qty_received,
                    })

            return Response({
                'delivery_id': delivery.id,
                'delivery_date': str(delivery.delivery_date),
                'picking_list': picking_list,
            }, status=status.HTTP_201_CREATED)


class StockDeliveryViewSet(viewsets.ModelViewSet):
    queryset = StockDelivery.objects.all().order_by('-created_at')
    serializer_class = StockDeliverySerializer
    permission_classes = [permissions.AllowAny]


class SentOrderViewSet(viewsets.ModelViewSet):
    queryset = SentOrder.objects.all().order_by('-created_at')
    serializer_class = SentOrderSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        data = request.data
        items_data = data.get('items', [])

        # Resolve supplier partner
        partner_data = data.get('partner') or {}
        supplier = None
        supplier_name = data.get('supplier_name', partner_data.get('name', ''))
        if partner_data.get('ico'):
            supplier, _ = Partner.objects.get_or_create(
                ico=partner_data['ico'],
                defaults={
                    'name': partner_data.get('name', ''),
                    'dic': partner_data.get('dic', ''),
                    'street': partner_data.get('street', ''),
                    'city': partner_data.get('city', ''),
                    'zip_code': partner_data.get('zip', ''),
                }
            )
            supplier_name = partner_data.get('name', supplier.name)
        elif data.get('supplier_id'):
            try:
                supplier = Partner.objects.get(id=data['supplier_id'])
                supplier_name = supplier.name
            except Partner.DoesNotExist:
                pass

        # Resolve project
        project = None
        if data.get('project_id'):
            try:
                project = Project.objects.get(id=data['project_id'])
            except Project.DoesNotExist:
                pass

        with transaction.atomic():
            sent_order = SentOrder.objects.create(
                order_number=SentOrder.generate_order_number(),
                supplier=supplier,
                supplier_name=supplier_name,
                project=project,
                notes=data.get('notes', ''),
                status='sent',
                expected_date=data.get('expected_date') or None,
            )

            for row in items_data:
                item_id = row.get('item_id')
                rental_item_id = row.get('rental_item_id')
                item = None
                rental_item = None
                if item_id:
                    try:
                        item = Item.objects.get(id=item_id)
                    except Item.DoesNotExist:
                        pass
                if rental_item_id:
                    try:
                        rental_item = RentalItem.objects.get(id=rental_item_id)
                    except RentalItem.DoesNotExist:
                        pass
                item_name = row.get('item_name', '') or (item.name if item else '') or (rental_item.name if rental_item else '')
                SentOrderItem.objects.create(
                    sent_order=sent_order,
                    item=item,
                    rental_item=rental_item,
                    item_name=item_name,
                    quantity=float(row.get('quantity', 1)),
                    mj=row.get('mj', 'ks'),
                    unit_price=float(row.get('unit_price', 0)),
                    vat_rate=int(row.get('vat_rate', 20)),
                )

        serializer = self.get_serializer(sent_order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from datetime import date as _date
        from django.db.models import Sum, F as Fdb

        # 1. Celkový obrat: suma všetkých faktúr (bez DPH)
        invoice_total = InvoiceItem.objects.aggregate(
            t=Sum(Fdb('quantity') * Fdb('unit_price'))
        )['t'] or 0

        # 2. Reálny zisk: obrat - nákupné náklady (z StockDelivery príjmov)
        purchase_costs = StockDeliveryItem.objects.aggregate(
            t=Sum(Fdb('quantity_received') * Fdb('purchase_price'))
        )['t'] or 0
        real_profit = float(invoice_total) - float(purchase_costs)

        # 3. Hodnota v prenájme: suma otvorených pohybov (qty * daily_rate * dni)
        rental_value = 0.0
        today = _date.today()
        for mv in RentalMovement.objects.filter(date_in__isnull=True).select_related('rental_item'):
            days = max(0, (today - mv.date_out).days)
            rental_value += float(mv.quantity) * float(mv.rental_item.daily_rate) * days

        # 4. Hodnota skladu v nákupe: suma (qty * avg_purchase_price)
        stock_value = sum(
            float(it.quantity) * float(it.avg_purchase_price)
            for it in Item.objects.all()
        )

        return Response({
            'total_turnover': round(float(invoice_total), 2),
            'real_profit': round(real_profit, 2),
            'rental_value': round(rental_value, 2),
            'stock_purchase_value': round(stock_value, 2),
        })

    @action(detail=True, methods=['post'])
    def upload_attachment(self, request, pk=None):
        sent_order = self.get_object()
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': 'Žiadny súbor'}, status=status.HTTP_400_BAD_REQUEST)
        attachment = SentOrderAttachment.objects.create(
            sent_order=sent_order,
            file=uploaded_file,
            original_name=uploaded_file.name,
            file_size=uploaded_file.size,
        )
        serializer = SentOrderAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='attachments/(?P<att_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, att_id=None):
        sent_order = self.get_object()
        try:
            att = SentOrderAttachment.objects.get(id=att_id, sent_order=sent_order)
            att.file.delete(save=False)
            att.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except SentOrderAttachment.DoesNotExist:
            return Response({'error': 'Nenájdené'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Mark items as received and route to appropriate stock."""
        sent_order = self.get_object()
        items_data = request.data.get('items', [])

        with transaction.atomic():
            for row in items_data:
                item_id = row.get('sent_order_item_id')
                qty_recv = float(row.get('quantity_received', 0))
                purchase_price = float(row.get('purchase_price', 0))
                target_stock = row.get('target_stock', 'sale')
                rental_target_id = row.get('rental_item_target_id')

                if qty_recv <= 0:
                    continue
                try:
                    so_item = SentOrderItem.objects.get(id=item_id, sent_order=sent_order)
                except SentOrderItem.DoesNotExist:
                    continue

                so_item.qty_received = float(so_item.qty_received) + qty_recv
                so_item.save()

                if target_stock == 'rental' and rental_target_id:
                    try:
                        r_item = RentalItem.objects.get(id=rental_target_id)
                        r_item.total_qty = float(r_item.total_qty) + qty_recv
                        r_item.save()
                    except RentalItem.DoesNotExist:
                        pass
                elif target_stock == 'sale' and so_item.item:
                    stock_item = so_item.item
                    old_qty = float(stock_item.quantity)
                    old_avg = float(stock_item.avg_purchase_price)
                    new_total = (old_qty * old_avg) + (qty_recv * purchase_price)
                    new_qty = old_qty + qty_recv
                    stock_item.quantity = new_qty
                    stock_item.avg_purchase_price = (new_total / new_qty) if new_qty > 0 else purchase_price
                    stock_item.save()
                    StockMovement.objects.create(
                        item=stock_item,
                        quantity=qty_recv,
                        movement_type='IN',
                        source_type='MANUAL',
                        note=f"Príjem OO {sent_order.order_number}",
                    )

            # Update sent_order status
            all_items = sent_order.items.all()
            if all_items.exists():
                all_received = all(float(i.qty_received) >= float(i.quantity) for i in all_items)
                any_received = any(float(i.qty_received) > 0 for i in all_items)
                if all_received:
                    sent_order.status = 'done'
                elif any_received:
                    sent_order.status = 'partial'
                sent_order.save()

        serializer = self.get_serializer(sent_order)
        return Response(serializer.data)