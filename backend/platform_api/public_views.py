from django.http import JsonResponse
from django.views.decorators.http import require_GET
from rest_framework.exceptions import Throttled
from .auth_views import throttled
from .models import Certificate
from .serializers import CERT_LABELS
from .services import PUBLIC_LOOKUPS

@require_GET
def verify_certificate(request, number):
    """Vérification publique d'un certificat par son numéro (US-10). Ne révèle que les informations imprimées sur le certificat."""
    try:
        PUBLIC_LOOKUPS.check(request)
    except Throttled as exc:
        return throttled(exc)
    PUBLIC_LOOKUPS.hit(request)
    cert = Certificate.objects.select_related('application__organization').filter(number__iexact=number.strip()).first()
    if not cert:
        return JsonResponse({'detail': 'Aucun certificat ne porte ce numéro.'}, status=404)
    status = cert.effective_status
    return JsonResponse({'number': cert.number, 'organization': cert.application.organization.legal_name, 'level': cert.level, 'domains': cert.domains,
                         'issued_at': cert.issued_at.isoformat(), 'expires_at': cert.expires_at.isoformat() if cert.expires_at else None,
                         'status': status, 'status_label': CERT_LABELS.get(status, status), 'is_valid': status == 'VALID'})
