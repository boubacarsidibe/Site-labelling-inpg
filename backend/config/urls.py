from django.urls import include, path
# Aucun service public de /media : les pièces sont téléchargées via l'API, après contrôle des droits.
urlpatterns = [path('api/v1/', include('platform_api.urls'))]
