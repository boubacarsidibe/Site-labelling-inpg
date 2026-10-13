from django.urls import include, path
urlpatterns = [path('api/v1/', include('platform_api.urls'))]
