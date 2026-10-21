"""Candidate narrow handoff gate. No full-gate fallback is launched automatically."""
import argparse
import ast
import hashlib
import io
import json
from pathlib import Path
import re
import stat
import subprocess
import sys
import tokenize


SOURCE = "scripts/worker-gaming-pipeline.py"
TEST = "scripts/tests/test_worker_gaming_pipeline.py"
POLICY = "scripts/worker-handoff-gate.py"
PATHS = (SOURCE, TEST)
TEST_ARGS = ("-B", "-m", "unittest", "discover", "-s", "scripts/tests",
             "-p", "test_worker_gaming_pipeline.py", "-v")
REQUIRED_CASES = frozenset({
    "test_missing_json_is_absent",
    "test_directory_json_is_absent_without_attempting_file_read",
    "test_valid_json_is_preserved",
    "test_invalid_json_remains_absent",
    "test_real_file_read_errors_are_not_suppressed",
    "test_first_handoff_without_pack_or_cycle_writes_both_checklists",
    "test_existing_pack_and_cycle_keep_their_metadata",
    "test_existing_pack_without_cycle_still_writes_checklists",
})
ASSERTIONS = {"assertEqual", "assertNotEqual", "assertTrue", "assertFalse",
              "assertIn", "assertNotIn", "assertIsNone", "assertIsNotNone"}


class GateError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise GateError(message)


def dump(node):
    return "None" if node is None else ast.dump(node, include_attributes=False)


def parse(text):
    try:
        require(len(text.encode("utf-8")) <= 256000, "Python file exceeds narrow-route size limit")
        encoding, _ = tokenize.detect_encoding(io.BytesIO(text.encode("utf-8")).readline)
        require(encoding == "utf-8", "only UTF-8 Python source is eligible")
        return ast.parse(text)
    except (SyntaxError, ValueError, RecursionError) as error:
        raise GateError("Python source cannot be parsed") from error


def sha(data):
    return hashlib.sha256(data).hexdigest()


def body_without_docstring(body):
    if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str):
        return body[1:]
    return body


def validate_source(before, after):
    old, new = parse(before), parse(after)
    def locate(tree):
        matches = [(i, node) for i, node in enumerate(tree.body)
                   if isinstance(node, ast.FunctionDef) and node.name == "_read_json"]
        require(len(matches) == 1, "exactly one top-level _read_json is required")
        return matches[0]
    old_i, old_fn = locate(old)
    new_i, fn = locate(new)
    require(old_i == new_i, "JSON helper cannot move")
    require(dump(old_fn.args) == dump(fn.args) and
            dump(old_fn.returns) == dump(fn.returns) and
            old_fn.decorator_list == fn.decorator_list == [] and
            not getattr(fn, "type_params", []), "JSON helper signature changed")
    old.body[old_i] = ast.Pass()
    new.body[new_i] = ast.Pass()
    require(dump(old) == dump(new), "source outside _read_json changed")

    def predicate(node):
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            return predicate(node.operand)
        if isinstance(node, ast.BoolOp) and isinstance(node.op, (ast.And, ast.Or)):
            return all(predicate(value) for value in node.values)
        return (isinstance(node, ast.Call) and not node.args and not node.keywords and
                isinstance(node.func, ast.Attribute) and node.func.attr in {"exists", "is_file"} and
                isinstance(node.func.value, ast.Name) and node.func.value.id == "path")

    body = body_without_docstring(fn.body)
    require(len(list(ast.walk(fn))) <= 128, "JSON helper exceeds narrow-route size limit")
    template = parse('def f():\n if not path.is_file():\n  return {}\n try:\n  return json.loads(path.read_text(encoding="utf-8"))\n except json.JSONDecodeError:\n  return {}\n').body[0].body
    require(len(body) == 2 and isinstance(body[0], ast.If) and predicate(body[0].test),
            "JSON predicate is outside the closed grammar")
    require(dump(ast.Module(body=body[0].body, type_ignores=[])) ==
            dump(ast.Module(body=template[0].body, type_ignores=[])) and not body[0].orelse,
            "JSON non-file branch changed")
    require(dump(body[1]) == dump(template[1]),
            "JSON parse/read/exception behavior is outside the closed grammar")


