// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATEGORY_ICONS } from "@/lib/domain/icons";
import type { SaveCategoryAction } from "./actionTypes";
import { CategoryEditor } from "./CategoryEditor";
import { GYM } from "./testing/fixtures";

afterEach(cleanup);

function renderEditor({
  category = null,
  saveAction = vi.fn(async () => ({ ok: true as const, message: "Saved." })),
}: {
  category?: typeof GYM | null;
  saveAction?: SaveCategoryAction;
} = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <CategoryEditor
      open
      category={category}
      saveAction={saveAction}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  return { saveAction, onClose, onSaved };
}

const editor = (name: string) => screen.getByRole("dialog", { name });

describe("CategoryEditor", () => {
  it("adds a category with the default icon", async () => {
    const { saveAction, onSaved } = renderEditor();
    const dialog = editor("Add category");
    await userEvent.type(
      within(dialog).getByLabelText("Category name"),
      "Outdoor",
    );
    expect(within(dialog).getByLabelText("Short description")).toHaveAttribute(
      "placeholder",
      "e.g. Bars, benches, racks and free weights",
    );
    expect(
      within(dialog).getByRole("radio", { name: "category" }),
    ).toBeChecked();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add category" }),
    );
    expect(saveAction).toHaveBeenCalledWith({
      id: undefined,
      name: "Outdoor",
      blurb: "",
      icon: "category",
    });
    expect(onSaved).toHaveBeenCalledWith("Saved.");
  });

  it("offers the 18 icons as one radio group", () => {
    renderEditor({ category: GYM });
    const group = screen.getByRole("group", { name: "Icon" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(CATEGORY_ICONS.length);
    expect(CATEGORY_ICONS).toHaveLength(18);
    expect(
      within(group).getByRole("radio", { name: "fitness center" }),
    ).toBeChecked();
  });

  it("picks an icon by keyboard alone", async () => {
    const { saveAction } = renderEditor({ category: GYM });
    const dialog = editor("Edit category");
    // Name, description, then the selected icon.
    within(dialog).getByLabelText("Short description").focus();
    await userEvent.tab();
    const selected = within(dialog).getByRole("radio", {
      name: "fitness center",
    });
    expect(selected).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    const next = within(dialog).getByRole("radio", { name: "exercise" });
    expect(next).toHaveFocus();
    expect(next).toBeChecked();

    // Then on to the dialog's buttons: Cancel, Save changes.
    await userEvent.tab();
    await userEvent.tab();
    expect(
      within(dialog).getByRole("button", { name: "Save changes" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(saveAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: GYM.id, icon: "exercise" }),
    );
  });

  it("shows a duplicate name from the server on the name, and focuses it", async () => {
    renderEditor({
      saveAction: vi.fn(async () => ({
        ok: false as const,
        fieldErrors: { name: "A category with this name already exists." },
      })),
    });
    const name = screen.getByLabelText("Category name");
    await userEvent.type(name, "gym equipment");
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));

    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription(
      "A category with this name already exists.",
    );
    expect(name).toHaveFocus();
  });

  it("checks the name before calling the server", async () => {
    const { saveAction } = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));
    const name = screen.getByLabelText("Category name");
    expect(name).toHaveAccessibleDescription("Enter a category name.");
    expect(name).toHaveFocus();
    expect(saveAction).not.toHaveBeenCalled();
  });

  it("asks before discarding edits, and closes straight away without any", async () => {
    const { onClose } = renderEditor({ category: GYM });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("radio", { name: "pool" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const confirm = screen.getByRole("dialog", {
      name: "Discard changes to this category?",
    });
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Discard changes" }),
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
