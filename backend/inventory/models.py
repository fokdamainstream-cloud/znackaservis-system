from django.db import models
from datetime import datetime

class Item(models.Model):
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=100, blank=True, verbose_name="Číslo položky (SKU)")
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    avg_purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    recommended_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Doporučená cena dodávateľa")
    sign_code = models.CharField(max_length=20, blank=True, verbose_name="Kód TP117 (napr. 506)")
    sign_name_sk = models.CharField(max_length=255, blank=True, verbose_name="Slovenský názov/skratka")
    dimensions = models.CharField(max_length=100, blank=True, verbose_name="Rozmery (napr. 600x600)")
    retroreflex_class = models.CharField(max_length=10, blank=True, choices=[('VRF1','VRF1'),('VRF2','VRF2'),('VRF7','VRF7 – s koľajnicou')], verbose_name="Trieda retroreflexie")

    def __str__(self):
        return f"{self.name} ({self.quantity} ks)"

class StockMovement(models.Model):
    MOVEMENT_TYPES = [('IN', 'Príjem'), ('OUT', 'Výdaj')]
    SOURCE_TYPES = [('MANUAL', 'Manuálny'), ('INVOICE', 'Faktúra'), ('QUOTATION', 'Cenová ponuka')]
    
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    movement_type = models.CharField(max_length=3, choices=MOVEMENT_TYPES)
    source_type = models.CharField(max_length=10, choices=SOURCE_TYPES)
    source_id = models.IntegerField(null=True, blank=True)
    created_by = models.CharField(max_length=150, null=True, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Partner(models.Model):
    name = models.CharField(max_length=255)
    ico = models.CharField(max_length=20, unique=True)
    dic = models.CharField(max_length=20, blank=True)
    ic_dph = models.CharField(max_length=20, blank=True)
    street = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    zip_code = models.CharField(max_length=20, blank=True)
    default_discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    default_discount_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.ico})"

VAT_RATES = [(23, '23%'), (20, '20%'), (10, '10%'), (0, '0%')]

class Invoice(models.Model):
    invoice_number = models.CharField(max_length=50, unique=True)
    delivery_note = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField()
    
    partner = models.ForeignKey(Partner, on_delete=models.SET_NULL, null=True, blank=True)

    # Textové zálohovanie partnera (aj bez FK)
    partner_name = models.CharField(max_length=255, blank=True)
    partner_ico = models.CharField(max_length=20, blank=True)
    partner_dic = models.CharField(max_length=20, blank=True)
    partner_address = models.CharField(max_length=500, blank=True)

    vat_rate = models.IntegerField(choices=VAT_RATES, default=23)
    is_vat_payer = models.BooleanField(default=True)

    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Fakturačné detaily
    payment_method = models.CharField(max_length=100, default='Bankový prevod', blank=True)
    customer_order_number = models.CharField(max_length=100, blank=True)
    date_of_supply = models.DateField(null=True, blank=True)
    place_of_supply = models.CharField(max_length=255, blank=True)
    job_number = models.CharField(max_length=100, blank=True)

    # Kontaktné údaje
    contact_person = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=50, blank=True)

    # Poznámky
    customer_note = models.TextField(blank=True)
    internal_note = models.TextField(blank=True)

    project = models.ForeignKey('Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')

    def __str__(self):
        return f"Faktúra {self.invoice_number}"

