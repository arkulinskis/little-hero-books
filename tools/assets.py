"""Refresh the theme assets' cache-busting hashes in anvil.yaml (and icons.css).

    python tools/assets.py          (no -I: it needs PyYAML)

native_deps.head_html in anvil.yaml loads the app's own files as _/theme/<file>?v=<hash>. After changing any of them,
run this so browsers fetch the new copy. It also rebuilds icons.css from lh-kit.js. Anvil's own IDE edits to
head_html (Native Libraries) are kept: only the ?v= values change.
"""
import hashlib
import pathlib
import re
import subprocess
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "theme" / "assets"


def main():
    subprocess.run([sys.executable, "-I", str(ROOT / "tools" / "build_icons.py")], check=True)
    path = ROOT / "anvil.yaml"
    meta = yaml.safe_load(path.read_text(encoding="utf-8"))
    head = meta["native_deps"]["head_html"]

    def fresh(m):
        f = ASSETS / m.group(1)
        if not f.exists():
            sys.exit("head_html loads _/theme/%s, but theme/assets/%s doesn't exist" % (m.group(1), m.group(1)))
        return "_/theme/%s?v=%s" % (m.group(1), hashlib.sha1(f.read_bytes()).hexdigest()[:10])

    new = re.sub(r"_/theme/([\w.\-/]+)\?v=[0-9a-f]+", fresh, head)
    if new != head:
        meta["native_deps"]["head_html"] = new
        path.write_text(yaml.safe_dump(meta, sort_keys=True, allow_unicode=True, width=120), encoding="utf-8", newline="\n")
        print("anvil.yaml: asset hashes updated")
    else:
        print("anvil.yaml: asset hashes already current")


if __name__ == "__main__":
    main()
