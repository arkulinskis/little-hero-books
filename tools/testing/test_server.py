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

# limits, and removing a hero removes their books
as_user(ana)
for i in range(11):
    ok(call("save_hero", None, "Kid %d" % i, "they", {"hair": "crop"}))
bad(call("save_hero", None, "One too many", "they", {"hair": "crop"}))
assert ok(call("delete_hero", mila["id"]))["removed_books"] == 2
assert not T.voice_pages.search(), "removing a hero removes the recordings of their books"
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
