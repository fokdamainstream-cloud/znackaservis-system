from rest_framework import serializers
from .models import Item, Invoice, InvoiceItem, Partner, Quotation, QuotationItem, DeliveryNote, DeliveryNoteItem, Project, RentalItem, RentalMovement, BOMItem, OrderNeed, OrderNeedProject, StockDelivery, StockDeliveryItem, SentOrder, SentOrderItem, SentOrderAttachment

class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = '__all__'

class PartnerSerializer(serializers.ModelSerializer):
    full_address = serializers.SerializerMethodField()

    class Meta:
        model = Partner
        fields = ['id', 'name', 'ico', 'dic', 'ic_dph', 'street', 'city', 'zip_code',
                  'default_discount_percent', 'default_discount_active', 'full_address']

    def get_full_address(self, obj):
        if obj.street and obj.zip_code and obj.city:
            return f"{obj.street}, {obj.zip_code} {obj.city}"
        return obj.city or ""

class InvoiceItemSerializer(serializers.ModelSerializer):
    item_name = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceItem
        fields = ['id', 'item', 'item_name', 'description', 'mj', 'quantity', 'unit_price',
                  'discount_percent', 'discount_amount', 'total_price',
                  'vat_rate', 'unit_price_with_vat', 'total_with_vat']

    def get_item_name(self, obj):
        if obj.item:
            return obj.item.name
        return obj.description or ''

class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    partner_detail = PartnerSerializer(source='partner', read_only=True)
    # FK má prednosť; ak nie je, použije sa uložený textový field
    partner_name = serializers.SerializerMethodField()
    partner_ico = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'

    def get_partner_name(self, obj):
        return obj.partner.name if obj.partner_id else obj.partner_name or ''

    def get_partner_ico(self, obj):
        return obj.partner.ico if obj.partner_id else obj.partner_ico or ''

class QuotationItemSerializer(serializers.ModelSerializer):
    item_name = serializers.SerializerMethodField()

    class Meta:
        model = QuotationItem
        fields = ['id', 'item', 'item_name', 'description', 'mj', 'quantity', 'unit_price',
                  'discount_percent', 'discount_amount', 'total_price',
                  'vat_rate', 'unit_price_with_vat', 'total_with_vat']

    def get_item_name(self, obj):
        if obj.item:
            return obj.item.name
        return obj.description or ''

class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, read_only=True)
    partner_detail = PartnerSerializer(source='partner', read_only=True)
    partner_name = serializers.SerializerMethodField()
    partner_ico = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = '__all__'

    def get_partner_name(self, obj):
        return obj.partner.name if obj.partner_id else obj.partner_name or ''

    def get_partner_ico(self, obj):
        return obj.partner.ico if obj.partner_id else obj.partner_ico or ''

class DeliveryNoteItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryNoteItem
        fields = ['id', 'item', 'rental_item', 'item_name', 'quantity', 'mj', 'pos', 'unit_price',
                  'is_complete_set', 'minus_stand', 'minus_pole', 'minus_clamps']

class DeliveryNoteSerializer(serializers.ModelSerializer):
    items = DeliveryNoteItemSerializer(many=True, read_only=True)
    partner_detail = PartnerSerializer(source='partner', read_only=True)
    partner_name = serializers.SerializerMethodField()
    partner_ico = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()

    def get_project_name(self, obj):
        return obj.project.name if obj.project_id else ''

    class Meta:
        model = DeliveryNote
        fields = '__all__'

    def get_partner_name(self, obj):
        return obj.partner.name if obj.partner_id else obj.partner_name or ''

    def get_partner_ico(self, obj):
        return obj.partner.ico if obj.partner_id else obj.partner_ico or ''


class ProjectSerializer(serializers.ModelSerializer):
    partner_detail = PartnerSerializer(source='partner', read_only=True)
    invoice_count = serializers.SerializerMethodField()
    quotation_count = serializers.SerializerMethodField()
    delivery_note_count = serializers.SerializerMethodField()
    has_active_rental = serializers.SerializerMethodField()
    has_sales = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'

    def get_invoice_count(self, obj):
        return obj.invoices.count()

    def get_quotation_count(self, obj):
        return obj.quotations.count()

    def get_delivery_note_count(self, obj):
        return obj.delivery_notes.count()

    def get_has_active_rental(self, obj):
        return obj.rental_movements.filter(date_in__isnull=True).exists()

    def get_has_sales(self, obj):
        return obj.delivery_notes.filter(type='standard').exists() or obj.invoices.exists()


class RentalItemSerializer(serializers.ModelSerializer):
    available_qty = serializers.SerializerMethodField()

    class Meta:
        model = RentalItem
        fields = '__all__'

    def get_available_qty(self, obj):
        return float(obj.total_qty) - float(obj.rented_qty)


