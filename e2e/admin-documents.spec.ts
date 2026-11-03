import { expect, test, type Page } from "@playwright/test";
import { cleanUpE2eDocuments } from "./helpers";

// Quotations and delivery receipts through the admin UI (ticket 24): create, refuse a
// duplicate number, complete, deliver in two receipts, print, and delete a receipt.
// Everything is numbered "E2E-<run>-…"; scripts/e2e-cleanup.ts deletes it before and
// after (completed quotations can't be deleted in the app). Runs in the ADMIN_WRITES
// chain, away from admin-auth signing out every session.
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const READY = !!process.env.DATABASE_URL && !!EMAIL && !!PASSWORD;
test.skip(!READY, "Needs DATABASE_URL and the E2E_ADMIN_* test account.");

// The tests build on each other: one quotation, then its receipts.
test.describe.configure({ mode: "serial" });

const RUN = Date.now();
const NUMBER = `E2E-${RUN}-1`;
const DR1 = `E2E-${RUN}-DR1`;
const DR2 = `E2E-${RUN}-DR2`;
// Drafts for the BUG-01 test. Neither contains NUMBER, so searching for it finds one.
const NUMBER_B = `E2E-${RUN}-B`;
const NUMBER_C = `E2E-${RUN}-C`;

// Seeded products that the dev branch also has. Their codes and catalog prices
// differ between the two, so the spec sets the prices itself.
const DESK = "Electric standing desk";
const CABINET = "Steel 4-drawer filing cabinet";
// 2 × 8,450 + 5 × 6,155.
const GRAND_TOTAL = "₱47,675.00";

let quotationId = "";

test.beforeAll(() => {
  if (READY) cleanUpE2eDocuments();
});

test.afterAll(() => {
  if (READY) cleanUpE2eDocuments();
});

