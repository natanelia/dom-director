"""Run every focused Studio review journey before and after publication."""
import unittest
from gesture_test import StudioReviewTests
from canvas_test import StudioCanvasTests
from keyframe_test import StudioKeyframeTests
from timeline_test import StudioTimelineTests
from audio_export_test import StudioAudioExportTests
from video_handoff_test import StudioVideoHandoffTests
from timing_link_test import StudioTimingLinkTests
from timing_link_accessibility_test import StudioTimingLinkAccessibilityTests


def load_tests(loader, tests, pattern):
    # Explicit own-method selection avoids rerunning the inherited baseline suite.
    cases = []
    for case in (StudioTimingLinkTests, StudioTimingLinkAccessibilityTests, StudioVideoHandoffTests, StudioReviewTests, StudioCanvasTests, StudioKeyframeTests, StudioTimelineTests, StudioAudioExportTests):
        cases.extend(case(name) for name in case.__dict__ if name.startswith('test_'))
    return unittest.TestSuite(cases)


if __name__ == '__main__':
    unittest.main(verbosity=2)
