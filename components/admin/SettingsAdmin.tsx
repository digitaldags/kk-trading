"use client";

import { upload } from "@vercel/blob/client";
import Image from "next/image";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useSnackbar } from "@/components/ui/Snackbar";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/shared/cx";
import {
  BRANDING_IMAGE_PREFIX,
  BRANDING_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
} from "@/lib/domain/productImages";
import { fromZodError, type FieldErrors } from "@/lib/domain/result";
import {
  MIN_ADMIN_PASSWORD_LENGTH,
  passwordChangeSchema,
  storeSettingsInputSchema,
} from "@/lib/domain/schemas";
import { slugify } from "@/lib/domain/slug";
import type { StoreSettings } from "@/lib/domain/types";
import type {
  ChangePasswordAction,
  DiscardLogoAction,
  PasswordField,
  SaveStoreDetailsAction,
  StoreDetailsField,
} from "./actionTypes";
import { UPLOAD_URL } from "./ProductEditor";
import { ImageFileError, readImageSize, UNREADABLE_IMAGE } from "./resizeImage";
import styles from "./SettingsAdmin.module.css";

export const LOGO_TYPE_ERROR = "Choose a PNG, JPEG or WebP image.";
export const LOGO_SIZE_ERROR = "Choose an image of 5 MB or less.";
export const LOGO_UPLOAD_FAILED = "The logo couldn't be uploaded. Try again.";

const LOGO_EXTENSIONS: Record<(typeof BRANDING_IMAGE_TYPES)[number], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

type SettingsAdminProps = {
  settings: StoreSettings;
  saveDetailsAction: SaveStoreDetailsAction;
  discardLogoAction: DiscardLogoAction;
  changePasswordAction: ChangePasswordAction;
};

