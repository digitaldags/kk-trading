import ExcelJS from "exceljs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  downloadedWorkbook,
  importRow,
  productsWorkbookFile,
  publish,
  runScript,
  workbookFile,
} from "./helpers";

// The Excel import and export (tickets 41 to 43), from the file to the storefront. Every
// product is named "E2E product <run> <n>" and coded "E2E-<run>-<n>", so
// scripts/e2e-cleanup.ts removes them. No seeded product is ever edited.
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
test.skip(
  !process.env.DATABASE_URL || !EMAIL || !PASSWORD,
  "Needs DATABASE_URL and the E2E_ADMIN_* test account.",
);

// The tests build on each other: the same file is imported, re-imported, then changed.
test.describe.configure({ mode: "serial" });

const RUN = Date.now();
const nameOf = (n: number | string) => `E2E product ${RUN} ${n}`;
const codeOf = (n: number | string) => `E2E-${RUN}-${n}`;
const NO_CODE_NAME = nameOf("no code");

/** Read from the template in the first test, so a renamed category can't break a run. */
let category = "";

const row = (n: number, overrides = {}) =>
  importRow({
    code: codeOf(n),
    name: nameOf(n),
    category,
    price: String(1000 + n),
    specs: "First line\nSecond line",
    ...overrides,
  });

const threeProducts = () => [row(1), row(2), row(3)];

async function signIn(page: Page) {
  await page.goto("/admin/login?next=%2Fadmin");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function openDialog(page: Page) {
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Import products" });
  await expect(dialog.getByLabel("Excel file (.xlsx)")).toBeVisible();
  return dialog;
}

const chooseFile = (
  dialog: Locator,
  file: { name: string; mimeType: string; buffer: Buffer },
) => dialog.getByLabel("Excel file (.xlsx)").setInputFiles(file);

const importButton = (dialog: Locator) =>
  dialog.getByRole("button", { name: /^Import \d+ products?$/ });

/** The summary, as shown. The same words are in the live region for screen readers. */
const summary = (dialog: Locator, text: string) =>
  dialog.getByText(text).first();

const productRow = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "Products" })
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });

const snackbar = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

/** The spreadsheet's rows by header, from the Products sheet. */
function rowsOf(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet("Products")!;
  const headers = (sheet.getRow(1).values as unknown[]).map(String);
  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((sheetRow, number) => {
    if (number === 1) return;
    rows.push(
      Object.fromEntries(
        headers
          .map((header, column) => [header, sheetRow.getCell(column).value])
          .slice(1),
      ),
    );
  });
  return rows;
}

// Clear what an interrupted run left behind, so a second run starts clean.
test.beforeAll(() => {
  if (!process.env.DATABASE_URL || !EMAIL || !PASSWORD) return;
  runScript("scripts/e2e-cleanup.ts");
});

test.afterAll(() => {
  if (!process.env.DATABASE_URL || !EMAIL || !PASSWORD) return;
  runScript("scripts/e2e-cleanup.ts");
});

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the template has the columns and lists, and no data rows", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download template" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(
    "kk-trading-products-template.xlsx",
  );

  const workbook = await downloadedWorkbook(download);
  expect(workbook.worksheets.map((s) => s.name)).toEqual([
    "Products",
    "Lists",
    "Instructions",
  ]);
  const sheet = workbook.getWorksheet("Products")!;
  expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual([
    "Code",
    "Name",
    "Category",
    "Unit",
    "Price",
    "Stock status",
    "Key spec",
    "Description",
    "Specifications",
  ]);
  expect(sheet.rowCount).toBe(1);

  const names = (
    workbook.getWorksheet("Lists")!.getColumn(1).values as unknown[]
  )
    .slice(2)
    .map(String);
  expect(names.length).toBeGreaterThan(0);

  await page.goto("/admin/categories");
  for (const name of names) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  category = names[0]!;
});

test("a bad row stops the whole file, with its row number", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await chooseFile(
    dialog,
    await productsWorkbookFile([row(1), row(2, { category: "No such thing" })]),
  );

  await expect(
    dialog.getByRole("heading", { name: "Problems in this file" }),
  ).toBeFocused();
  await expect(
    dialog.getByText(/^Row 3, Category: Unknown category “No such thing”/),
  ).toBeVisible();
  await expect(summary(dialog, "1 problem in 1 row.")).toBeVisible();
  await expect(importButton(dialog)).toHaveCount(0);

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(productRow(page, nameOf(1))).toHaveCount(0);
});

