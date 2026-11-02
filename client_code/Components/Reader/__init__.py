from anvil import *
import anvil.js

from ._anvil_designer import ReaderTemplate
from ... import lh


class Reader(ReaderTemplate):
    """The book reader. Set `book`; buttons placed in it (the "tools" dropzone) join the reader's toolbar.
    It stops reading aloud and lets go of the keyboard when the page closes (hide)."""

    def __init__(self, **properties):
        self._book, self._colour, self._rd = None, True, None
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
                "onPage": anvil.js.report_exceptions(lambda i, p: self.raise_event("page", index=i))}
        self._rd = lh.reader(self.dom_nodes["mount"], self._book, opts)
        bar = self.dom_nodes["mount"].querySelector(".rd-tools")
        if bar:
            bar.appendChild(self.dom_nodes["tools"])  # our buttons sit in the reader's own toolbar

    def _unmount(self):
        if self._rd is not None:
            anvil.js.get_dom_node(self).appendChild(self.dom_nodes["tools"])  # take our buttons back first
            self._rd.destroy()
            self._rd = None

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
    def colour(self):
        return self._colour

    @colour.setter
    def colour(self, value):
        self._colour = bool(value)
        self._mount()
