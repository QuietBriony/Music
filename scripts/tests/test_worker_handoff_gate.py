"""CPU/RAM gate tests: no real regression, Git, Temp, device or network calls."""
import ast
import contextlib
import copy
import io
import json
from pathlib import Path, PurePosixPath
import stat
import subprocess
import types
import unittest
from unittest import mock


HELPER = Path(__file__).resolve().parents[1] / "worker-handoff-gate.py"
CONTRACT = HELPER.parent / "tests" / "test_worker_gaming_pipeline.py"
POLICY_BYTES = HELPER.read_bytes().replace(b"\r\n", b"\n")
BASE_TESTS = CONTRACT.read_text(encoding="utf-8")
gate = types.ModuleType("handoff_gate_under_test")
gate.__file__ = str(HELPER)
# Compile directly so loading the helper cannot create an import cache.
exec(compile(POLICY_BYTES, str(HELPER), "exec"), gate.__dict__)

BASE = "a" * 40
HEAD = "b" * 40
OLD_SOURCE = '''import json
from pathlib import Path

SENTINEL = "unchanged"

def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

def unrelated():
    return SENTINEL
'''
NEW_SOURCE = OLD_SOURCE.replace("if not path.exists():", "if not path.is_file():")
EXTRA_CASE = '''    def test_extra_missing_json(self):
        result = pipeline._read_json(self.root / "extra-missing.json")
        self.assertEqual(result, {})

'''


def with_extra(text=BASE_TESTS, case=EXTRA_CASE):
    return text.replace('\n\nif __name__ == "__main__":', '\n\n' + case + 'if __name__ == "__main__":')


def function(body):
    return ast.parse(body).body[0]


def review(fingerprint="snapshot"):
    return {"schema": 1, "fingerprint": fingerprint, "decision": "approved",
            "independent": True, "source_json_only": True,
            "test_fixture_only": True, "author": "maker", "reviewer": "reviewer",
            "exclusive_candidate": True, "exclusive_owner": "maker"}


def before(count=8):
    return {"fingerprint": "snapshot", "manifest": {
        "base": BASE, "head": HEAD, "expected_cases": count}}


class CpuOnly(unittest.TestCase):
    def setUp(self):
        forbidden = mock.patch.object(gate.subprocess, "run", side_effect=AssertionError("real subprocess forbidden"))
        self.forbidden_process = forbidden.start()
        self.addCleanup(forbidden.stop)


