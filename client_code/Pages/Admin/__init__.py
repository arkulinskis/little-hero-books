from anvil import *

from ._anvil_designer import AdminTemplate
from ... import state

TABS = ["overview", "library", "feedback", "users", "painting", "demo"]


class Admin(AdminTemplate):
    """#admin/<tab>: overview numbers, the story library's stats, the old feedback inbox, users (admin / active
    switches), the painting studio (Image Enhancer address, secrets, connection check) and the demo data. Each tab is its own address, so the browser's back button works."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.tab = args[0] if args and args[0] in TABS else "overview"
        self._filter = "new"
        parts = {"overview": self.overview_part, "library": self.library_part, "feedback": self.feedback_part,
                 "users": self.users_part, "painting": self.painting_part, "demo": self.demo_part}
        tabs = {"overview": self.tab_overview, "library": self.tab_library, "feedback": self.tab_feedback,
                "users": self.tab_users, "painting": self.tab_painting, "demo": self.tab_demo}
        for name in TABS:
            parts[name].visible = name == self.tab
            tabs[name].classes["on"] = name == self.tab
        self.feedback_panel.add_event_handler("x-changed", self._feedback_changed)
        getattr(self, "_" + self.tab)()

    # ---- overview
    def _overview(self):
        d = state.call("admin_overview")
        self.s_users.text, self.s_admins.text = str(d["users"]), str(d["admins"])
        self.s_admins_label.text = "admin" if d["admins"] == 1 else "admins"
        self.s_feedback.text, self.s_heroes.text = str(d["feedback_new"]), str(d["heroes"])
        self.s_books.text, self.s_shared.text = str(d["books"]), str(d["shared"])
        self.demo_line.text = "Demo data is %s (%d demo people). Manage it in the Demo data tab." % (
            d["demo"]["state"], d["demo"]["counts"].get("users", 0))

    # ---- library
    def _library(self):
        self.stories_panel.items = state.call("admin_library")["stories"]

    # ---- feedback
    def _feedback(self):
        d = state.call("list_feedback", None)
        self._fb = d
        items = [i for i in d["items"] if self._filter == "all" or i["status"] == self._filter]
        self.feedback_panel.items = items
        self.no_feedback.visible = not items
        labels = {"new": "New", "read": "Read", "done": "Done", "all": "All"}
        for key, el in (("new", self.f_new), ("read", self.f_read), ("done", self.f_done), ("all", self.f_all)):
            n = len(d["items"]) if key == "all" else d["counts"].get(key, 0)
            el.text = "%s (%d)" % (labels[key], n)
            el.role = ["seg", "on"] if key == self._filter else ["seg"]

    def _set_filter(self, value):
        self._filter = value
        self._feedback()

    @handle("f_new", "click")
    def f_new_click(self, **event_args):
        self._set_filter("new")

    @handle("f_read", "click")
    def f_read_click(self, **event_args):
        self._set_filter("read")

    @handle("f_done", "click")
    def f_done_click(self, **event_args):
        self._set_filter("done")

    @handle("f_all", "click")
    def f_all_click(self, **event_args):
        self._set_filter("all")

    def _feedback_changed(self, **event_args):
        self._feedback()

    # ---- users
    def _users(self, query=None):
        d = state.call("list_users", query or None)
        self.users_panel.items = d["users"]
        self.users_count.text = state.plural(d["total"], "person", "people")

    @handle("search_box", "pressed_enter")
    def search_box_pressed_enter(self, **event_args):
        self._users(self.search_box.text)

    @handle("search_button", "click")
    def search_button_click(self, **event_args):
        self._users(self.search_box.text)

    # ---- painting studio
    def _painting(self):
        d = state.call("admin_painting")
        self.key_line.text = ("✓ image_enhancer_key is set" if d["key"] else
                              "✗ image_enhancer_key is missing: painting is switched off")
        self.key_line.role = ["ad-ok"] if d["key"] else ["ad-bad"]
        self.hook_line.text = ("✓ image_enhancer_webhook_secret is set: finished pictures arrive at once" if d["webhook"]
                               else "– image_enhancer_webhook_secret is missing: pictures arrive when the owner has "
                                    "the book open (checked every 15 s)")
        self.hook_line.role = ["ad-ok"] if d["webhook"] else ["ad-warn"]
        self.api_box.text = d["api"].replace("/_/api/v1", "") if d["custom"] else ""
        self.api_note.text = ("Using %s. Leave the box empty to use the built-in address." % d["api"])
        s = d["stats"]
        self.paint_stats.text = "%s painted · %s done · %d on the way · %d failed" % (
            state.plural(s["books"], "book"), state.plural(s["done"], "page"), s["open"], s["failed"])

    @handle("api_save_button", "click")
    def api_save_button_click(self, **event_args):
        if state.call("admin_painting_save", self.api_box.text or ""):
            state.toast("Saved", "ok")
            self._painting()

    @handle("api_check_button", "click")
    def api_check_button_click(self, **event_args):
        import anvil.server
        r = anvil.server.call("admin_painting_check")
        self.check_line.visible = True
        if not r.get("ok"):
            self.check_line.text = r.get("error") or "That didn't work."
            self.check_line.role = ["ad-check-line", "ad-bad"]
            return
        pc = "the studio PC is on" if r["online"] else "the studio PC is off right now (pages wait in line)"
        if r["paused"]:
            pc = "the queue is paused"
        self.check_line.text = "Connected: the key works, %s, %s." % (
            pc, state.plural(r["waiting"], "picture", "pictures") + " in the queue")
        self.check_line.role = ["ad-check-line", "ad-ok"]

    # ---- demo data
    def _demo(self):
        d = state.call("admin_overview")["demo"]
        counts = ", ".join("%s %s" % (v, k) for k, v in d["counts"].items())
        self.demo_status.text = "Status: %s · %s" % (d["state"], counts)
        self.demo_load_button.text = "Reload demo data" if d["state"] == "loaded" else "Load demo data"

    @handle("demo_load_button", "click")
    def demo_load_button_click(self, **event_args):
        if confirm("Demo people and content are added (any old demo rows are replaced).", title="Load the demo data?",
                   buttons=[("Cancel", False), ("Load", True)], role="lh-dialog"):
            if state.call("demo_load"):
                state.toast("Done", "ok")
                self._demo()

    @handle("demo_remove_button", "click")
    def demo_remove_button_click(self, **event_args):
        if confirm("Every demo row is deleted. Real data stays.", title="Remove the demo data?",
                   buttons=[("Cancel", False), ("Remove", True)], role="lh-dialog"):
            if state.call("demo_remove"):
                state.toast("Done", "ok")
                self._demo()
