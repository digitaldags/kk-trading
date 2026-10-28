# KK Trading 1.0 release notes

2026-10-24

KK Trading's first release went live on 23 October 2026 at [kk-trading.vercel.app](https://kk-trading.vercel.app/). It's an online catalog for office furniture and gym equipment, with an admin console where the owner edits products and publishes changes when they're ready. There's no checkout: shoppers browse, then contact the store.

## For shoppers

The storefront is one page, built to the Figma design, and it works on phones and without JavaScript.

- **Browse by category.** Office and Gym tiles, filter chips and a stock filter (In stock, Low stock, Out of stock) narrow the catalog.
- **Search** matches a product's name, key spec and description, and updates as you type.
- **Product dialog.** A card opens the product over the catalog; closing it keeps your search and filters.
- **Shareable product pages.** Every product has its own link, such as `/products/olympic-barbell-20-kg`, which opens as a full page.
- **Prices in pesos**, such as ₱8,950, with no decimals when the amount is whole.
- **Contact panel** with the store's phone, email and address, and a button to copy each one.
- **Accessibility:** keyboard-friendly dialogs and filters, screen-reader labels, and an automated accessibility check on every page.

## For the store admin

The admin console at `/admin` lets the owner edit everything shoppers see, then choose when it goes live.

- **Sign-in** with email and password. Sessions last and renew themselves; after 5 wrong passwords for an account, or 20 from one address, sign-in pauses for 15 minutes.
- **Products:** add, edit and delete, with name, price, category, stock, key spec and description. Prices can be typed as `8950`, `8,950` or `₱8,950.50`.
- **Photos:** upload from the editor. Photos are resized in the browser before upload, and a photo is deleted only once no draft or published product uses it.
- **Categories:** add, rename, pick an icon, reorder with up and down, and delete. Deleting a category asks where its products should go.
- **Store details:** name, tagline, phone, email and address, shown in the storefront and its contact panel.
- **Password change.** Changing the password signs out every other session.
- **Draft and publish.** Saves change a draft, and the store keeps showing the last published version. A pill shows "Unpublished changes" or "All changes live". The Publish bar puts the draft live in one step, and Discard returns the draft to what's published.
- **Sample data.** A new store starts with 2 categories and 8 sample products, tagged Sample until they're edited.

## Search and sharing

Every page tells search engines and chat apps what it shows, using only published content.

- **Titles and descriptions** come from the store details. Product pages read "Product · Store", with the key spec and price as the description.
- **Link previews.** A shared product link shows its photo. The home page has a generated preview image with the store name and headline.
- **Product data for Google** (JSON-LD): name, photo, price in PHP and stock, plus the store's contact details.
- **Sitemap and robots.** `/sitemap.xml` lists every published product, and `/robots.txt` keeps `/admin` and `/api` out of search.
- **Icons** for the browser tab and the iPhone home screen, matching the storefront's mark.

## Under the hood

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

## Known issues and before launch

The site works, but photo upload is off on production and a few launch steps remain.

- [ ] **Photo upload fails on production** (400 from `/api/blob/upload`). Most likely the Blob store isn't connected to the Vercel project yet. Connect it, then redeploy.
- [ ] **Replace the temporary admin account** with a real email and a password of 12 or more characters.
- [ ] **Replace the 8 sample products** with the real catalog, then publish.
- [ ] **Set `NEXT_PUBLIC_SITE_URL`** in Vercel, so links and previews use the final address.
- [ ] **Confirm the end-to-end tests pass in CI.**
- [ ] **Live-site checks:** Lighthouse on mobile (Performance 90 or more, Accessibility 95 or more), the session cookie is HttpOnly and Secure, Google's Rich Results Test, and Facebook's Sharing Debugger.

By design, a page that doesn't exist answers with status 200 rather than 404. It still shows "Page not found" and is hidden from search engines.

## Release history

The whole release was built in eight days, from 16 to 23 October 2026.

| Date   | What shipped                                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------- |
| 23 Oct | Released to production. Roboto self-hosted after a CI build failure; production database migrated, seeded and published |
| 23 Oct | Draft and publish, search and sharing, end-to-end tests on a throwaway CI database                                      |
| 23 Oct | Category management, store details and password change                                                                  |
| 21 Oct | Admin product list, product editor and photo upload                                                                     |
| 21 Oct | Admin sign-in                                                                                                           |
| 21 Oct | Storefront page and shareable product pages                                                                             |
| 19 Oct | Database, sample data and data layer                                                                                    |
| 19 Oct | UI components matching Figma                                                                                            |
| 16 Oct | Design tokens (colors, type, radii)                                                                                     |
| 16 Oct | Project setup with lint, type checks, tests and CI                                                                      |
