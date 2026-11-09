"""The painted edition: every picture of a book repainted in a picture-book style by Image Enhancer.

Image Enhancer is Arkvital's own image service (github.com/arkulinskis/image-enhancer): an Anvil app with a queue,
and a PC that repaints one picture at a time with an open image model (FLUX.2 [klein] 4B in ComfyUI). Nothing goes
to an outside AI company. This module is the only part of Little Hero Books that talks to it (enhancer_client.py).

How a book gets painted:
  1. On the book page the owner presses "Paint this book" and picks a style (Dialogs/Paint). The browser draws each
     page's picture as a PNG (LH.paintPicture: the cover, the dedication portrait, every story picture, the waving
     hero on The End) and sends them one by one: paint_page(book_id, page, style, png).
  2. paint_page keeps the drawing (column `source`) and sends it to Image Enhancer, asking it to keep the scene and
     the child's look (fidelity "strict"). The row remembers the job id and the estimated finish time.
  3. The picture comes back two ways: Image Enhancer calls the webhook /paint-done when a job finishes (signed with
     the webhook secret), and paint_status (the book page asks every 15 s while pages are open) checks the jobs too.
     Either way the result is saved in `picture` with a fresh random `key`; /painting/<key> serves it.
  4. The reader shows painted pictures where there are any (a Painted / Drawn switch), the family link too, and the
     PDF can use them. Repainting keeps the old picture on screen until the new one arrives.

One row per page in table `paintings` (page 0 = cover, 1 = the dedication page, 2.. = the story, last = The End;
the same numbers as voice_pages). Statuses: sending (not accepted by the service yet: tried again on the next
check), queued, working, done, failed.

Setup (the Anvil side): App Secrets `image_enhancer_key` (a key made on Image Enhancer's Apps & keys page) and
`image_enhancer_webhook_secret` (shown with it). The service's address: Admin -> Painting (app_settings
"enhancer_api"), else the App Secret `image_enhancer_url`, else enhancer_client.API.
"""
import datetime as dt
import re
import secrets

import anvil
import anvil.secrets
import anvil.server
from anvil.tables import app_tables
import anvil.tables.query as q

from . import common as C
from . import Voice
from . import enhancer_client as enhancer

STYLES = [
    {"key": "kids_book", "label": "Storybook", "note": "Soft gouache paint, like a classic bedtime picture book."},
    {"key": "watercolor", "label": "Watercolour", "note": "Light washes of colour on textured paper."},
    {"key": "cartoon_3d", "label": "3D cartoon", "note": "Round, soft and glossy, like an animated film."},
    {"key": "claymation", "label": "Clay", "note": "Little modelling-clay figures in a handmade set."},
    {"key": "comic", "label": "Comic book", "note": "Bold ink lines and bright, flat colours."},
    {"key": "fantasy", "label": "Fairy-tale painting", "note": "Rich, glowing colours, like an old book of fairy tales."},
]
BY_STYLE = {s["key"]: s for s in STYLES}
DEFAULT_API = enhancer.API
OPEN = ("sending", "queued", "working")
MAX_BYTES = 8 * 1024 * 1024          # a page picture is ~0.3-1.5 MB as PNG
PAGES_PER_DAY = 150                 # per person: about ten books a day
CHECK_EVERY = 10                    # seconds between two checks of the same book's jobs
KEY_RE = re.compile(r"^[A-Za-z0-9_-]{20,40}$")
# Asked of the painter on every page, after the style (the service adds "keep the composition" for strict).
# Don't say "page" or "book" here: the model then paints an open book into the picture (2026-11-09 previews).
PROMPT = ("Keep every character, the animals too, in the same place, size and pose, with the same face, hair, skin tone, "
          "glasses, clothes and colours. Gentle and friendly for young children. Add nothing new and no text.")
# Extra words for styles that drifted in the 2026-11-09 previews (fantasy turned the meadow into a forest with a creature;
# clay darkened the hero's skin and lost the glasses).
STYLE_EXTRA = {
    "fantasy": "Keep the same place, house, trees and sky; make it magical only with light and colour.",
    "claymation": "Model the child in clay of exactly the drawn skin colour.",
    "cartoon_3d": "Keep the glasses and freckles if drawn.",
}
MAX_PROMPT = 600  # Image Enhancer keeps at most 600 characters of an app's extra words

