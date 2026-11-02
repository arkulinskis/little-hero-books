"""Everything that must pass before pushing. Ends with ALL CHECKS PASSED.

    python tools/check.py          (no -I: the server tests and assets.py read anvil.yaml with PyYAML)
    python tools/check.py --ui     also the real-app UI tests in the local Anvil App Server (Docker; tools/ui_test.py)

  1. Anvil's own validator (`anvil validate`, @anvil-works/anvil-cli): anvil.yaml, every form template and every
     client/server Python file, type-checked against Anvil's API stubs. Kit files shared by all apps (SEO, legal) are
     reported but don't fail the check.
  2. node --check on the JavaScript engines in theme/assets.
  3. Asset hashes in anvil.yaml are current (tools/assets.py).
  4. Server tests (tools/testing/test_server.py, strict Anvil mock).
The CLI: `npm install -g @anvil-works/anvil-cli` once (or set ANVIL_CLI to its path).
"""
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
KIT_FILES = {"seo_routes.py", "legal_server.py"}  # maintained by APP_MAKER/seo and APP_MAKER/legal-kit
problems = []


def run(args, **kw):
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)


def step(name, good, detail=""):
    print(("ok   " if good else "FAIL ") + name + (("\n" + detail) if detail and not good else ""))
    if not good:
        problems.append(name)


def anvil_cli():
    exe = os.environ.get("ANVIL_CLI") or shutil.which("anvil")
    if exe:
        return [exe]
    npx = shutil.which("npx")
    return [npx, "--yes", "@anvil-works/anvil-cli@0.8.1"] if npx else None


def main():
    cli = anvil_cli()
    if not cli:
        step("anvil validate", False, "  Install the Anvil CLI: npm install -g @anvil-works/anvil-cli")
    else:
        r = run(cli + ["validate", "."], timeout=900)
        lines = [l for l in (r.stdout + r.stderr).splitlines() if l.strip() and "is valid" not in l]
        bad, kit = [], []
        current = None
        for l in lines:
            if "failed validation" in l:
                current = l
                (kit if any(k in l for k in KIT_FILES) else bad).append(l)
            elif current and l.lstrip("✖ ").startswith("-"):
                (kit if any(k in current for k in KIT_FILES) else bad).append(l)
            elif "✖" in l or "error" in l.lower():
                bad.append(l)
        step("anvil validate (anvil.yaml, %s)" % "forms, client + server Python", not bad, "\n".join(bad[:60]))
        if kit:
            print("     (kit files with type warnings, not counted: %s)" % ", ".join(sorted(KIT_FILES)))
    js = sorted((ROOT / "theme" / "assets").glob("*.js"))
    errs = [p.name + ": " + run(["node", "--check", str(p)]).stderr.strip() for p in js if run(["node", "--check", str(p)]).returncode]
    step("JavaScript parses (%d files)" % len(js), not errs, "\n".join(errs))
    r = run([sys.executable, str(ROOT / "tools" / "assets.py")])
    step("asset hashes", r.returncode == 0, r.stdout + r.stderr)
    if "updated" in r.stdout:
        print("     (anvil.yaml was updated with new asset hashes: commit it)")
    r = run([sys.executable, str(ROOT / "tools" / "testing" / "test_server.py")], timeout=600)
    step("server tests: " + (r.stdout.strip().splitlines() or ["?"])[-1], r.returncode == 0 and "ALL OK" in r.stdout,
         (r.stdout + r.stderr)[-3000:])
    if "--ui" in sys.argv:
        r = run([sys.executable, "-I", str(ROOT / "tools" / "ui_test.py")], timeout=1800)
        print(r.stdout[-4000:])
        step("UI tests in the App Server", r.returncode == 0, r.stderr[-2000:])
    print("\nALL CHECKS PASSED" if not problems else "\n%d PROBLEM(S): %s" % (len(problems), "; ".join(problems)))
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