class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(Item, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.CharField(max_length=500, blank=True)
    mj = models.CharField(max_length=20, default='ks', blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    unit_price_with_vat = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_with_vat = models.DecimalField(max_digits=10, decimal_places=2, default=0)

class Quotation(models.Model):
    """Cenová ponuka"""
    quotation_number = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateField()
    
    partner = models.ForeignKey(Partner, on_delete=models.SET_NULL, null=True, blank=True)

    # Textové zálohovanie partnera (aj bez FK)
    partner_name = models.CharField(max_length=255, blank=True)
    partner_ico = models.CharField(max_length=20, blank=True)
    partner_dic = models.CharField(max_length=20, blank=True)
    partner_address = models.CharField(max_length=500, blank=True)

    vat_rate = models.IntegerField(choices=VAT_RATES, default=23)
    is_vat_payer = models.BooleanField(default=True)

    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    STATUS_CHOICES = [
        ('draft', 'Koncept'),
        ('sent', 'Odoslaná'),
        ('accepted', 'Akceptovaná'),
        ('rejected', 'Zamietnutá'),
        ('converted', 'Konvertovaná na faktúru')
    ]
    status = models.CharField(max_length=20, default='draft', choices=STATUS_CHOICES)
    
    converted_to_invoice = models.ForeignKey(Invoice, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)

    # Fakturačné detaily
    payment_method = models.CharField(max_length=100, default='Bankový prevod', blank=True)
    customer_order_number = models.CharField(max_length=100, blank=True)
    job_number = models.CharField(max_length=100, blank=True)
    place_of_supply = models.CharField(max_length=255, blank=True)

    # Kontaktné údaje
    contact_person = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=50, blank=True)

    # Poznámky pre zákazníka (notes už existuje ako interná)
    customer_note = models.TextField(blank=True)

    project = models.ForeignKey('Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='quotations')

    def __str__(self):
        return f"Ponuka {self.quotation_number}"

class QuotationItem(models.Model):
    """Položka cenovej ponuky - môže byť zo skladu alebo ručne zadaná"""
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(Item, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Položka zo skladu")
    description = models.CharField(max_length=500, blank=True, verbose_name="Popis položky (ručné zadanie)")
    mj = models.CharField(max_length=20, default='ks', blank=True, verbose_name="Merná jednotka")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Množstvo")
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Jednotková cena")
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name="Zľava %")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Zľava €")
    total_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Celkom bez DPH")
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name="Sadzba DPH %")
    unit_price_with_vat = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Cena s DPH")
    total_with_vat = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Celkom s DPH")

    def __str__(self):
        return self.description or (self.item.name if self.item else "Položka")

class Project(models.Model):
    STATUS_CHOICES = [
        ('open', 'Otvorená'),
        ('done', 'Dokončená'),
        ('invoiced', 'Fakturovaná'),
    ]
    name = models.CharField(max_length=255)
    partner = models.ForeignKey(Partner, on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')
    partner_name = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    project_number = models.CharField(max_length=30, unique=True, blank=True)
    customer_order_number = models.CharField(max_length=100, blank=True, verbose_name="Číslo objednávky zákazníka")

    @classmethod
    def generate_project_number(cls, year=None):
        from django.utils import timezone
        year = year or timezone.now().year
        last = cls.objects.filter(project_number__startswith='PO/', project_number__endswith=f'/{year}').order_by('-id').first()
        if last and last.project_number:
            try:
                num = int(last.project_number.split('/')[1]) + 1
            except Exception:
                num = 1
        else:
            num = 1
        return f"PO/{num:04d}/{year}"

    def __str__(self):
        return self.name

class RentalItem(models.Model):
    sku = models.CharField(max_length=100, blank=True)
    name = models.CharField(max_length=255)
    total_qty = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    rented_qty = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    daily_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    mj = models.CharField(max_length=20, default='ks', blank=True)
    description = models.TextField(blank=True)
    dimensions = models.CharField(max_length=100, blank=True)
    vrf_class = models.CharField(max_length=50, blank=True, verbose_name="Reflexná trieda VRF")
    sign_code = models.CharField(max_length=20, blank=True, verbose_name="Kód TP117 (napr. 506)")
    sign_name_sk = models.CharField(max_length=255, blank=True, verbose_name="Slovenský názov/skratka")
    retroreflex_class = models.CharField(max_length=10, blank=True, choices=[('VRF1','VRF1'),('VRF2','VRF2'),('VRF7','VRF7 – s koľajnicou')], verbose_name="Trieda retroreflexie")
    is_component = models.BooleanField(default=False, verbose_name="Je komponent zostáv (stĺpik/svorka/podstavec)")

    @property
    def available_qty(self):
        return float(self.total_qty) - float(self.rented_qty)

    def __str__(self):
        return f"{self.name} ({self.available_qty} dostupných)"

class DeliveryNote(models.Model):
    delivery_note_number = models.CharField(max_length=50, unique=True)
    invoice = models.OneToOneField('Invoice', null=True, blank=True, on_delete=models.SET_NULL, related_name='linked_delivery_note')
    partner = models.ForeignKey(Partner, on_delete=models.SET_NULL, null=True, blank=True)
    partner_name = models.CharField(max_length=255, blank=True)
    partner_ico = models.CharField(max_length=20, blank=True)
    partner_dic = models.CharField(max_length=20, blank=True)
    partner_address = models.CharField(max_length=500, blank=True)
    date = models.DateField(auto_now_add=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    type = models.CharField(
        max_length=20,
        choices=[('standard', 'Klasický výdaj'), ('rental_out', 'Výdaj do prenájmu'), ('rental_return', 'Vratka z prenájmu')],
        default='standard'
    )
    project = models.ForeignKey('Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_notes')
    customer_order_number = models.CharField(max_length=100, blank=True, verbose_name="Číslo objednávky zákazníka")

    def __str__(self):
        return f"Dodací list {self.delivery_note_number}"

class DeliveryNoteItem(models.Model):
    delivery_note = models.ForeignKey(DeliveryNote, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(Item, on_delete=models.SET_NULL, null=True, blank=True)
    item_name = models.CharField(max_length=500, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    mj = models.CharField(max_length=20, default='ks', blank=True)
    pos = models.PositiveIntegerField(default=1)
    rental_item = models.ForeignKey('RentalItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_items')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_complete_set = models.BooleanField(default=False)
    minus_stand = models.BooleanField(default=False)
    minus_pole = models.BooleanField(default=False)
    minus_clamps = models.BooleanField(default=False)

    def __str__(self):
        return self.item_name or (self.item.name if self.item else 'Položka')

class RentalMovement(models.Model):
    rental_item = models.ForeignKey(RentalItem, on_delete=models.CASCADE, related_name='movements')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='rental_movements')
    delivery_note_out = models.ForeignKey(DeliveryNote, on_delete=models.SET_NULL, null=True, blank=True, related_name='rental_out_movements')
    delivery_note_in = models.ForeignKey(DeliveryNote, on_delete=models.SET_NULL, null=True, blank=True, related_name='rental_in_movements')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    date_out = models.DateField()
    date_in = models.DateField(null=True, blank=True)
    is_complete_set = models.BooleanField(default=False)
    minus_stand = models.BooleanField(default=False)
    minus_pole = models.BooleanField(default=False)
    minus_clamps = models.BooleanField(default=False)
    contract_number = models.CharField(max_length=30, blank=True)

    @classmethod
    def generate_contract_number(cls, year=None):
        from django.utils import timezone
        year = year or timezone.now().year
        last = cls.objects.filter(contract_number__endswith=f'/{year}').exclude(contract_number='').order_by('-id').first()
        if last and last.contract_number:
            try:
                num = int(last.contract_number.split('/')[1]) + 1
            except Exception:
                num = 1
        else:
            num = 1
        return f"P/{num:04d}/{year}"

    def __str__(self):
        return f"{self.rental_item.name} x{self.quantity} od {self.date_out}"


class BOMItem(models.Model):
    """Potrebný materiál pre zákazku (BOM)"""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='bom_items')
    item = models.ForeignKey(Item, on_delete=models.SET_NULL, null=True, blank=True, related_name='bom_refs')
    item_name = models.CharField(max_length=255)
    quantity_needed = models.DecimalField(max_digits=10, decimal_places=2)
    mj = models.CharField(max_length=20, default='ks')
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, default='pending',
        choices=[('pending', 'Čaká'), ('ordered', 'Objednané'), ('received', 'Prijaté')])
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.item_name} x{self.quantity_needed} [{self.project.name}]"


class OrderNeed(models.Model):
    """Centralizovaná objednávka – kumuluje BOM zo zákaziek"""
    item = models.ForeignKey(Item, on_delete=models.SET_NULL, null=True, blank=True, related_name='order_needs')
    item_name = models.CharField(max_length=255)
    total_qty_needed = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    qty_received = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    mj = models.CharField(max_length=20, default='ks')
    status = models.CharField(max_length=20, default='pending',
        choices=[('pending', 'Čaká na objednanie'), ('ordered', 'Objednané'),
                 ('partial', 'Čiastočne prijaté'), ('done', 'Prijaté')])
    created_at = models.DateTimeField(auto_now_add=True)
    order_number = models.CharField(max_length=30, blank=True)

    @classmethod
    def generate_order_number(cls, year=None):
        from django.utils import timezone
        year = year or timezone.now().year
        last = cls.objects.filter(order_number__startswith='OO/', order_number__endswith=f'/{year}').order_by('-id').first()
        if last and last.order_number:
            try:
                num = int(last.order_number.split('/')[1]) + 1
            except Exception:
                num = 1
        else:
            num = 1
        return f"OO/{num:04d}/{year}"

    def __str__(self):
        return f"{self.item_name} (zostatok: {float(self.total_qty_needed) - float(self.qty_received)})"


class OrderNeedProject(models.Model):
    """Väzba OrderNeed na konkrétnu zákazku"""
    order_need = models.ForeignKey(OrderNeed, on_delete=models.CASCADE, related_name='project_shares')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='order_need_shares')
    bom_item = models.ForeignKey(BOMItem, on_delete=models.SET_NULL, null=True, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)


