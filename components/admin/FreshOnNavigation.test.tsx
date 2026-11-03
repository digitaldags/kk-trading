// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import { QUOTATION_DEFAULTS } from "@/lib/domain/documents";
import type { QuotationDraftDefaults } from "@/lib/services/quotationService";
import type { QuotationAction, SaveQuotationAction } from "./actionTypes";
import { FreshOnNavigation } from "./FreshOnNavigation";
import { QuotationEditor } from "./QuotationEditor";
import { GYM, OFFICE } from "./testing/fixtures";

// BUG-01: Next hides a page you leave in <Activity> and shows the same instance when
// you come back. New quotation must start empty after a save; Back/Forward keeps state.

const router = { bfcacheId: "visit-1", replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const DEFAULTS: QuotationDraftDefaults = {
  number: "",
  quoteDate: "2026-10-27",
  customerName: "",
  customerAddress: "",
  customerTin: "",
  deliveryAddress: "",
  ...QUOTATION_DEFAULTS,
  items: [],
};

const SAVED_ID = "00000000-0000-4000-8000-0000000000d1";

let saveAction: ReturnType<typeof vi.fn<SaveQuotationAction>>;
const noop = vi.fn<QuotationAction>(async () => ({ ok: true, message: "" }));

/** The /new page as Next renders it: hidden or shown in Activity. */
function page(mode: "visible" | "hidden") {
  return (
    <SnackbarProvider>
      <Activity mode={mode}>
        <FreshOnNavigation>
          <QuotationEditor
            quotation={null}
            defaults={DEFAULTS}
            catalog={[]}
            categories={[OFFICE, GYM]}
            saveAction={saveAction}
            completeAction={noop}
            declineAction={noop}
            deleteAction={noop}
          />
        </FreshOnNavigation>
      </Activity>
    </SnackbarProvider>
  );
}

const numberField = () => screen.getByLabelText("Number");
const heading = () => screen.getByRole("heading", { level: 1 });

/** Fills in and saves quotation Q-1, then leaves the page (Activity hides it). */
async function saveThenLeave() {
  const view = render(page("visible"));
  fireEvent.change(numberField(), { target: { value: "Q-1" } });
  fireEvent.change(screen.getByLabelText("Customer name"), {
    target: { value: "Northwind" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await act(async () => {});
  expect(heading()).toHaveTextContent("Q-1");
  view.rerender(page("hidden"));
  return view;
}

beforeEach(() => {
  router.bfcacheId = "visit-1";
  saveAction = vi.fn<SaveQuotationAction>(async () => ({
    ok: true,
    message: "Saved quotation Q-1.",
    id: SAVED_ID,
    number: "Q-1",
    updatedAt: "2026-10-27T07:42:00.000Z",
  }));
  window.history.replaceState(null, "", "/admin/documents/new");
});

afterEach(cleanup);

describe("FreshOnNavigation around the new quotation editor", () => {
  it("shows an empty editor after a save when New quotation is clicked again", async () => {
    const view = await saveThenLeave();

    // A link click is a push navigation: Next gives the segment a new bfcacheId.
    router.bfcacheId = "visit-2";
    view.rerender(page("visible"));

    expect(heading()).toHaveTextContent("New quotation");
    expect(numberField()).toHaveValue("");

    // Saving it creates another quotation: no id from the one saved before.
    fireEvent.change(numberField(), { target: { value: "Q-2" } });
    fireEvent.change(screen.getByLabelText("Customer name"), {
      target: { value: "Contoso" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {});
    expect(saveAction).toHaveBeenCalledTimes(2);
    const [second] = saveAction.mock.lastCall!;
    expect(second).not.toHaveProperty("id");
    expect(second).toMatchObject({ number: "Q-2" });
  });

  it("keeps the editor's state on Back and Forward (same bfcacheId)", async () => {
    const view = await saveThenLeave();

    view.rerender(page("visible"));

    expect(heading()).toHaveTextContent("Q-1");
    expect(numberField()).toHaveValue("Q-1");
  });
});