test("a valid file adds exactly its products, to the draft", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await chooseFile(dialog, await productsWorkbookFile(threeProducts()));

  await expect(summary(dialog, "3 products will be added.")).toBeVisible();
  await importButton(dialog).click();

  await expect(
    snackbar(page, "Imported 3 products. Publish to show them on the store."),
  ).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Import", exact: true }),
  ).toBeFocused();

  for (const n of [1, 2, 3]) {
    await expect(productRow(page, nameOf(n))).toBeVisible();
  }
  await expect(
    page.getByRole("region", { name: "Unpublished changes" }),
  ).toBeVisible();

  // The list doesn't show codes, but the search reads them.
  await page.goto(`/admin?q=${codeOf(2)}`);
  await expect(
    page.getByRole("list", { name: "Products" }).getByRole("listitem"),
  ).toHaveCount(1);
  await expect(productRow(page, nameOf(2))).toBeVisible();
});

test("importing the same file again changes nothing", async ({ page }) => {
  const dialog = await openDialog(page);
  await chooseFile(dialog, await productsWorkbookFile(threeProducts()));

  await expect(
    summary(
      dialog,
      "0 products will be added. 3 already exist and will be skipped. Nothing to import.",
    ),
  ).toBeVisible();
  await expect(importButton(dialog)).toHaveCount(0);
});

test("a changed row is refused, and names the change", async ({ page }) => {
  const dialog = await openDialog(page);
  await chooseFile(
    dialog,
    await productsWorkbookFile([row(1), row(2, { price: "1" }), row(3)]),
  );

  await expect(
    dialog.getByText(
      `Row 3, Code: ${codeOf(2)} already exists with a different price. Edit it in the product editor.`,
    ),
  ).toBeVisible();
  await expect(importButton(dialog)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.goto(`/admin?q=${codeOf(2)}`);
  await expect(productRow(page, nameOf(2))).toContainText("1,002");
});

test("the export has every product, with the values the import accepts", async ({
  page,
}) => {
  // The seed's products all have a code, so add one without.
  await page.getByRole("link", { name: "Add product" }).click();
  const editor = page.getByRole("dialog", { name: "Add product" });
  await editor.getByLabel("Product name").fill(NO_CODE_NAME);
  await editor.getByLabel("Price").fill("10");
  await editor.getByRole("button", { name: "Add product" }).click();
  await expect(snackbar(page, `Added ${NO_CODE_NAME}.`)).toBeVisible();

  // A search on the page doesn't narrow the export.
  await page.goto(`/admin?q=${codeOf(1)}`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^kk-trading-products-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );

  const rows = rowsOf(await downloadedWorkbook(download));
  expect(rows.find((r) => r.Code === codeOf(2))).toMatchObject({
    Name: nameOf(2),
    Category: category,
    Unit: "pcs",
    Price: 1002,
    "Stock status": "In stock",
    Specifications: "First line\nSecond line",
  });
  expect(rows.map((r) => r.Name)).toContain("Electric standing desk");

  const noCode = rows.find((r) => r.Name === NO_CODE_NAME);
  expect(noCode).toBeDefined();
  expect(noCode?.Code ?? null).toBeNull();
});

test("export, add a row, import: only the new row is created", async ({
  page,
}) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  const workbook = await downloadedWorkbook(download);
  const existing = rowsOf(workbook).length;

  const sheet = workbook.getWorksheet("Products")!;
  const added = row(4);
  sheet.addRow([
    added.code,
    added.name,
    added.category,
    added.unit,
    added.price,
    added.stockStatus,
    added.keySpec,
    added.description,
    added.specs,
  ]);

  const dialog = await openDialog(page);
  await chooseFile(dialog, await workbookFile(workbook));

  await expect(
    summary(
      dialog,
      `1 product will be added. ${existing} already exist and will be skipped.`,
    ),
  ).toBeVisible();
  await expect(
    dialog.getByRole("region", { name: "Products to add" }),
  ).toContainText(nameOf(4));
  await importButton(dialog).click();

  await expect(snackbar(page, `${existing} skipped.`)).toBeVisible();
  await expect(productRow(page, nameOf(4))).toBeVisible();
});

test("the storefront shows imported products only after Publish", async ({
  page,
}) => {
  const search = `/?q=${encodeURIComponent(nameOf(1))}`;
  const card = (name: string) =>
    page.getByRole("link").filter({ hasText: name });

  await page.goto(search);
  await expect(card(nameOf(1))).toHaveCount(0);

  await page.goto("/admin");
  await publish(page);

  await page.goto(search);
  await expect(card(nameOf(1))).toBeVisible();

  runScript("scripts/e2e-cleanup.ts");
  await page.goto("/");
  await expect(card(nameOf(1))).toHaveCount(0);
});
