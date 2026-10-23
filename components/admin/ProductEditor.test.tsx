// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/domain/types";
import type { DiscardUploadAction, SaveProductAction } from "./actionTypes";
import { priceInputValue, ProductEditor, UPLOAD_URL } from "./ProductEditor";
import { adminProduct, GYM, OFFICE } from "./testing/fixtures";

const upload = vi.fn();
vi.mock("@vercel/blob/client", () => ({
  upload: (...args: unknown[]) => upload(...args),
}));

const resized = new Blob(["webp"], { type: "image/webp" });
vi.mock("./resizeImage", async (original) => ({
  ...(await original<typeof import("./resizeImage")>()),
  resizeImage: vi.fn(async () => resized),
}));

const PHOTO = {
  url: "https://store.public.blob.vercel-storage.com/products/chair-x1.webp",
  pathname: "products/chair-x1.webp",
};

let saveAction: ReturnType<typeof vi.fn<SaveProductAction>>;
let onClose: ReturnType<typeof vi.fn<() => void>>;
let onSaved: ReturnType<typeof vi.fn<(message: string) => void>>;
let discardUploadAction: ReturnType<typeof vi.fn<DiscardUploadAction>>;

function renderEditor(product: Product | null = null) {
  render(
    <ProductEditor
      open
      product={product}
      categories={[OFFICE, GYM]}
      saveAction={saveAction}
      discardUploadAction={discardUploadAction}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  return screen.getByRole("dialog", {
    name: product ? "Edit product" : "Add product",
  });
}

const field = (label: string) => screen.getByLabelText(label);

async function submit(name: "Add product" | "Save changes") {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

beforeEach(() => {
  saveAction = vi.fn<SaveProductAction>(async () => ({
    ok: true,
    message: "Added Desk lamp.",
  }));
  onClose = vi.fn<() => void>();
  onSaved = vi.fn<(message: string) => void>();
  discardUploadAction = vi.fn<DiscardUploadAction>(async () => {});
  upload.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

describe("ProductEditor", () => {
  it("adds a product with the shared schema's fields", async () => {
    const dialog = renderEditor();
    expect(within(dialog).getByLabelText("Category")).toHaveValue(OFFICE.id);
    fireEvent.change(field("Product name"), { target: { value: "Desk lamp" } });
    fireEvent.change(field("Price"), { target: { value: "1,250.50" } });
    fireEvent.change(field("Category"), { target: { value: GYM.id } });
    fireEvent.click(screen.getByRole("button", { name: "Low stock" }));
    fireEvent.change(field("Key spec"), { target: { value: "LED, 3 levels" } });
    await submit("Add product");

    expect(saveAction).toHaveBeenCalledWith({
      id: undefined,
      name: "Desk lamp",
      categoryId: GYM.id,
      price: "1,250.50",
      stockStatus: "low_stock",
      keySpec: "LED, 3 levels",
      description: "",
      image: undefined,
    });
    expect(onSaved).toHaveBeenCalledWith("Added Desk lamp.");
    expect(upload).not.toHaveBeenCalled();
  });

  it("keeps an invalid price on the price field, focused, without saving", async () => {
    renderEditor();
    fireEvent.change(field("Product name"), { target: { value: "Desk lamp" } });
    fireEvent.change(field("Price"), { target: { value: "abc" } });
    await submit("Add product");

    expect(saveAction).not.toHaveBeenCalled();
    expect(field("Price")).toHaveAttribute("aria-invalid", "true");
    expect(field("Price")).toHaveAccessibleDescription(
      "Enter a price of 0 or more, numbers only.",
    );
    expect(field("Price")).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Add product" })).toBeVisible();
  });

  it("focuses the first invalid field in order", async () => {
    renderEditor();
    await submit("Add product");
    expect(field("Product name")).toHaveAccessibleDescription(
      "Enter a product name.",
    );
    expect(field("Product name")).toHaveFocus();
  });

  it("edits a product, filling the fields from it", async () => {
    const chair = adminProduct({ priceCentavos: 895050 });
    saveAction.mockResolvedValue({
      ok: true,
      message: "Saved Ergonomic mesh chair.",
    });
    renderEditor(chair);
    expect(field("Product name")).toHaveValue("Ergonomic mesh chair");
    expect(field("Price")).toHaveValue("8950.50");
    expect(screen.getByRole("button", { name: "In stock" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await submit("Save changes");
    expect(saveAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: chair.id, image: undefined }),
    );
    expect(onSaved).toHaveBeenCalledWith("Saved Ergonomic mesh chair.");
  });

  it("removing the photo saves image: null", async () => {
    renderEditor(
      adminProduct({ imageUrl: PHOTO.url, imagePathname: PHOTO.pathname }),
    );
    expect(screen.getByRole("img", { name: "Product photo" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("button", { name: "Upload photo" })).toBeVisible();
    await submit("Save changes");
    expect(saveAction).toHaveBeenCalledWith(
      expect.objectContaining({ image: null }),
    );
  });

  it("uploads a new photo to Blob before saving, once", async () => {
    upload.mockResolvedValue(PHOTO);
    saveAction
      .mockResolvedValueOnce({
        ok: false,
        fieldErrors: {},
        formError: "Try again.",
      })
      .mockResolvedValueOnce({ ok: true, message: "Added Desk lamp." });
    renderEditor();
    fireEvent.change(field("Product name"), { target: { value: "Desk lamp" } });
    fireEvent.change(field("Price"), { target: { value: "900" } });
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [new File(["png"], "lamp.png", { type: "image/png" })],
        },
      });
    });
    expect(screen.getByRole("button", { name: "Replace photo" })).toBeVisible();

    await submit("Add product");
    expect(upload).toHaveBeenCalledWith("products/desk-lamp.webp", resized, {
      access: "public",
      handleUploadUrl: UPLOAD_URL,
      contentType: "image/webp",
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Try again.");

    await submit("Add product");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(saveAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ image: PHOTO }),
    );
    expect(onSaved).toHaveBeenCalledWith("Added Desk lamp.");
  });

  it("deletes an uploaded photo that was never saved when the editor closes", async () => {
    upload.mockResolvedValue(PHOTO);
    saveAction.mockResolvedValue({
      ok: false,
      fieldErrors: {},
      formError: "No.",
    });
    renderEditor();
    fireEvent.change(field("Product name"), { target: { value: "Desk lamp" } });
    fireEvent.change(field("Price"), { target: { value: "900" } });
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [new File(["png"], "lamp.png", { type: "image/png" })],
        },
      });
    });
    await submit("Add product");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(discardUploadAction).toHaveBeenCalledWith(PHOTO.url);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the server's field errors", async () => {
    saveAction.mockResolvedValue({
      ok: false,
      fieldErrors: { categoryId: "Choose a category." },
    });
    renderEditor(adminProduct());
    await submit("Save changes");
    expect(field("Category")).toHaveAccessibleDescription("Choose a category.");
    expect(field("Category")).toHaveFocus();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("closes straight away without edits", () => {
    renderEditor(adminProduct());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", {
        name: "Discard changes to this product?",
      }),
    ).not.toBeInTheDocument();
  });

  it("asks before closing with edits", () => {
    renderEditor(adminProduct());
    fireEvent.change(field("Product name"), { target: { value: "Chair" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).not.toHaveBeenCalled();
    const confirm = screen.getByRole("dialog", {
      name: "Discard changes to this product?",
    });
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Keep editing" }),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(field("Product name")).toHaveValue("Chair");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onClose).toHaveBeenCalled();
    expect(discardUploadAction).not.toHaveBeenCalled();
  });

  it("asks for a category first when there are none", () => {
    render(
      <ProductEditor
        open
        product={null}
        categories={[]}
        saveAction={saveAction}
        discardUploadAction={discardUploadAction}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );
    expect(
      screen.getByText(/Add a category before adding products/),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Go to Categories" }),
    ).toHaveAttribute("href", "/admin/categories?new=1");
  });
});

describe("priceInputValue", () => {
  it("shows whole pesos without decimals", () => {
    expect(priceInputValue(895000)).toBe("8950");
    expect(priceInputValue(895050)).toBe("8950.50");
    expect(priceInputValue(0)).toBe("0");
  });
});