def bounded_path(node):
    if dump(node) == dump(parse("self.root").body[0].value):
        return True
    return (isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div) and
            bounded_path(node.left) and isinstance(node.right, ast.Constant) and
            isinstance(node.right.value, str) and
            re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,79}", node.right.value) is not None and
            node.right.value not in {".", ".."})


def validate_extra_case(fn):
    require(not fn.decorator_list and not getattr(fn, "type_params", []) and
            dump(fn.args) == dump(parse("def f(self): pass").body[0].args) and
            fn.returns is None and len(list(ast.walk(fn))) <= 200,
            "additional case signature/decorator/size is unsupported")
    names = set()
    assertions = 0

    def expression(node):
        if isinstance(node, ast.Constant):
            return isinstance(node.value, (str, int, float, bool, type(None))) and len(repr(node.value)) <= 2048
        if isinstance(node, ast.Name):
            return node.id in names
        if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
            return len(node.elts) <= 50 and all(expression(value) for value in node.elts)
        if isinstance(node, ast.Dict):
            return len(node.keys) <= 50 and all(key is not None and expression(key) and expression(value)
                                                for key, value in zip(node.keys, node.values))
        if isinstance(node, ast.Subscript):
            return expression(node.value) and expression(node.slice)
        if isinstance(node, ast.Compare):
            return (all(isinstance(op, (ast.Eq, ast.NotEq, ast.In, ast.NotIn, ast.Is, ast.IsNot)) for op in node.ops)
                    and expression(node.left) and all(expression(value) for value in node.comparators))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            return expression(node.operand)
        if isinstance(node, ast.Call) and not node.keywords:
            target = ast.unparse(node.func)
            if target == "len":
                return len(node.args) == 1 and expression(node.args[0])
            if target == "pipeline._read_json":
                return len(node.args) == 1 and bounded_path(node.args[0])
            if target == "self.generate_handoff":
                return len(node.args) == 1 and ast.unparse(node.args[0]) == "self.root / 'worker'"
        return False

    for statement in body_without_docstring(fn.body):
        if isinstance(statement, ast.Assign) and len(statement.targets) == 1:
            require(expression(statement.value), "additional case has an unsupported expression")
            target = statement.targets[0]
            targets = target.elts if isinstance(target, ast.Tuple) else [target]
            require(all(isinstance(value, ast.Name) and not value.id.startswith("_") and
                        value.id not in {"self", "pipeline", "len"} for value in targets),
                    "additional case assignment is unsupported")
            names.update(value.id for value in targets)
        elif isinstance(statement, ast.Expr) and isinstance(statement.value, ast.Call):
            call = statement.value
            require(isinstance(call.func, ast.Attribute) and isinstance(call.func.value, ast.Name) and
                    call.func.value.id == "self" and call.func.attr in ASSERTIONS and
                    not call.keywords and 1 <= len(call.args) <= 3 and
                    all(expression(value) for value in call.args), "additional case may only make bounded assertions")
            assertions += 1
        else:
            raise GateError("additional case has an unsupported statement")
    require(assertions > 0, "additional case must assert a result")


def validate_tests(before, after):
    old, new = parse(before), parse(after)
    def suite(tree):
        matches = [node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "WorkerHandoffTests"]
        require(len(matches) == 1, "one WorkerHandoffTests class is required")
        return matches[0]
    old_class, new_class = suite(old), suite(new)
    old_cases = {node.name: node for node in old_class.body
                 if isinstance(node, ast.FunctionDef) and node.name.startswith("test_")}
    require(REQUIRED_CASES <= old_cases.keys(), "base regression contract is unknown")
    new_cases = [node for node in new_class.body
                 if isinstance(node, ast.FunctionDef) and node.name.startswith("test_")]
    require(len({node.name for node in new_cases}) == len(new_cases), "duplicate case names")
    require(old_cases.keys() <= {node.name for node in new_cases}, "existing regression case removed")
    for node in new_cases:
        if node.name in old_cases:
            require(dump(node) == dump(old_cases[node.name]), "existing regression case changed")
        else:
            validate_extra_case(node)
    require(len(new_cases) <= 24, "too many additional cases for the narrow route")
    # Remove only new cases; imports, fixtures, barriers, helpers and old cases must match.
    new_class.body = [node for node in new_class.body if not
                      (isinstance(node, ast.FunctionDef) and node.name.startswith("test_") and node.name not in old_cases)]
    require(dump(old) == dump(new), "test imports/fixtures/barriers/existing cases changed")
    return len(new_cases)


