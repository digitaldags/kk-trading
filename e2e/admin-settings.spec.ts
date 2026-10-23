import { execFileSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { publish } from "./helpers";

// Store details and the password change against the Neon dev branch. The store name gets
// " E2E" appended and is put back; the password is changed, then reset to the test
// account's with `pnpm db:admin`. Runs last (see playwright.config.ts), because changing
// the password signs out every other session. In CI it runs on a throwaway Neon branch.
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
test.skip(
  !process.env.DATABASE_URL || !EMAIL || !PASSWORD,
  "Needs DATABASE_URL and the E2E_ADMIN_* test account.",
);

test.describe.configure({ mode: "serial" });

const SUFFIX = " E2E";
const NEW_PASSWORD = `e2e password ${Date.now()}`;

function runScript(script: string, args: string[] = []) {
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", `scripts/${script}`, ...args],
    { stdio: "ignore" },
  );
}

/** Puts the test account's password back, and clears this spec's failed attempts. */
function resetAccount() {
  runScript("db-admin.ts", [
    "--email",
    EMAIL,
    "--password",
    PASSWORD,
    "--allow-weak-password",
  ]);
  runScript("e2e-reset-login-attempts.ts");
}

test.beforeAll(() => {
  if (!process.env.DATABASE_URL || !EMAIL || !PASSWORD) return;
  runScript("e2e-cleanup.ts");
  runScript("e2e-reset-login-attempts.ts");
});

test.afterAll(() => {
  if (!process.env.DATABASE_URL || !EMAIL || !PASSWORD) return;
  resetAccount();
  runScript("e2e-cleanup.ts");
});

async function signIn(page: Page, password = PASSWORD) {
  await page.goto("/admin/login?next=%2Fadmin%2Fsettings");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
}

async function signedInPage(browser: Browser, password = PASSWORD) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, password);
  return page;
}

const detailsForm = (page: Page) =>
  page.getByRole("form", { name: "Store details" });
const passwordForm = (page: Page) =>
  page.getByRole("form", { name: "Admin password" });
const snackbar = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

/** Saves a new store name and publishes it. */
async function setStoreName(page: Page, name: string) {
  const field = detailsForm(page).getByLabel("Store name");
  await field.fill(name);
  await detailsForm(page).getByRole("button", { name: "Save details" }).click();
  await expect(snackbar(page, "Store details saved.")).toBeVisible();
  await publish(page);
}

test("a new store name shows in the app bar, hero and footer on the next load", async ({
  page,
}) => {
  await signIn(page);
  await expect(page).toHaveTitle("Store details · Admin");
  const original = await detailsForm(page)
    .getByLabel("Store name")
    .inputValue();
  const renamed = `${original}${SUFFIX}`;

  // Load the store first, so its cached settings are warm.
  await page.goto("/");
  await expect(page.locator("footer")).toContainText(original);

  await page.goto("/admin/settings");
  await setStoreName(page, renamed);

  await page.goto("/");
  await expect(
    page.getByRole("banner").getByText(renamed, { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("section[aria-labelledby=hero-title]")
      .getByText(renamed, { exact: true }),
  ).toBeVisible();
  await expect(page.locator("footer")).toContainText(renamed);

  await page.goto("/admin/settings");
  await setStoreName(page, original);
  await page.goto("/");
  await expect(page.locator("footer")).not.toContainText(renamed);
});

test("an invalid email is refused before saving", async ({ page }) => {
  await signIn(page);
  const email = detailsForm(page).getByLabel("Email");
  await email.fill("not an email");
  await detailsForm(page).getByRole("button", { name: "Save details" }).click();
  await expect(email).toHaveAccessibleDescription(
    "Enter an email address like name@example.com.",
  );
  await expect(email).toBeFocused();
});

test("a wrong current password shows the error and changes nothing", async ({
  page,
  browser,
}) => {
  await signIn(page);
  const form = passwordForm(page);
  await form.getByLabel("Current password").fill("not the password");
  await form.getByLabel("New password").fill(NEW_PASSWORD);
  await form.getByLabel("Confirm password").fill(NEW_PASSWORD);
  await form.getByRole("button", { name: "Update password" }).click();

  const current = form.getByLabel("Current password");
  await expect(current).toHaveAccessibleDescription(
    "Your current password isn't right.",
  );
  await expect(current).toBeFocused();

  // The old password still works.
  const other = await signedInPage(browser);
  await other.context().close();
});

test("changing the password signs out other sessions on their next request", async ({
  page,
  browser,
}) => {
  test.slow();
  const other = await signedInPage(browser);
  await signIn(page);

  const form = passwordForm(page);
  await form.getByLabel("Current password").fill(PASSWORD);
  await form.getByLabel("New password").fill(NEW_PASSWORD);
  await form.getByLabel("Confirm password").fill(NEW_PASSWORD);
  await form.getByRole("button", { name: "Update password" }).click();
  await expect(
    snackbar(page, "Password updated. Other devices are signed out."),
  ).toBeVisible();
  await expect(form.getByLabel("Current password")).toHaveValue("");

  // The other browser is signed out on its next request. (The page, not the status: on
  // a production build the status is 200, see CLAUDE.md.)
  await other.reload();
  await expect(
    other.getByRole("heading", { level: 1, name: "Sign in to continue" }),
  ).toBeVisible();
  await other.context().close();

  // This browser got a new session, so it stays signed in.
  await page.reload();
  await expect(passwordForm(page)).toBeVisible();

  // The new password signs in.
  const fresh = await signedInPage(browser, NEW_PASSWORD);
  await fresh.context().close();

  resetAccount();
});
