// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import type { StoreSettings } from "@/lib/domain/types";
import type {
  ChangePasswordAction,
  SaveStoreDetailsAction,
} from "./actionTypes";
import { SettingsAdmin } from "./SettingsAdmin";

afterEach(cleanup);

const SETTINGS: StoreSettings = {
  name: "KK Trading",
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
}: {
  saveDetailsAction?: SaveStoreDetailsAction;
  changePasswordAction?: ChangePasswordAction;
} = {}) {
  render(
    <SnackbarProvider>
      <SettingsAdmin
        settings={SETTINGS}
        saveDetailsAction={saveDetailsAction}
        changePasswordAction={changePasswordAction}
      />
    </SnackbarProvider>,
  );
  return { saveDetailsAction, changePasswordAction };
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
      headline: SETTINGS.headline,
      tagline: SETTINGS.tagline,
      phone: SETTINGS.phone,
      email: SETTINGS.email,
      address: SETTINGS.address,
    });
    await waitFor(() =>
      expect(snackbar()).toHaveTextContent("Store details saved."),
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