# How the hero looks, in words, so the painter keeps the child the parent designed (studio choices, lh-avatar.js).
SKIN_WORDS = {"s9": "very fair", "s1": "very fair", "s10": "fair", "s2": "fair", "s11": "light", "s3": "light",
              "s12": "light golden", "s13": "medium", "s4": "medium", "s14": "medium tan", "s5": "tan",
              "s15": "tan brown", "s16": "light brown", "s6": "brown", "s17": "brown", "s7": "dark brown",
              "s18": "dark brown", "s8": "deep brown", "s19": "deep brown", "s20": "very deep brown"}
HAIR_STYLES = {"fuzz": "baby-fuzz", "buzz": "buzz-cut", "crop": "short", "sidepart": "side-parted", "swoop": "swept",
               "quiff": "quiffed", "spiky": "spiky", "mohawk": "mohawk", "bowl": "bowl-cut", "pixie": "pixie-cut",
               "mop": "shaggy", "curly": "curly", "afro": "afro", "puff": "afro-puff", "puffs": "two-puff",
               "knots": "Bantu-knot", "cornrows": "cornrow", "locs": "loc", "bun": "top-bun", "spacebuns": "space-bun",
               "pigtails": "pigtail", "ponytail": "ponytail", "sidepony": "side-ponytail", "bob": "bob",
               "wavy": "wavy", "long": "long", "longbangs": "long fringed", "curlylong": "long curly", "braids": "braided"}
GLASSES = {"round": "round glasses", "square": "square glasses", "oval": "oval glasses", "tiny": "little round glasses",
           "big": "big round glasses", "bright": "brightly framed glasses", "browline": "browline glasses",
           "cateye": "cat-eye glasses", "aviator": "aviator glasses", "sun": "sunglasses", "heart": "heart-shaped glasses",
           "star": "star-shaped party glasses", "threed": "3D glasses", "swim": "swim goggles", "visor": "a sporty visor"}
HATS = {"bow": "a bow", "flower": "a flower in the hair", "clips": "hair clips", "headband": "a star headband",
        "tiara": "a tiara", "cap": "a cap", "beanie": "a beanie", "sunhat": "a sun hat", "beret": "a beret",
        "helmet": "a bike helmet", "cowboy": "a cowboy hat", "party": "a party hat", "crown": "a crown",
        "wizard": "a wizard hat", "pirate": "a pirate hat", "bunny": "bunny ears", "cat": "cat ears", "hijab": "a hijab",
        "turban": "a patka", "kippah": "a kippah"}
COLOURS = {"dark": "dark brown", "lightbrown": "light brown", "strawberry": "strawberry blonde", "ash": "ash blonde",
           "cherry": "cherry red", "steel": "steel blue", "sun": "yellow", "white": "cream"}


def hero_words(look):
    """One sentence describing the hero for the painter, e.g. "The child has fair skin, ginger curly hair, freckles and
    round glasses." Empty if there's no look."""
    if not isinstance(look, dict) or not look:
        return ""
    colour = lambda key: COLOURS.get(look.get(key) or "", str(look.get(key) or "").replace("_", " "))
    parts = []
    if look.get("skin") in SKIN_WORDS:
        parts.append("%s skin" % SKIN_WORDS[look["skin"]])
    hair = look.get("hair") or ""
    if hair == "none":
        parts.append("no hair yet")
    elif hair in HAIR_STYLES:
        parts.append(("%s %s hair" % (colour("hairColor"), HAIR_STYLES[hair])).strip())
    if look.get("freckles"):
        parts.append("freckles")
    if look.get("glasses") in GLASSES:
        parts.append(GLASSES[look["glasses"]])
    if look.get("hat") in HATS:
        parts.append(HATS[look["hat"]])
    if not parts:
        return ""
    listed = parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]
    return "The child has %s." % listed


