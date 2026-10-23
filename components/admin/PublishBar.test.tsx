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
import { AdminAppBar } from "./AdminAppBar";
import { PublishBar } from "./PublishBar";

afterEach(cleanup);

function renderBar() {
  const publishAction = vi.fn(async () => ({
    ok: true,
    message: "Your changes are live.",
  }));
  const discardAction = vi.fn(async () => ({
    ok: true,
    message: "Changes discarded.",
  }));
  render(
    <SnackbarProvider>
      <PublishBar publishAction={publishAction} discardAction={discardAction} />
    </SnackbarProvider>,
  );
  return { publishAction, discardAction };
}

const bar = () => screen.getByRole("region", { name: "Unpublished changes" });
const snackbar = () => screen.getAllByRole("status").at(-1)!;

describe("PublishBar", () => {
  it("publishes and says so", async () => {
    const { publishAction } = renderBar();
    expect(bar()).toHaveTextContent("You have changes that aren't live yet.");
    await userEvent.click(
      within(bar()).getByRole("button", { name: "Publish" }),
    );
    expect(publishAction).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(snackbar()).toHaveTextContent("Your changes are live."),
    );
  });

  it("asks before discarding, and Keep changes does nothing", async () => {
    const { discardAction } = renderBar();
    await userEvent.click(
      within(bar()).getByRole("button", { name: "Discard" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Discard unpublished changes?",
    });
    expect(dialog).toHaveTextContent(
      "The store goes back to what was last published.",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Keep changes" }),
    );
    expect(discardAction).not.toHaveBeenCalled();

    await userEvent.click(
      within(bar()).getByRole("button", { name: "Discard" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Discard changes" }),
    );
    expect(discardAction).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(snackbar()).toHaveTextContent("Changes discarded."),
    );
  });
});

describe("AdminAppBar status", () => {
  const signOut = async () => {};

  it("shows Unpublished changes or All changes live", () => {
    const { rerender } = render(<AdminAppBar signOut={signOut} unpublished />);
    expect(screen.getByText("Unpublished changes")).toBeInTheDocument();
    rerender(<AdminAppBar signOut={signOut} unpublished={false} />);
    expect(screen.getByText("All changes live")).toBeInTheDocument();
  });

  it("shows no status without a session", () => {
    render(<AdminAppBar signOut={signOut} />);
    expect(screen.queryByText("Unpublished changes")).toBeNull();
    expect(screen.queryByText("All changes live")).toBeNull();
  });
});
