import os
import unittest
from unittest.mock import patch

from Backend import claude_agent


class ProviderConfigTests(unittest.TestCase):
    def test_google_provider_is_active(self):
        self.assertEqual(claude_agent.PROVIDER, "google")

    def test_google_key_is_used_when_present(self):
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "abc123", "ANTHROPIC_API_KEY": "ignored"}, clear=True):
            self.assertEqual(claude_agent.get_api_key(), "abc123")

    def test_placeholder_is_rejected(self):
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "your-google-key-here"}, clear=True):
            self.assertFalse(claude_agent.has_valid_api_key())
