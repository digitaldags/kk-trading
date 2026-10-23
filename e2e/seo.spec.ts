import { expect, test, type Page } from "@playwright/test";

// Metadata, structured data, sitemap and robots (ticket 13). Reads the seeded store, so
// it skips without a database. Rich Results Test and Facebook's Sharing Debugger need a
// public URL: check those on the Vercel preview.
test.skip(!process.env.DATABASE_URL, "Needs DATABASE_URL (a seeded database).");

const meta = (page: Page, key: string) =>
  page
    .locator(`meta[property="${key}"], meta[name="${key}"]`)
    .first()
    .getAttribute("content");

async function jsonLd(page: Page) {
  const scripts = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  return scripts.map((text) => JSON.parse(text) as Record<string, unknown>);
}

test("the home page has its title, description, share card and Store data", async ({
  page,
}) => {
  await page.goto("/");
  const name = await page.locator("footer").textContent();
  await expect(page).toHaveTitle(/^\S/);
  const title = await page.title();
  expect(name).toContain(title);

  expect(await meta(page, "description")).toBeTruthy();
  expect(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
  ).toMatch(/^https?:\/\/[^/]+\/?$/);
  const image = await meta(page, "og:image");
  expect(image).toMatch(/^https?:\/\/.+\/opengraph-image/);
  expect(await meta(page, "twitter:card")).toBe("summary_large_image");

  const [store] = await jsonLd(page);
  expect(store).toMatchObject({ "@type": "Store", name: title });

  const response = await page.request.get(new URL(image!).pathname);
  expect(response.headers()["content-type"]).toBe("image/png");
});

test("a product page has a Product with a PHP offer", async ({ page }) => {
  await page.goto("/products/olympic-barbell-20-kg");
  await expect(page).toHaveTitle(/^Olympic barbell 20 kg · /);
  expect(await meta(page, "description")).toContain("₱7,800");
  expect(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
  ).toMatch(/\/products\/olympic-barbell-20-kg$/);
  expect(await meta(page, "og:image")).toMatch(/^https?:\/\//);

  const [product] = await jsonLd(page);
  expect(product).toMatchObject({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Olympic barbell 20 kg",
    offers: {
      "@type": "Offer",
      price: "7800.00",
      priceCurrency: "PHP",
      availability: "https://schema.org/InStock",
    },
  });
});

test("the sitemap lists every product, and robots.txt keeps out of admin", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const productLinks = await page
    .locator('#catalog a[href^="/products/"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  expect(productLinks.length).toBeGreaterThan(0);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const href of new Set(productLinks)) {
    expect(sitemap).toContain(`${href}</loc>`);
  }

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/^Disallow: \/admin$/m);
  expect(robots).toMatch(/^Sitemap: https?:\/\/.+\/sitemap\.xml$/m);
});

test("admin pages ask not to be indexed", async ({ page }) => {
  await page.goto("/admin/login");
  expect(await meta(page, "robots")).toContain("noindex");
});

test("the site has an icon and an Apple touch icon", async ({
  page,
  request,
}) => {
  await page.goto("/");
  for (const rel of ["icon", "apple-touch-icon"]) {
    const href = await page
      .locator(`link[rel="${rel}"]`)
      .first()
      .getAttribute("href");
    expect(href).toBeTruthy();
    const response = await request.get(href!);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});