def prompt_for(book_row, style):
    """The extra words sent with each page: the hero in words, the picture-book rules, and the style's own fix."""
    hero = book_row["hero"] if book_row is not None else None
    words = [hero_words(hero["look"] if hero is not None else None), PROMPT, STYLE_EXTRA.get(style, "")]
    text = " ".join(w for w in words if w)
    return text if len(text) <= MAX_PROMPT else " ".join(w for w in words[1:] if w)[:MAX_PROMPT]
WAITING = "Waiting to reach the painting studio. It will be sent again in a moment."


# ------------------------------------------------------------------------------------------- setup
def api_address():
    """Admin -> Painting's saved address, else the App Secret image_enhancer_url, else the built-in one."""
    url = C.get_setting("enhancer_api") or _secret("image_enhancer_url").strip().rstrip("/")
    if url and not url.endswith("/_/api/v1"):
        url = url.split("/_/api")[0] + "/_/api/v1"
    return url or DEFAULT_API


def _secret(name):
    try:
        return anvil.secrets.get_secret(name) or ""
    except Exception:
        return ""


def configured():
    """True once the API key is in App Secrets."""
    return bool(_secret("image_enhancer_key"))


def _use():
    enhancer.API = api_address()


def _callback_url():
    """Where Image Enhancer reports finished pictures. It only calls https addresses (so not the local test server)."""
    if not _secret("image_enhancer_webhook_secret"):
        return None
    try:
        origin = anvil.server.get_app_origin().rstrip("/")
    except Exception:
        return None
    return origin + "/_/api/paint-done" if origin.startswith("https://") else None


# ------------------------------------------------------------------------------------------- rows
def _rows(book_row):
    """This book's painted pages. Until the owner accepts the Schema Mismatch after a deploy, the live database has
    no paintings table yet: books keep working, just without paintings."""
    try:
        return list(app_tables.paintings.search(book=book_row))
    except Exception:
        return []


def _key():
    return secrets.token_urlsafe(18)


def _when(value):
    if not value:
        return None
    try:
        d = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return None


def paint_for(book_row, rows=None):
    """{"<page>": {"key", "style"}}: every page with a painted picture (also while a repaint is on its way)."""
    out = {}
    for r in rows if rows is not None else _rows(book_row):
        if r["picture"] is not None and r["key"]:
            out[str(int(r["page"]))] = {"key": r["key"], "style": r["picture_style"] or r["style"]}
    return out


def state_for(book_row, rows=None):
    """How the painting of one book is going (for its owner), or None if it was never painted."""
    rows = rows if rows is not None else _rows(book_row)
    if not rows:
        return None
    total = Voice.page_count(book_row)
    count = {"sending": 0, "queued": 0, "working": 0, "done": 0, "failed": 0}
    eta, error, styles, pages = None, None, {}, {}
    for r in rows:
        s = r["status"] if r["status"] in count else "failed"
        count[s] += 1
        pages[str(int(r["page"]))] = s
        styles[r["style"]] = styles.get(r["style"], 0) + 1
        if s in OPEN and r["eta"] and (eta is None or r["eta"] > eta):
            eta = r["eta"]
        if s == "failed" and not error:
            error = r["error"]
    style = max(styles, key=lambda k: styles[k]) if styles else None
    now = C.now()
    left = None
    if eta is not None:
        left = max(0, int((eta - now).total_seconds()))
    open_n = count["sending"] + count["queued"] + count["working"]
    return {"style": style, "style_label": BY_STYLE.get(style, {}).get("label", style), "total": total,
            "pages": len(rows), "done": count["done"], "failed": count["failed"], "open": open_n,
            "sending": count["sending"], "working": count["working"], "missing": max(0, total - len(rows)),
            "seconds_left": left, "error": error, "page_status": pages,
            "status": "painting" if open_n else ("failed" if count["failed"] else "done")}


def delete_for(book_row):
    """Removes a book's paintings (when the book or its hero goes); jobs still waiting are cancelled."""
    rows = _rows(book_row)
    if any(r["status"] in ("queued", "working") and r["job_id"] for r in rows) and configured():
        _use()
        for r in rows:
            if r["status"] == "queued" and r["job_id"]:
                try:
                    enhancer.cancel(r["job_id"])
                except Exception:
                    pass
    for r in rows:
        r.delete()


