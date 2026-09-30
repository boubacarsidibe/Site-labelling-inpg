from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from .access import capabilities
from .models import AccessProfile

@api_view(['GET'])
def assignable_users(request):
    if 'applications.assign' not in capabilities(request.user):
        raise PermissionDenied('Vous ne pouvez pas affecter de dossiers.')
    users=AccessProfile.objects.filter(role__in=['EVALUATOR','AUDITOR'],user__is_active=True).select_related('user').order_by('role','user__username')
    return Response([{'id':item.user_id,'username':item.user.username,'role':item.role} for item in users])
