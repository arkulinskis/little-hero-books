from anvil import *
import anvil.js

from ._anvil_designer import WritePageTemplate
from ... import lh

CAPITAL = {"{he}": "{He}", "{his}": "{His}"}


class WritePage(WritePageTemplate):
    """One page on the writing page (#write): the picture it borrows, its text, and move / remove.
    item = {"i", "total", "text", "pic", "hero"}. Raises on the RepeatingPanel: x-pic(i), x-move(i, step), x-remove(i),
    x-text(i, text), x-focus(i). The page calls insert(token) to put {name} / {he} ... where the cursor is."""

    def __init__(self, **properties):
        super().__init__(**properties)
        it = self.item
        self.num_label.text = "Page %d" % (it["i"] + 1)
        self.text_box.text = it["text"]
        self.up_button.enabled = it["i"] > 0
        self.down_button.enabled = it["i"] < it["total"] - 1
        self.remove_button.enabled = it["total"] > 1
        self._draw_pic()
        self._reads()

    def _draw_pic(self):
        anvil.js.get_dom_node(self.pic).innerHTML = lh.pic_svg(self.item["pic"], self.item["hero"], clip=lh.uid("wp"))

    def _reads(self):
        """How the page reads with the hero in it (only when it has tokens to fill)."""
        text = self.text_box.text or ""
        self.reads_label.text = ("Reads: " + lh.fill(text, self.item["hero"])) if "{" in text else ""
        self.reads_label.visible = bool(self.reads_label.text)

    def _area(self):
        node = anvil.js.get_dom_node(self.text_box)
        return node if str(node.tagName).upper() == "TEXTAREA" else node.querySelector("textarea")

    def insert(self, token):
        """Put a token where the cursor was (a capital {He}/{His} at the start of a sentence)."""
        text = self.text_box.text or ""
        area = self._area()
        at = len(text)
        end = at
        if area is not None:
            try:
                at, end = int(area.selectionStart), int(area.selectionEnd)
            except Exception:
                pass
        before = text[:at].rstrip(" ")
        if token in CAPITAL and (not before or before[-1] in ".!?\n“\""):
            token = CAPITAL[token]
        pad = "" if (not text[:at] or text[:at].endswith((" ", "\n", "“", "\""))) else " "
        piece = pad + token
        self.text_box.text = text[:at] + piece + text[end:]
        self.parent.raise_event("x-text", i=self.item["i"], text=self.text_box.text)
        self._reads()
        if area is not None:
            pos = at + len(piece)
            area.focus()
            area.setSelectionRange(pos, pos)

    def focus_text(self):
        self.text_box.focus()

    @handle("text_box", "change")
    def text_box_change(self, **event_args):
        self.parent.raise_event("x-text", i=self.item["i"], text=self.text_box.text or "")
        self._reads()

    @handle("text_box", "focus")
    def text_box_focus(self, **event_args):
        self.parent.raise_event("x-focus", i=self.item["i"])

    def pic_click(self, event):
        self.parent.raise_event("x-pic", i=self.item["i"])

    @handle("pic_button", "click")
    def pic_button_click(self, **event_args):
        self.parent.raise_event("x-pic", i=self.item["i"])

    @handle("up_button", "click")
    def up_button_click(self, **event_args):
        self.parent.raise_event("x-move", i=self.item["i"], step=-1)

    @handle("down_button", "click")
    def down_button_click(self, **event_args):
        self.parent.raise_event("x-move", i=self.item["i"], step=1)

    @handle("remove_button", "click")
    def remove_button_click(self, **event_args):
        self.parent.raise_event("x-remove", i=self.item["i"])
