"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useSnackbar } from "@/components/ui/Snackbar";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/shared/cx";
import { fromZodError, type FieldErrors } from "@/lib/domain/result";
import {
  MIN_ADMIN_PASSWORD_LENGTH,
  passwordChangeSchema,
  storeSettingsInputSchema,
} from "@/lib/domain/schemas";
import type { StoreSettings } from "@/lib/domain/types";
import type {
  ChangePasswordAction,
  PasswordField,
  SaveStoreDetailsAction,
  StoreDetailsField,
} from "./actionTypes";
import styles from "./SettingsAdmin.module.css";

type SettingsAdminProps = {
  settings: StoreSettings;
  saveDetailsAction: SaveStoreDetailsAction;
  changePasswordAction: ChangePasswordAction;
};

/** The Store details tab (Figma 12:1149): two independent forms. */
export function SettingsAdmin({
  settings,
  saveDetailsAction,
  changePasswordAction,
}: SettingsAdminProps) {
  return (
    <>
      <h1 className="visually-hidden">Store details</h1>
      <StoreDetailsForm settings={settings} saveAction={saveDetailsAction} />
      <PasswordForm changeAction={changePasswordAction} />
    </>
  );
}

/** Moves focus to the first field (in `order`) that has an error. */
function focusFirstError<F extends string>(
  order: readonly F[],
  errors: FieldErrors<F>,
  idFor: (field: F) => string,
) {
  const first = order.find((field) => errors[field]);
  if (first) document.getElementById(idFor(first))?.focus();
}

const DETAIL_FIELDS = [
  "name",
  "headline",
  "tagline",
  "phone",
  "email",
  "address",
] as const satisfies readonly StoreDetailsField[];

type Details = Record<StoreDetailsField, string>;

function StoreDetailsForm({
  settings,
  saveAction,
}: {
  settings: StoreSettings;
  saveAction: SaveStoreDetailsAction;
}) {
  const id = useId();
  const fieldId = (field: StoreDetailsField) => `${id}-${field}`;
  const snackbar = useSnackbar();
  const [fields, setFields] = useState<Details>(() => ({
    name: settings.name,
    headline: settings.headline,
    tagline: settings.tagline,
    phone: settings.phone,
    email: settings.email,
    address: settings.address,
  }));
  const [errors, setErrors] = useState<FieldErrors<StoreDetailsField>>({});
  const [formError, setFormError] = useState<string>();
  const [saving, startSaving] = useTransition();

  const field = (name: StoreDetailsField) => ({
    id: fieldId(name),
    value: fields[name],
    error: errors[name],
    onChange: (e: { target: { value: string } }) =>
      setFields((f) => ({ ...f, [name]: e.target.value })),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const parsed = storeSettingsInputSchema.safeParse(fields);
    if (!parsed.success) {
      const found = fromZodError<StoreDetailsField>(parsed.error).fieldErrors;
      setErrors(found);
      setFormError(undefined);
      focusFirstError(DETAIL_FIELDS, found, fieldId);
      return;
    }
    setErrors({});
    setFormError(undefined);
    startSaving(async () => {
      const result = await saveAction(fields);
      if (result.ok) {
        snackbar.show(result.message);
        return;
      }
      setErrors(result.fieldErrors);
      setFormError(result.formError);
      focusFirstError(DETAIL_FIELDS, result.fieldErrors, fieldId);
    });
  }

  return (
    <form
      className={styles.panel}
      aria-labelledby={`${id}-title`}
      noValidate
      onSubmit={handleSubmit}
      aria-busy={saving || undefined}
    >
      <h2 id={`${id}-title`} className={cx(styles.title, "t-title-medium")}>
        Store details
      </h2>
      <p className={cx(styles.description, "t-body-medium")}>
        Shown in the header, hero and contact section of the store.
      </p>
      <TextField
        label="Store name"
        maxLength={60}
        required
        {...field("name")}
      />
      <TextField
        label="Headline"
        maxLength={120}
        required
        {...field("headline")}
      />
      <TextField
        kind="multiline"
        label="Tagline"
        maxLength={240}
        rows={3}
        {...field("tagline")}
      />
      <div className={styles.two}>
        <TextField
          label="Phone"
          type="tel"
          maxLength={40}
          autoComplete="off"
          {...field("phone")}
        />
        <TextField
          label="Email"
          type="email"
          maxLength={254}
          autoComplete="off"
          required
          {...field("email")}
        />
      </div>
      <TextField label="Address" maxLength={200} {...field("address")} />
      {formError && (
        <p role="alert" className={cx(styles.error, "t-body-small")}>
          {formError}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" disabled={saving}>
          Save details
        </Button>
      </div>
    </form>
  );
}

const PASSWORD_FIELDS = [
  "currentPassword",
  "newPassword",
  "confirmPassword",
] as const satisfies readonly PasswordField[];

type Passwords = Record<PasswordField, string>;

const NO_PASSWORDS: Passwords = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function PasswordForm({
  changeAction,
}: {
  changeAction: ChangePasswordAction;
}) {
  const id = useId();
  const fieldId = (field: PasswordField) => `${id}-${field}`;
  const snackbar = useSnackbar();
  const [fields, setFields] = useState<Passwords>(NO_PASSWORDS);
  const [errors, setErrors] = useState<FieldErrors<PasswordField>>({});
  const [formError, setFormError] = useState<string>();
  const [saving, startSaving] = useTransition();

  const field = (name: PasswordField) => ({
    id: fieldId(name),
    type: "password",
    value: fields[name],
    error: errors[name],
    onChange: (e: { target: { value: string } }) =>
      setFields((f) => ({ ...f, [name]: e.target.value })),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const parsed = passwordChangeSchema.safeParse(fields);
    if (!parsed.success) {
      const found = fromZodError<PasswordField>(parsed.error).fieldErrors;
      setErrors(found);
      setFormError(undefined);
      focusFirstError(PASSWORD_FIELDS, found, fieldId);
      return;
    }
    setErrors({});
    setFormError(undefined);
    startSaving(async () => {
      const result = await changeAction(fields);
      if (result.ok) {
        setFields(NO_PASSWORDS);
        snackbar.show(result.message);
        return;
      }
      setErrors(result.fieldErrors);
      setFormError(result.formError);
      focusFirstError(PASSWORD_FIELDS, result.fieldErrors, fieldId);
    });
  }

  return (
    <form
      className={styles.panel}
      aria-labelledby={`${id}-title`}
      noValidate
      onSubmit={handleSubmit}
      aria-busy={saving || undefined}
    >
      <h2 id={`${id}-title`} className={cx(styles.title, "t-title-medium")}>
        Admin password
      </h2>
      <p className={cx(styles.description, "t-body-medium")}>
        Changing it signs you out on your other devices.
      </p>
      <TextField
        label="Current password"
        autoComplete="current-password"
        required
        {...field("currentPassword")}
      />
      <div className={styles.two}>
        <TextField
          label="New password"
          autoComplete="new-password"
          minLength={MIN_ADMIN_PASSWORD_LENGTH}
          required
          hint={`At least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`}
          {...field("newPassword")}
        />
        <TextField
          label="Confirm password"
          autoComplete="new-password"
          required
          {...field("confirmPassword")}
        />
      </div>
      {formError && (
        <p role="alert" className={cx(styles.error, "t-body-small")}>
          {formError}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" variant="tonal" disabled={saving}>
          Update password
        </Button>
      </div>
    </form>
  );
}
