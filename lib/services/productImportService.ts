import { ProductCodeTakenError } from "@/lib/domain/errors";
import {
  joinWords,
  normalizeName,
  parseStockStatus,
  parseUnit,
  type ImportCommit,
  type ImportErrorKey,
  type ImportField,
  type ImportPreview,
  type ImportRowInput,
} from "@/lib/domain/productImport";
import {
  formError,
  fromZodError,
  ok,
  type FieldErrors,
  type ServiceResult,
} from "@/lib/domain/result";
import {
  IMPORT_RELOAD,
  importBatchSchema,
  productInputSchema,
  type ProductValues,
} from "@/lib/domain/schemas";
import { slugify, uniqueSlug } from "@/lib/domain/slug";
import type { Product } from "@/lib/domain/types";
import type { CategoryRepo, ProductRepo } from "@/lib/repositories/types";

/** A row's values after the schema. The file has no photo. */
type RowValues = Omit<ProductValues, "image">;

type ClassifiedRow = {
  outcome: "create" | "unchanged";
  index: number;
  values: RowValues;
};

/** What a row and a product are compared on. The code finds the product. */
type Compared = Pick<
  Product,
  | "name"
  | "categoryId"
  | "uom"
  | "priceCentavos"
  | "stockStatus"
  | "keySpec"
  | "description"
  | "specs"
>;

/** The compared columns in the file's order, as a message names them. */
const COMPARED: { word: string; key: keyof Compared }[] = [
  { word: "name", key: "name" },
  { word: "category", key: "categoryId" },
  { word: "unit", key: "uom" },
  { word: "price", key: "priceCentavos" },
  { word: "stock status", key: "stockStatus" },
  { word: "key spec", key: "keySpec" },
  { word: "description", key: "description" },
  { word: "specifications", key: "specs" },
];

/** The schema's field names, as the file calls them. */
const FILE_FIELD: Record<string, ImportField> = {
  code: "code",
  name: "name",
  categoryId: "category",
  uom: "unit",
  price: "price",
  stockStatus: "stockStatus",
  keySpec: "keySpec",
  description: "description",
  specs: "specs",
};

const comparable = ({ price, ...values }: RowValues): Compared => ({
  ...values,
  priceCentavos: price,
});

/** Every compared column, so a code-less row can find an identical code-less product. */
const signature = (product: Compared) =>
  JSON.stringify(COMPARED.map(({ key }) => product[key]));

const codeRaceMessage = (code?: string) =>
  code
    ? `Another product was added with the code ${code} while you were importing. Preview the file again.`
    : "Another product took one of these codes while you were importing. Preview the file again.";

