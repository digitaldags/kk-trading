// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import type { StoreSettings } from "@/lib/domain/types";
import type {
  ChangePasswordAction,
  DiscardLogoAction,
  SaveStoreDetailsAction,
} from "./actionTypes";
import {
  LOGO_SIZE_ERROR,
  LOGO_TYPE_ERROR,
  LOGO_UPLOAD_FAILED,
  SettingsAdmin,
} from "./SettingsAdmin";
import { UNREADABLE_IMAGE } from "./resizeImage";

const upload = vi.fn();
vi.mock("@vercel/blob/client", () => ({
  upload: (...args: unknown[]) => upload(...args),
}));

afterEach(cleanup);

const SETTINGS: StoreSettings = {
  name: "KK Trading",
  slogan: "FOUNDATION TO FURNISH",
  logoUrl: null,
  logoPathname: null,
  logoWidth: null,
  logoHeight: null,
  phone2: "",
  headline: "Equipment for the desk and the gym",
  tagline: "Office furniture and fitness gear.",
  phone: "0917 000 0000",
  email: "hello@example.com",
  address: "Quezon City",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const NEW_PASSWORD = "a much longer password";

function renderSettings({
  saveDetailsAction = vi.fn(async () => ({
    ok: true as const,
    message: "Store details saved.",
  })),
  changePasswordAction = vi.fn(async () => ({
    ok: true as const,
    message: "Password updated. Other devices are signed out.",
  })),
  discardLogoAction = vi.fn(async () => {}),
  settings = SETTINGS,
}: {
  saveDetailsAction?: SaveStoreDetailsAction;
  changePasswordAction?: ChangePasswordAction;
  discardLogoAction?: DiscardLogoAction;
  settings?: StoreSettings;
} = {}) {
  const { unmount } = render(
    <SnackbarProvider>
      <SettingsAdmin
        settings={settings}
        saveDetailsAction={saveDetailsAction}
        discardLogoAction={discardLogoAction}
        changePasswordAction={changePasswordAction}
      />
    </SnackbarProvider>,
  );
  return {
    saveDetailsAction,
    changePasswordAction,
    discardLogoAction,
    unmount,
  };
}

const details = () => screen.getByRole("form", { name: "Store details" });
const password = () => screen.getByRole("form", { name: "Admin password" });
const snackbar = () => screen.getAllByRole("status").at(-1)!;

async function fillPasswords(current: string, next: string, confirm = next) {
  const form = within(password());
  await userEvent.type(form.getByLabelText("Current password"), current);
  await userEvent.type(form.getByLabelText("New password"), next);
  await userEvent.type(form.getByLabelText("Confirm password"), confirm);
  await userEvent.click(form.getByRole("button", { name: "Update password" }));
}

describe("Store details", () => {
  it("saves the edited details and shows the snackbar", async () => {
    const { saveDetailsAction } = renderSettings();
    const name = within(details()).getByLabelText("Store name");
    expect(name).toHaveValue("KK Trading");
    await userEvent.clear(name);
    await userEvent.type(name, "KK Trading PH");
    await userEvent.click(
      within(details()).getByRole("button", { name: "Save details" }),
    );
    expect(saveDetailsAction).toHaveBeenCalledWith({
      name: "KK Trading PH",
      slogan: SETTINGS.slogan,
      headline: SETTINGS.headline,
      tagline: SETTINGS.tagline,
      phone: SETTINGS.phone,
      phone2: SETTINGS.phone2,
      email: SETTINGS.email,
      address: SETTINGS.address,
      logo: undefined,
    });
    await waitFor(() =>
      expect(snackbar()).toHaveTextContent("Store details saved."),
    );
  });

  it("saves the slogan and second phone", async () => {
    const { saveDetailsAction } = renderSettings();
    const form = within(details());
    await userEvent.clear(form.getByLabelText("Slogan"));
    await userEvent.type(form.getByLabelText("Slogan"), "Built to last");
    await userEvent.type(
      form.getByLabelText("Second phone"),
      "+639 77 698 2416",
    );
    await userEvent.click(form.getByRole("button", { name: "Save details" }));
    expect(saveDetailsAction).toHaveBeenCalledWith(
      expect.objectContaining({
        slogan: "Built to last",
        phone2: "+639 77 698 2416",
      }),
    );
  });

  it("checks the email format first and focuses it", async () => {
    const { saveDetailsAction } = renderSettings();
    const email = within(details()).getByLabelText("Email");
    await userEvent.clear(email);
    await userEvent.type(email, "not an email");
    await userEvent.click(
      within(details()).getByRole("button", { name: "Save details" }),
    );
    expect(email).toHaveAccessibleDescription(
      "Enter an email address like name@example.com.",
    );
    expect(email).toHaveFocus();
    expect(saveDetailsAction).not.toHaveBeenCalled();
  });
});

describe("Store details › Logo", () => {
  const LOGO = {
    url: "https://store.public.blob.vercel-storage.com/branding/kk-trading-logo-x1.png",
    pathname: "branding/kk-trading-logo-x1.png",
  };
  const logoFile = () =>
    document.querySelector<HTMLInputElement>('[data-testid="logo-file"]')!;
  const save = () =>
    userEvent.click(
      within(details()).getByRole("button", { name: "Save details" }),
    );

  // jsdom can't decode images: every picked file reads as 400 × 100.
  const createImageBitmap = vi.fn(async () => ({
    width: 400,
    height: 100,
    close: () => {},
  }));

  beforeEach(() => {
    upload.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    createImageBitmap.mockClear();
    vi.stubGlobal("createImageBitmap", createImageBitmap);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the hint and an Upload button without a logo", () => {
    renderSettings();
    const button = within(details()).getByRole("button", {
      name: "Upload logo",
    });
    expect(button).toHaveAccessibleDescription(
      "PNG with a transparent background works best. Shown in the store header, and printed at the top left of quotations and delivery receipts.",
    );
    expect(
      within(details()).queryByRole("button", { name: "Remove logo" }),
    ).toBeNull();
    expect(logoFile()).toHaveAttribute(
      "accept",
      "image/webp,image/jpeg,image/png",
    );
  });

  it("uploads a picked PNG to branding/ on save, as is, once", async () => {
    upload.mockResolvedValue(LOGO);
    const saveDetailsAction = vi
      .fn<SaveStoreDetailsAction>()
      .mockResolvedValueOnce({ ok: false, fieldErrors: {}, formError: "No." })
      .mockResolvedValueOnce({ ok: true, message: "Store details saved." });
    renderSettings({ saveDetailsAction });
    const file = new File(["png"], "logo.png", { type: "image/png" });
    await userEvent.upload(logoFile(), file);
    expect(
      await screen.findByRole("img", { name: "Store logo" }),
    ).toBeVisible();

    await save();
    expect(upload).toHaveBeenCalledWith("branding/kk-trading-logo.png", file, {
      access: "public",
      handleUploadUrl: "/api/blob/upload",
      contentType: "image/png",
    });
    await save();
    expect(upload).toHaveBeenCalledTimes(1);
    // With its size, so the storefront reserves its box (ticket 40).
    expect(saveDetailsAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ logo: { ...LOGO, width: 400, height: 100 } }),
    );
  });

  it("refuses an image it can't read, before uploading", async () => {
    createImageBitmap.mockRejectedValueOnce(new Error("bad image"));
    renderSettings();
    await userEvent.upload(
      logoFile(),
      new File(["not a png"], "logo.png", { type: "image/png" }),
    );
    await waitFor(() =>
      expect(
        within(details()).getByRole("button", { name: "Upload logo" }),
      ).toHaveAccessibleDescription(expect.stringContaining(UNREADABLE_IMAGE)),
    );
    expect(screen.queryByRole("img", { name: "Store logo" })).toBeNull();
    await save();
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses an SVG or other file before uploading", async () => {
    renderSettings();
    await userEvent.upload(
      logoFile(),
      new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }),
      { applyAccept: false },
    );
    expect(
      within(details()).getByRole("button", { name: "Upload logo" }),
    ).toHaveAccessibleDescription(expect.stringContaining(LOGO_TYPE_ERROR));
    await save();
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses a file over 5 MB", async () => {
    renderSettings();
    const big = new File(["x"], "logo.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 + 1 });
    await userEvent.upload(logoFile(), big);
    expect(
      within(details()).getByRole("button", { name: "Upload logo" }),
    ).toHaveAccessibleDescription(expect.stringContaining(LOGO_SIZE_ERROR));
  });

  it("removing the saved logo sends logo: null", async () => {
    const { saveDetailsAction } = renderSettings({
      settings: { ...SETTINGS, logoUrl: LOGO.url, logoPathname: LOGO.pathname },
    });
    expect(screen.getByRole("img", { name: "Store logo" })).toBeVisible();
    await userEvent.click(
      within(details()).getByRole("button", { name: "Remove logo" }),
    );
    expect(
      within(details()).getByRole("button", { name: "Upload logo" }),
    ).toBeVisible();
    await save();
    expect(saveDetailsAction).toHaveBeenCalledWith(
      expect.objectContaining({ logo: null }),
    );
  });

  it("deletes an uploaded logo that was never saved when the page closes", async () => {
    upload.mockResolvedValue(LOGO);
    const { discardLogoAction, unmount } = renderSettings({
      saveDetailsAction: vi.fn(async () => ({
        ok: false as const,
        fieldErrors: {},
        formError: "No.",
      })),
    });
    await userEvent.upload(
      logoFile(),
      new File(["png"], "logo.png", { type: "image/png" }),
    );
    await save();
    expect(discardLogoAction).not.toHaveBeenCalled();
    unmount();
    expect(discardLogoAction).toHaveBeenCalledWith(LOGO.url);
  });

  it("keeps a saved logo when the page closes", async () => {
    upload.mockResolvedValue(LOGO);
    const { discardLogoAction, unmount } = renderSettings();
    await userEvent.upload(
      logoFile(),
      new File(["png"], "logo.png", { type: "image/png" }),
    );
    await save();
    await waitFor(() =>
      expect(
        within(details()).getByRole("button", { name: "Replace logo" }),
      ).toBeVisible(),
    );
    unmount();
    expect(discardLogoAction).not.toHaveBeenCalled();
  });

  it("shows an upload failure on the logo field", async () => {
    upload.mockRejectedValue(new Error("offline"));
    const { saveDetailsAction } = renderSettings();
    await userEvent.upload(
      logoFile(),
      new File(["png"], "logo.png", { type: "image/png" }),
    );
    await save();
    expect(saveDetailsAction).not.toHaveBeenCalled();
    const button = within(details()).getByRole("button", {
      name: "Replace logo",
    });
    expect(button).toHaveAccessibleDescription(
      expect.stringContaining(LOGO_UPLOAD_FAILED),
    );
    expect(button).toHaveFocus();
  });
});

