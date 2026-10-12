from rest_framework.authentication import SessionAuthentication


class SessionAuth(SessionAuthentication):
    """Session Django, mais une requête non authentifiée reçoit 401 (et non 403) :
    l'interface distingue ainsi « session expirée » de « droits insuffisants »."""

    def authenticate_header(self, request):
        return 'Session'
