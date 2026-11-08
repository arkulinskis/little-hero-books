import json

from anvil import *
import anvil.js
import anvil.server

from ._anvil_designer import ReaderTemplate
from ... import lh


class Reader(ReaderTemplate):
    """The book reader. Set `book`; buttons placed in it (the "tools" dropzone) join the reader's toolbar.
    It stops reading aloud and lets go of the keyboard when the page closes (hide).
    record=True adds "Record my voice": the engine records a page, and this component saves it (save_voice) and
    keeps book["voice"] up to date; "Read to me" plays book["voice"] where there is one.
    book["paint"] (painted pictures) shows instead of the drawings, with a Painted switch; set_paint() updates it."""

    def __init__(self, **properties):
        self._book, self._colour, self._record, self._rd = None, True, False, None
        self._ready = False
        super().__init__(**properties)
        self._ready = True
        self._mount()

    def _mount(self):
        if not self._ready or not self._book:
            return
        self._unmount()
        opts = {"colour": self._colour,
                "onFinish": anvil.js.report_exceptions(lambda: self.raise_event("finish")),
                "onPage": anvil.js.report_exceptions(lambda i, p: self.raise_event("page", index=i)),
                "voiceBase": voice_base()}
        if self._record and self._book.get("id"):
            opts.update(record=True, onVoiceSave=self._voice_save, onVoiceDelete=self._voice_delete)
        self._rd = lh.reader(self.dom_nodes["mount"], self._book, opts)
        bar = self.dom_nodes["mount"].querySelector(".rd-tools")
        if bar:
            bar.appendChild(self.dom_nodes["tools"])  # our buttons sit in the reader's own toolbar

    def _unmount(self):
        if self._rd is not None:
            anvil.js.get_dom_node(self).appendChild(self.dom_nodes["tools"])  # take our buttons back first
            self._rd.destroy()
            self._rd = None

    def _book_id(self):
        b = self._book
        return b.get("id") if isinstance(b, dict) else None

    def _voice_save(self, page, blob, seconds):
        """Called by the engine with a finished recording. Answers JSON {ok, voice, error}."""
        try:
            media = anvil.js.to_media(blob)
            r = anvil.server.call_s("save_voice", self._book_id(), int(page), media, float(seconds))
        except Exception:
            r = {"ok": False, "error": "The recording couldn’t be saved. Check your connection and try again."}
        return self._voice_done(r)

    def _voice_delete(self, page):
        """Delete one page's recording, or every recording (page -1, after asking). None = cancelled."""
        if page < 0:
            if not confirm("Every page you recorded in this book is deleted. Family members hear the reading voice "
                           "of their device instead.", title="Delete all your recordings?",
                           buttons=[("Keep them", False), ("Delete all", True)], role="lh-dialog"):
                return json.dumps(None)
        try:
            r = anvil.server.call_s("delete_voice", self._book_id(), None if page < 0 else int(page))
        except Exception:
            r = {"ok": False, "error": "That didn’t work. Check your connection and try again."}
        return self._voice_done(r)

    def _voice_done(self, r):
        b = self._book
        if r.get("ok") and isinstance(b, dict):
            b["voice"] = r["voice"]
            self.raise_event("voice", voice=r["voice"])
        return json.dumps({"ok": bool(r.get("ok")), "voice": r.get("voice") or {}, "error": r.get("error") or ""})

    def set_paint(self, paint):
        """New painted pictures (from paint_status): the reader shows them without turning the page."""
        if isinstance(self._book, dict):
            self._book["paint"] = paint or {}
        if self._rd is not None:
            self._rd.setPaint(paint or {})

    def go(self, index):
        """Turn to a page (0 = cover, 1 = the dedication page)."""
        if self._rd is not None:
            self._rd.go(index)

    @handle("", "show")
    def form_show(self, **event_args):
        if self._rd is None:
            self._mount()

    @handle("", "hide")
    def form_hide(self, **event_args):
        self._unmount()

    @property
    def book(self):
        return self._book

    @book.setter
    def book(self, value):
        self._book = value
        self._mount()

    @property
    def record(self):
        return self._record

    @record.setter
    def record(self, value):
        self._record = bool(value)
        self._mount()

    @property
    def colour(self):
        return self._colour

    @colour.setter
    def colour(self, value):
        self._colour = bool(value)
        self._mount()


def voice_base():
    """Where recorded pages are served: <app>/_/api/voice/<key> (get_api_origin() already ends in /_/api)."""
    origin = anvil.server.get_api_origin().rstrip("/")
    if origin.endswith("/_/api"):
        origin = origin[:-len("/_/api")]
    return origin + "/_/api/voice/"