def new_keys(book_row):
    """Fresh addresses for every painted picture: old links stop working (the family link changed)."""
    for r in _rows(book_row):
        if r["picture"] is not None:
            r["key"] = _key()


# ------------------------------------------------------------------------------------------- talking to the service
def _submit(row):
    """Send one page to Image Enhancer. Problems with the picture fail the page; the service being out of reach
    leaves it "sending" so the next check tries again."""
    if not configured():
        row.update(status="sending", error="The painting studio isn't switched on yet.", updated=C.now())
        return
    _use()
    book = row["book"]
    try:
        job = enhancer.submit(row["source"], row["style"], prompt=prompt_for(book, row["style"]), fidelity="strict",
                              megapixels=1.0,
                              size="source", fmt="jpeg", ref="lhb:%s:%d" % (book.get_id(), int(row["page"])),
                              callback_url=_callback_url())
    except enhancer.EnhancerError as e:
        if e.status in (400, 413, 415, 422):
            row.update(status="failed", error=C.text(str(e), 300) or "The studio couldn't use this picture.",
                       updated=C.now())
        else:  # 401/403 (key), 429 (hourly limit), 5xx, 0 (no connection): try again later
            row.update(status="sending", error=C.text(str(e), 300) or WAITING, updated=C.now())
        return
    except Exception:
        row.update(status="sending", error=WAITING, updated=C.now())
        return
    row.update(job_id=job.get("id"), status="queued", error=None, attempts=(row["attempts"] or 0) + 1,
               updated=C.now())
    _apply(row, job)


def _apply(row, job):
    """Update a row from a job dict the service sent (status call or webhook). Done: fetch and keep the picture."""
    status = job.get("status")
    if status == "done":
        try:
            media = enhancer.result(job["id"])
        except Exception:
            return  # try again on the next check
        if not hasattr(media, "get_bytes"):
            return
        ctype = (getattr(media, "content_type", "") or "image/jpeg").split(";")[0]
        ext = {"image/png": "png", "image/webp": "webp"}.get(ctype, "jpg")
        row.update(picture=anvil.BlobMedia(ctype, media.get_bytes(), name="page-%d.%s" % (int(row["page"]), ext)),
                   picture_style=row["style"], key=_key(), status="done", error=None, eta=None, updated=C.now())
    elif status in ("failed", "cancelled"):
        row.update(status="failed", eta=None, updated=C.now(),
                   error=C.text(job.get("error") or "The studio couldn't paint this page.", 300))
    elif status in ("queued", "working"):
        row.update(status=status, eta=_when(job.get("eta_at")), error=None)


def sync(book_row, rows=None, force=False):
    """Check this book's unfinished pages with the service (at most every CHECK_EVERY seconds)."""
    rows = rows if rows is not None else _rows(book_row)
    todo = [r for r in rows if r["status"] in OPEN]
    if not todo or not configured():
        return rows
    now = C.now()
    if not force and all(r["checked"] and (now - r["checked"]).total_seconds() < CHECK_EVERY for r in todo):
        return rows
    _use()
    for r in todo:
        r["checked"] = now
    for r in [r for r in todo if r["status"] == "sending"]:
        _submit(r)
    waiting = [r for r in todo if r["status"] in ("queued", "working") and r["job_id"]]
    found = {}
    if len(waiting) > 3:
        try:  # one call for every open job of this app, then single calls for the ones that just finished
            for j in enhancer._call("GET", "/jobs?status=open&limit=100").get("jobs") or []:
                found[j["id"]] = j
        except Exception:
            found = {}
    for r in waiting:
        job = found.get(r["job_id"])
        if job is None:
            try:
                job = enhancer.status(r["job_id"])
            except enhancer.EnhancerError as e:
                if e.status == 404:  # the service no longer has it: send the drawing again
                    r.update(status="sending", job_id=None, error=WAITING)
                    _submit(r)
                continue
            except Exception:
                continue
        _apply(r, job)
    return rows


def _own_book(book_id, me):
    r = C.row_by_id(app_tables.books, book_id)
    if r is None or r["owner"] != me or r["is_demo"]:
        return None
    return r


