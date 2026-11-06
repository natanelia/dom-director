"""Keep release claims tied to inspectable contracts, not design-only completion."""
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class ReleaseCandidateTests(unittest.TestCase):
    def test_packages_remain_private_and_candidate_versions_match(self):
        core=json.loads((ROOT/'packages/core/package.json').read_text())
        react=json.loads((ROOT/'packages/react/package.json').read_text())
        status=json.loads((ROOT/'docs/implementation-status.json').read_text())
        self.assertTrue(core['private']);self.assertTrue(react['private'])
        self.assertEqual(core['version'],react['version']);self.assertEqual(core['version'],status['packageCandidate'])
        self.assertFalse(status['npmPublished'])
    def test_manual_and_optional_gates_are_not_marked_certified(self):
        status=json.loads((ROOT/'docs/implementation-status.json').read_text())
        self.assertEqual([m['id'] for m in status['milestones']],[f'M{i}' for i in range(7)])
        self.assertGreaterEqual(len(status['manualGates']),5)
        self.assertIn('Video export',status['optionalDeferred'])
        self.assertNotEqual(status['milestones'][-1]['status'],'certified')
    def test_performance_summary_preserves_method_and_provenance(self):
        evidence=json.loads((ROOT/'docs/evidence/performance.json').read_text())
        self.assertTrue(evidence['complete']);self.assertTrue(evidence['budgetMet'])
        self.assertEqual(evidence['cleanup']['cycles'],100)
        self.assertEqual(len(evidence['testedCommit']),40)
        self.assertEqual(len(evidence['rawResultsSha256']),64)
        self.assertEqual(evidence['method']['measuredRuns'],20)
        self.assertIn('paint',evidence['method']['excluded'])
        self.assertEqual(len(evidence['workloads']),3)
if __name__=='__main__':unittest.main(verbosity=2)
