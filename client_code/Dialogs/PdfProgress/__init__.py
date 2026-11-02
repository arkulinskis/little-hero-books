import anvil.js
from anvil import *
from anvil.js import window

from ._anvil_designer import PdfProgressTemplate
from ... import lh, state


class PdfProgress(PdfProgressTemplate):
    """Draws the PDF page by page (the JavaScript PDF writer does the pixels), shows progress, then downloads it and
    says what to do next. Opens with the book and the options from Dialogs.Pdf."""

    def __init__(self, book, opts, **properties):
        super().__init__(**properties)
        self.book, self.opts = book, dict(opts)
        outline = self.opts.get("outline")
        self.heading.text = "Drawing your colouring book…" if outline else "Printing your book…"
        self.done_part.visible = False
        self._started = False

    def _progress(self, i, total):
        outline = self.opts.get("outline")
        self.bar.style["width"] = "%d%%" % round(i * 100 / total)
        if i >= total:
            self.message.text = "Binding the pages…"
        elif i == 0:
            self.message.text = "Drawing the cover" if outline else "Painting the cover"
        else:
            self.message.text = "%s page %d of %d" % ("Drawing" if outline else "Painting", i, total - 1)

    @handle("", "show")
    def form_show(self, **event_args):
        if self._started:
            return
        self._started = True
        try:
            blob = lh.make_pdf(self.book, anvil.js.report_exceptions(self._progress), self.opts)
        except anvil.js.ExternalError as e:
            self.raise_event("x-close-alert", value=None)
            state.toast("The PDF could not be made: %s" % (e.original_error.message or "please try again."), "error")
            return
        name = lh.file_name(self.book, self.opts)
        url = window.LH.saveBlob(blob, name)  # downloads it; the URL also opens it in a new tab
        n = lh.pdf_pages(self.book, self.opts)
        if self.opts.get("print"):
            how = ("Upload it to your photo-book printer as a square %s book. The printer trims off the bleed edge, "
                   "so nothing important sits near it." % self.opts["print"]["label"])
        elif self.opts.get("outline"):
            how = "Print it on plain paper (it fits Letter and A4), then get the crayons out!"
        else:
            how = "Print it at home, or read it together on a tablet."
        self.heading.text = "Your colouring book is ready!" if self.opts.get("outline") else "Your book is ready!"
        self.message.text = "%s (%d MB, %d square pages) is in your downloads. %s" % (name, max(1, round(blob.size / 1048576)), n, how)
        self.bar_box.visible = False
        self.privacy_note.visible = False
        state.set_attr(self.open_link, "href", url)
        self.done_part.visible = True
        state.confetti()

    @handle("done_button", "click")
    def done_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)