def git(repo, *args):
    result = subprocess.run(["git", "--no-optional-locks", "-C", str(repo), *args],
                            capture_output=True, timeout=15, check=False)
    require(result.returncode == 0, "Git read failed: " + " ".join(args[:2]))
    return result.stdout


def entries(repo, rev):
    result = {}
    for row in git(repo, "ls-tree", "-r", "-z", rev, "--", *PATHS).split(b"\0"):
        if row:
            metadata, path = row.decode("utf-8").split("\t", 1)
            mode, kind, blob = metadata.split()
            require(mode == "100644" and kind == "blob", "file mode/type changed")
            result[path] = blob
    require(set(result) == set(PATHS), "both base/candidate files must be tracked")
    return result


def snapshot(repo, base, head):
    repo = Path(repo).resolve()
    require(all(re.fullmatch(r"[0-9a-f]{40}", value or "") for value in (base, head)), "explicit full base/head SHA required")
    require(Path(git(repo, "rev-parse", "--show-toplevel").decode().strip()).resolve() == repo,
            "candidate path must be the repository root")
    require(git(repo, "remote", "get-url", "origin").decode().strip() in {
        "https://github.com/QuietBriony/Music.git", "https://github.com/QuietBriony/Music",
        "git@github.com:QuietBriony/Music.git"}, "candidate origin must be QuietBriony/Music")
    require(git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored") == b"",
            "dirty, untracked or ignored content requires the full gate")
    require(all(row.startswith(b"H ") for row in git(repo, "ls-files", "-v", "-z").split(b"\0") if row),
            "assume-unchanged, skip-worktree or unusual index flags require the full gate")
    for value in (base, head):
        require(git(repo, "rev-parse", "--verify", value + "^{commit}").decode().strip() == value, "unknown commit")
    require(git(repo, "rev-parse", "HEAD").decode().strip() == head, "candidate HEAD moved")
    require(git(repo, "rev-parse", "refs/remotes/origin/main").decode().strip() == base, "base differs from verified origin/main ref")
    git(repo, "merge-base", "--is-ancestor", base, head)
    rows = git(repo, "diff", "--no-ext-diff", "--no-textconv", "--name-status", "-z", "--no-renames", base, head, "--").decode("utf-8").split("\0")
    require(rows[-1] == "", "invalid diff inventory")
    changes = list(zip(rows[:-1:2], rows[1:-1:2]))
    require(changes and all(status == "M" and path in PATHS for status, path in changes),
            "only modifications of the two tracked handoff files are eligible")
    require(len(rows) == len(changes) * 2 + 1, "invalid diff status fields")
    gate_bytes = Path(__file__).read_bytes().replace(b"\r\n", b"\n")
    require(git(repo, "show", base + ":" + POLICY) == gate_bytes,
            "run an unchanged gate already present in the trusted base; this gate cannot approve itself")
    old_entries, new_entries = entries(repo, base), entries(repo, head)
    old, new, hashes = {}, {}, {}
    for path in PATHS:
        full = repo / path
        current = repo
        for part in Path(path).parts:
            current = current / part
            require(not current.is_symlink() and not getattr(current, "is_junction", lambda: False)(), "link/reparse path is ineligible")
        require(full.resolve().is_relative_to(repo) and stat.S_ISREG(full.stat().st_mode), "file escapes repository")
        raw = full.read_bytes()
        old[path] = git(repo, "show", base + ":" + path).decode("utf-8")
        new[path] = git(repo, "show", head + ":" + path).decode("utf-8")
        require(raw.replace(b"\r\n", b"\n") == new[path].encode("utf-8"), "working file differs from candidate blob")
        hashes[path] = {"base_blob": old_entries[path], "candidate_blob": new_entries[path], "working_sha256": sha(raw)}
    validate_source(old[SOURCE], new[SOURCE])
    count = validate_tests(old[TEST], new[TEST])
    manifest = {"schema": 1, "base": base, "head": head, "gate_sha256": sha(gate_bytes),
                "changes": changes, "files": hashes, "expected_cases": count}
    fingerprint = sha(json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    return {"manifest": manifest, "fingerprint": fingerprint}


def validate_review(record, fingerprint, author):
    require(isinstance(author, str) and author.strip() and isinstance(record, dict) and record.get("schema") == 1 and
            record.get("fingerprint") == fingerprint and record.get("decision") == "approved" and
            record.get("independent") is True and record.get("source_json_only") is True and
            record.get("test_fixture_only") is True and record.get("author") == author and
            record.get("exclusive_candidate") is True and record.get("exclusive_owner") == author and
            isinstance(record.get("reviewer"), str) and record["reviewer"].strip() and
            record["reviewer"].strip().casefold() != author.strip().casefold(),
            "completed independent review for this exact snapshot is required")


def run_regression(repo, before, record, author, *, exclusive=False):
    require(exclusive, "operator-confirmed exclusive candidate ownership is required before execution")
    validate_review(record, before["fingerprint"], author)
    require(snapshot(repo, before["manifest"]["base"], before["manifest"]["head"]) == before,
            "candidate changed after review; no regression was started")
    try:
        result = subprocess.run([sys.executable, *TEST_ARGS], cwd=repo, capture_output=True,
                                text=True, encoding="utf-8", errors="replace", timeout=120, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise GateError("regression launch/timeout blocked; do not retry or remove its lock automatically") from error
    output = result.stdout + result.stderr
    require(result.returncode == 0 and not re.search(r"skipped|expected failure|unexpected success|permission denied|WinError 5|EACCES|EPERM", output, re.I),
            "regression failed, skipped or denied; inspect its state without automatic retry")
    counts = re.findall(r"Ran (\d+) tests? in", output)
    require(counts == [str(before["manifest"]["expected_cases"])] and re.search(r"^OK\s*$", output, re.M), "unexpected regression case/result count")
    after = snapshot(repo, before["manifest"]["base"], before["manifest"]["head"])
    require(after == before, "candidate or filesystem state changed during regression")
    return {"status": "NARROW_GATE_PASS", "gate_pass": True, **after,
            "test_exit": 0, "test_count": int(counts[0]), "output_sha256": sha(output.encode("utf-8")),
            "reviewer": record["reviewer"], "review_independence": "operator-confirmed; JSON is not an identity signature",
            "execution_isolation": "operator-exclusive checkout; no protection against hostile transient file replacement"}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("inspect", "run"))
    parser.add_argument("--repo", required=True)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--review")
    parser.add_argument("--author")
    parser.add_argument("--exclusive-candidate", action="store_true")
    args = parser.parse_args(argv)
    try:
        before = snapshot(args.repo, args.base, args.head)
        if args.mode == "inspect":
            print(json.dumps({"status": "ELIGIBLE_REVIEW_REQUIRED", "gate_pass": False, **before}, indent=2))
            return 2
        require(args.review and args.author and args.author.strip(), "review path and author are required before execution")
        review_path = Path(args.review).resolve()
        require(not review_path.is_relative_to(Path(args.repo).resolve()), "review evidence must be outside the candidate worktree")
        record = json.loads(review_path.read_text(encoding="utf-8"))
        print(json.dumps(run_regression(args.repo, before, record, args.author, exclusive=args.exclusive_candidate), indent=2))
        return 0
    except (GateError, OSError, UnicodeError, json.JSONDecodeError, subprocess.TimeoutExpired) as error:
        print(json.dumps({"status": "FULL_GATE_REQUIRED_OR_BLOCKED", "gate_pass": False, "reason": str(error)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
