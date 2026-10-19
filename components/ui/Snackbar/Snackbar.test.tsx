// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SNACKBAR_DURATION_MS,
  SnackbarProvider,
  useSnackbar,
} from "./Snackbar";

function Trigger({ messages }: { messages: string[] }) {
  const { show } = useSnackbar();
  return (
    <button type="button" onClick={() => messages.forEach(show)}>
      Show
    </button>
  );
}

function renderWith(messages: string[]) {
  render(
    <SnackbarProvider>
      <Trigger messages={messages} />
    </SnackbarProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
  return screen.getByRole("status");
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Snackbar", () => {
  it("announces messages through a status region", () => {
    const region = renderWith(["Saved Ergonomic mesh chair."]);
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Saved Ergonomic mesh chair.");
  });

  it("shows queued messages one at a time and dismisses each after 4.2s", () => {
    const region = renderWith(["First", "Second"]);
    expect(region).toHaveTextContent("First");
    expect(region).not.toHaveTextContent("Second");

    act(() => vi.advanceTimersByTime(SNACKBAR_DURATION_MS - 1));
    expect(region).toHaveTextContent("First");

    act(() => vi.advanceTimersByTime(1));
    expect(region).toHaveTextContent("Second");

    act(() => vi.advanceTimersByTime(SNACKBAR_DURATION_MS));
    expect(region).toBeEmptyDOMElement();
  });
});