class SourceContractTests(CpuOnly):
    def test_non_utf8_source_cookie_is_rejected(self):
        for cookie in ("unicode_escape", "latin-1", "utf-16"):
            with self.subTest(cookie=cookie), self.assertRaises(gate.GateError):
                gate.parse("# coding: " + cookie + "\n" + NEW_SOURCE)

    def test_source_and_helper_size_limits_are_rejected(self):
        with self.assertRaises(gate.GateError):
            gate.parse("#" + "x" * 256000)
        oversized = NEW_SOURCE.replace("not path.is_file()", " and ".join(["path.is_file()"] * 40))
        with self.assertRaises(gate.GateError):
            gate.validate_source(OLD_SOURCE, oversized)

    def test_only_json_predicate_change_is_eligible(self):
        gate.validate_source(OLD_SOURCE, NEW_SOURCE)

    def test_closed_predicates_and_docstring_are_eligible(self):
        candidate = NEW_SOURCE.replace("if not path.is_file():", "if not (path.exists() and path.is_file()):")
        candidate = candidate.replace("    if not (", '    """Read fixture JSON."""\n    if not (')
        gate.validate_source(OLD_SOURCE, candidate)

    def test_outside_helper_changes_are_rejected(self):
        for change in (NEW_SOURCE.replace('SENTINEL = "unchanged"', 'SENTINEL = "changed"'),
                       NEW_SOURCE + '\nimport socket\n',
                       NEW_SOURCE.replace("return SENTINEL", "return 3")):
            with self.subTest(candidate=change[-50:]), self.assertRaises(gate.GateError):
                gate.validate_source(OLD_SOURCE, change)

    def test_signature_and_decorator_changes_are_rejected(self):
        for change in (NEW_SOURCE.replace("(path: Path)", "(path: Path, extra=None)"),
                       NEW_SOURCE.replace("def _read_json", "@decorate\ndef _read_json")):
            with self.subTest(candidate=change[:50]), self.assertRaises(gate.GateError):
                gate.validate_source(OLD_SOURCE, change)

    def test_missing_return_annotation_is_rejected(self):
        with self.assertRaises(gate.GateError):
            gate.validate_source(OLD_SOURCE, NEW_SOURCE.replace(" -> dict:", ":"))

    def test_dynamic_or_effectful_predicates_are_rejected(self):
        for predicate in ('path.unlink()', 'getattr(path, "is_file")()', 'path.is_file(1)',
                          'other.is_file()', 'True', 'path.is_file() == True'):
            with self.subTest(predicate=predicate), self.assertRaises(gate.GateError):
                gate.validate_source(OLD_SOURCE, NEW_SOURCE.replace("not path.is_file()", predicate))

    def test_parser_read_and_exception_contract_is_frozen(self):
        for change in (NEW_SOURCE.replace('encoding="utf-8"', 'encoding="utf-16"'),
                       NEW_SOURCE.replace("except json.JSONDecodeError:", "except Exception:"),
                       NEW_SOURCE.replace("return {}", "return None", 1),
                       NEW_SOURCE.replace("    try:", "    path.write_text('x')\n    try:")):
            with self.subTest(candidate=change[-90:]), self.assertRaises(gate.GateError):
                gate.validate_source(OLD_SOURCE, change)

    def test_unknown_or_malformed_helper_is_rejected(self):
        for change in ("def broken(:", NEW_SOURCE.replace("def _read_json", "def renamed"),
                       NEW_SOURCE + '\ndef _read_json(path: Path) -> dict:\n    return {}\n'):
            with self.subTest(candidate=change[:30]), self.assertRaises(gate.GateError):
                gate.validate_source(OLD_SOURCE, change)


class RegressionContractTests(CpuOnly):
    def test_existing_eight_cases_are_accepted_without_execution(self):
        self.assertEqual(gate.validate_tests(BASE_TESTS, BASE_TESTS), 8)

    def test_pure_additional_json_case_is_accepted(self):
        self.assertEqual(gate.validate_tests(BASE_TESTS, with_extra()), 9)

    def test_bounded_existing_handoff_helper_case_is_accepted(self):
        extra = '''    def test_extra_handoff(self):
        report, output = self.generate_handoff(self.root / "worker")
        self.assertEqual(len(report["sonar_tracks"]), 4)

'''
        self.assertEqual(gate.validate_tests(BASE_TESTS, with_extra(case=extra)), 9)

    def test_existing_case_cannot_be_changed_removed_or_skipped(self):
        variants = [BASE_TESTS.replace('self.assertFalse(report["environment"]["sonar_exe_exists"])', 'self.assertTrue(report["environment"]["sonar_exe_exists"])'),
                    BASE_TESTS.replace('def test_missing_json_is_absent', 'def removed_case'),
                    BASE_TESTS.replace('    def test_missing_json_is_absent', '    @unittest.skip("no")\n    def test_missing_json_is_absent')]
        for candidate in variants:
            with self.subTest(candidate=candidate[-50:]), self.assertRaises(gate.GateError):
                gate.validate_tests(BASE_TESTS, candidate)

    def test_module_fixture_cleanup_and_barriers_are_frozen(self):
        variants = [BASE_TESTS + '\nimport socket\n',
                    BASE_TESTS.replace('"pr384-approved-fixtures"', '"elsewhere"'),
                    BASE_TESTS.replace('shutil.rmtree(self.root)', 'shutil.rmtree(self.root.parent)'),
                    BASE_TESTS.replace('"network forbidden"', '"network allowed"'),
                    BASE_TESTS.replace('os.O_CREAT | os.O_EXCL | os.O_WRONLY', 'os.O_CREAT | os.O_WRONLY')]
        for candidate in variants:
            with self.subTest(candidate=candidate[-50:]), self.assertRaises(gate.GateError):
                gate.validate_tests(BASE_TESTS, candidate)

    def test_unknown_base_missing_minimum_case_is_rejected(self):
        unknown = BASE_TESTS.replace('def test_missing_json_is_absent', 'def no_longer_known')
        with self.assertRaises(gate.GateError):
            gate.validate_tests(unknown, unknown)

    def test_duplicate_or_excessive_added_cases_are_rejected(self):
        duplicate = with_extra(case=EXTRA_CASE + EXTRA_CASE)
        excessive = with_extra(case=''.join(EXTRA_CASE.replace('test_extra_missing_json', 'test_extra_' + str(i)) for i in range(17)))
        for candidate in (duplicate, excessive):
            with self.subTest(length=len(candidate)), self.assertRaises(gate.GateError):
                gate.validate_tests(BASE_TESTS, candidate)

    def test_additional_cases_cannot_add_effects_or_escape(self):
        bodies = ['pipeline.subprocess.run(["cmd"])',
                  'self.assertEqual(pipeline._read_json(self.root / ".."), {})',
                  'self.assertEqual(pipeline._read_json(self.root / "/absolute"), {})',
                  'self.assertEqual(pipeline._read_json(self.root / "nested/file"), {})',
                  'self.assertTrue(__import__("os"))',
                  'self.root = "elsewhere"',
                  'self = 1',
                  'value = [x for x in []]',
                  'self.assertTrue(True, msg="unsupported keyword")',
                  'pass']
        for body in bodies:
            with self.subTest(body=body), self.assertRaises(gate.GateError):
                gate.validate_extra_case(function('def test_extra(self):\n    ' + body + '\n'))