class StockDelivery(models.Model):
    """Príjem tovaru od dodávateľa"""
    supplier = models.ForeignKey(Partner, on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_deliveries')
    supplier_name = models.CharField(max_length=255, blank=True)
    supplier_invoice_number = models.CharField(max_length=100, blank=True)
    delivery_date = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Dodávka {self.delivery_date} – {self.supplier_name}"


class StockDeliveryItem(models.Model):
    """Položky v príjmovom doklade s nákupnou cenou"""
    delivery = models.ForeignKey(StockDelivery, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(Item, on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_receipts')
    order_need = models.ForeignKey(OrderNeed, on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_items')
    item_name = models.CharField(max_length=255)
    quantity_received = models.DecimalField(max_digits=10, decimal_places=2)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    mj = models.CharField(max_length=20, default='ks')
    target_stock = models.CharField(max_length=10, choices=[('sale','Predaj – klasický Sklad'),('rental','Požičovňa – Majetok')], default='sale')
    rental_item_target = models.ForeignKey('RentalItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_receipts_rental', verbose_name="Cieľová položka Požičovne")


class SentOrder(models.Model):
    """Odoslaná objednávka (OO) – manuálne vytvorená objednávka pre dodávateľa"""
    STATUS_CHOICES = [
        ('sent', 'Odoslaná – čaká na príjem'),
        ('partial', 'Čiastočne prijaté'),
        ('done', 'Prijaté'),
    ]
    order_number = models.CharField(max_length=30, unique=True, blank=True)
    supplier = models.ForeignKey(
        Partner, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_orders'
    )
    supplier_name = models.CharField(max_length=255, blank=True)
    project = models.ForeignKey(
        Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_orders'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sent')
    notes = models.TextField(blank=True)
    expected_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.order_number or 'OO?'} – {self.supplier_name}"

    @classmethod
    def generate_order_number(cls, year=None):
        from django.utils import timezone
        year = year or timezone.now().year
        last = cls.objects.filter(
            order_number__startswith='OO/',
            order_number__endswith=f'/{year}'
        ).order_by('-id').first()
        if last and last.order_number:
            try:
                num = int(last.order_number.split('/')[1]) + 1
            except Exception:
                num = 1
        else:
            num = 1
        return f"OO/{num:04d}/{year}"


class SentOrderItem(models.Model):
    """Položka odoslanej objednávky"""
    sent_order = models.ForeignKey(SentOrder, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(
        Item, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_order_refs'
    )
    rental_item = models.ForeignKey(
        'RentalItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_order_refs'
    )
    item_name = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    qty_received = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    mj = models.CharField(max_length=20, default='ks', blank=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vat_rate = models.IntegerField(default=20)

    def __str__(self):
        return f"{self.item_name} x{self.quantity}"


class SentOrderAttachment(models.Model):
    """Prílohy odoslanej objednávky (naskenované potvrdenky, dodáky)"""
    sent_order = models.ForeignKey(SentOrder, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='sent_order_attachments/')
    original_name = models.CharField(max_length=255, blank=True)
    file_size = models.IntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.original_name} [{self.sent_order.order_number}]"