"""Hermetic JSON/handoff regression tests; no machine, DAW or device probes."""
import argparse
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest import mock


SOURCE = Path(__file__).resolve().parents[1] / "worker-gaming-pipeline.py"
SPEC = importlib.util.spec_from_file_location("worker_pipeline_under_test", SOURCE)
pipeline = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pipeline)
FIXTURE_ROOT = Path(__file__).resolve().parents[2] / "output" / "pr384-approved-fixtures"
RUN_LOCK = FIXTURE_ROOT / ".regression.lock"


def setUpModule():
    FIXTURE_ROOT.mkdir(parents=True, exist_ok=True)
    # A running or interrupted invocation must be reviewed before another starts.
    # Never remove an existing lock or launch another suite beside it.
    descriptor = os.open(RUN_LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    with os.fdopen(descriptor, "w", encoding="utf-8") as lock:
        lock.write(str(os.getpid()) + "\n")


def tearDownModule():
    RUN_LOCK.unlink()


class WorkerHandoffTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="case-", dir=FIXTURE_ROOT)).resolve()
        # Fixture operations and cleanup stay in the explicitly approved root.
        self.assertTrue(self.root.is_relative_to(FIXTURE_ROOT.resolve()))
        self.addCleanup(self.cleanup_fixture)

    def cleanup_fixture(self):
        self.assertTrue(self.root.is_relative_to(FIXTURE_ROOT.resolve()))
        # Raise on cleanup failure; do not chmod/retry a denied deletion.
        shutil.rmtree(self.root)

    def test_missing_json_is_absent(self):
        self.assertEqual(pipeline._read_json(self.root / "missing.json"), {})

    def test_directory_json_is_absent_without_attempting_file_read(self):
        with mock.patch.object(Path, "read_text", side_effect=AssertionError("non-file JSON must not be read")):
            self.assertEqual(pipeline._read_json(self.root), {})
            with contextlib.chdir(self.root):
                self.assertEqual(pipeline._read_json(Path("")), {})

    def test_valid_json_is_preserved(self):
        path = self.root / "valid.json"
        expected = {"entries": [{"role": "fixture"}], "label": "initial handoff"}
        path.write_text(json.dumps(expected), encoding="utf-8")
        self.assertEqual(pipeline._read_json(path), expected)

    def test_invalid_json_remains_absent(self):
        path = self.root / "invalid.json"
        path.write_text("{unfinished", encoding="utf-8")
        self.assertEqual(pipeline._read_json(path), {})

    def test_real_file_read_errors_are_not_suppressed(self):
        path = self.root / "file.json"
        path.write_text("{}", encoding="utf-8")
        with mock.patch.object(Path, "read_text", side_effect=OSError("synthetic read failure")):
            with self.assertRaisesRegex(OSError, "synthetic read failure"):
                pipeline._read_json(path)

    def generate_handoff(self, worker_root):
        args = argparse.Namespace(worker_root=str(worker_root), band="tabasco", song="human-fly",
                                  ep133_pack=None, recreation_cycle=None, open_report=False)
        original_exists, original_read = Path.exists, Path.read_text
        sonar_exe = Path(r"C:\Program Files\Cakewalk\Sonar\Sonar.exe")

        def exists(path):
            # Keep the Sonar presence check synthetic too.
            return False if path == sonar_exe else original_exists(path)

        def read_json_file(path, *args, **kwargs):
            # Reproduce the erroneous branch before the OS tries to read a directory.
            # This is a test assertion, not an actual filesystem access denial.
            self.assertTrue(path.is_file(), "handoff tried to read a directory as JSON")
            return original_read(path, *args, **kwargs)

        output = io.StringIO()
        with contextlib.ExitStack() as stack:
            stack.enter_context(contextlib.chdir(self.root))
            stack.enter_context(contextlib.redirect_stdout(output))
            stack.enter_context(mock.patch.object(pipeline, "_windows_pnp_devices", return_value=[]))
            stack.enter_context(mock.patch.object(pipeline, "_windows_sound_devices", return_value=[]))
            stack.enter_context(mock.patch.object(pipeline, "_sqlite_count", return_value=None))
            stack.enter_context(mock.patch.object(Path, "exists", exists))
            stack.enter_context(mock.patch.object(Path, "read_text", read_json_file))
            stack.enter_context(mock.patch.object(pipeline.subprocess, "run", side_effect=AssertionError("external command forbidden")))
            stack.enter_context(mock.patch.object(pipeline.urllib.request, "urlopen", side_effect=AssertionError("network forbidden")))
            stack.enter_context(mock.patch.object(pipeline.os, "startfile", create=True, side_effect=AssertionError("app launch forbidden")))
            pipeline.command_sonar_ep133_handoff(args)

        reports = list((worker_root / "reports" / "tabasco" / "human-fly").glob("sonar-ep133-handoff-*"))
        self.assertEqual(len(reports), 1)
        report = json.loads((reports[0] / "sonar-ep133-handoff.json").read_text(encoding="utf-8"))
        markdown = (reports[0] / "sonar-ep133-handoff.md").read_text(encoding="utf-8")
        self.assertIn("Sonar", markdown)
        for entry in report["ep133_entries"]:
            self.assertIn(entry["file"], markdown)
        self.assertEqual(len(report["sonar_tracks"]), 4)
        self.assertFalse(report["environment"]["sonar_exe_exists"])
        return report, output.getvalue()

    def test_first_handoff_without_pack_or_cycle_writes_both_checklists(self):
        report, output = self.generate_handoff(self.root / "worker")
        self.assertEqual(report["ep133_entries"], [])
        self.assertEqual(report["cycle_recommendations"], [])
        self.assertEqual(report["paths"]["ep133_manifest"], "")
        self.assertEqual(report["paths"]["recreation_cycle_report"], "")
        self.assertIn("warning: no EP-133 pack found", output)
        self.assertIn("warning: no recreation cycle found", output)

    def test_existing_pack_and_cycle_keep_their_metadata(self):
        worker = self.root / "worker"
        pack = worker / "hardware-jam" / "ep133-inbox" / "tabasco" / "human-fly" / "ep133-pack-fixture"
        cycle = worker / "reports" / "tabasco" / "human-fly" / "recreation-cycle-fixture"
        pack.mkdir(parents=True)
        cycle.mkdir(parents=True)
        entries = [{"slot": "A1", "role": "fixture-loop", "file": "not-real-audio.wav"}]
        recommendations = ["fixture recommendation"]
        (pack / "ep133-transfer-manifest.json").write_text(json.dumps({"entries": entries}), encoding="utf-8")
        (cycle / "recreation-cycle-report.json").write_text(json.dumps({"recommendations": recommendations}), encoding="utf-8")
        report, output = self.generate_handoff(worker)
        self.assertEqual(report["ep133_entries"], entries)
        self.assertEqual(report["cycle_recommendations"], recommendations)
        self.assertEqual(Path(report["paths"]["ep133_manifest"]), pack / "ep133-transfer-manifest.json")
        self.assertNotIn("warning: no EP-133 pack found", output)
        self.assertNotIn("warning: no recreation cycle found", output)

    def test_existing_pack_without_cycle_still_writes_checklists(self):
        worker = self.root / "worker"
        pack = worker / "hardware-jam" / "ep133-inbox" / "tabasco" / "human-fly" / "ep133-pack-fixture"
        pack.mkdir(parents=True)
        entries = [{"slot": "A1", "role": "fixture-loop", "file": "not-real-audio.wav"}]
        (pack / "ep133-transfer-manifest.json").write_text(json.dumps({"entries": entries}), encoding="utf-8")
        report, output = self.generate_handoff(worker)
        self.assertEqual(report["ep133_entries"], entries)
        self.assertEqual(report["cycle_recommendations"], [])
        self.assertEqual(report["paths"]["recreation_cycle_report"], "")
        self.assertNotIn("warning: no EP-133 pack found", output)
        self.assertIn("warning: no recreation cycle found", output)


if __name__ == "__main__":
    unittest.main()