class RentalMovementSerializer(serializers.ModelSerializer):
    rental_item_name = serializers.CharField(source='rental_item.name', read_only=True)
    rental_item_daily_rate = serializers.DecimalField(source='rental_item.daily_rate', max_digits=10, decimal_places=2, read_only=True)
    days = serializers.SerializerMethodField()

    class Meta:
        model = RentalMovement
        fields = '__all__'

    def get_days(self, obj):
        from datetime import date
        end = obj.date_in if obj.date_in else date.today()
        return max(0, (end - obj.date_out).days)


class BOMItemSerializer(serializers.ModelSerializer):
    item_detail = serializers.SerializerMethodField()
    stock_qty = serializers.SerializerMethodField()

    class Meta:
        model = BOMItem
        fields = '__all__'

    def get_item_detail(self, obj):
        if obj.item:
            return {'id': obj.item.id, 'name': obj.item.name, 'sku': obj.item.sku}
        return None

    def get_stock_qty(self, obj):
        if obj.item:
            return float(obj.item.quantity)
        return None


class OrderNeedProjectSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    project_number = serializers.CharField(source='project.project_number', read_only=True)

    class Meta:
        model = OrderNeedProject
        fields = '__all__'


class OrderNeedSerializer(serializers.ModelSerializer):
    project_shares = OrderNeedProjectSerializer(many=True, read_only=True)
    remaining_qty = serializers.SerializerMethodField()
    item_detail = serializers.SerializerMethodField()

    class Meta:
        model = OrderNeed
        fields = '__all__'

    def get_remaining_qty(self, obj):
        return max(0, float(obj.total_qty_needed) - float(obj.qty_received))

    def get_item_detail(self, obj):
        if obj.item:
            return {'id': obj.item.id, 'name': obj.item.name, 'sku': obj.item.sku,
                    'quantity': float(obj.item.quantity), 'unit_price': float(obj.item.unit_price)}
        return None


class StockDeliveryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockDeliveryItem
        fields = '__all__'


class StockDeliverySerializer(serializers.ModelSerializer):
    items = StockDeliveryItemSerializer(many=True, read_only=True)
    supplier_detail = PartnerSerializer(source='supplier', read_only=True)

    class Meta:
        model = StockDelivery
        fields = '__all__'


class SentOrderItemSerializer(serializers.ModelSerializer):
    item_detail = serializers.SerializerMethodField()
    remaining_qty = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = SentOrderItem
        fields = '__all__'

    def get_item_detail(self, obj):
        if obj.item:
            return {'id': obj.item.id, 'name': obj.item.name, 'sku': obj.item.sku,
                    'sign_code': obj.item.sign_code, 'sign_name_sk': obj.item.sign_name_sk}
        if obj.rental_item:
            return {'id': obj.rental_item.id, 'name': obj.rental_item.name, 'sku': obj.rental_item.sku,
                    'sign_code': obj.rental_item.sign_code, 'sign_name_sk': obj.rental_item.sign_name_sk}
        return None

    def get_remaining_qty(self, obj):
        return max(0, float(obj.quantity) - float(obj.qty_received))

    def get_line_total(self, obj):
        return round(float(obj.quantity) * float(obj.unit_price), 2)


class SentOrderAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = SentOrderAttachment
        fields = ['id', 'original_name', 'file_size', 'uploaded_at', 'file_url']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None


class SentOrderSerializer(serializers.ModelSerializer):
    items = SentOrderItemSerializer(many=True, read_only=True)
    attachments = SentOrderAttachmentSerializer(many=True, read_only=True)
    supplier_detail = PartnerSerializer(source='supplier', read_only=True)
    project_detail = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()
    received_count = serializers.SerializerMethodField()
    total_value = serializers.SerializerMethodField()
    received_pct = serializers.SerializerMethodField()

    class Meta:
        model = SentOrder
        fields = '__all__'

    def get_project_detail(self, obj):
        if obj.project:
            return {'id': obj.project.id, 'name': obj.project.name,
                    'project_number': obj.project.project_number}
        return None

    def get_items_count(self, obj):
        return obj.items.count()

    def get_received_count(self, obj):
        return sum(1 for item in obj.items.all() if float(item.qty_received) >= float(item.quantity))

    def get_total_value(self, obj):
        return round(sum(float(i.quantity) * float(i.unit_price) for i in obj.items.all()), 2)

    def get_received_pct(self, obj):
        items = obj.items.all()
        if not items:
            return 0
        total = sum(float(i.quantity) for i in items)
        received = sum(float(i.qty_received) for i in items)
        return round((received / total * 100) if total > 0 else 0, 1)
