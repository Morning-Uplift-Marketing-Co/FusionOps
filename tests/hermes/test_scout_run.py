import sys
import types
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "hermes-agents"))
sys.modules.setdefault("requests", types.SimpleNamespace())
from SCOUT.run import SCOUTAdCopyIntel  # noqa: E402


class ScoutReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.scout = SCOUTAdCopyIntel.__new__(SCOUTAdCopyIntel)

    def test_split_new_creatives_suppresses_signature_matches(self):
        prev = {
            "OLD1": {
                "creative_id": "OLD1",
                "advertiser_id": "ADV1",
                "title": "Fig Loans Login",
                "url": "https://www.figloans.com/login",
                "format": "text",
            }
        }
        current = {
            "NEW1": {
                "creative_id": "NEW1",
                "advertiser_id": "ADV1",
                "title": "Fig Loans Login",
                "url": "https://www.figloans.com/login",
                "format": "text",
            },
            "NEW2": {
                "creative_id": "NEW2",
                "advertiser_id": "ADV2",
                "title": "Apply for Fast Cash",
                "url": "https://www.figloans.com/apply",
                "format": "text",
            },
        }

        matched, true_new = self.scout._split_new_creatives(prev, current)

        self.assertEqual(matched, ["NEW1"])
        self.assertEqual(true_new, ["NEW2"])


if __name__ == "__main__":
    unittest.main()