class MemoryPath:
    def __init__(self, value, state):
        self.value = str(value).replace("\\", "/").rstrip("/") or "/"
        self.state = state

    def __str__(self):
        return self.value

    def __eq__(self, other):
        return isinstance(other, MemoryPath) and self.value == other.value

    def __truediv__(self, part):
        return MemoryPath(self.value.rstrip("/") + "/" + str(part), self.state)

    @property
    def parts(self):
        return PurePosixPath(self.value).parts

    def resolve(self):
        return MemoryPath(self.state.redirects.get(self.value, self.value), self.state)

    def is_relative_to(self, other):
        prefix = str(other).rstrip("/")
        return self.value == prefix or self.value.startswith(prefix + "/")

    def is_symlink(self):
        return self.value in self.state.links

    def is_junction(self):
        return self.value in self.state.junctions

    def stat(self):
        return types.SimpleNamespace(st_mode=stat.S_IFREG | 0o644)

    def read_bytes(self):
        return self.state.files[self.value]

    def read_text(self, encoding="utf-8"):
        return self.read_bytes().decode(encoding)


class RepoState:
    def __init__(self):
        self.root = "/repo"
        self.origin = "https://github.com/QuietBriony/Music.git"
        self.index_flags = b"H scripts/worker-gaming-pipeline.py\0H scripts/tests/test_worker_gaming_pipeline.py\0"
        self.calls = []
        self.status = b""
        self.head = HEAD
        self.base_ref = BASE
        self.unknown = False
        self.ancestor = True
        self.inventory = ("M\0" + gate.SOURCE + "\0M\0" + gate.TEST + "\0").encode()
        self.mode = "100644"
        self.kind = "blob"
        self.missing_entry = False
        self.base_policy = POLICY_BYTES
        self.old = {gate.SOURCE: OLD_SOURCE.encode(), gate.TEST: BASE_TESTS.encode()}
        self.new = {gate.SOURCE: NEW_SOURCE.encode(), gate.TEST: with_extra().encode()}
        self.files = {"/repo/" + path: value for path, value in self.new.items()}
        self.files[str(HELPER).replace("\\", "/")] = POLICY_BYTES
        self.redirects, self.links, self.junctions = {}, set(), set()

    def path(self, value):
        return MemoryPath(value, self)

    def git(self, repo, *args):
        self.calls.append(args)
        if args == ("rev-parse", "--show-toplevel"):
            return (self.root + "\n").encode()
        if args == ("remote", "get-url", "origin"):
            return (self.origin + "\n").encode()
        if args == ("ls-files", "-v", "-z"):
            return self.index_flags
        if args[0] == "status":
            return self.status
        if args[:2] == ("rev-parse", "--verify"):
            return (("c" * 40 if self.unknown else args[2].split("^")[0]) + "\n").encode()
        if args == ("rev-parse", "HEAD"):
            return (self.head + "\n").encode()
        if args == ("rev-parse", "refs/remotes/origin/main"):
            return (self.base_ref + "\n").encode()
        if args[0] == "merge-base":
            if not self.ancestor:
                raise gate.GateError("not an ancestor")
            return b""
        if args[0] == "diff":
            return self.inventory
        if args[0] == "ls-tree":
            paths = gate.PATHS[:1] if self.missing_entry else gate.PATHS
            return b"".join((self.mode + " " + self.kind + " " + ("1" * 40 if args[3] == BASE else "2" * 40) + "\t" + path + "\0").encode() for path in paths)
        if args[0] == "show":
            rev, path = args[1].split(":", 1)
            if path == gate.POLICY:
                return self.base_policy
            return (self.old if rev == BASE else self.new)[path]
        raise AssertionError("unexpected mocked Git call: " + repr(args))


