import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// Admin sign-in against the Neon dev branch, with the local test account from
// `pnpm db:admin` (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in .env.local). In CI the
// workflow seeds a throwaway Neon branch with a generated account (README › Tests).
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
test.skip(
  !process.env.DATABASE_URL || !EMAIL || !PASSWORD,
  "Needs DATABASE_URL and the E2E_ADMIN_* test account.",
);

// One account for every test, and the last test signs out all of its sessions.
test.describe.configure({ mode: "serial" });

const SESSION_COOKIE = "kk_admin_session";

/** Runs a TypeScript script from scripts/ the way `pnpm db:*` does, without a shell. */
function runScript(script: string, args: string[] = []) {
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", `scripts/${script}`, ...args],
    { stdio: "ignore" },
  );
}

// Each run fails a sign-in with the same test email (`@example.test`), so the 6th run
// within 15 minutes would hit that email's limit of 5 (and they add up towards the local
// IP's 20). Clear those attempts first so repeated runs stay independent.
test.beforeAll(() => {
  if (process.env.DATABASE_URL && EMAIL && PASSWORD) {
    runScript("e2e-reset-login-attempts.ts");
  }
});

/** Signed in: the admin shell shows, on the Products tab. */
async function expectProductsTab(page: Page) {
  await expect(
    page.getByRole("link", { name: "Products", exact: true }),
  ).toHaveAttribute("aria-current", "page");
}

async function signIn(page: Page, email = EMAIL, password = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("signed out, /admin goes to the sign-in page, and signing in lands on /admin", async ({
  page,
  context,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
  await expect(page).toHaveTitle("Admin · KK Trading");
  await expect(
    page.getByRole("heading", { level: 1, name: "Store admin" }),
  ).toBeVisible();

  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expectProductsTab(page);

  const cookie = (await context.cookies()).find(
    (c) => c.name === SESSION_COOKIE,
  );
  expect(cookie).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
  });
  // About 7 days from now.
  const days = ((cookie?.expires ?? 0) * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(6.9);
  expect(days).toBeLessThanOrEqual(7);
});

test("an unknown email gets the same message as a wrong password", async ({
  page,
}) => {
  // An unknown email, so the real test account never gets close to its lockout.
  await page.goto("/admin/login");
  await signIn(page, "nobody@example.test", "not the password");
  // Scoped to the form: Next.js's route announcer is also an alert.
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "That email and password don't match.",
  );
  await expect(page.getByLabel("Email")).toHaveValue("nobody@example.test");
  await expect(page.getByLabel("Password")).toHaveValue("");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("empty fields are marked", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel("Email")).toHaveAccessibleDescription(
    "Enter your email.",
  );
  await expect(page.getByLabel("Password")).toHaveAccessibleDescription(
    "Enter your password.",
  );
});

test("signing in returns to the admin page you asked for, never elsewhere", async ({
  page,
}) => {
  await page.goto("/admin/login?next=https%3A%2F%2Fevil.example%2Fadmin");
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);

  // Already signed in: the sign-in page sends you on.
  await page.goto("/admin/login");
  await expect(page).toHaveURL(/\/admin$/);
});

test("signing out goes to the store, and /admin asks to sign in again", async ({
  page,
  context,
}) => {
  await page.goto("/admin/login");
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(
    false,
  );

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("an admin action called without a session answers 401", async ({
  page,
  playwright,
  baseURL,
}) => {
  // Read the sign-out action's id from the signed-in page's server HTML (once hydrated,
  // React replaces the form's action), then call it from a client with no cookies, the
  // way a forged request would.
  await page.goto("/admin/login");
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  const html = await (await page.request.get("/admin")).text();
  const actionId = html.match(/name="\$ACTION_ID_([0-9a-f]+)"/)?.[1];
  expect(actionId).toBeTruthy();

  const anonymous = await playwright.request.newContext({ baseURL });
  // How the app's own JavaScript calls an action.
  const response = await anonymous.post("/admin", {
    headers: {
      "Next-Action": actionId!,
      "Content-Type": "text/plain;charset=UTF-8",
      Origin: baseURL!,
      Accept: "text/x-component",
    },
    data: "[]",
    maxRedirects: 0,
  });
  expect(response.status()).toBe(401);
  expect(response.headers()["set-cookie"] ?? "").not.toContain(SESSION_COOKIE);

  // A plain form post (no JavaScript) is rejected too. Next.js renders that path's
  // `unauthorized()` as its 404 page rather than a 401; either way nothing runs.
  const formPost = await anonymous.post("/admin", {
    headers: { Origin: baseURL! },
    multipart: { [`$ACTION_ID_${actionId}`]: "" },
    maxRedirects: 0,
  });
  expect(formPost.status()).toBeGreaterThanOrEqual(400);
  expect(formPost.headers()["set-cookie"] ?? "").not.toContain(SESSION_COOKIE);
  await anonymous.dispose();

  // The real session is untouched.
  await page.reload();
  await expectProductsTab(page);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the sign-in form works as a plain form", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await signIn(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expectProductsTab(page);
  });
});

// Last: setting the password again (to the same value) bumps password_changed_at,
// which signs out every existing session, as changing it in ticket 12 will.
test("changing the password signs out other sessions", async ({ page }) => {
  test.slow();
  await page.goto("/admin/login");
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);

  runScript("db-admin.ts", [
    "--email",
    EMAIL,
    "--password",
    PASSWORD,
    "--allow-weak-password",
  ]);

  // The page, not the status: a production build sends the admin shell (with 200)
  // before the session check runs. Actions still answer 401 (tested above).
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in to continue" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);
});
