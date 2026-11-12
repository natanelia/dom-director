"""Local video renderer contracts and real Chromium/FFmpeg output parity.

Run VideoModelTests without a browser; the full suite requires the built fixture,
pinned Playwright Chromium and FFmpeg with H.264/AAC and VP9/Opus encoders.
All exported content in this suite is synthetic and may be retained as evidence.
"""
import array
import base64
from copy import deepcopy
import hashlib
import io
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import render_video as renderer


def options(output, *extra):
    return renderer.parser().parse_args(['--sample', '--output', str(output), '--width', '960', '--fps', '24', '--end-ms', '500', *extra])


def rgb(data):
    return subprocess.run(['ffmpeg', '-v', 'error', '-f', 'image2pipe', '-c:v', 'png', '-i', 'pipe:0', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], input=data, capture_output=True, check=True, timeout=30).stdout


def video_frame(path, index):
    return subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vf', f'select=eq(n\\,{index})', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], capture_output=True, check=True, timeout=30).stdout


def difference(a, b):
    assert len(a) == len(b) and len(a) > 0
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


class VideoModelTests(unittest.TestCase):
    def test_exact_frame_schedule_includes_start_and_excludes_end(self):
        self.assertEqual(renderer.frame_count(0, 1000, 24), 24)
        self.assertEqual(renderer.frame_count(1700, 2701, 30), 31)
        for fps in renderer.FPS:
            for length in [1, 17, 1001, 120000]:
                n = renderer.frame_count(731, 731 + length, fps)
                self.assertLess((n - 1) * 1000 / fps, length)
                self.assertGreaterEqual(n * 1000 / fps, length)

    def test_invalid_ranges_and_rates_are_rejected(self):
        for args in [(0, 0, 30), (-1, 50, 30), (0, 120001, 30), (0, 100, 29), (0.1, 200, 24), (True, 100, 30)]:
            with self.subTest(args=args), self.assertRaises(ValueError):
                renderer.frame_count(*args)

    def test_template_removes_editor_execution_not_application_markup(self):
        template = (ROOT / 'site/studio.html').read_text()
        output = renderer.render_template(template).decode()
        self.assertNotIn('src="./studio.mjs"', output)
        self.assertNotIn('studio-video.mjs', output)
        self.assertNotIn('studio-selection.css', output)
        self.assertIn('href="./studio.css"', output)
        self.assertIn('src="./render-host.mjs"', output)
        self.assertIn('id="scene" class="orbit" inert', output)
        self.assertIn('id="app-review"', output)
        with self.assertRaises(ValueError):
            renderer.render_template(template.replace('./studio.mjs', './other.mjs'))

    def test_render_only_style_boundary_rejects_missing_or_duplicate_marker(self):
        template = (ROOT / 'site/studio.html').read_text()
        marker = '<link rel="stylesheet" href="./studio-selection.css">'
        for changed in [template.replace(marker, ''), template.replace(marker, marker + marker)]:
            with self.subTest(template=changed[:40]), self.assertRaisesRegex(ValueError, 'authoring stylesheet'):
                renderer.render_template(changed)

    def test_encoder_has_explicit_streams_frame_rate_and_bounded_duration(self):
        mp4 = renderer.encoder_command(Path('result.mp4'), 30, 31, Path('mix.wav'))
        self.assertIn('libx264', mp4);self.assertIn('aac', mp4)
        self.assertEqual(mp4[mp4.index('-frames:v') + 1], '31')
        self.assertEqual(mp4[mp4.index('-framerate') + 1], '30')
        self.assertIn('apad', mp4);self.assertIn('-n', mp4)
        webm = renderer.encoder_command(Path('result.webm'), 24, 6, None)
        self.assertIn('libvpx-vp9', webm);self.assertIn('-an', webm)
        self.assertNotIn('libopus', webm)

    def test_broken_encoder_write_and_close_preserve_bounded_diagnostics(self):
        class BrokenPipe:
            def write(self):raise BrokenPipeError('write failed')
            def close(self):raise BrokenPipeError('close failed')
        with tempfile.TemporaryDirectory() as root:
            log = Path(root) / 'encoder.log'
            log.write_text('not retained ' * 1000 + 'encoder cannot continue')
            for method in ['write', 'close']:
                with self.subTest(method=method), self.assertRaisesRegex(ValueError, 'Video encoder stopped early:') as caught:
                    with renderer.encoder_diagnostics(log):
                        getattr(BrokenPipe(), method)()
                self.assertTrue(str(caught.exception).endswith('encoder cannot continue'))
                self.assertLessEqual(len(str(caught.exception)), 2100)
            log.write_bytes(b'')
            with self.assertRaisesRegex(ValueError, 'may have timed out'):
                with renderer.encoder_diagnostics(log):raise BrokenPipeError()
            with self.assertRaises(KeyboardInterrupt):
                with renderer.encoder_diagnostics(log):raise KeyboardInterrupt()

    def test_publication_never_overwrites_and_rolls_back_its_own_files(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            a = root / 'a';b = root / 'b';a.write_text('first');b.write_text('second')
            output = root / 'video';report = root / 'report';report.write_text('existing')
            with self.assertRaises(FileExistsError):
                renderer.publish_files([(a, output), (b, report)])
            self.assertFalse(output.exists());self.assertEqual(report.read_text(), 'existing')
            self.assertEqual(a.read_text(), 'first')

    def test_server_only_serves_named_tokenized_inputs(self):
        with renderer.local_fixture({'render.html': b'render', 'sdk/index.js': b'export {}'}) as base:
            self.assertEqual(urlopen(base + 'render.html').read(), b'render')
            for path in ['../secret', '%2e%2e/secret', 'sdk/', 'missing']:
                with self.subTest(path=path), self.assertRaises(HTTPError):
                    urlopen(base + path)
            for headers in [{'Origin': 'https://example.invalid'}, {'Host': 'example.invalid'}]:
                with self.assertRaises(HTTPError):
                    urlopen(Request(base + 'render.html', headers=headers))

    def test_source_is_explicit_and_output_format_is_checked_before_loading(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaisesRegex(ValueError, 'mp4 or .webm'):
                renderer.render(options(Path(root) / 'file.gif'))
            output = Path(root) / 'existing.mp4';output.write_bytes(b'keep')
            with self.assertRaisesRegex(ValueError, 'already exists'):
                renderer.render(options(output))
            self.assertEqual(output.read_bytes(), b'keep')

    def test_site_integrity_and_exact_source_allowlist(self):
        files, _ = renderer.load_site(ROOT / 'site-dist', None)
        self.assertNotIn('studio.mjs', files)
        self.assertNotIn('studio-selection.mjs', files)
        self.assertNotIn('studio-selection.css', files)
        self.assertNotIn('project.director', files)
        self.assertNotIn('AGENTS.md', files)
        self.assertIn('render-host.mjs', files)
        with tempfile.TemporaryDirectory() as temp:
            site = Path(temp) / 'site';shutil.copytree(ROOT / 'site-dist', site)
            (site / 'studio.css').write_text('changed')
            with self.assertRaisesRegex(ValueError, 'build manifest'):
                renderer.load_site(site, None)


class VideoBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Build pure sample data with the actual local package, not a second format.
        result = subprocess.run(['node', '--input-type=module', '-e', "import {createSample} from './packages/studio/src/index.js'; console.log(JSON.stringify(createSample()));"], cwd=ROOT, capture_output=True, text=True, check=True)
        cls.sample = json.loads(result.stdout)
        cls.evidence = ROOT / 'video-results';cls.evidence.mkdir(exist_ok=True)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='director-video-test-')
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)

    def bundle(self, project, media=None):
        media = media or {}
        files, chunks = [], []
        for asset in project['assets']:
            if asset['source'] != 'local':continue
            data = media[asset['id']]
            parts = [data[i:i + 196608] for i in range(0, len(data), 196608)]
            files.append({'id':asset['id'], 'sha256':asset['sha256'], 'byteLength':len(data), 'chunks':len(parts)})
            chunks.extend({'id':asset['id'], 'index':i, 'data':base64.b64encode(part).decode()} for i, part in enumerate(parts))
        target = self.path / 'project.director'
        target.write_text('\n'.join(json.dumps(x) for x in [{'format':'dom-director-studio/1','project':project,'files':files}, *chunks]) + '\n')
        return target

    def render(self, name, *, start=0, end=500, extra=(), project=None, probes=None):
        output = self.path / name
        args = options(output, '--start-ms', str(start), '--end-ms', str(end), *extra)
        if project:args.project=project;args.sample=False
        captured = {}
        def probe(index, image, frame):
            if probes is not None and index in probes:
                captured[index] = (image, frame)
        report = renderer.render(args, on_frame=probe)
        self.assertEqual(report['outputSha256'], renderer.sha(output.read_bytes()))
        self.assertEqual(json.loads(output.with_suffix(output.suffix + '.json').read_text()), report)
        return output, report, captured

    def test_mp4_frame_parity_across_scene_boundary_with_prepared_voice(self):
        output, report, frames = self.render('sample.mp4', start=6750, end=7250, probes=[0, 11])
        self.assertEqual((report['frames'],report['videoCodec'],report['audioCodec']), (12,'h264','aac'))
        self.assertNotEqual(frames[0][1]['sceneId'], frames[11][1]['sceneId'])
        parity = []
        for index, (png, frame) in frames.items():
            expected = rgb(png);actual = video_frame(output,index)
            error = difference(expected,actual)
            self.assertLess(error,8, 'Encoded frame differs from the exact live-DOM sample')
            parity.append({'frame':index,'timeMs':frame['timeMs'],'meanAbsoluteRgbError':error})
            (self.evidence / f'frame-{index}.png').write_bytes(png)
        self.assertGreater(difference(rgb(frames[0][0]),rgb(frames[11][0])),1)
        shutil.copyfile(output,self.evidence / output.name)
        (self.evidence / 'mp4-report.json').write_text(json.dumps({'render':report,'parity':parity},indent=2))

    def test_webm_includes_local_audio_at_exact_timeline_placement(self):
        stream=io.BytesIO()
        with wave.open(stream,'wb') as wav:
            wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(48000)
            wav.writeframes(b''.join(struct.pack('<h',round(8000*math.sin(2*math.pi*440*i/48000))) for i in range(48000)))
        data=stream.getvalue();project=deepcopy(self.sample)
        asset={'id':'local.tone','name':'Synthetic tone','mime':'audio/wav','durationMs':1000,'source':'local','sha256':hashlib.sha256(data).hexdigest()}
        project['assets'].append(asset)
        voice=project['tracks'][2]['clips'][0]
        voice.update(assetId=asset['id'],startMs=200,durationMs=500,sourceInMs=100,gain=.5,fadeInMs=50,fadeOutMs=50)
        project['tracks'][2]['clips']=[voice]
        project['tracks'][3]['clips'][0].update(text='A locally rendered voice.',style={'color':'#ffffff','background':'#000000','size':38})
        path=self.bundle(project,{asset['id']:data});before=path.read_bytes()
        output,report,_=self.render('local.webm',end=1000,project=path)
        self.assertEqual((report['videoCodec'],report['audioCodec']),('vp9','opus'))
        decoded=subprocess.run(['ffmpeg','-v','error','-i',str(output),'-map','0:a:0','-ac','1','-ar','48000','-f','f32le','pipe:1'],capture_output=True,check=True,timeout=30).stdout
        samples=array.array('f');samples.frombytes(decoded)
        if sys.byteorder!='little':samples.byteswap()
        def rms(start,end):
            values=samples[int(start*48000):int(end*48000)]
            return math.sqrt(sum(v*v for v in values)/len(values))
        self.assertLess(rms(0,.1),.001)
        self.assertGreater(rms(.3,.5),.05)
        self.assertLess(rms(.85,.95),.001)
        self.assertEqual(path.read_bytes(),before)
        shutil.copyfile(output,self.evidence / output.name)
        (self.evidence/'webm-report.json').write_text(json.dumps(report,indent=2))

    def test_1080p_silent_export_respects_explicit_caption_and_motion_settings(self):
        _,report,frames=self.render('silent.mp4',end=200,extra=['--width','1920','--fps','30','--silent','--no-captions','--reduced-motion'],probes=[0])
        self.assertEqual((report['width'],report['height'],report['frames']),(1920,1080,6))
        self.assertIsNone(report['audioCodec']);self.assertIsNone(report['audio'])
        self.assertFalse(report['captionsBurnedIn']);self.assertTrue(report['reducedMotion'])
        self.assertEqual(struct.unpack('>II',frames[0][0][16:24]),(1920,1080))
        (self.evidence/'silent-1080p.png').write_bytes(frames[0][0])

    def test_invalid_project_missing_take_and_unapproved_target_publish_nothing(self):
        for name,mutate in [('target',lambda p:p['tracks'][0]['clips'][0]['keys'][0].update(target='unapproved.target')),
                            ('take',lambda p:p['tracks'][2]['clips'][0].update(assetId=None)),
                            ('unknown',lambda p:p.update(execute='not allowed'))]:
            with self.subTest(name=name):
                project=deepcopy(self.sample);mutate(project);path=self.bundle(project)
                args=options(self.path/(name+'.mp4'));args.project=path;args.sample=False
                with self.assertRaises(Exception):renderer.render(args)
                self.assertFalse(args.output.exists())
                self.assertFalse(args.output.with_suffix('.mp4.json').exists())
                self.assertFalse(list(self.path.glob('.director-render-*')))

    def test_cancellation_cleans_encoder_and_does_not_publish_partial_video(self):
        args=options(self.path/'cancel.mp4','--silent')
        def cancel(index,_image,_frame):
            if index==2:raise KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):renderer.render(args,on_frame=cancel)
        self.assertFalse(args.output.exists());self.assertFalse(list(self.path.glob('.director-render-*')))
        self.assertFalse(args.output.with_suffix('.mp4.json').exists())

    def test_early_encoder_failure_reports_its_log_and_cleans_output(self):
        from unittest.mock import patch
        original = renderer.encoder_command
        def broken_encoder(*args, **kwargs):
            command = original(*args, **kwargs)
            command[command.index('-c:v') + 1] = 'director_missing_encoder'
            return command
        args = options(self.path / 'encoder-failure.mp4', '--silent')
        with patch.object(renderer, 'encoder_command', broken_encoder):
            with self.assertRaisesRegex(ValueError, 'director_missing_encoder'):
                renderer.render(args)
        self.assertFalse(args.output.exists())
        self.assertFalse(args.output.with_suffix('.mp4.json').exists())
        self.assertFalse(list(self.path.glob('.director-render-*')))

    def test_partial_final_frame_uses_fixed_rate_without_timeline_drift(self):
        _,report,frames=self.render('fraction.mp4',start=6980,end=7081,extra=['--fps','30','--silent'],probes=[0,3])
        self.assertEqual(report['frames'],4)
        self.assertEqual(frames[0][1]['timeMs'],6980)
        self.assertAlmostEqual(frames[3][1]['timeMs'],7080)
        self.assertAlmostEqual(report['durationSeconds'],4/30,delta=.05)


if __name__=='__main__':unittest.main(verbosity=2)