/** The Store details tab (Figma 12:1149): two independent forms. */
export function SettingsAdmin({
  settings,
  saveDetailsAction,
  discardLogoAction,
  changePasswordAction,
}: SettingsAdminProps) {
  return (
    <>
      <h1 className="visually-hidden">Store details</h1>
      <StoreDetailsForm
        settings={settings}
        saveAction={saveDetailsAction}
        discardLogoAction={discardLogoAction}
      />
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

/** Fields in the order they're shown, so the first error gets focus. */
const DETAIL_FIELDS = [
  "name",
  "slogan",
  "logo",
  "headline",
  "tagline",
  "phone",
  "phone2",
  "email",
  "address",
] as const satisfies readonly StoreDetailsField[];

type TextDetail = Exclude<StoreDetailsField, "logo">;
type Details = Record<TextDetail, string>;

/** A logo as the save sends it: the Blob file and its size in pixels. */
type LogoInput = {
  url: string;
  pathname: string;
  width: number;
  height: number;
};

/**
 * The logo as the form shows it. A new one carries its size, read when it's picked;
 * `uploaded` is set once the file is in Blob.
 */
type Logo =
  | { kind: "current"; url: string }
  | { kind: "none" }
  | {
      kind: "new";
      file: File;
      previewUrl: string;
      width: number;
      height: number;
      uploaded?: LogoInput;
    };

/** Copy for a file the logo field can't take, or null when it's fine. */
function logoFileError(file: File): string | null {
  if (!(BRANDING_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return LOGO_TYPE_ERROR;
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) return LOGO_SIZE_ERROR;
  return null;
}

function StoreDetailsForm({
  settings,
  saveAction,
  discardLogoAction,
}: {
  settings: StoreSettings;
  saveAction: SaveStoreDetailsAction;
  discardLogoAction: DiscardLogoAction;
}) {
  const id = useId();
  const fieldId = (field: StoreDetailsField) => `${id}-${field}`;
  const snackbar = useSnackbar();
  const [fields, setFields] = useState<Details>(() => ({
    name: settings.name,
    slogan: settings.slogan,
    headline: settings.headline,
    tagline: settings.tagline,
    phone: settings.phone,
    phone2: settings.phone2,
    email: settings.email,
    address: settings.address,
  }));
  const [logo, setLogo] = useState<Logo>(() =>
    settings.logoUrl
      ? { kind: "current", url: settings.logoUrl }
      : { kind: "none" },
  );
  // Whether the saved row has a logo, so removing one sends `null`.
  const [hasSavedLogo, setHasSavedLogo] = useState(settings.logoUrl !== null);
  const [errors, setErrors] = useState<FieldErrors<StoreDetailsField>>({});
  const [formError, setFormError] = useState<string>();
  const [saving, startSaving] = useTransition();
  // A logo in Blob that the settings row doesn't use yet. Deleted if the page closes first.
  const unsavedUploadRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Counts picks, so a slow size read can't replace a file picked after it.
  const pickRef = useRef(0);

  const previewUrl = logo.kind === "new" ? logo.previewUrl : null;
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    // Reset on mount: Next can show this same instance again (see CLAUDE.md, route dialogs).
    unsavedUploadRef.current = null;
    return () => {
      const unsaved = unsavedUploadRef.current;
      if (unsaved) {
        unsavedUploadRef.current = null;
        void discardLogoAction(unsaved);
      }
    };
  }, [discardLogoAction]);

  const clearLogoError = () => setErrors(({ logo: _, ...rest }) => rest);

  async function handleLogoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let the same file be picked again after Remove.
    event.target.value = "";
    if (!file) return;
    const pick = ++pickRef.current;
    const problem = logoFileError(file);
    if (problem) {
      setErrors((e) => ({ ...e, logo: problem }));
      return;
    }
    // The size goes with the logo, so the storefront reserves its box (ticket 40).
    let size: { width: number; height: number };
    try {
      size = await readImageSize(file);
    } catch (error) {
      if (pick !== pickRef.current) return;
      const message =
        error instanceof ImageFileError ? error.message : UNREADABLE_IMAGE;
      setErrors((e) => ({ ...e, logo: message }));
      return;
    }
    if (pick !== pickRef.current) return;
    setLogo({
      kind: "new",
      file,
      previewUrl: URL.createObjectURL(file),
      ...size,
    });
    clearLogoError();
  }

  const field = (name: TextDetail) => ({
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
      let logoInput: LogoInput | null | undefined;
      if (logo.kind === "new") {
        logoInput = logo.uploaded;
        if (!logoInput) {
          try {
            const extension =
              LOGO_EXTENSIONS[
                logo.file.type as (typeof BRANDING_IMAGE_TYPES)[number]
              ];
            const blob = await upload(
              `${BRANDING_IMAGE_PREFIX}${slugify(fields.name, "store")}-logo.${extension}`,
              logo.file,
              {
                access: "public",
                handleUploadUrl: UPLOAD_URL,
                contentType: logo.file.type,
              },
            );
            logoInput = {
              url: blob.url,
              pathname: blob.pathname,
              width: logo.width,
              height: logo.height,
            };
            unsavedUploadRef.current = blob.url;
            // Kept, so trying again after a failed save doesn't upload a second copy.
            setLogo({ ...logo, uploaded: logoInput });
          } catch {
            setErrors({ logo: LOGO_UPLOAD_FAILED });
            document.getElementById(fieldId("logo"))?.focus();
            return;
          }
        }
      } else if (logo.kind === "none" && hasSavedLogo) {
        logoInput = null;
      }

      const result = await saveAction({ ...fields, logo: logoInput });
      if (result.ok) {
        unsavedUploadRef.current = null;
        if (logoInput) {
          setLogo({ kind: "current", url: logoInput.url });
          setHasSavedLogo(true);
        } else if (logoInput === null) {
          setHasSavedLogo(false);
        }
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
        Shown in the header, hero and contact section of the store. The store
        name, slogan, logo and phone numbers also print on quotations and
        delivery receipts.
      </p>
      <TextField
        label="Store name"
        maxLength={60}
        required
        {...field("name")}
      />
      <TextField label="Slogan" maxLength={60} {...field("slogan")} />

      <fieldset className={styles.logoField}>
        <legend className={cx(styles.label, "t-label-small")}>Logo</legend>
        <div className={styles.logo}>
          <div className={styles.logoPreview}>
            {logo.kind === "none" ? (
              <Icon name="storefront" size={36} />
            ) : (
              <Image
                src={logo.kind === "new" ? logo.previewUrl : logo.url}
                alt="Store logo"
                fill
                sizes="84px"
                unoptimized={logo.kind === "new"}
                className={styles.logoImage}
              />
            )}
          </div>
          <div className={styles.logoActions}>
            <Button
              id={fieldId("logo")}
              variant="outlined"
              icon="add_photo_alternate"
              aria-describedby={cx(
                `${id}-logo-hint`,
                errors.logo && `${id}-logo-error`,
              )}
              onClick={() => fileRef.current?.click()}
            >
              {logo.kind === "none" ? "Upload logo" : "Replace logo"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept={BRANDING_IMAGE_TYPES.join(",")}
              hidden
              data-testid="logo-file"
              onChange={handleLogoFile}
            />
            {logo.kind !== "none" && (
              <Button
                variant="text"
                onClick={() => {
                  // A pick still reading its size doesn't come back after this.
                  pickRef.current += 1;
                  setLogo({ kind: "none" });
                  clearLogoError();
                }}
              >
                Remove logo
              </Button>
            )}
          </div>
        </div>
        <p id={`${id}-logo-hint`} className={cx(styles.hint, "t-label-small")}>
          PNG with a transparent background works best. Shown in the store
          header, and printed at the top left of quotations and delivery
          receipts.
        </p>
        {errors.logo && (
          <p
            id={`${id}-logo-error`}
            className={cx(styles.error, "t-label-small")}
          >
            {errors.logo}
          </p>
        )}
      </fieldset>

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
      <div className={styles.three}>
        <TextField
          label="Phone"
          type="tel"
          maxLength={40}
          autoComplete="off"
          {...field("phone")}
        />
        <TextField
          label="Second phone"
          type="tel"
          maxLength={40}
          autoComplete="off"
          {...field("phone2")}
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
