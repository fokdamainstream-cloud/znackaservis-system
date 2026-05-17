from django.contrib import admin
from .models import Item, StockMovement, Partner, Invoice, InvoiceItem, Quotation, QuotationItem

class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 1
    fields = ['item', 'quantity', 'unit_price', 'discount_percent', 'discount_amount', 'total_price']
    raw_id_fields = ['item']

class QuotationAdmin(admin.ModelAdmin):
    inlines = [QuotationItemInline]
    list_display = ['quotation_number', 'partner', 'created_at', 'valid_until', 'status', 'total']
    list_filter = ['status', 'created_at']
    search_fields = ['quotation_number', 'partner__name', 'partner__ico']
    readonly_fields = ['quotation_number', 'created_at', 'subtotal', 'discount_total', 'vat_amount', 'total']
    
    fieldsets = (
        ('Základné údaje', {
            'fields': ('quotation_number', 'partner', 'valid_until', 'status', 'notes')
        }),
        ('Nastavenia DPH a zliav', {
            'fields': ('vat_rate', 'is_vat_payer', 'discount_percent', 'discount_amount')
        }),
        ('Súhrn', {
            'fields': ('subtotal', 'discount_total', 'vat_amount', 'total'),
            'classes': ('collapse',)
        }),
    )

class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1
    fields = ['item', 'quantity', 'unit_price', 'discount_percent', 'discount_amount', 'total_price']
    raw_id_fields = ['item']

class InvoiceAdmin(admin.ModelAdmin):
    inlines = [InvoiceItemInline]
    list_display = ['invoice_number', 'partner', 'created_at', 'due_date', 'total']
    search_fields = ['invoice_number', 'partner__name', 'partner__ico']
    readonly_fields = ['invoice_number', 'delivery_note', 'created_at', 'subtotal', 'discount_total', 'vat_amount', 'total']

class PartnerAdmin(admin.ModelAdmin):
    list_display = ['name', 'ico', 'city', 'default_discount_percent', 'default_discount_active']
    search_fields = ['name', 'ico']

admin.site.register(Item)
admin.site.register(StockMovement)
admin.site.register(Partner, PartnerAdmin)
admin.site.register(Invoice, InvoiceAdmin)
admin.site.register(InvoiceItem)
admin.site.register(Quotation, QuotationAdmin)
admin.site.register(QuotationItem)