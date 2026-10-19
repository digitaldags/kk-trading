// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TextField } from "./TextField";

afterEach(cleanup);

describe("TextField", () => {
  it("associates the label with the input", () => {
    render(<TextField label="Product name" />);
    expect(
      screen.getByRole("textbox", { name: "Product name" }),
    ).toBeInTheDocument();
  });

  it("is not marked invalid without an error", () => {
    render(<TextField label="Product name" hint="Shown on the card." />);
    const input = screen.getByRole("textbox", { name: "Product name" });
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Shown on the card.");
  });

  it("wires the error to aria-invalid and aria-describedby", () => {
    render(
      <TextField
        label="Key spec"
        hint="One short line."
        error="Enter a key spec."
      />,
    );
    const input = screen.getByRole("textbox", { name: "Key spec" });
    expect(input).toHaveAttribute("aria-invalid", "true");

    const ids = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(ids).toHaveLength(2);
    const described = ids.map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(["One short line.", "Enter a key spec."]);
    expect(input).toHaveAccessibleDescription(
      "One short line. Enter a key spec.",
    );
  });

  it("wires errors the same way for select, price and multiline", () => {
    render(
      <>
        <TextField kind="select" label="Category" error="Pick a category.">
          <option value="">Choose</option>
        </TextField>
        <TextField kind="price" label="Price" error="Enter a price." />
        <TextField kind="multiline" label="Description" error="Too long." />
      </>,
    );
    expect(
      screen.getByRole("combobox", { name: "Category" }),
    ).toHaveAccessibleDescription("Pick a category.");
    expect(screen.getByRole("textbox", { name: "Price" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByRole("textbox", { name: "Description" }),
    ).toHaveAccessibleDescription("Too long.");
  });

  it("keeps a caller's aria-describedby", () => {
    render(
      <>
        <p id="extra">Extra help.</p>
        <TextField
          label="Email"
          aria-describedby="extra"
          error="Enter an email."
        />
      </>,
    );
    expect(
      screen.getByRole("textbox", { name: "Email" }),
    ).toHaveAccessibleDescription("Extra help. Enter an email.");
  });
});
