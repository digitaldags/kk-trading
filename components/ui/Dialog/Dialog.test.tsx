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