async function signIn(page: Page) {
  await page.goto("/admin/login?next=%2Fadmin");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.beforeEach(async ({ page, context }) => {
  // "Create and print" opens the receipt's print page in a new tab; close it.
  context.on("page", (tab) => void tab.close());
  await signIn(page);
});

const snackbar = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

/** The Remaining cell of a line in Delivery progress, as shown. */
const remaining = (page: Page, product: string) =>
  page
    .getByRole("region", { name: "Delivery progress" })
    .getByRole("row", { name: new RegExp(product) })
    .getByRole("cell")
    .last();

const createButton = (page: Page) =>
  page.getByRole("button", { name: "Create delivery receipt" });

/** Creates a receipt from the open quotation, with the given quantities (or the defaults). */
async function createReceipt(
  page: Page,
  number: string,
  quantities: Record<string, string> = {},
) {
  await createButton(page).click();
  const dialog = page.getByRole("dialog", { name: "Create delivery receipt" });
  await dialog.getByLabel("Number").fill(number);
  for (const [product, quantity] of Object.entries(quantities)) {
    await dialog.getByLabel(`Deliver now for ${product}`).fill(quantity);
  }
  await dialog.getByRole("button", { name: "Create and print" }).click();
  await expect(dialog).toBeHidden();
  await expect(snackbar(page, `Receipt ${number} created.`)).toBeVisible();
}

test("the Documents tab is reachable from every admin page", async ({
  page,
}) => {
  for (const path of ["/admin", "/admin/categories", "/admin/settings"]) {
    await page.goto(path);
    await page
      .getByRole("navigation", { name: "Admin sections" })
      .getByRole("link", { name: "Documents" })
      .click();
    await expect(page).toHaveURL(/\/admin\/documents$/);
    await expect(
      page.getByRole("link", { name: "Documents", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
});

test("a new quotation adds products, takes edited prices and totals them", async ({
  page,
}) => {
  await page.goto("/admin/documents");
  // The toolbar's; an empty list shows a second one.
  await page.getByRole("link", { name: "New quotation" }).first().click();
  await expect(page).toHaveURL(/\/admin\/documents\/new$/);

  await page.getByLabel("Number", { exact: true }).fill(NUMBER);
  await page.getByLabel("Customer name").fill("E2E Customer");
  await page.getByLabel("TIN", { exact: true }).fill("010-865-925-000");
  await page.getByLabel("Delivery address").fill("Lapu-Lapu City, Cebu");

  await page.getByRole("button", { name: "Add product" }).click();
  const add = page.getByRole("dialog", { name: "Add product" });
  await add.getByRole("button", { name: `Add ${DESK}` }).click();
  await add.getByRole("button", { name: `Add ${CABINET}` }).click();
  await add.getByRole("button", { name: "Done" }).click();

  await page.getByLabel(`Quantity for ${DESK}`).fill("2");
  await page.getByLabel(`Unit price for ${DESK}`).fill("8,450");
  await page.getByLabel(`Quantity for ${CABINET}`).fill("5");
  await page.getByLabel(`Unit price for ${CABINET}`).fill("6,155");
  await expect(
    page.getByRole("region", { name: "Totals" }).locator("dd").last(),
  ).toHaveText(GRAND_TOTAL);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(snackbar(page, `Saved quotation ${NUMBER}.`)).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/documents\/[0-9a-f-]{36}$/);
  quotationId = page.url().split("/").at(-1)!;
});

// BUG-01: Next keeps a page you leave alive (hidden in <Activity>), so New quotation
// used to show the quotation just saved, and saving it updated that one.
test("New quotation after a save opens an empty form and creates another", async ({
  page,
}) => {
  const heading = (name: string) =>
    page.getByRole("heading", { level: 1, name });
  const numberField = page.getByLabel("Number", { exact: true });
  const newQuotation = page
    .getByRole("link", { name: "New quotation" })
    .first();
  const documentsTab = page
    .getByRole("navigation", { name: "Admin sections" })
    .getByRole("link", { name: "Documents" });

  await page.goto("/admin/documents");
  await newQuotation.click();
  await expect(page).toHaveURL(/\/admin\/documents\/new$/);
  await numberField.fill(NUMBER_B);
  await page.getByLabel("Customer name").fill("E2E Customer B");
  const input = await numberField.elementHandle();
  const save = page.getByRole("button", { name: "Save", exact: true });
  await save.click();
  await expect(snackbar(page, `Saved quotation ${NUMBER_B}.`)).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/documents\/[0-9a-f-]{36}$/);
  const idB = page.url().split("/").at(-1)!;
  // The first save keeps the editor mounted (ticket 21): the same input is on screen.
  await expect(heading(NUMBER_B)).toBeVisible();
  expect(await input!.evaluate((node) => node.isConnected)).toBe(true);

  await documentsTab.click();
  await expect(page).toHaveURL(/\/admin\/documents$/);
  await newQuotation.click();
  await expect(page).toHaveURL(/\/admin\/documents\/new$/);
  await expect(heading("New quotation")).toBeVisible();
  await expect(numberField).toHaveValue("");
  await expect(page.getByLabel("Customer name")).toHaveValue("");

  // Back and Forward show the form that matches the URL.
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/documents$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/admin\/documents\/new$/);
  await expect(heading("New quotation")).toBeVisible();
  await expect(numberField).toHaveValue("");

  await numberField.fill(NUMBER_C);
  await page.getByLabel("Customer name").fill("E2E Customer C");
  await save.click();
  await expect(snackbar(page, `Saved quotation ${NUMBER_C}.`)).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/documents\/[0-9a-f-]{36}$/);
  expect(page.url().split("/").at(-1)).not.toBe(idB);

  // B is unchanged.
  await page.goto(`/admin/documents/${idB}`);
  await expect(heading(NUMBER_B)).toBeVisible();
  await expect(page.getByLabel("Customer name")).toHaveValue("E2E Customer B");
});

test("a second quotation can't take the same number in another case", async ({
  page,
}) => {
  await page.goto("/admin/documents/new");
  await page.getByLabel("Number", { exact: true }).fill(NUMBER.toLowerCase());
  await page.getByLabel("Customer name").fill("E2E Duplicate");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Another quotation already uses this number."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/documents\/new$/);

  await page.goto(`/admin/documents?q=${NUMBER}`);
  await expect(
    page.getByRole("list", { name: "Quotations" }).getByRole("listitem"),
  ).toHaveCount(1);
});

test("marking it completed locks it", async ({ page }) => {
  await page.goto(`/admin/documents/${quotationId}`);
  await page.getByRole("button", { name: "Mark as completed" }).click();
  await page
    .getByRole("dialog", { name: "Mark as completed?" })
    .getByRole("button", { name: "Mark as completed" })
    .click();
  await expect(snackbar(page, `Marked ${NUMBER} as completed.`)).toBeVisible();

  await expect(
    page.getByText(
      /^Completed quotations are read-only\. .+ still to be delivered\.$/,
    ),
  ).toBeVisible();
  for (const name of ["Save", "Mark as completed", "Add product"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  }
  await expect(page.getByLabel("Customer name")).toHaveCount(0);
});

test("two receipts deliver everything", async ({ page }) => {
  await page.goto(`/admin/documents/${quotationId}`);

  await createReceipt(page, DR1, { [DESK]: "1", [CABINET]: "0" });
  await expect(remaining(page, DESK)).toHaveText("1", { useInnerText: true });
  await expect(remaining(page, CABINET)).toHaveText("5", {
    useInnerText: true,
  });

  // The rest: the quantities start at what is left.
  await createReceipt(page, DR2);
  await expect(remaining(page, DESK)).toHaveText("0", { useInnerText: true });
  await expect(remaining(page, CABINET)).toHaveText("0", {
    useInnerText: true,
  });
  await expect(createButton(page)).toHaveCount(0);
  await expect(
    page.getByText(
      "Completed quotations are read-only. Everything has been delivered.",
    ),
  ).toBeVisible();

  await page.goto(`/admin/documents?q=${NUMBER}`);
  await expect(
    page.getByRole("list", { name: "Quotations" }).getByText("Fully delivered"),
  ).toBeVisible();
});

test("both print pages show the totals, the notice and the numbers", async ({
  page,
}) => {
  await page.goto(`/admin/print/quotations/${quotationId}`);
  await expect(page.getByText(NUMBER, { exact: true })).toBeVisible();
  await expect(page.getByText(GRAND_TOTAL)).toBeVisible();

  await page.goto(`/admin/documents/${quotationId}`);
  const href = await page
    .getByRole("region", { name: "Delivery receipts" })
    .getByRole("row", { name: new RegExp(DR1) })
    .getByRole("link", { name: "Print" })
    .getAttribute("href");
  await page.goto(href!);
  await expect(page.getByText(DR1, { exact: true })).toBeVisible();
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1).getByRole("cell").last()).toHaveText("1");
  await expect(
    page.getByText("THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX"),
  ).toBeVisible();
});

test("deleting a receipt puts its quantities back", async ({ page }) => {
  await page.goto(`/admin/documents/${quotationId}`);
  await page.getByRole("button", { name: `Delete receipt ${DR2}` }).click();
  await page
    .getByRole("dialog", { name: `Delete receipt ${DR2}?` })
    .getByRole("button", { name: "Delete receipt", exact: true })
    .click();
  await expect(snackbar(page, `Deleted receipt ${DR2}.`)).toBeVisible();

  await expect(remaining(page, DESK)).toHaveText("1", { useInnerText: true });
  await expect(remaining(page, CABINET)).toHaveText("5", {
    useInnerText: true,
  });
  await expect(createButton(page)).toBeVisible();
});
