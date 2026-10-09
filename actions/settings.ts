"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, brandingAssets } from "@/db/schema";
import { MAX_BRANDING_BYTES, validateBrandingImage } from "@/lib/settings/branding";
import {
  isBrandingKind,
  isSettingsSection,
  parseSettingsPatch,
  type SettingsSection,
} from "@/lib/settings/schema";
import type { BrandingKind } from "@/lib/settings/types";
import { invalidateSettingsCache } from "@/services/settings";
import {
  internalError,
  requireAuth,
  validationError,
  type ActionResult,
} from "./types";

function afterWrite() {
  invalidateSettingsCache();
  // Company name, colours, logo and defaults appear on every page.
  revalidatePath("/[locale]", "layout");
}

/**
 * Saves one Settings section. `data` may be partial; a field set to null is
 * removed so the env var / built-in default applies again.
 */
export async function saveSettings(
  section: SettingsSection,
  data: Record<string, unknown>
): Promise<ActionResult> {
  const denied = await requireAuth();
  if (denied) return denied;

  if (!isSettingsSection(section)) return validationError({ section: ["invalidValue"] });
  const patch = parseSettingsPatch(section, data);
  if (!patch.success) return validationError(patch.fieldErrors);

  try {
    const values = JSON.stringify(patch.set);
    const removed = `{${patch.reset.map((key) => `"${key}"`).join(",")}}`;
    // Merge in SQL so two tabs saving different sections cannot overwrite
    // each other's changes with a stale copy.
    const current = sql`CASE WHEN jsonb_typeof(${appSettings.data} -> ${section}::text) = 'object'
      THEN ${appSettings.data} -> ${section}::text ELSE '{}'::jsonb END`;
    await db
      .insert(appSettings)
      .values({
        id: 1,
        data: sql`jsonb_build_object(${section}::text, ${values}::jsonb)`,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: {
          data: sql`jsonb_set(
            CASE WHEN jsonb_typeof(${appSettings.data}) = 'object' THEN ${appSettings.data} ELSE '{}'::jsonb END,
            ARRAY[${section}::text],
            (${current} || ${values}::jsonb) - ${removed}::text[]
          )`,
          updatedAt: sql`now()`,
        },
      });
  } catch (error) {
    console.error("saveSettings failed:", error);
    return internalError("Failed to save settings");
  }

  afterWrite();
  return { success: true };
}

/** FormData: `kind` (logo | stamp | icon) and `file` (PNG/JPEG, ≤ 1 MB, ≤ 2048² pixels). */
export async function uploadBrandingAsset(formData: FormData): Promise<ActionResult> {
  const denied = await requireAuth();
  if (denied) return denied;

  // A hand-crafted request can send any serialisable value here.
  if (!(formData instanceof FormData)) return validationError({ file: ["required"] });
  const kind = formData.get("kind");
  if (!isBrandingKind(kind)) return validationError({ kind: ["invalidValue"] });
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) return validationError({ file: ["required"] });
  if (file.size > MAX_BRANDING_BYTES) return validationError({ file: ["imageTooLarge"] });

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Trust the bytes, not the file name or the browser-reported type.
  const checked = validateBrandingImage(bytes);
  if (!checked.ok) return validationError({ file: [checked.error] });
  const { image } = checked;

  try {
    const dataBase64 = Buffer.from(bytes).toString("base64");
    await db
      .insert(brandingAssets)
      .values({ kind, mime: image.mime, dataBase64, updatedAt: sql`now()` })
      .onConflictDoUpdate({
        target: brandingAssets.kind,
        set: { mime: image.mime, dataBase64, updatedAt: sql`now()` },
      });
  } catch (error) {
    console.error("uploadBrandingAsset failed:", error);
    return internalError("Failed to save the image");
  }

  afterWrite();
  return { success: true };
}

/** Removes an uploaded image; the env/disk/default fallback applies again. */
export async function deleteBrandingAsset(kind: BrandingKind): Promise<ActionResult> {
  const denied = await requireAuth();
  if (denied) return denied;

  if (!isBrandingKind(kind)) return validationError({ kind: ["invalidValue"] });

  try {
    await db.delete(brandingAssets).where(eq(brandingAssets.kind, kind));
  } catch (error) {
    console.error("deleteBrandingAsset failed:", error);
    return internalError("Failed to delete the image");
  }

  afterWrite();
  return { success: true };
}
