// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

afterEach(cleanup);

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose?.();
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog
        open={open}
        onClose={close}
        title="Edit product"
        actions={<button type="button">Save</button>}
      >
        <label>
          Name
          <input defaultValue="Chair" />
        </label>
      </Dialog>
    </>
  );
}

async function openDialog(onClose = vi.fn()) {
  const user = userEvent.setup();
  render(<Harness onClose={onClose} />);
  const trigger = screen.getByRole("button", { name: "Open" });
  await user.click(trigger);
  const dialog = document.querySelector("dialog");
  if (!dialog) throw new Error("dialog not rendered");
  return { user, trigger, dialog, onClose };
}

describe("Dialog", () => {
  it("is labelled by its title", async () => {
    const { dialog } = await openDialog();
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAccessibleName("Edit product");
  });

  it("moves focus to the first field in the body when it opens", async () => {
    await openDialog();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
  });

  it("wraps Tab from the last control to the first, and Shift+Tab back", async () => {
    const { user } = await openDialog();
    const close = screen.getByRole("button", { name: "Close" });
    const save = screen.getByRole("button", { name: "Save" });

    save.focus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(save).toHaveFocus();
  });

  it("closes on Escape (the cancel event) and returns focus to the trigger", async () => {
    const { dialog, trigger, onClose } = await openDialog();
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("closes on a scrim click but not on a click inside", async () => {
    const { user, dialog, onClose } = await openDialog();
    await user.click(screen.getByRole("textbox", { name: "Name" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the close button and returns focus to the trigger", async () => {
    const { user, trigger, onClose } = await openDialog();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });
});

// A route dialog: mounted already open, and removed (not closed) when the route changes.
function RouteHarness() {
  const [mounted, setMounted] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setMounted(true)}>
        Open
      </button>
      <button type="button" onClick={() => setMounted(false)}>
        Go back
      </button>
      {mounted && (
        <Dialog
          open
          onClose={() => setMounted(false)}
          labelledBy="detail-title"
        >
          <h2 id="detail-title">Ergonomic mesh chair</h2>
          <button type="button">Copy phone</button>
        </Dialog>
      )}
    </>
  );
}

describe("Dialog without a title (bare layout)", () => {
  it("is labelled by the heading in its content and has no header", async () => {
    const user = userEvent.setup();
    render(<RouteHarness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = document.querySelector("dialog");
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAccessibleName("Ergonomic mesh chair");
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy phone" })).toHaveFocus();
  });

  it("returns focus to the trigger when it unmounts while open", async () => {
    const user = userEvent.setup();
    render(<RouteHarness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    // The page behind is inert in a browser; jsdom lets the click through.
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(document.querySelector("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe("Dialog closed by the browser", () => {
  // Chrome closes a modal dialog itself on a second Escape when the page prevented the
  // first without a click in between. The parent must hear about it.
  it("asks the parent to close and returns focus to the trigger", async () => {
    const { dialog, trigger, onClose } = await openDialog();
    dialog.close(); // As the browser would: `open` goes false, then `close` fires.
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it("ignores a stale close event that arrives after the dialog was shown again", async () => {
    const { dialog, onClose } = await openDialog();
    // React's dev double effect closes then reopens; the first `close` event lands late.
    fireEvent(dialog, new Event("close"));
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute("open");
  });

  it("doesn't report its own closes as the browser's", async () => {
    const { user, onClose } = await openDialog();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
