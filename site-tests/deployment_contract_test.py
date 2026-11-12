"""The remote manifest cannot broaden the public verification allowlist."""
import copy
import unittest
from deployed_smoke import validate_manifest, sha

class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.revision = 'a' * 40
        self.files = {'index.html':b'checked html', 'sdk/index.js':b'checked module'}
        self.audio = {'assets/voice.one.mp3'}
        self.manifest = {'revision':self.revision, 'runtime':'@dom-director/core', 'schemaVersion':'draft',
            'files':{**{name:sha(data) for name,data in self.files.items()}, 'assets/voice.one.mp3':'b'*64}}
    def check(self, value):
        return validate_manifest(value, self.revision, self.files, self.audio, 'draft')
    def test_exact_manifest_is_accepted(self):
        self.assertEqual(set(self.check(self.manifest)), set(self.files) | self.audio)
    def test_remote_manifest_cannot_replace_first_party_bytes(self):
        self.manifest['files']['sdk/index.js'] = 'c' * 64
        with self.assertRaises(ValueError):self.check(self.manifest)
    def test_no_missing_extra_or_traversal_paths(self):
        for path in ['../secret', 'https://example.test/remote', '/root', 'sdk/new.js']:
            value=copy.deepcopy(self.manifest);value['files'][path]='b'*64
            with self.assertRaises(ValueError):self.check(value)
        del self.manifest['files']['index.html']
        with self.assertRaises(ValueError):self.check(self.manifest)
    def test_revision_and_hash_format_are_strict(self):
        value=copy.deepcopy(self.manifest);value['revision']='d'*40
        with self.assertRaises(ValueError):self.check(value)
        for digest in [None, {}, 'bad', 'A'*64]:
            value=copy.deepcopy(self.manifest);value['files']['assets/voice.one.mp3']=digest
            with self.assertRaises(ValueError):self.check(value)

if __name__=='__main__':unittest.main(verbosity=2)
