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
    the drawing in the corner, and a card per style), then every page's picture is drawn as a PNG in the browser
    (LH.paintPicture) and sent to the painting studio (paint_page), one by one with a progress bar. Also: send the
    pages that are missing or failed, or go back to the drawings (paint_remove).
    Styles the book was painted in before are saved (server: saved_paintings): the card says "Saved", and picking one
    switches back at once (paint_saved) instead of painting again; "Paint fresh" ignores the saved pictures;
    "Delete saved styles" (paint_forget) removes them.
    Closes with {"sent", "failed", "error", "reused", "style"} after sending, {"removed": True}, or None."""

    def __init__(self, book, **properties):
        super().__init__(**properties)
        self.book = book
        self.styles_panel.add_event_handler("x-style", self._pick)
        self.send_part.visible = False
        r = anvil.server.call("paint_info", book["id"])
        if not r.get("ok"):  # not your book any more: an explanation instead of styles
            r.update(styles=[], ready=False, queue=None, pages=0, state=None, saved={})
        self.info = r
        st = r.get("state") or {}
        keys = [s["key"] for s in r["styles"]]
        self.chosen = st.get("style") if st.get("style") in keys else (keys[0] if keys else None)
        self._fresh_by_default = False
        self._draw()

    # ---- what's saved
    def _saved_pages(self, key=None):
        return list((self.info.get("saved") or {}).get(key or self.chosen) or [])

    def _all_saved(self, key=None):
        pages = self.info.get("pages") or 0
        return bool(pages) and len(self._saved_pages(key)) >= pages

    def _is_current(self):
        st = self.info.get("state")
        return bool(st) and st["style"] == self.chosen and st["status"] == "done"

    def _label(self, key=None):
        st = next((s for s in self.info["styles"] if s["key"] == (key or self.chosen)), None)
        return st["label"] if st else ""

    # ---- drawing
    def _draw(self):
        r, st = self.info, self.info.get("state")
        name = (self.book.get("hero") or {}).get("name") or "your hero"
        self.title.text = "The painted edition" if st else "Paint this book"
        if st:
            self.intro.text = ("The pictures of this book were painted in %s style. Pick another style to paint it "
                               "again: the pictures you have now stay until the new ones are ready, and every style "
                               "you've used is saved, so switching back is instant." % st["style_label"])
        else:
            self.intro.text = ("Our painting studio repaints every picture of this book, from the cover to The End, in "
                               "the style you choose. The words stay just as they are, and %s stays %s: the painter "
                               "is asked to keep faces, hair and clothes as you drew them." % (name, name))
        self.styles_part.visible = bool(r["styles"])
        missing = self._missing()
        self.remove_button.visible = bool(st)
        self.retry_button.visible = bool(st) and bool(missing)
        self.retry_button.text = "Send %s again" % state.plural(len(missing), "missing page")
        self.retry_button.enabled = bool(r.get("ready"))
        self._refresh()
        if r.get("error"):
            self._error(r["error"])

    def _refresh(self):
        """Everything that depends on the chosen style: cards, preview, the queue line and the buttons."""
        self.styles_panel.items = self._style_items()
        self._preview()
        self.queue_line.text = self._queue_text()
        r = self.info
        ready, saved = bool(r.get("ready")), self._saved_pages()
        self._fresh_by_default = False
        if self._is_current():
            self.start_button.text = "Paint it fresh"
            self.start_button.enabled = ready
            self._fresh_by_default = True
            self.fresh_button.visible = False
        elif self._all_saved():
            self.start_button.text = "Switch to %s" % self._label()
            self.start_button.enabled = True
            self.fresh_button.visible = ready
        else:
            self.start_button.text = "Paint it again" if r.get("state") else "Paint my book"
            self.start_button.enabled = ready and bool(self.chosen)
            self.fresh_button.visible = ready and bool(saved)
        self.forget_button.visible = bool(r.get("saved"))

    def _style_items(self):
        out, pages = [], self.info.get("pages") or 0
        for st in self.info["styles"]:
            n = len(self._saved_pages(st["key"]))
            item = {"key": st["key"], "label": st["label"]}
            item["on"] = st["key"] == self.chosen
            item["saved"] = "Saved" if pages and n >= pages else ("%d of %d saved" % (n, pages) if n else "")
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
        if st and st["status"] == "painting":
            done = "%d of %d pages painted." % (st["done"], st["total"])
            if q and not q["online"]:
                return done + " The studio's computer is resting right now: the rest get painted when it's back on."
            if st.get("seconds_left") is not None:
                return done + " The rest should be ready in %s. You can close the book: painting carries on." % minutes(st["seconds_left"])
            return done + " The rest are on their way."
        if self._is_current():
            return "This is the style on your book now. Paint it fresh for new pictures in the same style."
        if self._all_saved():
            return "Saved from before: switching to %s takes a moment, with no painting or waiting." % self._label()
        if not r.get("ready"):
            return "The painting studio isn't open yet. Please come back soon."
        saved = len(self._saved_pages())
        todo = max(0, r["pages"] - saved)
        lead = ("%d of %d pages are saved from before; the other %d get painted. " % (saved, r["pages"], todo)) if saved else ""
        if q is None:
            return lead + "The painting studio can't be reached right now. Your pages wait and go as soon as it answers."
        if q["paused"]:
            return lead + "The studio is taking a short break. Your pages wait in line and get painted after it."
        if not q["online"]:
            return lead + "The studio's computer is resting right now. Your pages wait in line and get painted when it's back on."
        per = q.get("average_seconds") or 60
        total = (q.get("first_seconds") or per) + per * max(0, todo - 1)
        ahead = ("%s waiting ahead of yours. " % state.plural(q["waiting"], "picture is", "pictures are")) if q["waiting"] else ""
        if saved:
            return "%s%sThey should be ready in %s." % (lead, ahead, minutes(total))
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
            self._refresh()

    # ---- sending
    def _busy(self, on):
        for b in (self.start_button, self.fresh_button, self.retry_button, self.remove_button, self.cancel_button,
                  self.forget_button):
            b.enabled = not on
        self.styles_part.visible = not on
        self.send_part.visible = on

    def _bar(self, done, total):
        pct = int(round(100.0 * done / max(1, total)))
        self.send_fill.style["transform"] = "scaleX(%.3f)" % (pct / 100.0)
        state.set_attr(self.send_bar, "aria-valuenow", str(pct))

    def _start(self, fresh):
        """Use the saved pictures of this style first (unless fresh), then paint only the pages still missing."""
        pages, reused = list(range(self.info["pages"])), 0
        if not fresh and self._saved_pages():
            r = state.call("paint_saved", self.book["id"], self.chosen)
            if not r:
                return
            reused, pages = len(r["used"]), list(r["missing"])
        if not pages:
            self.raise_event("x-close-alert", value={"sent": 0, "failed": 0, "error": None, "reused": reused,
                                                     "style": self._label()})
            return
        self._send(pages, reused)

    def _send(self, pages, reused=0):
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
        if not sent and not reused:
            self._error(first_error or "The pictures couldn't be sent. Please try again.")
            return
        self.raise_event("x-close-alert", value={"sent": sent, "failed": failed, "error": first_error, "reused": reused,
                                                 "style": self._label()})

    @handle("start_button", "click")
    def start_button_click(self, **event_args):
        self._start(fresh=self._fresh_by_default)

    @handle("fresh_button", "click")
    def fresh_button_click(self, **event_args):
        self._start(fresh=True)

    @handle("retry_button", "click")
    def retry_button_click(self, **event_args):
        self._send(self._missing())

    @handle("forget_button", "click")
    def forget_button_click(self, **event_args):
        if confirm("The pictures saved from earlier paintings are deleted. The painting on your book now stays. "
                   "Going back to another style means painting it again.", title="Delete the saved styles?",
                   buttons=[("Keep them", False), ("Delete them", True)], role="lh-dialog"):
            if state.call("paint_forget", self.book["id"]):
                self.info["saved"] = {}
                self._refresh()
                state.toast("Saved styles deleted", "ok")

    @handle("remove_button", "click")
    def remove_button_click(self, **event_args):
        if confirm("The book shows its drawings again. The painted pictures stay saved, so you can switch back to "
                   "them any time.", title="Back to the drawings?",
                   buttons=[("Cancel", False), ("Show the drawings", True)], role="lh-dialog"):
            if state.call("paint_remove", self.book["id"]):
                self.raise_event("x-close-alert", value={"removed": True})

    @handle("cancel_button", "click")
    def cancel_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)