def _queue():
    """The studio's queue (is the PC on, how long is the line), or None if it can't be reached."""
    if not configured():
        return None
    _use()
    try:
        info = enhancer.queue()
    except Exception:
        return None
    return {"online": bool(info.get("pc_online")), "paused": bool(info.get("paused")),
            "waiting": int(info.get("queue_length") or 0), "average_seconds": info.get("average_seconds"),
            "first_seconds": info.get("eta_new_job_seconds")}


def _reply(book_row, rows=None):
    rows = rows if rows is not None else _rows(book_row)
    return C.ok(paint=paint_for(book_row, rows), state=state_for(book_row, rows))


# ------------------------------------------------------------------------------------------- callables
@anvil.server.callable(require_user=True)
def paint_info(book_id):
    """For the Paint dialog: the styles, whether the studio is on, its queue, and how this book is going."""
    me = C.require_user()
    r = _own_book(book_id, me)
    if r is None:
        return C.fail("You can only paint your own books.")
    rows = sync(r, force=True)
    return C.ok(styles=STYLES, ready=configured(), queue=_queue(), pages=Voice.page_count(r),
                paint=paint_for(r, rows), state=state_for(r, rows))


@anvil.server.callable(require_user=True)
def paint_page(book_id, page, style, picture):
    """Keep one page's drawing and send it to be painted (replaces that page's earlier painting request)."""
    me = C.require_user()
    r = _own_book(book_id, me)
    if r is None:
        return C.fail("You can only paint your own books.")
    if not configured():
        return C.fail("The painting studio isn't switched on yet. Please try again later.")
    p = Voice._page(page, r)
    if p is None:
        return C.fail("That page isn't in this book.")
    if style not in BY_STYLE:
        return C.fail("Pick one of the painting styles.")
    if not isinstance(picture, anvil.Media):
        return C.fail("The picture didn't arrive. Please try again.")
    ctype = (picture.content_type or "").split(";")[0].strip().lower()
    if ctype not in ("image/png", "image/jpeg", "image/webp"):
        return C.fail("That isn't a picture.")
    size = picture.length or 0
    if size < 500 or size > MAX_BYTES:
        return C.fail("That picture is the wrong size. Please try again.")
    try:
        old = list(app_tables.paintings.search(book=r, page=p))
    except Exception:
        return C.fail("The painting studio isn't ready yet. Please try again later.")
    since = C.now() - dt.timedelta(days=1)
    mine = [x for x in app_tables.paintings.search(created=q.greater_than(since))
            if x["book"] is not None and x["book"]["owner"] == me]
    if len(mine) >= PAGES_PER_DAY and not old:
        return C.fail("That's a lot of painting for one day. Please try again tomorrow.")
    data = anvil.BlobMedia(ctype, picture.get_bytes(), name="page-%d.png" % p)
    if old:
        row = old[0]
        for extra in old[1:]:
            extra.delete()
        if row["status"] == "queued" and row["job_id"]:
            _use()
            try:
                enhancer.cancel(row["job_id"])
            except Exception:
                pass
        row.update(style=style, source=data, job_id=None, status="sending", error=None, eta=None, attempts=0,
                   created=C.now(), updated=C.now(), checked=None)
    else:
        row = app_tables.paintings.add_row(book=r, page=p, style=style, source=data, status="sending", attempts=0,
                                           created=C.now(), updated=C.now())
    _submit(row)
    return C.ok(page=p, status=row["status"], error=row["error"] if row["status"] == "failed" else None)


@anvil.server.callable(require_user=True)
def paint_status(book_id):
    """The book page asks this while pages are being painted: checks the studio and returns what's ready."""
    me = C.require_user()
    r = _own_book(book_id, me)
    if r is None:
        return C.fail("You can only see your own books.")
    return _reply(r, sync(r))


@anvil.server.callable(require_user=True)
def paint_remove(book_id):
    """Back to the drawn pictures: deletes every painted page of the book."""
    me = C.require_user()
    r = _own_book(book_id, me)
    if r is None:
        return C.fail("You can only change your own books.")
    delete_for(r)
    return _reply(r, [])


