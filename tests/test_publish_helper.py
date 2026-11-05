"""Local-only publishing helper checks. No GitHub calls or writes are made."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools/publish-github.sh"


@unittest.skipUnless(shutil.which("bash"), "Bash is unavailable on this host")
class PublishHelperTests(unittest.TestCase):
    def run_script(self, *args):
        return subprocess.run(["bash", str(SCRIPT), *args], cwd=ROOT,
                              capture_output=True, text=True, timeout=5)

    def test_shell_syntax(self):
        result = subprocess.run(["bash", "-n", str(SCRIPT)], capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_explicit_arguments_required(self):
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Usage:", result.stderr)

    def test_invalid_repository_rejected_before_external_calls(self):
        result = self.run_script("../../unrelated", "--public")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Expected OWNER/REPO", result.stderr)

    def test_visibility_must_be_explicit_allowed_value(self):
        result = self.run_script("natanelia/dom-director", "--guess")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Choose --public or --private", result.stderr)

    def test_extra_arguments_rejected(self):
        result = self.run_script("natanelia/dom-director", "--public", "--force")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Usage:", result.stderr)


if __name__ == "__main__":
    unittest.main()
