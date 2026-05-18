import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path


def load_module():
    script_path = Path(__file__).resolve().parents[2] / "scripts" / "migrate-hermes-state-to-d1.py"
    sys.modules.setdefault("httpx", types.SimpleNamespace(Client=object))
    spec = importlib.util.spec_from_file_location("migrate_hermes_state_to_d1", script_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class CollectScoutTests(unittest.TestCase):
    def test_collect_scout_uses_creative_id_as_hash_and_payload_field(self):
        module = load_module()

        with tempfile.TemporaryDirectory() as tmpdir:
            state_dir = Path(tmpdir)
            scout_dir = state_dir / "scout-state"
            scout_dir.mkdir(parents=True)
            (scout_dir / "snapshots.json").write_text(json.dumps({
                "figloans.com": {
                    "creatives": {
                        "CR123": {
                            "title": "Fig Loans Login",
                            "url": "https://www.figloans.com/login",
                            "format": "text",
                        }
                    }
                }
            }))

            rows = module.collect_scout(state_dir)

        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["agent"], "SCOUT")
        self.assertEqual(row["scope"], "figloans.com")
        self.assertEqual(row["fingerprint_key"], "CR123")
        self.assertEqual(row["fingerprint_hash"], "CR123")
        self.assertEqual(row["payload"]["creative_id"], "CR123")
        self.assertEqual(row["payload"]["title"], "Fig Loans Login")


if __name__ == "__main__":
    unittest.main()
