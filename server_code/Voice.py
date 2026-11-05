"""Voice recordings: a parent reads their book aloud, page by page, and the family link plays that voice.

One row per recorded page (table voice_pages): the book, the page index (0 = cover, 1 = "This book belongs to",
2..10 = the story, 11 = The End), the audio as Media, its length and a random key. The audio is served by the
/voice/<key> endpoint with byte ranges (Safari and iPhones won't play audio without them). Only the key reaches the
browser: the owner gets it from get_book, family members from get_shared_book. Turning the family link off (or making
a new one) gives every recording a new key, so old audio addresses stop working too.
"""
import re
import secrets

import anvil
import anvil.server
from anvil.tables import app_tables

from . import common as C
from . import Stories

MAX_BYTES = 4 * 1024 * 1024   # a page read aloud is ~20-60 s, ~0.2-0.5 MB at 64 kbit/s
MAX_SECONDS = 180
KEY_RE = re.compile(r"^[A-Za-z0-9_-]{20,40}$")


def _key():
    return secrets.token_urlsafe(18)


def page_count(book_row):
    s = Stories.BY_KEY.get(book_row["story"])
    return (len(s["pages"]) + 3) if s else 0  # cover + dedication + story pages + The End


def voice_for(book_row):
    """{"<page>": {"key", "seconds"}} for one book (JSON keys are strings)."""
    out = {}
    for r in app_tables.voice_pages.search(book=book_row):
        out[str(int(r["page"]))] = {"key": r["key"], "seconds": round(float(r["seconds"] or 0), 1)}
    return out


def delete_for(book_row):
    """Removes every recording of a book (used when the book or its hero is removed)."""
    for r in app_tables.voice_pages.search(book=book_row):
        r.delete()


def new_keys(book_row):
    """Fresh keys for every recording of a book: old audio addresses stop working."""
    for r in app_tables.voice_pages.search(book=book_row):
        r["key"] = _key()


def _own_book(book_id, me):
    r = C.row_by_id(app_tables.books, book_id)
    if r is None or r["owner"] != me or r["is_demo"]:
        return None
    return r


def _page(value, book_row):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or int(value) != value:
        return None
    p = int(value)
    return p if 0 <= p < page_count(book_row) else None


@anvil.server.callable(require_user=True)
def save_voice(book_id, page, audio, seconds):
    """Saves (or replaces) the recording of one page of your own book."""
    me = C.require_user()
    r = _own_book(book_id, me)
    if r is None:
        return C.fail("You can only record your own books.")
    p = _page(page, r)
    if p is None:
        return C.fail("That page isn't in this book.")
    if not isinstance(audio, anvil.Media):
        return C.fail("The recording didn't arrive. Please try again.")
    ctype = (audio.content_type or "").split(";")[0].strip().lower()
    if not ctype.startswith("audio/") and ctype != "video/webm":  # some browsers label sound-only WebM as video
        return C.fail("That isn't a sound recording.")
    if ctype == "video/webm":
        ctype = "audio/webm"
    size = audio.length or 0
    if size < 200:
        return C.fail("The recording was empty. Check your microphone and try again.")
    if size > MAX_BYTES:
        return C.fail("That recording is too long. Keep each page under %d minutes." % (MAX_SECONDS // 60))
    try:
        secs = float(seconds)
    except (TypeError, ValueError):
        secs = 0.0
    secs = max(0.0, min(float(MAX_SECONDS), secs))
    for old in app_tables.voice_pages.search(book=r, page=p):
        old.delete()
    app_tables.voice_pages.add_row(book=r, page=p, audio=anvil.BlobMedia(ctype, audio.get_bytes(), name="page-%d" % p),
                                   seconds=secs, key=_key(), created=C.now())
    return C.ok(page=p, voice=voice_for(r))


@anvil.server.callable(require_user=True)
def delete_voice(book_id, page=None):
    """Deletes the recording of one page, or of every page (page None)."""
    me = C.require_user()
    r = _own_book(book_id, me)
    if r is None:
        return C.fail("You can only change your own books.")
    if page is None:
        delete_for(r)
    else:
        p = _page(page, r)
        if p is None:
            return C.fail("That page isn't in this book.")
        for old in app_tables.voice_pages.search(book=r, page=p):
            old.delete()
    return C.ok(voice=voice_for(r))


def _range(raw, header):
    """(status, body bytes, extra headers) honouring a single "Range: bytes=a-b" request (Safari needs it)."""
    m = re.match(r"^bytes=(\d*)-(\d*)$", (header or "").strip())
    n = len(raw)
    if not m or (not m.group(1) and not m.group(2)):
        return 200, raw, {}
    if m.group(1):
        a = int(m.group(1))
        b = min(int(m.group(2)), n - 1) if m.group(2) else n - 1
    else:
        a, b = max(0, n - int(m.group(2))), n - 1
    if a >= n or a > b:
        return 416, b"", {"Content-Range": "bytes */%d" % n}
    return 206, raw[a:b + 1], {"Content-Range": "bytes %d-%d/%d" % (a, b, n)}


@anvil.server.http_endpoint("/voice/:key")
def voice_file(key, **kw):
    """The audio of one recorded page. The key is the only way in (it changes when the family link changes)."""
    key = str(key or "")
    row = app_tables.voice_pages.get(key=key) if KEY_RE.match(key) else None
    if row is None or row["audio"] is None:
        return anvil.server.HttpResponse(404, "Not found", headers={"Content-Type": "text/plain"})
    media = row["audio"]
    # A key's audio never changes (Redo makes a new key), so the key is the ETag. "no-cache" makes the browser ask
    # again each time (a cheap 304), so a deleted recording or a turned-off family link stops at once.
    etag = '"%s"' % key
    headers = {"Content-Type": media.content_type or "audio/webm", "Cache-Control": "private, no-cache", "ETag": etag,
               "Accept-Ranges": "bytes"}
    req = getattr(anvil.server, "request", None)
    req_headers = (getattr(req, "headers", None) or {}) if req is not None else {}
    if req_headers.get("if-none-match") == etag:
        return anvil.server.HttpResponse(304, "", headers=headers)
    rng = req_headers.get("range")
    raw = media.get_bytes()
    status, body, extra = _range(raw, rng) if rng else (200, raw, {})
    headers.update(extra)
    return anvil.server.HttpResponse(status, anvil.BlobMedia(headers["Content-Type"], body), headers=headers)