export function createProductImportService(deps: {
  products: ProductRepo;
  categories: CategoryRepo;
}) {
  /** Sorts every row into create, unchanged or error, and collects all errors. */
  async function classify(rows: ImportRowInput[], rowNumbers?: number[]) {
    // Read once and index in memory: per-row lookups would be 500 queries.
    const [catalog, categories] = await Promise.all([
      deps.products.listWithCategory(),
      deps.categories.list(),
    ]);
    const categoryByName = new Map(
      categories.map((c) => [normalizeName(c.name), c]),
    );
    const categoryNames = categories.map((c) => c.name).join(", ");
    const productByCode = new Map(
      catalog.filter((p) => p.code).map((p) => [normalizeName(p.code), p]),
    );
    const codeless = new Set(catalog.filter((p) => !p.code).map(signature));
    const firstRowWithCode = new Map<string, number>();

    const errors: FieldErrors<ImportErrorKey> = {};
    const classified: ClassifiedRow[] = [];

    rows.forEach((row, index) => {
      let hasError = false;
      const fail = (field: ImportField, message: string) => {
        hasError = true;
        errors[`rows.${index}.${field}`] ??= message;
      };

      const category = categoryByName.get(normalizeName(row.category));
      if (!category) {
        const name = row.category.trim();
        fail(
          "category",
          name
            ? `Unknown category “${name}”. Use one of: ${categoryNames}.`
            : `Enter a category. Use one of: ${categoryNames}.`,
        );
      }

      const parsed = productInputSchema.safeParse({
        code: row.code,
        name: row.name,
        uom: parseUnit(row.unit),
        specs: row.specs,
        categoryId: category?.id,
        price: row.price,
        stockStatus: parseStockStatus(row.stockStatus),
        keySpec: row.keySpec,
        description: row.description,
      });
      if (!parsed.success) {
        const issues = fromZodError(parsed.error).fieldErrors;
        for (const [field, message] of Object.entries(issues)) {
          const fileField = FILE_FIELD[field];
          if (fileField && message) fail(fileField, message);
        }
      }

      const codeKey = normalizeName(row.code);
      const earlierRow = firstRowWithCode.get(codeKey);
      if (codeKey && earlierRow !== undefined) {
        fail("code", `Row ${earlierRow} in this file uses the same code.`);
      } else if (codeKey) {
        firstRowWithCode.set(codeKey, rowNumbers?.[index] ?? index + 2);
      }

      let values: RowValues | null = null;
      if (parsed.success) {
        const { image: _, ...fields } = parsed.data;
        values = fields;
      }

      if (!codeKey) {
        if (
          values &&
          !hasError &&
          codeless.has(signature(comparable(values)))
        ) {
          classified.push({ outcome: "unchanged", index, values });
          return;
        }
        fail(
          "code",
          "Enter a product code. If this is an existing product, remove it from the file.",
        );
        return;
      }

      if (!values || hasError) return;

      const existing = productByCode.get(codeKey);
      if (!existing) {
        classified.push({ outcome: "create", index, values });
        return;
      }
      const incoming = comparable(values);
      const different = COMPARED.filter(
        ({ key }) => incoming[key] !== existing[key],
      ).map(({ word }) => word);
      if (different.length > 0) {
        fail(
          "code",
          `${values.code} already exists with a different ${joinWords(different)}. Edit it in the product editor.`,
        );
        return;
      }
      classified.push({ outcome: "unchanged", index, values });
    });

    return { errors, classified, catalog };
  }

  const count = (rows: ClassifiedRow[], outcome: ClassifiedRow["outcome"]) =>
    rows.filter((row) => row.outcome === outcome).length;

  return {
    /** Says what a commit would do with these rows, or lists every problem. Writes nothing. */
    async preview(
      rows: ImportRowInput[],
      rowNumbers?: number[],
    ): Promise<ServiceResult<ImportPreview, ImportErrorKey>> {
      const batch = importBatchSchema.safeParse({ rows, rowNumbers });
      if (!batch.success) {
        return formError(batch.error.issues[0]?.message ?? IMPORT_RELOAD);
      }
      const { errors, classified } = await classify(
        batch.data.rows,
        batch.data.rowNumbers,
      );
      if (Object.keys(errors).length > 0) {
        return { ok: false, fieldErrors: errors };
      }
      return ok({
        toCreate: count(classified, "create"),
        unchanged: count(classified, "unchanged"),
        rows: classified.map(({ outcome, index, values }) => ({
          index,
          code: values.code,
          name: values.name,
          outcome,
        })),
      });
    },

    /**
     * Adds the rows' new products, all or none. It classifies from scratch: the catalog
     * can change after a preview, and an action's input can't be trusted.
     */
    async commit(
      rows: ImportRowInput[],
      rowNumbers?: number[],
    ): Promise<ServiceResult<ImportCommit, ImportErrorKey>> {
      const batch = importBatchSchema.safeParse({ rows, rowNumbers });
      if (!batch.success) {
        return formError(batch.error.issues[0]?.message ?? IMPORT_RELOAD);
      }
      const { errors, classified, catalog } = await classify(
        batch.data.rows,
        batch.data.rowNumbers,
      );
      if (Object.keys(errors).length > 0) {
        return { ok: false, fieldErrors: errors };
      }

      const unchanged = count(classified, "unchanged");
      const toCreate = classified.filter((row) => row.outcome === "create");
      if (toCreate.length === 0) return ok({ created: 0, unchanged });

      const slugs = new Set(catalog.map((p) => p.slug));
      const firstSortOrder = (await deps.products.maxSortOrder()) + 1;
      const products = toCreate.map(({ values }, position) => {
        const { price, ...fields } = values;
        const slug = uniqueSlug(slugify(fields.name, "product"), slugs);
        slugs.add(slug);
        return {
          ...fields,
          slug,
          priceCentavos: price,
          imageUrl: null,
          imagePathname: null,
          isSample: false,
          sortOrder: firstSortOrder + position,
        };
      });

      try {
        await deps.products.insertMany(products);
      } catch (error) {
        if (error instanceof ProductCodeTakenError) {
          return formError(codeRaceMessage(error.code));
        }
        throw error;
      }
      return ok({ created: products.length, unchanged });
    },
  };
}

export type ProductImportService = ReturnType<
  typeof createProductImportService
>;
