from anvil import *
from anvil.js import window

from ._anvil_designer import PdfTemplate
from ... import lh, state


def size_text(inches, metric):
    return ("%g cm" % (round(inches * 25.4 * 10) / 100)) if metric else ("%g in" % (round(inches * 1000) / 1000))


class Pdf(PdfTemplate):
    """"Download a PDF": the picture book or the colour-me-in book, for home printing or print-ready (300 dpi with
    bleed, in a chosen size). Remembers the last choice. Closes with the PDF options, or None."""

    def __init__(self, book, **properties):
        super().__init__(**properties)
        self.book = book
        saved = state.store_get("pdfopts", {}) or {}
        self.kind = "outline" if saved.get("kind") == "outline" else "colour"
        self.use = "print" if saved.get("use") == "print" else "home"
        self.sizes, self.bleeds = lh.print_sizes(), lh.bleeds()
        self.size_box.items = [(s["label"], s["key"]) for s in self.sizes]
        self.bleed_box.items = [(b["label"], b["key"]) for b in self.bleeds]
        if saved.get("size") in [s["key"] for s in self.sizes]:
            self.size_box.selected_value = saved["size"]
        if saved.get("bleed") in [b["key"] for b in self.bleeds]:
            self.bleed_box.selected_value = saved["bleed"]
        for c in (self.cover_colour, self.cover_outline):
            c.hero = book["hero"]
            c.story = book["story"]
        self._sync()

    def choice(self):
        size = next((s for s in self.sizes if s["key"] == self.size_box.selected_value), self.sizes[0])
        bleed = next((b for b in self.bleeds if b["key"] == self.bleed_box.selected_value), self.bleeds[0])
        opts = {"outline": self.kind == "outline",
                "print": {"trim": size["trim"], "bleed": bleed["v"], "label": size["label"]} if self.use == "print" else None}
        return {"kind": self.kind, "use": self.use, "size": size["key"], "bleed": bleed["key"], "opts": opts}

    def _sync(self):
        self.kind_colour.classes["on"] = self.kind == "colour"
        self.kind_outline.classes["on"] = self.kind == "outline"
        self.use_home.classes["on"] = self.use == "home"
        self.use_print.classes["on"] = self.use == "print"
        self.print_part.visible = self.use == "print"
        if self.use == "print":
            c = self.choice()
            o, metric = c["opts"]["print"], c["size"] == "20cm"
            full = o["trim"] + 2 * o["bleed"]
            n = lh.pdf_pages(self.book, c["opts"])
            px = round(full * window.LH.DPI)
            self.note.text = ("Each page is %s square (%s plus the bleed), %d × %d pixels. %d pages: the cover, then %d inside "
                              "pages (an even number, as printers like). Pick the same size and bleed your printer asks for."
                              % (size_text(full, metric), size_text(o["trim"], metric), px, px, n, n - 1))

    def kind_click(self, event):
        self.kind = event.currentTarget.getAttribute("data-k")
        self._sync()

    def use_click(self, event):
        self.use = event.currentTarget.getAttribute("data-u")
        self._sync()

    @handle("size_box", "change")
    def size_box_change(self, **event_args):
        self._sync()

    @handle("bleed_box", "change")
    def bleed_box_change(self, **event_args):
        self._sync()

    @handle("cancel_button", "click")
    def cancel_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)

    @handle("make_button", "click")
    def make_button_click(self, **event_args):
        c = self.choice()
        state.store_set("pdfopts", {"kind": c["kind"], "use": c["use"], "size": c["size"], "bleed": c["bleed"]})
        self.raise_event("x-close-alert", value=c["opts"])
