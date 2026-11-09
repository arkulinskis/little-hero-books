"""Server tests against the strict mock of Anvil (tools/testing/mock).

    python tools/testing/test_server.py          -> prints ALL OK, or the first failure   (no -I: reads anvil.yaml)

call(name, ...) runs a server function the way the browser does: by name, with require_user enforced,
and the reply must be JSON (a datetime or a row in a reply fails here, like it would break the page).
Add tests for every new server function: the happy path, bad input, and someone who isn't allowed.
"""
import datetime as dt
import importlib
import json
import os
import pathlib
import shutil
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
_tmp = pathlib.Path(tempfile.mkdtemp())
shutil.copytree(PROJECT / "server_code", _tmp / "app")
(_tmp / "app" / "__init__.py").write_text("")
os.environ["ANVIL_APP_YAML"] = str(PROJECT / "anvil.yaml")  # the mock's tables follow the app's own schema
sys.path[:0] = [str(HERE / "mock"), str(_tmp)]
import anvil.server  # noqa: E402
import anvil.users  # noqa: E402
from anvil.tables import app_tables as T  # noqa: E402

M = {p.stem: importlib.import_module("app." + p.stem) for p in sorted((PROJECT / "server_code").glob("*.py"))}
now = dt.datetime.now(dt.timezone.utc)


def call(name, *args):
    r = anvil.server.call(name, *args)
    json.dumps(r)  # strict: must be JSON-able
    return r


def as_user(row):
    anvil.users.CURRENT[0] = row
    anvil.server.session.use(row.get_id() if row is not None else None)


def denied(name, *args):
    try:
        call(name, *args)
    except anvil.server.PermissionDenied:
        return True
    return False


def ok(r, msg=""):
    assert isinstance(r, dict) and r.get("ok"), (msg, r)
    return r


def bad(r, msg=""):
    assert isinstance(r, dict) and r.get("ok") is False and r.get("error"), (msg, r)
    return r


def person(email, name=None, **kw):
    return T.users.add_row(email=email, enabled=True, signed_up=now, display_name=name, **kw)


# ---------------------------------------------------------------------------------- accounts
admin = person("arkulinskis@gmail.com", "The Admin")
ana = person("ana@example.com", "Ana")
bob = person("bob@example.com")

as_user(None)
assert call("get_me") is None
assert denied("update_profile", "X")
as_user(admin)
assert call("get_me")["is_admin"] is True, "ADMIN_EMAILS become admins on first sign-in"
as_user(ana)
me = call("get_me")
assert me["name"] == "Ana" and me["is_admin"] is False
assert ana["last_seen"] is not None
as_user(bob)
assert call("get_me")["name"] == "Bob", "a name comes from the email when none is set"
bad(call("update_profile", " x "))
assert ok(call("update_profile", "  Bob   Stone "))["me"]["name"] == "Bob Stone"

# ---------------------------------------------------------------------------------- feedback
as_user(None)
bad(call("submit_feedback", "bug", "hi"))
ok(call("submit_feedback", "bug", "The button is broken", "guest@example.com", {"page": "#home", "evil": "x" * 9999}))
fb = T.feedback.search()[0]
assert fb["name"] == "Guest" and fb["email"] == "guest@example.com" and "evil" not in fb["context"] and fb["status"] == "new"
for i in range(4):
    ok(call("submit_feedback", "idea", "Idea number %d" % i))
bad(call("submit_feedback", "idea", "One too many this hour"), "rate limit")
as_user(ana)
ok(call("submit_feedback", "nonsense-kind", "Signed-in feedback"))
assert T.feedback.get(message="Signed-in feedback")["kind"] == "other"
assert denied("list_feedback")
as_user(admin)
lst = call("list_feedback")
assert lst["counts"]["new"] == 6 and len(lst["items"]) == 6
fid = lst["items"][0]["id"]
ok(call("set_feedback_status", fid, "done", "Fixed it"))
assert call("list_feedback", "done")["items"][0]["note"] == "Fixed it"
bad(call("set_feedback_status", fid, "weird"))
bad(call("set_feedback_status", "nope", "done"))
ok(call("delete_feedback", fid))
assert len(call("list_feedback")["items"]) == 5

# ---------------------------------------------------------------------------------- admin
as_user(ana)
for fn, args in [("admin_overview", ()), ("list_users", ()), ("set_admin", (bob.get_id(), True)), ("demo_load", ()), ("demo_remove", ())]:
    assert denied(fn, *args), fn
