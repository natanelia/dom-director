"""Run every focused Studio review journey before and after publication."""
import unittest
from gesture_test import StudioReviewTests
from canvas_test import StudioCanvasTests
from keyframe_test import StudioKeyframeTests


def load_tests(loader, tests, pattern):
    # Explicit own-method selection avoids rerunning the inherited baseline suite.
    cases = []
    for case in (StudioReviewTests, StudioCanvasTests, StudioKeyframeTests):
        cases.extend(case(name) for name in case.__dict__ if name.startswith('test_'))
    return unittest.TestSuite(cases)


if __name__ == '__main__':
    unittest.main(verbosity=2)
