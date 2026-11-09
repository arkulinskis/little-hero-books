"""Repaint the style samples in the Paint dialog (theme/assets/paint-<style>.jpg + paint-drawing.jpg).

    <python with pillow> tools/paint_previews.py [--url https://little-hero-books.anvil.app]

Run it on the studio PC after changing Painting.PROMPT, STYLE_EXTRA, hero_words or a style in Image Enhancer:
1. draws Juniper (the demo hero) on the Three Bears cover with the app's own engine (LH.paintPicture, headless Chrome
   through tools/live/drive.mjs; the live app by default, or --url http://localhost:3031 for the local server);
2. paints it in each of Painting.STYLES with this PC's ComfyUI, through Image Enhancer's worker engine
   (../image-enhancer/worker/engines.py) and the exact instruction a book page gets (Image Enhancer's default style
   words + "strict" + Painting.prompt_for words for Juniper). ComfyUI must be running (start_worker.bat starts it);
   nothing goes through the live apps' databases;
3. saves 800 x 560 JPEGs into theme/assets. Look at them before committing; then python tools/assets.py.
"""
import base64
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
IE = ROOT.parent / "image-enhancer"
ASSETS = ROOT / "theme" / "assets"
LOOK = {"size": "kid", "skin": "s2", "face": "round", "hair": "curly", "hairColor": "ginger", "eyes": "sparkle",
        "eyeColor": "green", "brows": "soft", "nose": "button", "mouth": "grin", "cheeks": True, "freckles": True,
        "glasses": "round", "outfit": "overalls", "outfitColor": "sky", "hat": "none"}  # Juniper (DemoData.py)


def draw_source(url, tmp):
    make = """(async function () {
      const book = { story: { key: 'bears', text: new Array(9).fill('x'), title: 'x', color: '#ef5a36' },
                     hero: { name: 'Juniper', pronoun: 'she', look: %s } };
      const buf = new Uint8Array(await (await LH.paintPicture(book, 0)).arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
      window.__png = btoa(s);
      return { chars: window.__png.length };
    })()""" % json.dumps(LOOK)
    steps = [{"waitFor": "window.UI_READY === true && !!window.LH && !!LH.paintPicture", "timeout": 90000}, {"eval": make}]
    steps += [{"eval": "window.__png.slice(%d, %d)" % (i, i + 50000)} for i in range(0, 4_000_000, 50000)]
    f = tmp / "steps.json"
    f.write_text(json.dumps(steps), encoding="utf-8")
    r = subprocess.run(["node", str(ROOT / "tools" / "live" / "drive.mjs"), url.rstrip("/") + "/#landing", str(f), str(tmp)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
    evals = [l[len("[eval] "):] for l in r.stdout.splitlines() if l.startswith("[eval] ")]
    want = json.loads(evals[0])["chars"]
    data = "".join(json.loads(e) for e in evals[1:] if e.startswith('"'))
    assert len(data) == want, "the drawing didn't come back whole (%d of %d)" % (len(data), want)
    return base64.b64decode(data)


def main():
    url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "https://little-hero-books.anvil.app"
    from PIL import Image
    import io
    sys.path.insert(0, str(IE / "worker"))
    import engines
    painting = (ROOT / "server_code" / "Painting.py").read_text(encoding="utf-8")
    ns = {}
    exec(painting[painting.index("STYLES = ["):painting.index("BY_STYLE")], ns)
    exec(painting[painting.index("PROMPT = ("):painting.index("def api_address")], ns)
    styles_src = (IE / "server_code" / "Styles.py").read_text(encoding="utf-8")
    sty = {}
    exec(styles_src[styles_src.index("DEFAULTS = ["):styles_src.index("\n\n\n", styles_src.index("FIDELITY = {"))], sty)
    words = {d[0]: d[3] for d in sty["DEFAULTS"]}
    hero = {"look": LOOK}
    tmp = pathlib.Path(tempfile.mkdtemp())
    src = draw_source(url, tmp)
    print("drawing:", len(src) // 1024, "KB")

    def save(data, key):
        im = Image.open(io.BytesIO(data)).convert("RGB").resize((800, 560), Image.LANCZOS)
        im.save(ASSETS / ("paint-%s.jpg" % key), "JPEG", quality=82, optimize=True, progressive=True)

    save(src, "drawing")
    cfg = json.loads((IE / "worker" / "config.json").read_text(encoding="utf-8"))
    cfg.pop("uplink_key", None)
    cfg.update(start_comfy=False, comfy_dir=str(IE / "worker" / cfg.get("comfy_dir", "ComfyUI")),
               workflow=str(IE / "worker" / cfg.get("workflow", "workflows/flux2_klein_edit.json")))
    eng = engines.make(cfg, lambda m: print("  engine:", m))
    eng.prepare()
    for st in [s["key"] for s in ns["STYLES"]]:
        instruction = " ".join([words[st].strip(), sty["FIDELITY"]["strict"], ns["prompt_for"]({"hero": hero}, st)])
        out, _, meta = eng.process(src, {"job_id": "lhbpreview_" + st, "instruction": instruction, "megapixels": 1.0,
                                         "seed": 20261109, "size": "source", "width": 1216, "height": 851, "format": "jpeg"})
        save(out, st)
        print("painted", st)
    print("Saved in theme/assets. Look at them, then: python tools/assets.py")


if __name__ == "__main__":
    main()
