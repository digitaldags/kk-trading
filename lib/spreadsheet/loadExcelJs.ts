// exceljs is about 900 KB, so it's only loaded when someone reads or builds a file: the
// storefront and the admin's first load never carry it. ESLint keeps every other import
// of it out of the app (eslint.config.mjs).

export type ExcelJs = typeof import("exceljs");

/** The Node build is a CommonJS module, and the browser build a UMD one. */
export async function loadExcelJs(): Promise<ExcelJs> {
  const loaded = (await import("exceljs")) as ExcelJs & { default?: ExcelJs };
  return loaded.default ?? loaded;
}