class SnapshotTests(CpuOnly):
    def inspect(self, state, base=BASE, head=HEAD):
        with mock.patch.object(gate, "Path", side_effect=state.path), mock.patch.object(gate, "git", side_effect=state.git):
            return gate.snapshot("/repo", base, head)

    def test_valid_snapshot_binds_base_head_gate_files_and_cases(self):
        record = self.inspect(RepoState())
        self.assertEqual(record["manifest"]["base"], BASE)
        self.assertEqual(record["manifest"]["head"], HEAD)
        self.assertEqual(record["manifest"]["expected_cases"], 9)
        self.assertEqual(set(record["manifest"]["files"]), set(gate.PATHS))
        self.assertRegex(record["fingerprint"], r"^[0-9a-f]{64}$")

    def test_repository_root_and_origin_must_match(self):
        for key, value in (("root", "/other"), ("origin", "https://github.com/other/Music.git"),
                           ("origin", "https://github.com/QuietBriony/Music.git?unverified=1")):
            state = RepoState()
            setattr(state, key, value)
            with self.subTest(key=key, value=value), self.assertRaises(gate.GateError):
                self.inspect(state)

    def test_assume_unchanged_skip_worktree_and_unusual_index_flags_are_rejected(self):
        for flag in (b"h", b"S", b"s", b"M", b"?"):
            state = RepoState()
            state.index_flags = flag + b" scripts/worker-gaming-pipeline.py\0"
            with self.subTest(flag=flag), self.assertRaises(gate.GateError):
                self.inspect(state)

    def test_inventory_commands_disable_external_diff_and_textconv(self):
        state = RepoState()
        self.inspect(state)
        diffs = [args for args in state.calls if args[0] == "diff"]
        self.assertEqual(len(diffs), 1)
        self.assertEqual(diffs[0][:3], ("diff", "--no-ext-diff", "--no-textconv"))
        self.assertIn(("ls-files", "-v", "-z"), state.calls)

    def test_raw_working_bytes_are_bound_even_when_git_lf_matches(self):
        state = RepoState()
        original = self.inspect(state)
        state.files["/repo/" + gate.SOURCE] = state.new[gate.SOURCE].replace(b"\n", b"\r\n")
        changed = self.inspect(state)
        self.assertNotEqual(original["fingerprint"], changed["fingerprint"])

    def test_dirty_untracked_and_ignored_content_are_rejected(self):
        for status in (b" M scripts/worker-gaming-pipeline.py\0", b"?? extra.py\0", b"!! cache/\0", b"UU conflict\0"):
            state = RepoState()
            state.status = status
            with self.subTest(status=status), self.assertRaises(gate.GateError):
                self.inspect(state)

    def test_unknown_nonancestor_stale_base_or_moved_head_is_rejected(self):
        for key, value in (("unknown", True), ("ancestor", False), ("base_ref", "c" * 40), ("head", "c" * 40)):
            state = RepoState()
            setattr(state, key, value)
            with self.subTest(key=key), self.assertRaises(gate.GateError):
                self.inspect(state)

    def test_symbolic_short_or_missing_revisions_are_rejected(self):
        for value in ("main", "a" * 7, "", None):
            with self.subTest(value=value), self.assertRaises(gate.GateError):
                self.inspect(RepoState(), base=value)

    def test_out_of_scope_self_policy_status_or_empty_diff_is_rejected(self):
        inventories = [b"M\0AGENTS.md\0", b"M\0scripts/worker-handoff-gate.py\0", b"",
                       ("A\0" + gate.SOURCE + "\0").encode(),
                       ("D\0" + gate.TEST + "\0").encode(),
                       ("R100\0" + gate.SOURCE + "\0").encode(),
                       ("M\0" + gate.SOURCE + "\0dangling\0").encode()]
        for inventory in inventories:
            state = RepoState()
            state.inventory = inventory
            with self.subTest(inventory=inventory), self.assertRaises(gate.GateError):
                self.inspect(state)

    def test_policy_must_already_match_trusted_base(self):
        state = RepoState()
        state.base_policy = b"older or unknown gate"
        with self.assertRaises(gate.GateError):
            self.inspect(state)

    def test_mode_type_missing_file_links_and_root_escape_are_rejected(self):
        mutations = [("mode", "100755"), ("mode", "120000"), ("kind", "tree"), ("missing_entry", True)]
        for key, value in mutations:
            state = RepoState()
            setattr(state, key, value)
            with self.subTest(key=key, value=value), self.assertRaises(gate.GateError):
                self.inspect(state)
        for kind in ("links", "junctions", "redirects"):
            state = RepoState()
            if kind == "redirects":
                state.redirects["/repo/" + gate.SOURCE] = "/outside/source.py"
            else:
                getattr(state, kind).add("/repo/scripts")
            with self.subTest(kind=kind), self.assertRaises(gate.GateError):
                self.inspect(state)

    def test_working_bytes_cannot_differ_from_committed_candidate(self):
        state = RepoState()
        state.files["/repo/" + gate.SOURCE] += b"# changed after commit\n"
        with self.assertRaises(gate.GateError):
            self.inspect(state)

    def test_git_wrapper_is_readonly_bounded_and_has_no_trust_override(self):
        result = types.SimpleNamespace(returncode=0, stdout=b"result")
        with mock.patch.object(gate.subprocess, "run", return_value=result) as run:
            self.assertEqual(gate.git("/repo", "status", "--porcelain"), b"result")
        self.assertEqual(run.call_args.args[0], ["git", "--no-optional-locks", "-C", "/repo", "status", "--porcelain"])
        self.assertEqual(run.call_args.kwargs["timeout"], 15)


