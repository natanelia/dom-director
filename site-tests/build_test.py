import importlib.util,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('build_site',ROOT/'tools/build_site.py');builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
class SiteBuildTests(unittest.TestCase):
    def test_template_uses_sdk_and_keeps_controls_outside_camera(self):
        html=builder.render_html((ROOT/'demo/src/index.html').read_text(),'/* local test CSS */','a'*40)
        self.assertIn('src="./app.mjs"',html);self.assertIn('id="sdk-overlay"',html)
        self.assertNotIn('/*__',html);self.assertNotIn('id="demo-cursor"',html)
        self.assertLess(html.index('id="toast"'),html.index('id="caption"'))
        self.assertIn('canonical SDK schema',html);self.assertIn('Original prototype',html)
    def test_unexpected_template_changes_fail_instead_of_silently_shipping(self):
        with self.assertRaises(ValueError):builder.render_html('<html></html>','', 'a'*40)
    def test_legacy_source_is_read_only(self):
        path=ROOT/'demo/src/index.html';before=path.read_bytes();builder.render_html(before.decode(),'','b'*40);self.assertEqual(path.read_bytes(),before)
if __name__=='__main__':unittest.main(verbosity=2)
