# KK Trading release notes

| Version    | Tagged      | Where                                                                             |
| ---------- | ----------- | --------------------------------------------------------------------------------- |
| [1.2](#12) | 3 Nov 2026  | `dev` only; goes live when `dev` merges to `main`                                 |
| [1.1](#11) | 31 Oct 2026 | `dev` only; goes live when `dev` merges to `main`                                 |
| [1.0](#10) | 28 Oct 2026 | Live at [kk-trading.vercel.app](https://kk-trading.vercel.app/) since 23 Oct 2026 |

Versions 1.1 and 1.2 go live together. See [Before 1.1 and 1.2 go live](#before-11-and-12-go-live).

## 1.2

3 November 2026

The store's logo now shows on the storefront, and starting a new quotation always gives an empty form.

### For shoppers

- **Store logo in the header.** Once a logo is uploaded in Admin › Store details and published, it replaces the built-in icon at the top left of the storefront and of every product page. It's 40px tall and at most 160px wide, and the store name stays beside it. The page reserves the logo's space before it loads, so nothing jumps.
- **Search engines** also get the logo, in the store's structured data on the home page.

### For the store admin

- **Logo size is recorded at upload.** Admin reads the logo's width and height when you pick the file, and refuses an image it can't read. The hint under Logo now says where the logo shows: the store header, and the top left of quotations and delivery receipts.
- **Like everything else in Store details, a new logo goes live only when you publish.**
- **Tip:** a logo with wide empty margins looks small at 40px tall. Crop the file to the artwork before uploading.

### Fixed

- **New quotation reopened the last saved quotation** (BUG-01). After saving a quotation, choosing New quotation showed the saved one again, and Save updated it instead of creating another. New quotation now always starts from an empty form. Back and Forward still return to a quotation as you left it.

### Under the hood

- Migration `0005_logo_size` adds the logo's width and height to the store details (both empty, or both above 0).
- 626 unit and component tests; services at 99.4% line coverage. Database tests now allow 30 seconds for setup under the coverage run.
- New end-to-end tests: New quotation after a save, and a published logo in the header (this one runs only on a store with no logo, so it never replaces the owner's).
- Lighthouse on mobile: no layout shift with a logo, Accessibility and SEO 100.

## 1.1

31 October 2026

Admin can now write quotations and record deliveries against them, and print both on A4 in the layout of the store's own paper forms.

### For the store admin

**Product and store details**

- **Product code** (optional, unique), **unit** (pcs, set, pair, unit or lot) and **spec lines** on every product. They print on quotations and delivery receipts.
- **Slogan, second phone and logo** in Store details, for the letterhead. The logo is uploaded as is, and deleted only once nothing uses it.

**Documents tab**

- **Quotation list** with search (number or customer) and status chips: All, Draft, Completed and Declined. Each row shows the number, status, customer, total, date and delivery progress.
- **Quotation editor:** date, number, terms, customer name, TIN and addresses, then the items. Add products from a searchable catalog dialog, then set each quantity and price. Line totals and the grand total update as you type. New quotations start with the store's usual terms, notes and acknowledgement text.
- **Mark as completed or declined.** Unsaved edits are saved first, and you're asked to confirm. Drafts can be deleted. Completed and declined quotations can't be edited.
- **Delivery receipts** on a completed quotation: a table shows what's ordered, delivered and left for each line. Create receipt delivers some or all of what's left, and never more ("Only 3 left to deliver."). The receipt opens for printing right away. Receipts can be deleted.

**Printing**

- **A4 print pages** for quotations and delivery receipts, laid out like the store's sample PDFs: letterhead with logo, slogan and phones, customer details, the items with photos, and totals.
- Long quotations repeat the table header on each page and never split a row. Receipts end with the input tax notice and signature lines at the bottom of the page.

### Under the hood

- Migrations `0002_document_fields`, `0003_optional_product_code` and `0004_documents` add the new fields and four tables for quotations and receipts.
- Quotations and receipts are outside draft and publish: they save straight away and never appear on the storefront.
- The database itself refuses a receipt that delivers more than was ordered, even when two admins create receipts at once.
- Each quotation line keeps its own copy of the product's code, name, specs, photo and price, so editing or deleting a product never changes a quotation. Photos a quotation prints are never deleted.
- "Today" on new quotations and receipts is the date in Manila.
- End-to-end tests cover the whole documents flow and print pages, plus accessibility scans of the documents pages at desktop and phone sizes.

## 1.0

Released 23 October 2026 · notes written 24 October 2026

KK Trading's first release went live on 23 October 2026 at [kk-trading.vercel.app](https://kk-trading.vercel.app/). It's an online catalog for office furniture and gym equipment, with an admin console where the owner edits products and publishes changes when they're ready. There's no checkout: shoppers browse, then contact the store.

### For shoppers

The storefront is one page, built to the Figma design, and it works on phones and without JavaScript.

- **Browse by category.** Office and Gym tiles, filter chips and a stock filter (In stock, Low stock, Out of stock) narrow the catalog.
- **Search** matches a product's name, key spec and description, and updates as you type.
- **Product dialog.** A card opens the product over the catalog; closing it keeps your search and filters.
- **Shareable product pages.** Every product has its own link, such as `/products/olympic-barbell-20-kg`, which opens as a full page.
- **Prices in pesos**, such as ₱8,950, with no decimals when the amount is whole.
- **Contact panel** with the store's phone, email and address, and a button to copy each one.
- **Accessibility:** keyboard-friendly dialogs and filters, screen-reader labels, and an automated accessibility check on every page.

### For the store admin

The admin console at `/admin` lets the owner edit everything shoppers see, then choose when it goes live.

- **Sign-in** with email and password. Sessions last and renew themselves; after 5 wrong passwords for an account, or 20 from one address, sign-in pauses for 15 minutes.
- **Products:** add, edit and delete, with name, price, category, stock, key spec and description. Prices can be typed as `8950`, `8,950` or `₱8,950.50`.
- **Photos:** upload from the editor. Photos are resized in the browser before upload, and a photo is deleted only once no draft or published product uses it.
- **Categories:** add, rename, pick an icon, reorder with up and down, and delete. Deleting a category asks where its products should go.
- **Store details:** name, tagline, phone, email and address, shown in the storefront and its contact panel.
- **Password change.** Changing the password signs out every other session.
- **Draft and publish.** Saves change a draft, and the store keeps showing the last published version. A pill shows "Unpublished changes" or "All changes live". The Publish bar puts the draft live in one step, and Discard returns the draft to what's published.
- **Sample data.** A new store starts with 2 categories and 8 sample products, tagged Sample until they're edited.

### Search and sharing

Every page tells search engines and chat apps what it shows, using only published content.

- **Titles and descriptions** come from the store details. Product pages read "Product · Store", with the key spec and price as the description.
- **Link previews.** A shared product link shows its photo. The home page has a generated preview image with the store name and headline.
- **Product data for Google** (JSON-LD): name, photo, price in PHP and stock, plus the store's contact details.
- **Sitemap and robots.** `/sitemap.xml` lists every published product, and `/robots.txt` keeps `/admin` and `/api` out of search.
- **Icons** for the browser tab and the iPhone home screen, matching the storefront's mark.

### Under the hood

The app is Next.js 16 on Vercel with a Postgres database on Neon (Singapore), and every change runs through automated checks.

| Area        | What's in place                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Stack       | Next.js 16.4 (App Router, cache components), React 19, TypeScript, Drizzle ORM, Neon Postgres, Vercel Blob for photos |
| Code layout | Routes → services → repositories → database, enforced by lint rules; all input checked with zod                       |
| Security    | Password hashing with Argon2, signed session cookies, an admin check on every page and action, sign-in rate limits    |
| Speed       | Storefront pages cached until the next publish; fonts and icons self-hosted                                           |
| Tests       | 311 unit and component tests, database tests on in-process Postgres, 98.95% line coverage on services (90% required)  |
| End-to-end  | Playwright runs 7 key flows at desktop (1440 × 900) and phone (390 × 844) sizes, plus an axe accessibility scan       |
| CI          | Every pull request runs lint, formatting, type checks, coverage, a build and e2e on a throwaway Neon database         |
| Design      | Colors, radii and type from the Figma variables, with a test that blocks hard-coded values                            |

### Known issues at release

The site works, but photo upload is off on production and a few launch steps remain.

- [ ] **Photo upload fails on production** (400 from `/api/blob/upload`). Most likely the Blob store isn't connected to the Vercel project yet. Connect it, then redeploy.
- [ ] **Replace the temporary admin account** with a real email and a password of 12 or more characters.
- [ ] **Replace the 8 sample products** with the real catalog, then publish.
- [ ] **Set `NEXT_PUBLIC_SITE_URL`** in Vercel, so links and previews use the final address.
- [ ] **Confirm the end-to-end tests pass in CI.**
- [ ] **Live-site checks:** Lighthouse on mobile (Performance 90 or more, Accessibility 95 or more), the session cookie is HttpOnly and Secure, Google's Rich Results Test, and Facebook's Sharing Debugger.

By design, a page that doesn't exist answers with status 200 rather than 404. It still shows "Page not found" and is hidden from search engines.

## Before 1.1 and 1.2 go live

Migrations don't run on deploy, so the database has to be ready before the code.

- [ ] **Confirm a green CI run** (end-to-end included) on `dev`.
- [ ] **Run migrations `0002` to `0005` on production** before merging `dev` into `main`, then delete `.env.production.local`.
- [ ] **Connect the Blob store to Vercel** (`BLOB_READ_WRITE_TOKEN`). Logo and photo uploads both need it.
- [ ] **Merge `dev` into `main`** through a pull request.
- [ ] **Fill in Store details** on production and publish: slogan, second phone and logo.
- [ ] **Optionally replace the product codes** made from product names (like `ELECTRIC-STANDING-DESK`) with real ones; they print on quotations.

## Release history

| Date   | Version | What shipped                                                                                                            |
| ------ | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| 3 Nov  | 1.2     | Store logo in the storefront header; New quotation always starts empty                                                  |
| 31 Oct | 1.1     | Documents end-to-end and accessibility tests                                                                            |
| 31 Oct | 1.1     | Print pages for quotations and delivery receipts                                                                        |
| 31 Oct | 1.1     | Completed quotation view and delivery receipts                                                                          |
| 31 Oct | 1.1     | Quotation editor and Add product dialog                                                                                 |
| 31 Oct | 1.1     | Documents tab and quotation list                                                                                        |
| 31 Oct | 1.1     | Quotation and delivery receipt rules                                                                                    |
| 28 Oct | 1.1     | Quotation and delivery receipt tables                                                                                   |
| 28 Oct | 1.1     | Product codes, units and specs; store slogan, second phone and logo                                                     |
| 23 Oct | 1.0     | Released to production. Roboto self-hosted after a CI build failure; production database migrated, seeded and published |
| 23 Oct | 1.0     | Draft and publish, search and sharing, end-to-end tests on a throwaway CI database                                      |
| 23 Oct | 1.0     | Category management, store details and password change                                                                  |
| 21 Oct | 1.0     | Admin product list, product editor and photo upload                                                                     |
| 21 Oct | 1.0     | Admin sign-in                                                                                                           |
| 21 Oct | 1.0     | Storefront page and shareable product pages                                                                             |
| 19 Oct | 1.0     | Database, sample data and data layer                                                                                    |
| 19 Oct | 1.0     | UI components matching Figma                                                                                            |
| 16 Oct | 1.0     | Design tokens (colors, type, radii)                                                                                     |
| 16 Oct | 1.0     | Project setup with lint, type checks, tests and CI                                                                      |
