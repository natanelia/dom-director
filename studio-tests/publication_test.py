"""An explicit allowlist is the publication boundary, not every future source module."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('studio_builder', ROOT / 'tools/build_site.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class StudioPublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'site').mkdir()
        self.source = self.root / 'packages/studio/src'
        self.source.mkdir(parents=True)
        for name in builder.STUDIO_SITE_FILES:
            (self.root / 'site' / name).write_text('<head></head>' if name.endswith('.html') else '')
        for name in builder.STUDIO_MODULES:
            (self.source / name).write_text('export const example = true;\n')
        self.patcher = patch.object(builder, 'ROOT', self.root)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_internal_source_is_not_implicitly_published(self):
        (self.source / 'internal-only.js').write_text('DO_NOT_PUBLISH')
        files = builder.studio_files('a' * 40)
        self.assertEqual(set(files), set(builder.STUDIO_SITE_FILES) | {'studio-sdk/' + name for name in builder.STUDIO_MODULES})
        self.assertNotIn(b'DO_NOT_PUBLISH', files.values())

    def test_approved_module_cannot_import_an_unapproved_local_file(self):
        (self.source / 'internal-only.js').write_text('export default {};')
        for code in ["export {default} from './internal-only.js';", "import './internal-only.js';"]:
            with self.subTest(code=code):
                (self.source / 'index.js').write_text(code)
                with self.assertRaisesRegex(ValueError, 'Unexpected Studio dependency'):
                    builder.studio_files('a' * 40)

    def test_missing_approved_modules_fail_the_build(self):
        (self.source / 'editing.js').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing approved Studio module'):
            builder.studio_files('a' * 40)

    def test_dynamic_or_remote_imports_require_explicit_review(self):
        for code in ["export const module = import('./internal-only.js');", "import data from 'https://example.invalid/a.js';"]:
            with self.subTest(code=code):
                (self.source / 'index.js').write_text(code)
                with self.assertRaises(ValueError):
                    builder.studio_files('a' * 40)

    def test_symlinked_module_is_not_published(self):
        (self.source / 'index.js').unlink()
        (self.source / 'index.js').symlink_to(self.source / 'editing.js')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            builder.studio_files('a' * 40)

if __name__ == '__main__':
    unittest.main(verbosity=2)