class ReviewAndExecutionTests(CpuOnly):
    def test_only_completed_independent_exact_snapshot_review_is_accepted(self):
        gate.validate_review(review(), "snapshot", "maker")
        variants = [None, {}, {**review(), "fingerprint": "older"},
                    {**review(), "decision": "pending"}, {**review(), "independent": False},
                    {**review(), "source_json_only": False}, {**review(), "test_fixture_only": False},
                    {**review(), "author": "other"}, {**review(), "reviewer": "  MAKER  "},
                    {**review(), "reviewer": " "}, {**review(), "exclusive_candidate": False},
                    {**review(), "exclusive_owner": "other"},
                    {key: value for key, value in review().items() if key != "exclusive_candidate"},
                    {key: value for key, value in review().items() if key != "exclusive_owner"}]
        for record in variants:
            with self.subTest(record=record), self.assertRaises(gate.GateError):
                gate.validate_review(record, "snapshot", "maker")

    def test_missing_review_prevents_process_launch(self):
        with self.assertRaises(gate.GateError):
            gate.run_regression("/repo", before(), None, "maker", exclusive=True)
        self.forbidden_process.assert_not_called()

    def test_exclusive_ownership_must_be_explicit_before_snapshot_or_launch(self):
        with mock.patch.object(gate, "snapshot") as snap, self.assertRaises(gate.GateError):
            gate.run_regression("/repo", before(), review(), "maker")
        snap.assert_not_called()
        self.forbidden_process.assert_not_called()

    def test_pre_run_snapshot_change_prevents_process_launch(self):
        changed = copy.deepcopy(before())
        changed["fingerprint"] = "after-review-change"
        with mock.patch.object(gate, "snapshot", return_value=changed), self.assertRaises(gate.GateError):
            gate.run_regression("/repo", before(), review(), "maker", exclusive=True)
        self.forbidden_process.assert_not_called()

    def test_success_uses_only_fixed_regression_command_and_matching_post_state(self):
        result = types.SimpleNamespace(returncode=0, stdout="", stderr="Ran 8 tests in 0.002s\n\nOK\n")
        with mock.patch.object(gate.subprocess, "run", return_value=result) as run, mock.patch.object(gate, "snapshot", return_value=before()) as snap:
            outcome = gate.run_regression("/repo", before(), review(), "maker", exclusive=True)
        self.assertTrue(outcome["gate_pass"])
        self.assertEqual(outcome["test_count"], 8)
        self.assertEqual(run.call_count, 1)
        self.assertEqual(snap.call_count, 2)
        self.assertIn("no protection against hostile transient file replacement", outcome["execution_isolation"])
        self.assertEqual(run.call_args.args[0], [gate.sys.executable, "-B", "-m", "unittest", "discover", "-s", "scripts/tests", "-p", "test_worker_gaming_pipeline.py", "-v"])
        self.assertEqual(run.call_args.kwargs["timeout"], 120)
        self.assertNotIn("sandbox_permissions", run.call_args.kwargs)

    def test_failed_skipped_denied_or_wrong_count_results_are_rejected_without_retry(self):
        outputs = [(1, "Ran 8 tests in 0.1s\nFAILED\n"),
                   (0, "Ran 8 tests in 0.1s\nOK (skipped=1)\n"),
                   (0, "Ran 8 tests in 0.1s\nexpected failure\nOK\n"),
                   (0, "Ran 8 tests in 0.1s\nunexpected success\nOK\n"),
                   (0, "Ran 8 tests in 0.1s\nPermission denied\nOK\n"),
                   (0, "Ran 8 tests in 0.1s\nWinError 5\nOK\n"),
                   (0, "Ran 7 tests in 0.1s\nOK\n"),
                   (0, "Ran 8 tests in 0.1s\nRan 8 tests in 0.1s\nOK\n"),
                   (0, "Ran 8 tests in 0.1s\n"), (0, "OK\n")]
        for code, output in outputs:
            result = types.SimpleNamespace(returncode=code, stdout="", stderr=output)
            with self.subTest(output=output), mock.patch.object(gate.subprocess, "run", return_value=result) as run, mock.patch.object(gate, "snapshot", return_value=before()) as snap, self.assertRaises(gate.GateError):
                gate.run_regression("/repo", before(), review(), "maker", exclusive=True)
            self.assertEqual(run.call_count, 1)
            self.assertEqual(snap.call_count, 1)

    def test_launch_denial_and_timeout_are_not_retried(self):
        for error in (PermissionError("synthetic launch denial"), subprocess.TimeoutExpired("python", 120)):
            with self.subTest(error=type(error).__name__), mock.patch.object(gate.subprocess, "run", side_effect=error) as run, mock.patch.object(gate, "snapshot", return_value=before()), self.assertRaises(gate.GateError):
                gate.run_regression("/repo", before(), review(), "maker", exclusive=True)
            self.assertEqual(run.call_count, 1)

    def test_after_execution_changes_invalidate_success(self):
        result = types.SimpleNamespace(returncode=0, stdout="", stderr="Ran 8 tests in 0.1s\nOK\n")
        changed = copy.deepcopy(before())
        changed["fingerprint"] = "after-change"
        with mock.patch.object(gate.subprocess, "run", return_value=result), mock.patch.object(gate, "snapshot", side_effect=[before(), changed]), self.assertRaises(gate.GateError):
            gate.run_regression("/repo", before(), review(), "maker", exclusive=True)


