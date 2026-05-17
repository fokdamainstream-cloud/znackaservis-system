from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from inventory.views import ItemViewSet, InvoiceViewSet, PartnerViewSet, QuotationViewSet, DeliveryNoteViewSet, ProjectViewSet, RentalItemViewSet, BOMItemViewSet, OrderNeedViewSet, StockDeliveryViewSet, SentOrderViewSet
from django.conf import settings
from django.conf.urls.static import static

router = DefaultRouter()
router.register(r'items', ItemViewSet)
router.register(r'invoices', InvoiceViewSet)
router.register(r'partners', PartnerViewSet)
router.register(r'quotations', QuotationViewSet)
router.register(r'delivery-notes', DeliveryNoteViewSet)
router.register(r'projects', ProjectViewSet)
router.register(r'rental-items', RentalItemViewSet)
router.register(r'bom-items', BOMItemViewSet)
router.register(r'order-needs', OrderNeedViewSet)
router.register(r'stock-deliveries', StockDeliveryViewSet)
router.register(r'sent-orders', SentOrderViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api-auth/', include('rest_framework.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
