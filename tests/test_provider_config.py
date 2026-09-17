import os
import unittest
from datetime import datetime
from unittest.mock import patch

from Backend.database import schemas
from Backend.services import agent


class ProviderConfigTests(unittest.TestCase):
    def test_google_provider_is_active(self):
        self.assertEqual(agent.PROVIDER, "google")

    def test_google_key_is_used_when_present(self):
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "abc123", "ANTHROPIC_API_KEY": "ignored"}, clear=True):
            self.assertEqual(agent.get_api_key(), "abc123")

    def test_placeholder_is_rejected(self):
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "your-google-key-here"}, clear=True):
            self.assertFalse(agent.has_valid_api_key())

    def test_job_schema_accepts_application_date(self):
        payload = {
            "title": "Senior Engineer",
            "company": "Contoso",
            "url": "https://example.com/jobs/1",
            "date_applied": datetime(2025, 1, 15),
        }
        model = schemas.JobCreate(**payload)
        self.assertEqual(model.date_applied, datetime(2025, 1, 15))
