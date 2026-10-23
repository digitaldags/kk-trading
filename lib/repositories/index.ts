import { getDb } from "@/lib/db/client";
import { createAdminUserRepo } from "./adminUserRepo";
import { createCategoryRepo } from "./categoryRepo";
import { createLoginAttemptRepo } from "./loginAttemptRepo";
import { createProductRepo } from "./productRepo";
import { createPublishRepo } from "./publishRepo";
import { createSettingsRepo } from "./settingsRepo";
import type {
  AdminUserRepo,
  CategoryRepo,
  LoginAttemptRepo,
  ProductRepo,
  PublishRepo,
  SettingsRepo,
} from "./types";

export type * from "./types";

// Built on first use, so importing this module never needs DATABASE_URL.
function lazy<T extends object>(create: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get: (_target, key) => (instance ??= create())[key as keyof T],
  });
}

export const categoryRepo = lazy<CategoryRepo>(() =>
  createCategoryRepo(getDb()),
);
export const productRepo = lazy<ProductRepo>(() => createProductRepo(getDb()));
export const settingsRepo = lazy<SettingsRepo>(() =>
  createSettingsRepo(getDb()),
);
export const adminUserRepo = lazy<AdminUserRepo>(() =>
  createAdminUserRepo(getDb()),
);
export const loginAttemptRepo = lazy<LoginAttemptRepo>(() =>
  createLoginAttemptRepo(getDb()),
);
export const publishRepo = lazy<PublishRepo>(() => createPublishRepo(getDb()));
