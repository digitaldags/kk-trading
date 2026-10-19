"use client";

import { useState, type ReactNode } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { CategoryRow } from "@/components/ui/CategoryRow";
import { Dialog } from "@/components/ui/Dialog";
import { FilterChip } from "@/components/ui/FilterChip";
import { IconButton } from "@/components/ui/IconButton";
import { ProductCard } from "@/components/ui/ProductCard";
import { ProductRow } from "@/components/ui/ProductRow";
import { SegmentedButtons } from "@/components/ui/SegmentedButtons";
import { useSnackbar } from "@/components/ui/Snackbar";
import { StockStatus } from "@/components/ui/StockStatus";
import { TextField } from "@/components/ui/TextField";
import {
  STOCK_LABELS,
  STOCK_STATUSES,
  type StockStatus as Status,
} from "@/lib/domain/stock";
import styles from "./styleguide.module.css";

const BUTTON_VARIANTS: ButtonVariant[] = [
  "filled",
  "tonal",
  "outlined",
  "text",
  "danger",
  "inverse",
];

const CATEGORIES = ["All", "Office equipment", "Gym equipment"];

const STOCK_OPTIONS = STOCK_STATUSES.map((value) => ({
  value,
  label: STOCK_LABELS[value],
}));

export function ComponentDemos() {
  const snackbar = useSnackbar();
  const [category, setCategory] = useState("All");
  const [stock, setStock] = useState<Status>("in_stock");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <>
      <Section id="buttons" title="Button">
        <div className={styles.row}>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} icon="add">
              {capitalize(variant)}
            </Button>
          ))}
        </div>
        <div className={styles.row}>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} disabled>
              Disabled
            </Button>
          ))}
        </div>
      </Section>

      <Section id="icon-buttons" title="Icon button">
        <div className={styles.row}>
          <IconButton icon="edit" label="Edit" />
          <IconButton icon="delete" label="Delete" tone="danger" />
          <IconButton icon="edit" label="Edit (primary)" tone="primary" />
        </div>
      </Section>

      <Section id="chips" title="Filter chip">
        <div className={styles.row} data-testid="chips">
          {CATEGORIES.map((name) => (
            <FilterChip
              key={name}
              selected={category === name}
              onClick={() => setCategory(name)}
            >
              {name}
            </FilterChip>
          ))}
        </div>
      </Section>

      <Section id="stock" title="Stock status">
        <div className={styles.row}>
          {STOCK_STATUSES.map((status) => (
            <StockStatus key={status} status={status} />
          ))}
        </div>
      </Section>

      <Section id="fields" title="Text field">
        <div className={styles.fields}>
          <TextField label="Product name" defaultValue="Ergonomic mesh chair" />
          <TextField kind="select" label="Category" defaultValue="office">
            <option value="office">Office equipment</option>
            <option value="gym">Gym equipment</option>
          </TextField>
          <TextField kind="price" label="Price" defaultValue="8,950" />
          <TextField
            kind="multiline"
            label="Description"
            defaultValue="Breathable mesh back with adjustable lumbar support."
          />
          <TextField
            label="Key spec"
            hint="One short line shown on the product card."
            defaultValue=""
            error="Enter a key spec."
          />
        </div>
      </Section>

      <Section id="segmented" title="Segmented buttons">
        <div className={styles.narrow} data-testid="segmented">
          <SegmentedButtons
            label="Stock"
            options={STOCK_OPTIONS}
            value={stock}
            onChange={setStock}
          />
        </div>
      </Section>

      <Section id="cards" title="Product card">
        <div className={styles.cards}>
          <ProductCard
            name="Ergonomic mesh chair"
            category="Office equipment"
            spec="Seat height 44–54 cm · 3D armrests"
            priceCentavos={895000}
            status="in_stock"
            icon="chair"
            toneIndex={0}
            href="/styleguide#cards"
          />
          <ProductCard
            name="Olympic barbell 20 kg"
            category="Gym equipment"
            spec="2,200 mm · 28 mm grip"
            priceCentavos={780000}
            status="low_stock"
            icon="fitness_center"
            toneIndex={1}
          />
          <ProductCard
            name="Standing desk mat"
            category="Accessories"
            spec="Anti-fatigue foam · 90 × 50 cm"
            priceCentavos={189950}
            status="out_of_stock"
            icon="inventory_2"
            toneIndex={2}
          />
        </div>
      </Section>

      <Section id="rows" title="Product row and category row">
        <ul className={styles.list}>
          <li>
            <ProductRow
              name="Ergonomic mesh chair"
              subtitle="Office equipment · Seat height 44–54 cm · 3D armrests"
              priceCentavos={895000}
              status="in_stock"
              sample
              icon="chair"
              toneIndex={0}
              onEdit={() => snackbar.show("Edit Ergonomic mesh chair.")}
              onDelete={() => setConfirmOpen(true)}
            />
          </li>
          <li>
            <ProductRow
              name="Rubber hex dumbbells, pair"
              subtitle="Gym equipment · 2 × 10 kg · Chrome handles"
              priceCentavos={260000}
              status="out_of_stock"
              icon="fitness_center"
              toneIndex={1}
              onEdit={() => snackbar.show("Edit Rubber hex dumbbells, pair.")}
              onDelete={() => setConfirmOpen(true)}
            />
          </li>
        </ul>
        <ul className={styles.list}>
          <li>
            <CategoryRow
              name="Office equipment"
              productCount={4}
              blurb="Chairs, desks and storage"
              icon="chair"
              toneIndex={0}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </li>
          <li>
            <CategoryRow
              name="Gym equipment"
              productCount={1}
              blurb=""
              icon="fitness_center"
              toneIndex={1}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </li>
        </ul>
      </Section>

      <Section id="banners" title="Banner">
        <div className={styles.stack}>
          <Banner>
            8 of these products are samples. Edit them with real details or
            delete them.
          </Banner>
          <Banner tone="warn">
            You can look around, but only people with edit access can save
            changes.
          </Banner>
        </div>
      </Section>

      <Section id="dialogs" title="Dialog and snackbar">
        <div className={styles.row}>
          <Button
            variant="danger"
            icon="delete"
            onClick={() => setConfirmOpen(true)}
          >
            Open delete dialog
          </Button>
          <Button
            variant="tonal"
            icon="edit"
            onClick={() => setEditorOpen(true)}
          >
            Open edit dialog
          </Button>
          <Button
            variant="outlined"
            onClick={() => snackbar.show("Saved Ergonomic mesh chair.")}
          >
            Show snackbar
          </Button>
        </div>
      </Section>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete Ergonomic mesh chair?"
        showClose={false}
        fullScreenOnMobile={false}
        actions={
          <>
            <Button variant="text" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmOpen(false);
                snackbar.show("Deleted Ergonomic mesh chair.");
              }}
            >
              Delete product
            </Button>
          </>
        }
      >
        <p>It will be removed from the store right away.</p>
      </Dialog>

      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title="Edit product"
        actions={
          <>
            <Button variant="text" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setEditorOpen(false);
                snackbar.show("Saved Ergonomic mesh chair.");
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        <TextField label="Product name" defaultValue="Ergonomic mesh chair" />
        <div className={styles.two}>
          <TextField kind="select" label="Category" defaultValue="office">
            <option value="office">Office equipment</option>
            <option value="gym">Gym equipment</option>
          </TextField>
          <TextField kind="price" label="Price" defaultValue="8,950" />
        </div>
        <SegmentedButtons
          label="Stock"
          options={STOCK_OPTIONS}
          value={stock}
          onChange={setStock}
        />
        <TextField
          label="Key spec"
          hint="One short line shown on the product card."
          defaultValue="Seat height 44–54 cm · 3D armrests"
        />
        <TextField
          kind="multiline"
          label="Description"
          defaultValue="Breathable mesh back with adjustable lumbar support."
        />
      </Dialog>
    </>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className="t-headline-small">
        {title}
      </h2>
      <div className={styles.demo}>{children}</div>
    </section>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