class MainTests(CpuOnly):
    def args(self, mode="inspect", extra=()):
        return [mode, "--repo", "/repo", "--base", BASE, "--head", HEAD, *extra]

    def invoke(self, args):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = gate.main(args)
        return code, json.loads(output.getvalue())

    def test_inspect_is_never_a_pass_or_execution(self):
        with mock.patch.object(gate, "snapshot", return_value=before()):
            code, result = self.invoke(self.args())
        self.assertEqual(code, 2)
        self.assertFalse(result["gate_pass"])
        self.assertEqual(result["status"], "ELIGIBLE_REVIEW_REQUIRED")
        self.forbidden_process.assert_not_called()

    def test_gate_error_reports_blocked_without_full_gate_fallback(self):
        with mock.patch.object(gate, "snapshot", side_effect=gate.GateError("out of scope")):
            code, result = self.invoke(self.args())
        self.assertEqual(code, 1)
        self.assertFalse(result["gate_pass"])
        self.forbidden_process.assert_not_called()

    def test_run_requires_review_path_and_author_before_launch(self):
        with mock.patch.object(gate, "snapshot", return_value=before()), mock.patch.object(gate, "run_regression") as run:
            code, result = self.invoke(self.args("run"))
        self.assertEqual(code, 1)
        run.assert_not_called()
        self.forbidden_process.assert_not_called()

    def test_review_inside_candidate_is_rejected(self):
        state = RepoState()
        with mock.patch.object(gate, "Path", side_effect=state.path), mock.patch.object(gate, "snapshot", return_value=before()), mock.patch.object(gate, "run_regression") as run:
            code, result = self.invoke(self.args("run", ("--review", "/repo/review.json", "--author", "maker", "--exclusive-candidate")))
        self.assertEqual(code, 1)
        run.assert_not_called()

    def test_run_reads_only_external_review_and_returns_confirmed_result(self):
        state = RepoState()
        state.files["/reviews/approved.json"] = json.dumps(review()).encode()
        confirmed = {"status": "NARROW_GATE_PASS", "gate_pass": True}
        with mock.patch.object(gate, "Path", side_effect=state.path), mock.patch.object(gate, "snapshot", return_value=before()), mock.patch.object(gate, "run_regression", return_value=confirmed) as run:
            code, result = self.invoke(self.args("run", ("--review", "/reviews/approved.json", "--author", "maker", "--exclusive-candidate")))
        self.assertEqual(code, 0)
        self.assertEqual(result, confirmed)
        self.assertEqual(run.call_args.args[2], review())
        self.assertIs(run.call_args.kwargs["exclusive"], True)
        self.forbidden_process.assert_not_called()

    def test_cli_without_exclusive_declaration_cannot_launch(self):
        state = RepoState()
        state.files["/reviews/approved.json"] = json.dumps(review()).encode()
        with mock.patch.object(gate, "Path", side_effect=state.path), mock.patch.object(gate, "snapshot", return_value=before()):
            code, result = self.invoke(self.args("run", ("--review", "/reviews/approved.json", "--author", "maker")))
        self.assertEqual(code, 1)
        self.assertFalse(result["gate_pass"])
        self.forbidden_process.assert_not_called()


if __name__ == "__main__":
    unittest.main()
