from anvil import *
import anvil.js
import anvil.server

from ._anvil_designer import PaintTemplate
from ... import lh, state
from ...Items.PaintStyle import preview_url


def minutes(secs):
    """Plain words for a wait: "a minute or two", "about 25 minutes", "about 3 hours"."""
    secs = max(0, int(secs or 0))
    if secs < 150:
        return "a minute or two"
    if secs < 3600:
        return "about %d minutes" % round(secs / 60.0)
    hours = secs / 3600.0
    return "about %s hours" % (("%.1f" % hours).rstrip("0").rstrip(".") if hours < 10 else str(int(round(hours))))


class Paint(PaintTemplate):
    """"Paint this book": a sample of each style (the same drawing painted six ways: a big preview of the chosen one with
    the drawing in the corner, and a card per style), then every page's picture is drawn as a PNG in the browser (LH.paintPicture)
    and sent to the painting studio (paint_page), one by one with a progress bar. Also: paint it again in another
    style, send the pages that are missing or failed, or go back to the drawings (paint_remove).
    Closes with {"sent", "failed", "error"} after sending, {"removed": True}, or None."""

    def __init__(self, book, **properties):
        super().__init__(**properties)
        self.book = book
        self.styles_panel.add_event_handler("x-style", self._pick)
        self.send_part.visible = False
        r = anvil.server.call("paint_info", book["id"])
        if not r.get("ok"):  # not your book any more: an explanation instead of styles
            r.update(styles=[], ready=False, queue=None, pages=0, state=None)
        self.info = r
        st = r.get("state") or {}
        keys = [s["key"] for s in r["styles"]]
        self.chosen = st.get("style") if st.get("style") in keys else (keys[0] if keys else None)
        self._draw()

    # ---- drawing
    def _draw(self):
        r, st = self.info, self.info.get("state")
        name = (self.book.get("hero") or {}).get("name") or "your hero"
        self.title.text = "The painted edition" if st else "Paint this book"
        if st:
            self.intro.text = ("The pictures of this book were painted in %s style. Pick a style to paint it again: "
                               "the pictures you have now stay until the new ones are ready." % st["style_label"])
        else:
            self.intro.text = ("Our painting studio repaints every picture of this book, from the cover to The End, in "
                               "the style you choose. The words stay just as they are, and %s stays %s: the painter "
                               "is asked to keep faces, hair and clothes as you drew them." % (name, name))
        self.styles_panel.items = self._style_items()
        self.styles_part.visible = bool(r["styles"])
        self._preview()
        self.queue_line.text = self._queue_text()
        missing = self._missing()
        self.remove_button.visible = bool(st)
        self.retry_button.visible = bool(st) and bool(missing)
        self.retry_button.text = "Send %s again" % state.plural(len(missing), "missing page")
        self.start_button.text = "Paint it again" if st else "Paint my book"
        self.start_button.enabled = bool(r.get("ready")) and bool(self.chosen)
        self.retry_button.enabled = bool(r.get("ready"))
        if r.get("error"):
            self._error(r["error"])

    def _style_items(self):
        out = []
        for st in self.info["styles"]:
            item = {"key": st["key"], "label": st["label"]}
            item["on"] = st["key"] == self.chosen
            out.append(item)
        return out

    def _preview(self):
        st = next((s for s in self.info["styles"] if s["key"] == self.chosen), None)
        if st is None:
            return
        state.set_attr(self.preview_img, "src", preview_url(st["key"]))
        state.set_attr(self.preview_img, "alt", "A sample cover painted in %s style" % st["label"])
        self.preview_name.text = st["label"]
        self.preview_note.text = st["note"]

    def _queue_text(self):
        r, st, q = self.info, self.info.get("state"), self.info.get("queue")
        if r.get("error"):
            return "This book can't be painted."
        if not r.get("ready"):
            return "The painting studio isn't open yet. Please come back soon."
        if st and st["status"] == "painting":
            done = "%d of %d pages painted." % (st["done"], st["total"])
            if q and not q["online"]:
                return done + " The studio's computer is resting right now: the rest get painted when it's back on."
            if st.get("seconds_left") is not None:
                return done + " The rest should be ready in %s. You can close the book: painting carries on." % minutes(st["seconds_left"])
            return done + " The rest are on their way."
        if q is None:
            return "The painting studio can't be reached right now. Your pages wait and go as soon as it answers."
        if q["paused"]:
            return "The studio is taking a short break. Your pages wait in line and get painted after it."
        if not q["online"]:
            return "The studio's computer is resting right now. Your pages wait in line and get painted when it's back on."
        per = q.get("average_seconds") or 60
        total = (q.get("first_seconds") or per) + per * max(0, r["pages"] - 1)
        ahead = ("%s waiting ahead of yours. " % state.plural(q["waiting"], "picture is", "pictures are")) if q["waiting"] else ""
        return "%sAll %d pages should be ready in %s." % (ahead, r["pages"], minutes(total))

    def _missing(self):
        """Pages with no painting on the way: never sent, or failed."""
        st = self.info.get("state")
        if not st:
            return []
        status = st.get("page_status") or {}
        return [i for i in range(self.info["pages"]) if status.get(str(i)) in (None, "failed")]

    def _error(self, text):
        self.error_line.text = text
        self.error_line.visible = True

    def _pick(self, key, **event_args):
        if self.chosen != key:
            self.chosen = key
            self.styles_panel.items = self._style_items()
            self._preview()

    # ---- sending
    def _busy(self, on):
        for b in (self.start_button, self.retry_button, self.remove_button, self.cancel_button):
            b.enabled = not on
        self.styles_part.visible = not on
        self.send_part.visible = on

    def _bar(self, done, total):
        pct = int(round(100.0 * done / max(1, total)))
        self.send_fill.style["transform"] = "scaleX(%.3f)" % (pct / 100.0)
        state.set_attr(self.send_bar, "aria-valuenow", str(pct))

    def _send(self, pages):
        self.error_line.visible = False
        self._busy(True)
        sent, failed, first_error, n = 0, 0, None, len(pages)
        for i, idx in enumerate(pages):
            self.send_text.text = "Sending picture %d of %d to the studio…" % (i + 1, n)
            self._bar(i, n)
            try:
                blob = lh.paint_picture(self.book, idx)
                r = anvil.server.call_s("paint_page", self.book["id"], idx, self.chosen, anvil.js.to_media(blob))
            except Exception:
                r = {"ok": False, "error": "A picture couldn't be sent. Check your connection and try again."}
            if r.get("ok") and r.get("status") != "failed":
                sent += 1
            else:
                failed += 1
                first_error = first_error or r.get("error")
                if not r.get("ok") and not sent and i == 0:
                    break  # the first page was refused (studio closed, daily limit): the rest would be too
        self._bar(n, n)
        self._busy(False)
        if not sent:
            self._error(first_error or "The pictures couldn't be sent. Please try again.")
            return
        self.raise_event("x-close-alert", value={"sent": sent, "failed": failed, "error": first_error})

    @handle("start_button", "click")
    def start_button_click(self, **event_args):
        self._send(list(range(self.info["pages"])))

    @handle("retry_button", "click")
    def retry_button_click(self, **event_args):
        self._send(self._missing())

    @handle("remove_button", "click")
    def remove_button_click(self, **event_args):
        if confirm("The painted pictures are deleted and the book shows its drawings again. You can paint it again "
                   "any time.", title="Back to the drawings?", buttons=[("Keep the paintings", False),
                                                                         ("Delete them", True)], role="lh-dialog"):
            if state.call("paint_remove", self.book["id"]):
                self.raise_event("x-close-alert", value={"removed": True})

    @handle("cancel_button", "click")
    def cancel_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)