as_user(admin)
ov = call("admin_overview")
assert ov["users"] == 3 and ov["admins"] == 1 and ov["feedback_new"] == 5
assert len(call("list_users")["users"]) == 3 and len(call("list_users", "bob")["users"]) == 1
ok(call("set_admin", bob.get_id(), True))
assert bob["is_admin"] is True
bad(call("set_admin", admin.get_id(), False), "can't remove your own admin")
ok(call("set_enabled", bob.get_id(), False))
assert bob["enabled"] is False
bad(call("set_enabled", admin.get_id(), False))
ok(call("set_enabled", bob.get_id(), True))
ok(call("set_admin", bob.get_id(), False))
assert bob["is_admin"] is False

# ---------------------------------------------------------------------------------- the stories
import re  # noqa: E402
St = M["Stories"]
assert len(St.STORIES) == 12 and len({s["key"] for s in St.STORIES}) == 12
for s in St.STORIES:
    assert len(s["pages"]) == 9, s["key"]
    assert 300 <= St.words(s) <= 500, (s["key"], St.words(s))
    assert set(re.findall(r"\{(\w+)\}", " ".join(s["pages"]) + s["title"])) <= St.TOKENS, s["key"]
    assert "{name}" in s["title"] and "public domain" in s["source"]
bad(call("get_story", "nope"))
bad(call("get_story", None))
assert len(ok(call("get_story", "bears"))["story"]["text"]) == 9

# ---------------------------------------------------------------------------------- library + demo data (guests)
DD = M["DemoData"]
as_user(None)
lib = call("get_library")
assert DD.state() == "loaded", "demo loads on first visit"
assert len(lib["stories"]) == 12 and lib["heroes"] == [] and len(lib["examples"]) == len(DD.DEMO_HEROES)
assert denied("get_shelf") and denied("save_hero", None, "X", "she", {}) and denied("make_book", "x", "bears")
ex = lib["examples"][0]
assert ok(call("get_hero", ex["id"]))["mine"] is False, "example heroes can be copied by anyone"
demo_book = T.books.search(is_demo=True)[0]
gb = ok(call("get_book", demo_book.get_id()))
assert gb["book"]["demo"] and not gb["book"]["mine"] and gb["book"]["share_key"] is None

# ---------------------------------------------------------------------------------- heroes
as_user(ana)
bad(call("save_hero", None, " ", "she", {"hair": "curly"}), "needs a name")
bad(call("save_hero", None, "Mila", "it", {"hair": "curly"}), "pronoun must be she/he/they")
bad(call("save_hero", None, "Mila", "she", "not a dict"))
bad(call("save_hero", None, "Mila", "she", {"evil": "x"}), "an empty look after cleaning is refused")
mila = ok(call("save_hero", None, "  Mila  ", "she", {"hair": "curly", "skin": "s3", "evil": "x", "hairColor": "<script>", "cheeks": True}))["hero"]
assert mila["name"] == "Mila" and "evil" not in mila["look"] and "hairColor" not in mila["look"] and mila["look"]["cheeks"] is True
# the newer choices (ages, face paint, head coverings) are kept
nu = ok(call("save_hero", mila["id"], "Mila", "she", {"size": "a12", "mark": "stars", "hat": "hijab", "hair": "curlylong", "outfit": "astro"}))["hero"]
assert nu["look"] == {"size": "a12", "mark": "stars", "hat": "hijab", "hair": "curlylong", "outfit": "astro"}, nu["look"]
ok(call("save_hero", mila["id"], "Mila Rose", "she", {"hair": "bob"}))
h = ok(call("get_hero", mila["id"]))
assert h["hero"]["name"] == "Mila Rose" and h["mine"] and h["hero"]["look"] == {"hair": "bob"}
bad(call("save_hero", ex["id"], "Mine now", "she", {"hair": "bob"}), "example heroes can't be edited")
as_user(bob)
bad(call("get_hero", mila["id"]), "heroes are private")
bad(call("save_hero", mila["id"], "Hack", "he", {"hair": "bob"}))
bad(call("delete_hero", mila["id"]))
assert call("get_library")["heroes"] == []

