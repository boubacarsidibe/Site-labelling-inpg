from tempfile import TemporaryDirectory
from django.test import TestCase, override_settings


class TemporaryMediaTestCase(TestCase):
    """Keeps uploaded test files outside the development media directory."""

    @classmethod
    def setUpClass(cls):
        cls._media_directory = TemporaryDirectory()
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_directory.name)
        cls._media_override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        try:
            super().tearDownClass()
        finally:
            cls._media_override.disable()
            cls._media_directory.cleanup()
