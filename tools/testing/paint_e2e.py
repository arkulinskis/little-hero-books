"""The painted edition end to end, on this PC: Little Hero Books -> Image Enhancer -> its worker -> back.

    <python with anvil-uplink + pillow> tools/testing/paint_e2e.py [--shots DIR]     -> PAINT E2E PASSED

Needs the Image Enhancer repo next to this one (../image-enhancer) and Docker Desktop. It
1. starts Image Enhancer's local App Server (its tools/ui_test.py; container imageenhancer-dev),
2. adds an API key for Little Hero Books through Uplink (as its console would),
3. starts Image Enhancer's real PC worker with the built-in test filters (--backend classic: no GPU, no model),
4. recreates Little Hero Books' local server with the App Secrets image_enhancer_key and image_enhancer_url
   (http://host.docker.internal:<port>: the container reaches the other one through the host),
5. runs tools/ui/paint.js at desktop and phone width (tools/ui_test.py --only paint.js): paint a book, watch the
   pictures arrive, the reader, the PDF dialog, reload, back to the drawings, paint again.
The webhook isn't used here (Image Enhancer only calls https addresses): pictures arrive through paint_status.
"""
import datetime as dt
import hashlib
import json
import os
import pathlib
import secrets
import subprocess
import sys
import tempfile
import time

HERE = pathlib.Path(__file__).resolve().parent
LHB = HERE.parents[1]
IE = LHB.parent / "image-enhancer"
sys.path.insert(0, str(IE / "tools"))
import ui_test as ie  # noqa: E402  (Image Enhancer's local server: URL, port, uplink key)


def main():
    if not IE.exists():
        sys.exit("Image Enhancer isn't next to this repo (%s)." % IE)
    print("starting Image Enhancer's local server on", ie.URL)
    ie.start()
    import anvil.server
    anvil.server.connect(ie.UPLINK_KEY, url=ie.URL.replace("http://", "ws://") + "/_/uplink", quiet=True)
    from anvil.tables import app_tables
    key = "ie_" + secrets.token_hex(20)
    app_tables.clients.add_row(name="Little Hero Books (local test)", key_prefix=key[:9],
                               key_hash=hashlib.sha256(key.encode()).hexdigest(), webhook_secret="whsec_" + secrets.token_hex(12),
                               active=True, hourly_limit=1000, jobs_total=0, is_demo=False, created=dt.datetime.now(dt.timezone.utc))
    print("ok   API key for Little Hero Books added through Uplink")

    tmp = pathlib.Path(tempfile.mkdtemp())
    cfg = tmp / "config.json"
    cfg.write_text(json.dumps({"start_comfy": False, "comfy_dir": str(tmp), "heartbeat_seconds": 20}))
    log = open(str(cfg) + ".log", "w", encoding="utf-8")
    worker = subprocess.Popen([sys.executable, str(IE / "worker" / "enhancer_worker.py"), "--backend", "classic",
                               "--key", ie.UPLINK_KEY, "--url", ie.URL.replace("http://", "ws://") + "/_/uplink"],
                              env=dict(os.environ, IE_WORKER_CONFIG=str(cfg)), stdout=log, stderr=subprocess.STDOUT)
    try:
        end = time.time() + 120
        while time.time() < end and not any("Connected" in l for l in open(str(cfg) + ".log", encoding="utf-8", errors="replace")):
            time.sleep(1.5)
        print("ok   Image Enhancer's worker connected (test filters)")
        env = dict(os.environ, LHB_SECRETS="image_enhancer_key=%s,image_enhancer_url=http://host.docker.internal:%d"
                   % (key, ie.PORT))
        args = ["python", "-I", str(LHB / "tools" / "ui_test.py"), "--restart", "--only", "paint.js"]
        if "--shots" in sys.argv:
            args += ["--shots", sys.argv[sys.argv.index("--shots") + 1]]
        r = subprocess.run(args, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=1800)
        print(r.stdout[-6000:], r.stderr[-2000:])
        jobs = list(app_tables.jobs.search())
        print("Image Enhancer jobs: %d (%s)" % (len(jobs), ", ".join(sorted(set(j["status"] for j in jobs)))))
        # The truth check: every pass of a page (first paint, repaints, other styles, Paint fresh) started from
        # byte-for-byte the same vector drawing, a PNG at the drawing's size, never a painted picture or a sample.
        ours = [j for j in jobs if j["client"] is not None and j["client"]["key_prefix"] == key[:9]]
        by_page = {}
        for j in ours:
            raw = j["source"].get_bytes()
            assert raw[:8] == b"\x89PNG\r\n\x1a\n", "a base that isn't the PNG drawing: %s" % j["client_ref"]
            size = (int.from_bytes(raw[16:20], "big"), int.from_bytes(raw[20:24], "big"))
            assert size in ((1216, 851), (1024, 1024)), "a base of the wrong size %s: %s" % (size, j["client_ref"])
            by_page.setdefault(j["client_ref"], set()).add(hashlib.sha1(raw).hexdigest())
        repainted = [ref for ref in by_page if sum(1 for j in ours if j["client_ref"] == ref) > 1]
        assert ours and all(len(h) == 1 for h in by_page.values()), "a page started from different drawings: %s" % by_page
        print("ok   truth: %d passes over %d pages all started from the same vector drawing of their page (%d pages painted"
              " more than once)" % (len(ours), len(by_page), len(repainted)))
        if "ALL UI TESTS PASSED" not in r.stdout:
            print("worker log:", open(str(cfg) + ".log", encoding="utf-8", errors="replace").read()[-3000:])
            sys.exit("PAINT E2E FAILED")
    finally:
        worker.terminate()
    print("PAINT E2E PASSED")


if __name__ == "__main__":
    main()