# ---------------------------------------------------------------------------------- books
as_user(ana)
bad(call("make_book", mila["id"], "nope"))
bad(call("make_book", ex["id"], "bears"), "books star your own heroes")
b = ok(call("make_book", mila["id"], "bears", "For Mila"))["book"]
assert b["mine"] and b["story"]["key"] == "bears" and b["dedication"] == "For Mila" and not b["shared"] and b["hero"]["name"] == "Mila Rose"
again = ok(call("make_book", mila["id"], "bears", ""))
assert again["existed"] and again["book"]["id"] == b["id"] and again["book"]["dedication"] == "For Mila", "the same book isn't made twice"
ok(call("make_book", mila["id"], "pea"))
shelf = call("get_shelf")
assert len(shelf["books"]) == 2 and shelf["stats"]["books"] == 2 and len(shelf["heroes"]) == 1 and shelf["heroes"][0]["books"] == 2
assert len(shelf["examples"]) == len(DD.DEMO_BOOKS) and all(x["demo"] and not x["mine"] for x in shelf["examples"])
assert len(ok(call("get_book", b["id"]))["story"]["text"]) == 9
ok(call("book_read", b["id"]))
ok(call("book_read", b["id"]))
assert call("get_book", b["id"])["book"]["times_read"] == 2 and call("get_shelf")["stats"]["reads"] == 2
assert ok(call("update_book", b["id"], "  Love you  "))["book"]["dedication"] == "Love you"
sh = ok(call("share_book", b["id"], True))["book"]
key = sh["share_key"]
assert key and sh["shared"]
as_user(None)
shared = ok(call("get_shared_book", key))
assert shared["book"]["hero"]["name"] == "Mila Rose" and "id" not in shared["book"]["hero"] and shared["book"]["share_key"] is None
assert "ana@example.com" not in json.dumps(shared) and len(shared["story"]["text"]) == 9
bad(call("get_shared_book", "short"))
bad(call("get_shared_book", "x" * 20))
bad(call("get_shared_book", None))
bad(call("get_book", b["id"]), "books are private")
as_user(bob)
bad(call("get_book", b["id"]))
bad(call("update_book", b["id"], "x"))
bad(call("share_book", b["id"], True))
bad(call("delete_book", b["id"]))
assert call("get_shelf")["books"] == []
ok(call("book_read", b["id"]))
as_user(ana)
assert call("get_book", b["id"])["book"]["times_read"] == 2, "someone else's read doesn't count"
ok(call("share_book", b["id"], False))
as_user(None)
bad(call("get_shared_book", key), "a link that was turned off stops working")