# ------------------------------------------------------------------------------------------- admin
def admin_stats():
    try:
        rows = list(app_tables.paintings.search())
    except Exception:
        rows = []
    books = set(r["book"].get_id() for r in rows if r["book"] is not None)
    return {"books": len(books), "done": len([r for r in rows if r["status"] == "done"]),
            "open": len([r for r in rows if r["status"] in OPEN]),
            "failed": len([r for r in rows if r["status"] == "failed"])}


@anvil.server.callable(require_user=True)
def admin_painting():
    C.require_admin()
    return {"api": api_address(), "default_api": DEFAULT_API, "custom": bool(C.get_setting("enhancer_api")),
            "key": configured(), "webhook": bool(_secret("image_enhancer_webhook_secret")),
            "callback": _callback_url(), "stats": admin_stats()}


@anvil.server.callable(require_user=True)
def admin_painting_save(api):
    """Save the Image Enhancer address (its API base, ending in /_/api/v1). Empty = the built-in one."""
    C.require_admin()
    a = C.text(api, 300).rstrip("/")
    if not a:
        C.set_setting("enhancer_api", None)
        return C.ok(api=DEFAULT_API)
    if not re.match(r"^https?://[A-Za-z0-9.-]+(:\d+)?(/.*)?$", a):
        return C.fail("That doesn't look like a web address. Paste the Image Enhancer app's address.")
    if not a.endswith("/_/api/v1"):
        a = re.sub(r"/_/api(/v1)?$", "", a) + "/_/api/v1"
    C.set_setting("enhancer_api", a)
    return C.ok(api=a)


@anvil.server.callable(require_user=True)
def admin_painting_check():
    """Ask the studio how it is: reachable, key accepted, PC on, queue length."""
    C.require_admin()
    if not configured():
        return C.fail("Add the App Secret image_enhancer_key first (Anvil editor: App Secrets).")
    _use()
    try:
        info = enhancer.queue()
    except enhancer.EnhancerError as e:
        if e.status in (401, 403):
            return C.fail("Image Enhancer answered, but it didn't accept the key. Make a new key on its Apps & keys page.")
        return C.fail("Image Enhancer couldn't be reached at %s (%s)." % (api_address(), C.text(str(e), 160)))
    except Exception as e:
        return C.fail("Image Enhancer couldn't be reached at %s (%s)." % (api_address(), C.text(str(e), 160)))
    return C.ok(online=bool(info.get("pc_online")), paused=bool(info.get("paused")),
                waiting=int(info.get("queue_length") or 0), average_seconds=info.get("average_seconds"))


# ------------------------------------------------------------------------------------------- HTTP
@anvil.server.http_endpoint("/paint-done", methods=["POST"])
def paint_done(**kw):
    """Image Enhancer calls this when a picture is finished (or failed). Signed with the webhook secret."""
    try:
        payload = enhancer.verified_webhook()
    except Exception:
        return anvil.server.HttpResponse(403, "Bad signature", headers={"Content-Type": "text/plain"})
    job = (payload or {}).get("job") or {}
    try:
        row = app_tables.paintings.get(job_id=job.get("id")) if job.get("id") else None
    except Exception:
        row = None
    if row is not None and row["status"] in OPEN:
        _use()
        _apply(row, job)
    return anvil.server.HttpResponse(200, "OK", headers={"Content-Type": "text/plain"})


@anvil.server.http_endpoint("/painting/:key")
def painting_file(key, **kw):
    """One painted picture. The key is the only way in (it changes with the family link and with every repaint)."""
    key = str(key or "")
    try:
        row = app_tables.paintings.get(key=key) if KEY_RE.match(key) else None
    except Exception:
        row = None
    if row is None or row["picture"] is None:
        return anvil.server.HttpResponse(404, "Not found", headers={"Content-Type": "text/plain"})
    etag = '"%s"' % key
    headers = {"Content-Type": row["picture"].content_type or "image/jpeg", "Cache-Control": "private, no-cache",
               "ETag": etag}
    req = getattr(anvil.server, "request", None)
    req_headers = (getattr(req, "headers", None) or {}) if req is not None else {}
    if req_headers.get("if-none-match") == etag:
        return anvil.server.HttpResponse(304, "", headers=headers)
    return anvil.server.HttpResponse(200, row["picture"], headers=headers)
