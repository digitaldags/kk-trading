/** The icons a category can use (the prototype's `ICONS` list), as Material Symbols ligatures. */
export const CATEGORY_ICONS = [
  "chair",
  "desk",
  "table_restaurant",
  "shelves",
  "inventory_2",
  "print",
  "monitor",
  "keyboard",
  "lightbulb",
  "fitness_center",
  "exercise",
  "sports_gymnastics",
  "directions_run",
  "sports_martial_arts",
  "self_improvement",
  "pool",
  "sports_tennis",
  "category",
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];