# ---------------------------------------------------------------------------------- recorded voice (Voice.py)
import anvil  # noqa: E402
V = M["Voice"]
snd = lambda n=3000, t="audio/webm;codecs=opus": anvil.BlobMedia(t, (bytes(range(256)) * (n // 256 + 1))[:n], name="rec")
as_user(ana)
assert call("get_book", b["id"])["book"]["voice"] == {}
r = ok(call("save_voice", b["id"], 2, snd(), 4.26))
assert r["page"] == 2 and list(r["voice"]) == ["2"] and r["voice"]["2"]["seconds"] == 4.3
k1 = r["voice"]["2"]["key"]
row = T.voice_pages.get(key=k1)
assert row["audio"].content_type == "audio/webm", "codecs are dropped from the stored type"
r = ok(call("save_voice", b["id"], 2, snd(5000, "audio/mp4"), 6))
assert len(T.voice_pages.search(book=T.books.get_by_id(b["id"]), page=2)) == 1 and r["voice"]["2"]["key"] != k1, "redo replaces the page"
k2 = r["voice"]["2"]["key"]
ok(call("save_voice", b["id"], 0, snd(), 2))
ok(call("save_voice", b["id"], 11, snd(), 2))
bad(call("save_voice", b["id"], 12, snd(), 2), "past The End")
bad(call("save_voice", b["id"], -1, snd(), 2))
bad(call("save_voice", b["id"], 2.5, snd(), 2))
bad(call("save_voice", b["id"], True, snd(), 2))
bad(call("save_voice", b["id"], "2", snd(), 2))
bad(call("save_voice", b["id"], 3, "not media", 2))
bad(call("save_voice", b["id"], 3, anvil.BlobMedia("image/png", b"x" * 3000), 2), "only sound")
bad(call("save_voice", b["id"], 3, snd(50), 2), "empty recording")
bad(call("save_voice", b["id"], 3, snd(V.MAX_BYTES + 10), 2), "too big")
assert ok(call("save_voice", b["id"], 3, snd(), "x"))["voice"]["3"]["seconds"] == 0
assert ok(call("save_voice", b["id"], 4, snd(3000, "video/webm"), 9999))["voice"]["4"]["seconds"] == V.MAX_SECONDS
assert T.voice_pages.get(key=call("get_book", b["id"])["book"]["voice"]["4"]["key"])["audio"].content_type == "audio/webm"
assert sorted(call("get_book", b["id"])["book"]["voice"]) == ["0", "11", "2", "3", "4"]
ok(call("delete_voice", b["id"], 3))
ok(call("delete_voice", b["id"], 4))
bad(call("delete_voice", b["id"], 40))
assert sorted(ok(call("delete_voice", b["id"], 0))["voice"]) == ["11", "2"]
# the audio endpoint: whole file, byte ranges (Safari), unknown keys
ep = anvil.server.ENDPOINTS["/voice/:key"]
anvil.server.request.headers = {}
res = ep(key=k2)
assert res.status == 200 and res.headers["Content-Type"] == "audio/mp4" and res.body.length == T.voice_pages.get(key=k2)["audio"].length
anvil.server.request.headers = {"range": "bytes=0-99"}
res = ep(key=k2)
assert res.status == 206 and res.body.length == 100 and res.headers["Content-Range"].startswith("bytes 0-99/")
anvil.server.request.headers = {"range": "bytes=-10"}
assert ep(key=k2).body.length == 10
anvil.server.request.headers = {"range": "bytes=999999-"}
assert ep(key=k2).status == 416
anvil.server.request.headers = {"if-none-match": '"%s"' % k2}
assert ep(key=k2).status == 304, "the browser's copy is still good"
anvil.server.request.headers = {}
assert ep(key=k2).headers["Cache-Control"] == "private, no-cache"
assert ep(key=k1).status == 404, "a replaced recording's address is gone"
assert ep(key="short").status == 404 and ep(key="../../etc/passwd-xxxxxxxxxxxxxxx").status == 404
# family link: the visitor gets the voice; turning the link off (or a new link) changes the audio addresses
sh2 = ok(call("share_book", b["id"], True))["book"]
as_user(None)
fam = ok(call("get_shared_book", sh2["share_key"]))["book"]["voice"]
assert sorted(fam) == ["11", "2"] and fam["2"]["key"] != k2, "a new family link means new audio addresses"
assert ep(key=k2).status == 404 and ep(key=fam["2"]["key"]).status == 200
assert denied("save_voice", b["id"], 2, snd(), 2) and denied("delete_voice", b["id"], 2)
as_user(bob)
bad(call("save_voice", b["id"], 2, snd(), 2), "someone else's book")
bad(call("delete_voice", b["id"], 2))
bad(call("delete_voice", b["id"]))
assert len(T.voice_pages.search()) == 2
as_user(ana)
ok(call("share_book", b["id"], False))
assert ep(key=fam["2"]["key"]).status == 404, "turning the family link off stops the old audio addresses"
demo_book = T.books.search(is_demo=True)[0]
bad(call("save_voice", demo_book.get_id(), 2, snd(), 2), "example books can't be recorded")
assert ok(call("delete_voice", b["id"]))["voice"] == {} and not T.voice_pages.search(), "delete all"
ok(call("save_voice", b["id"], 5, snd(), 3))  # removed with the hero below

# ---------------------------------------------------------------------------------- painted edition (Painting.py)
import hashlib  # noqa: E402
import hmac  # noqa: E402
import anvil.http as H  # noqa: E402
import anvil.secrets as S  # noqa: E402
P = M["Painting"]
API = P.DEFAULT_API
P.CHECK_EVERY = 0  # check the studio on every call in the tests
JOBS = {}
STUDIO = {"down": False, "n": 0}


def fake_studio(url, method, data):
    """A tiny Image Enhancer: jobs in JOBS, statuses changed by the test."""
    if STUDIO["down"]:
        raise H.HttpError(503, json.dumps({"ok": False, "error": "Image Enhancer is restarting."}))
    path = url[len(API):]
    if path == "/jobs" and method == "POST":
        body = json.loads(data)
        if body["style"] == "nope":
            raise H.HttpError(400, json.dumps({"ok": False, "error": "Unknown style."}))
        STUDIO["n"] += 1
        jid = "job_%04d" % STUDIO["n"]
        JOBS[jid] = {"id": jid, "status": "queued", "style": body["style"], "fidelity": body["fidelity"],
                     "ref": body.get("ref"), "callback": body.get("callback_url"), "prompt": body.get("prompt"),
                     "format": body.get("format"), "size": body.get("size"), "image_len": len(body["image"]),
                     "eta_at": (now + dt.timedelta(minutes=5)).isoformat(), "error": None}
        return json.dumps({"ok": True, "job": JOBS[jid]})
    if path.startswith("/jobs?status=open"):
        return json.dumps({"ok": True, "jobs": [j for j in JOBS.values() if j["status"] in ("queued", "working")]})
    if path == "/queue":
        return json.dumps({"ok": True, "pc_online": True, "paused": False, "queue_length": 2, "average_seconds": 45,
                           "eta_new_job_seconds": 120})
    parts = path.split("?")[0].split("/")  # ["", "jobs", id, ...]
    jid = parts[2] if len(parts) > 2 else ""
    if jid not in JOBS:
        raise H.HttpError(404, json.dumps({"ok": False, "error": "No job %s for this key." % jid}))
    if path.endswith("/result"):
        return anvil.BlobMedia("image/jpeg", b"\xff\xd8\xff" + jid.encode() * 200, name="result.jpg")
    if path.endswith("/cancel"):
        JOBS[jid]["status"] = "cancelled"
    return json.dumps({"ok": True, "job": JOBS[jid]})


H.REPLIES[API] = fake_studio
png = lambda n=4000, t="image/png": anvil.BlobMedia(t, (b"\x89PNG\r\n\x1a\n" + bytes(range(256)) * (n // 256 + 1))[:n], name="p.png")
as_user(ana)
bk = b["id"]
bk_row = T.books.get_by_id(bk)
assert call("get_book", bk)["book"]["paint"] == {} and call("get_book", bk)["book"]["paint_state"] is None
# the studio isn't set up yet: the dialog says so, nothing is sent
info = ok(call("paint_info", bk))
assert info["ready"] is False and info["queue"] is None and len(info["styles"]) == 6 and info["pages"] == 12
bad(call("paint_page", bk, 0, "kids_book", png()), "no key yet")
S.SECRETS["image_enhancer_key"] = "ie_test_key"
info = ok(call("paint_info", bk))
assert info["ready"] and info["queue"]["online"] and info["queue"]["waiting"] == 2 and info["state"] is None
# bad input and people who aren't allowed
bad(call("paint_page", bk, 12, "kids_book", png()), "past The End")
bad(call("paint_page", bk, -1, "kids_book", png()))
bad(call("paint_page", bk, "1", "kids_book", png()))
bad(call("paint_page", bk, 1, "realistic", png()), "only the picture-book styles")
bad(call("paint_page", bk, 1, "kids_book", "not media"))
bad(call("paint_page", bk, 1, "kids_book", png(t="text/html")), "only pictures")
bad(call("paint_page", bk, 1, "kids_book", png(100)), "too small")
bad(call("paint_page", bk, 1, "kids_book", png(P.MAX_BYTES + 10)), "too big")
bad(call("paint_page", T.books.search(is_demo=True)[0].get_id(), 1, "kids_book", png()), "example books can't be painted")
as_user(bob)
for fn, args in (("paint_info", (bk,)), ("paint_page", (bk, 0, "kids_book", png())), ("paint_status", (bk,)), ("paint_remove", (bk,))):
    bad(call(fn, *args), "someone else's book: " + fn)
as_user(None)
assert denied("paint_info", bk) and denied("paint_page", bk, 0, "kids_book", png()) and denied("paint_status", bk)
assert not T.paintings.search() and not JOBS
# send every page; no webhook secret yet = no callback address
as_user(ana)
for i in range(12):
    r = ok(call("paint_page", bk, i, "kids_book", png()))
    assert r["page"] == i and r["status"] == "queued", r
assert len(JOBS) == 12 and all(j["fidelity"] == "strict" and j["callback"] is None and j["format"] == "jpeg" for j in JOBS.values())
assert JOBS["job_0001"]["ref"] == "lhb:%s:0" % bk and "Add nothing new" in JOBS["job_0001"]["prompt"]
assert JOBS["job_0001"]["prompt"].startswith("The child has "), "the hero in words comes first"
assert "book" not in P.PROMPT.lower() and "page" not in P.PROMPT.lower(), "the model paints an open book when told 'page of a book'"
assert P.hero_words({"skin": "s2", "hair": "curly", "hairColor": "ginger", "freckles": True, "glasses": "round", "hat": "none"}) ==     "The child has fair skin, ginger curly hair, freckles and round glasses."
assert P.hero_words({"skin": "s20", "hair": "none", "hat": "hijab"}) == "The child has very deep brown skin, no hair yet and a hijab."
assert P.hero_words(None) == "" and P.hero_words({}) == "" and P.hero_words({"skin": "zz"}) == ""
worst = {"skin": "s16", "hair": "curlylong", "hairColor": "strawberry", "freckles": True, "glasses": "star", "hat": "flower"}
for st in P.BY_STYLE:
    hero_row = type("H", (), {"__getitem__": lambda self, k: worst})()
    book_row = {"hero": hero_row}
    assert len(P.prompt_for(book_row, st)) <= P.MAX_PROMPT, st
st = call("get_book", bk)["book"]["paint_state"]
assert st["status"] == "painting" and st["open"] == 12 and st["done"] == 0 and st["total"] == 12 and st["style_label"] == "Storybook"
assert 0 < st["seconds_left"] <= 300 and st["page_status"]["11"] == "queued"
# the studio finishes some: one status call for all open jobs (more than 3 open), then the finished ones
JOBS["job_0001"]["status"] = "done"
JOBS["job_0003"]["status"] = "working"
JOBS["job_0005"].update(status="failed", error="Out of memory on the studio PC.")
del H.CALLS[:]
r = ok(call("paint_status", bk))
assert any("/jobs?status=open" in c["url"] for c in H.CALLS), "one list call when many pages are open"
assert list(r["paint"]) == ["0"] and r["state"]["done"] == 1 and r["state"]["failed"] == 1 and r["state"]["working"] == 1
assert r["state"]["error"] == "Out of memory on the studio PC." and r["state"]["page_status"]["4"] == "failed"
k0 = r["paint"]["0"]["key"]
row0 = T.paintings.get(key=k0)
assert row0["picture"].content_type == "image/jpeg" and row0["picture_style"] == "kids_book" and row0["status"] == "done"
assert call("get_book", bk)["book"]["paint"]["0"]["key"] == k0
# the picture endpoint
ep = anvil.server.ENDPOINTS["/painting/:key"]
anvil.server.request.headers = {}
res = ep(key=k0)
assert res.status == 200 and res.headers["Content-Type"] == "image/jpeg" and res.headers["Cache-Control"] == "private, no-cache"
anvil.server.request.headers = {"if-none-match": '"%s"' % k0}
assert ep(key=k0).status == 304
anvil.server.request.headers = {}
assert ep(key="x" * 24).status == 404 and ep(key="../../secret").status == 404
# a job the studio forgot is sent again; the studio being down keeps pages waiting
del JOBS["job_0012"]
ok(call("paint_status", bk))
assert T.paintings.get(book=bk_row, page=11)["status"] == "queued" and "job_0013" in JOBS, "sent again after a 404"
STUDIO["down"] = True
r = ok(call("paint_page", bk, 3, "kids_book", png()))
assert r["status"] == "sending", "kept, to be sent again"
row3 = T.paintings.get(book=bk_row, page=3)
assert row3["status"] == "sending" and "restarting" in row3["error"]
ok(call("paint_status", bk))  # still down: nothing breaks
STUDIO["down"] = False
ok(call("paint_status", bk))
assert T.paintings.get(book=bk_row, page=3)["status"] == "queued", "sent once the studio answers"
# repainting a done page in another style keeps the old picture until the new one is ready
ok(call("paint_page", bk, 0, "watercolor", png()))
r = ok(call("paint_status", bk))
assert r["paint"]["0"]["key"] == k0 and r["paint"]["0"]["style"] == "kids_book" and r["state"]["page_status"]["0"] == "queued"
new0 = T.paintings.get(book=bk_row, page=0)["job_id"]
JOBS[new0]["status"] = "done"
r = ok(call("paint_status", bk))
assert r["paint"]["0"]["key"] != k0 and r["paint"]["0"]["style"] == "watercolor" and ep(key=k0).status == 404
# replacing a page that is still waiting cancels its old job
old5 = T.paintings.get(book=bk_row, page=5)["job_id"]
ok(call("paint_page", bk, 5, "kids_book", png()))
assert JOBS[old5]["status"] == "cancelled" and len(T.paintings.search(book=bk_row, page=5)) == 1
# the webhook: signed with the webhook secret; with the secret set, new pages carry the callback address
S.SECRETS["image_enhancer_webhook_secret"] = "whsec_test"
ok(call("paint_page", bk, 4, "kids_book", png()))
j4 = T.paintings.get(book=bk_row, page=4)["job_id"]
assert JOBS[j4]["callback"] == "https://app-test.anvil.app/_/api/paint-done"
hook = anvil.server.ENDPOINTS["/paint-done"]
JOBS[j4]["status"] = "done"
body = json.dumps({"event": "job.done", "job": JOBS[j4]}).encode()
anvil.server.request.body = body
anvil.server.request.headers = {"X-Enhancer-Signature": "sha256=" + "0" * 64}
assert hook().status == 403 and T.paintings.get(book=bk_row, page=4)["status"] != "done", "a bad signature changes nothing"
anvil.server.request.headers = {"X-Enhancer-Signature": "sha256=" + hmac.new(b"whsec_test", body, hashlib.sha256).hexdigest()}
assert hook().status == 200 and T.paintings.get(book=bk_row, page=4)["status"] == "done", "the webhook saves the picture"
anvil.server.request.headers, anvil.server.request.body = {}, None
# the daily limit counts new pages only
P.PAGES_PER_DAY = len(T.paintings.search())
ok(call("paint_page", bk, 4, "kids_book", png()), "repainting a page isn't a new page")
made = ok(call("make_book", mila["id"], "goats"))
assert made["existed"] is False
bk2 = made["book"]["id"]
bad(call("paint_page", bk2, 0, "kids_book", png()), "daily limit")
P.PAGES_PER_DAY = 150
# the family link shows the painted pictures; a new link changes their addresses
done_keys = dict((k, v["key"]) for k, v in call("get_book", bk)["book"]["paint"].items())
sh = ok(call("share_book", bk, True))["book"]
as_user(None)
fam = ok(call("get_shared_book", sh["share_key"]))["book"]
assert sorted(fam["paint"]) == sorted(done_keys) and "paint_state" not in fam
assert all(fam["paint"][k]["key"] != done_keys[k] for k in done_keys) and all(ep(key=v).status == 404 for v in done_keys.values())
as_user(ana)
ok(call("share_book", bk, False))
# back to the drawings: rows go, waiting jobs are cancelled
waiting = [r["job_id"] for r in T.paintings.search(book=bk_row) if r["status"] == "queued"]
r = ok(call("paint_remove", bk))
assert r["paint"] == {} and r["state"] is None and not T.paintings.search(book=bk_row)
assert waiting and all(JOBS[j]["status"] == "cancelled" for j in waiting)
# saved styles: every finished picture is kept per style; "Back to the drawings" keeps them; switching back reuses them
sv = ok(call("paint_info", bk))["saved"]
assert sv.get("watercolor") == [0] and 0 in sv.get("kids_book", []) and 4 in sv["kids_book"], sv
n_jobs = len(JOBS)
r = ok(call("paint_saved", bk, "watercolor"))
assert r["used"] == [0] and r["missing"] == list(range(1, 12)) and len(JOBS) == n_jobs, "nothing sent again"
assert r["paint"]["0"]["style"] == "watercolor" and r["state"]["page_status"]["0"] == "done"
k_saved = r["paint"]["0"]["key"]
anvil.server.request.headers = {}
assert ep(key=k_saved).status == 200, "a reused picture gets its own address"
r = ok(call("paint_saved", bk, "kids_book"))
assert sorted(r["used"]) == sorted(sv["kids_book"]) and r["paint"]["0"]["style"] == "kids_book" and len(JOBS) == n_jobs
assert ep(key=k_saved).status == 404, "switching style retires the old address"
assert ok(call("paint_saved", bk, "comic"))["used"] == [], "a style never painted has nothing saved"
bad(call("paint_saved", bk, "nope"))
as_user(bob)
bad(call("paint_saved", bk, "kids_book"))
bad(call("paint_forget", bk))
as_user(None)
assert denied("paint_saved", bk, "kids_book") and denied("paint_forget", bk)
as_user(ana)
ok(call("paint_remove", bk))
assert ok(call("paint_info", bk))["saved"].get("watercolor") == [0], "back to the drawings keeps the saved styles"
# a new painting of a page replaces its saved picture once done
ok(call("paint_page", bk, 0, "watercolor", png()))
j0 = T.paintings.get(book=bk_row, page=0)["job_id"]
JOBS[j0]["status"] = "done"
ok(call("paint_status", bk))
assert len(T.saved_paintings.search(book=bk_row, page=0, style="watercolor")) == 1
# editing the hero changes the look: saved pictures stop matching and go when the dialog opens
ok(call("save_hero", mila["id"], "Mila", "she", {"hair": "bob", "skin": "s5"}))
assert ok(call("paint_info", bk))["saved"] == {} and not T.saved_paintings.search(book=bk_row), "pruned after a hero edit"
assert ok(call("paint_saved", bk, "watercolor"))["used"] == []
# the new look is saved again, and paint_forget deletes saved pictures but keeps the painting on show
ok(call("paint_page", bk, 2, "comic", png()))
JOBS[T.paintings.get(book=bk_row, page=2)["job_id"]]["status"] = "done"
ok(call("paint_status", bk))
assert ok(call("paint_info", bk))["saved"] == {"comic": [2]}
assert ok(call("paint_forget", bk))["saved"] == {} and not T.saved_paintings.search(book=bk_row)
assert ok(call("paint_status", bk))["paint"]["2"]["style"] == "comic", "the painting on show stays"
ok(call("paint_page", bk, 1, "comic", png()))  # removed with the hero below
ok(call("paint_page", bk2, 1, "comic", png()))
ok(call("delete_book", bk2))
assert not [x for x in T.paintings.search() if x["book"] is None or x["book"].get_id() == bk2] and T.paintings.search(book=bk_row),     "removing a book removes its paintings (and only its own)"
# admin: the studio's address, the secrets, a connection check
assert denied("admin_painting") and denied("admin_painting_save", "https://x.anvil.app") and denied("admin_painting_check")
as_user(admin)
d = call("admin_painting")
assert d["key"] and d["webhook"] and d["api"] == API and not d["custom"] and d["stats"]["books"] == 1
bad(call("admin_painting_save", "not a web address"))
r = ok(call("admin_painting_save", "https://image-enhancer-live.anvil.app/"))
assert r["api"] == "https://image-enhancer-live.anvil.app/_/api/v1" and call("admin_painting")["custom"]
assert ok(call("admin_painting_save", "https://image-enhancer-live.anvil.app/_/api"))["api"].endswith(".app/_/api/v1")
bad(call("admin_painting_check"), "the new address has no fake studio")
assert ok(call("admin_painting_save", ""))["api"] == API
c = ok(call("admin_painting_check"))
assert c["online"] and c["waiting"] == 2
S.SECRETS.pop("image_enhancer_key")
bad(call("admin_painting_check"), "no key")
S.SECRETS["image_enhancer_key"] = "ie_test_key"
as_user(ana)

# limits, and removing a hero removes their books
as_user(ana)
for i in range(11):
    ok(call("save_hero", None, "Kid %d" % i, "they", {"hair": "crop"}))
bad(call("save_hero", None, "One too many", "they", {"hair": "crop"}))
assert ok(call("delete_hero", mila["id"]))["removed_books"] == 2
assert not T.voice_pages.search(), "removing a hero removes the recordings of their books"
assert not T.paintings.search(), "removing a hero removes the paintings of their books"
assert not T.saved_paintings.search(), "removing a hero removes the saved styles of their books"
assert call("get_shelf")["books"] == [] and not T.books.search(owner=ana)
pea = ok(call("make_book", T.heroes.search(owner=ana)[0].get_id(), "pea"))["book"]
ok(call("save_voice", pea["id"], 1, snd(), 3))
ok(call("delete_book", pea["id"]))
assert not T.voice_pages.search(), "removing a book removes its recordings"
ok(call("delete_book", pea["id"]), "deleting twice is fine")

# ---------------------------------------------------------------------------------- admin: library + demo data
as_user(ana)
assert denied("admin_library")
as_user(admin)
assert len(call("admin_library")["stories"]) == 12
ov = call("admin_overview")
assert ov["heroes"] == 11 and ov["books"] == 0 and ov["shared"] == 0
ok(call("demo_remove"))
assert DD.state() == "removed" and not T.heroes.search(is_demo=True) and not T.books.search(is_demo=True) and len(T.heroes.search()) == 11
assert not T.users.search(is_demo=True)
as_user(None)
call("get_library")
assert DD.state() == "removed", "removed demo data doesn't come back by itself"
as_user(admin)
ok(call("demo_load"))
ok(call("demo_load"))
assert len(T.heroes.search(is_demo=True)) == len(DD.DEMO_HEROES) and len(T.books.search(is_demo=True)) == len(DD.DEMO_BOOKS), "reloading replaces the demo"

# ---------------------------------------------------------------------------------- Privacy & Terms
if "legal_server" in M:
    as_user(ana)
    st = call("legal_state")
    assert st["signedIn"] and st["accepted_version"] is None
    ok(call("legal_accept", st["version"], "signup"))
    assert ana["legal_source"] == "signup" and call("legal_state")["accepted_version"] == st["version"]

# ---------------------------------------------------------------------------------- every callable is covered by a permission check
# A callable that changes data without require_user / a C.require_* check is a security hole. List the public ones here.
PUBLIC = {"get_me", "submit_feedback", "legal_state", "legal_accept", "get_story", "get_hero", "get_library", "get_book",
          "get_shared_book"}
for name, (f, need) in sorted(anvil.server.CALLABLES.items()):
    if name in PUBLIC:
        continue
    assert need, "%s is callable by anyone: add require_user=True (or list it in PUBLIC in test_server.py)" % name

print("ALL OK (%d server functions)" % len(anvil.server.CALLABLES))
