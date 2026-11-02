"""Dialog Forms, shown with anvil.alert(Form(...), buttons=[]). Each closes itself with
self.raise_event("x-close-alert", value=...), and alert() returns that value."""