describe("Admin password", () => {
  it("changes the password, clears the fields and shows the snackbar", async () => {
    const { changePasswordAction } = renderSettings();
    await fillPasswords("admin", NEW_PASSWORD);
    expect(changePasswordAction).toHaveBeenCalledWith({
      currentPassword: "admin",
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    await waitFor(() =>
      expect(snackbar()).toHaveTextContent(
        "Password updated. Other devices are signed out.",
      ),
    );
    for (const label of [
      "Current password",
      "New password",
      "Confirm password",
    ]) {
      expect(within(password()).getByLabelText(label)).toHaveValue("");
    }
  });

  it("asks for 12 characters and matching passwords before calling the server", async () => {
    const { changePasswordAction } = renderSettings();
    await fillPasswords("admin", "short");
    const next = within(password()).getByLabelText("New password");
    expect(next).toHaveAccessibleDescription(
      expect.stringContaining("Use at least 12 characters."),
    );
    expect(next).toHaveFocus();

    await userEvent.clear(next);
    await userEvent.type(next, NEW_PASSWORD);
    await userEvent.click(
      within(password()).getByRole("button", { name: "Update password" }),
    );
    const confirm = within(password()).getByLabelText("Confirm password");
    expect(confirm).toHaveAccessibleDescription(
      "The two passwords don't match.",
    );
    expect(confirm).toHaveFocus();
    expect(changePasswordAction).not.toHaveBeenCalled();
  });

  it("shows a wrong current password on that field", async () => {
    renderSettings({
      changePasswordAction: vi.fn(async () => ({
        ok: false as const,
        fieldErrors: { currentPassword: "Your current password isn't right." },
      })),
    });
    await fillPasswords("wrong", NEW_PASSWORD);
    const current = within(password()).getByLabelText("Current password");
    await waitFor(() =>
      expect(current).toHaveAccessibleDescription(
        "Your current password isn't right.",
      ),
    );
    expect(current).toHaveFocus();
  });
});
