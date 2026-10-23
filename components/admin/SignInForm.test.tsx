// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInForm, type SignInState } from "./SignInForm";

afterEach(cleanup);

function renderForm(
  action = vi.fn<(state: SignInState, data: FormData) => Promise<SignInState>>(
    async () => ({ fieldErrors: {} }),
  ),
) {
  render(
    <SignInForm
      action={action}
      storeName="KK Trading"
      next="/admin/products"
    />,
  );
  return action;
}

describe("SignInForm", () => {
  it("shows the copy, the labelled fields and the links", () => {
    renderForm();
    expect(
      screen.getByRole("heading", { level: 1, name: "Store admin" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sign in to manage products and categories for KK Trading.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to store" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("posts the email, password and where to go next", async () => {
    const user = userEvent.setup();
    const action = renderForm();
    await user.type(screen.getByLabelText("Email"), "admin");
    await user.type(screen.getByLabelText("Password"), "admin");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(action).toHaveBeenCalledTimes(1);
    const data = action.mock.calls[0]![1];
    expect(Object.fromEntries(data)).toEqual({
      email: "admin",
      password: "admin",
      next: "/admin/products",
    });
  });

  it("shows the error, keeps the email and clears the password", async () => {
    const user = userEvent.setup();
    renderForm(
      vi.fn(async () => ({
        fieldErrors: {},
        formError: "That email and password don't match.",
        email: "admin",
        attempt: 1,
      })),
    );
    await user.type(screen.getByLabelText("Email"), "admin");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email and password don't match.",
    );
    expect(screen.getByLabelText("Email")).toHaveValue("admin");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("marks empty fields", async () => {
    const user = userEvent.setup();
    renderForm(
      vi.fn(async () => ({
        fieldErrors: {
          email: "Enter your email.",
          password: "Enter your password.",
        },
        attempt: 1,
      })),
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByLabelText("Email")).toHaveAccessibleDescription(
      "Enter your email.",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "Enter your password.",
    );
  });
});
