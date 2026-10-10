// Runtime settings (spec §6): DB (Settings page) > env vars > defaults, plus
// branding images (DB → branding/<kind>.png → branding-defaults/logo.png).
import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, brandingAssets } from "@/db/schema";
import { brandingCandidates, getAppNameOverride, getEnvSettings } from "@/lib/config";
import { sniffImageMime } from "@/lib/settings/branding";
import {
  SETTINGS_DEFAULTS,
  hashString,
  mergeSettings,
  settingSource,
  type SettingSource,
} from "@/lib/settings/merge";
import {
  SETTINGS_SECTIONS,
  parseSettingsLayer,
  type SettingsLayer,
  type SettingsSection,
} from "@/lib/settings/schema";
import type {
  BrandingAsset,
  BrandingKind,
  DocumentBranding,
  EffectiveSettings,
  PublicAppConfig,
} from "@/lib/settings/types";

export const SETTINGS_TTL_MS = 15_000;
const DEFAULT_APP_NAME = "Quote System";
const WARN_INTERVAL_MS = 60_000;

type Cached<T> = { value: T; expires: number };

/** An asset load, tied to the settings version that was current when it started. */
type AssetLoad<T> = T & { settingsVersion: string };

type Store = {
  /** bumped by invalidateSettingsCache so in-flight loads don't store stale data */
  generation: number;
  settings: Cached<EffectiveSettings> | null;
  pending: Promise<EffectiveSettings> | null;
  assets: Map<BrandingKind, AssetLoad<Cached<BrandingAsset | null>>>;
  pendingAssets: Map<BrandingKind, AssetLoad<{ promise: Promise<BrandingAsset | null> }>>;
  /** What the last successful branding_assets read per kind returned (null: no upload). */
  lastDbAssets: Map<BrandingKind, BrandingAsset | null>;
  warnedAt: number;
};

// On globalThis: pages, route handlers and server actions are bundled
// separately, and a save in one must invalidate the cache of all of them.
const STORE = Symbol.for("quote-system.settings-cache");

function store(): Store {
  const g = globalThis as { [STORE]?: Store };
  return (g[STORE] ??= {
    generation: 0,
    settings: null,
    pending: null,
    assets: new Map(),
    pendingAssets: new Map(),
    lastDbAssets: new Map(),
    warnedAt: -Infinity,
  });
}

/** Drop in-process caches after a settings/branding write. */
export function invalidateSettingsCache(): void {
  const s = store();
  s.generation++;
  s.settings = null;
  s.pending = null;
  s.assets.clear();
  s.pendingAssets.clear();
  // A write may have replaced or removed an upload: like the settings, the
  // last good images are no longer known to be good.
  s.lastDbAssets.clear();
}

// `next build` imports pages without a reachable database; never try (and
// never bake DB values into prerendered output).
const isBuildPhase = () => process.env.NEXT_PHASE === "phase-production-build";

function warnDbUnavailable(what: string, error: unknown) {
  const s = store();
  const now = Date.now();
  if (now - s.warnedAt < WARN_INTERVAL_MS) return;
  s.warnedAt = now;
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`settings: could not read ${what} from the database, using env/defaults (${reason})`);
}

type StoredSettings = {
  data: unknown;
  updatedAt: Date | null;
  stamps: Record<string, string>;
};

/** null when the database could not be read. */
async function readStoredSettings(): Promise<StoredSettings | null> {
  if (isBuildPhase()) return { data: {}, updatedAt: null, stamps: {} };
  try {
    const [rows, assets] = await Promise.all([
      db
        .select({ data: appSettings.data, updatedAt: appSettings.updatedAt })
        .from(appSettings)
        .where(eq(appSettings.id, 1))
        .limit(1),
      db
        .select({ kind: brandingAssets.kind, updatedAt: brandingAssets.updatedAt })
        .from(brandingAssets),
    ]);
    const stamps: Record<string, string> = {};
    for (const asset of assets) stamps[`db:${asset.kind}`] = isoOf(asset.updatedAt);
    return { data: rows[0]?.data ?? {}, updatedAt: rows[0]?.updatedAt ?? null, stamps };
  } catch (error) {
    warnDbUnavailable("app_settings", error);
    return null;
  }
}

function isoOf(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  return value ?? "";
}

/** mtime + size of the on-disk branding files, so swapping one busts caches. */
async function fileStamps(): Promise<Record<string, string>> {
  const files = new Set(
    (["logo", "stamp", "icon"] as const).flatMap((kind) => brandingCandidates(kind))
  );
  const stamps: Record<string, string> = {};
  await Promise.all(
    [...files].map(async (file) => {
      try {
        const stat = await fs.stat(file);
        stamps[`file:${path.relative(process.cwd(), file)}`] = `${stat.mtimeMs}:${stat.size}`;
      } catch {
        // missing file: no stamp
      }
    })
  );
  return stamps;
}

async function loadSettings(previous: EffectiveSettings | null): Promise<EffectiveSettings> {
  const [stored, files] = await Promise.all([readStoredSettings(), fileStamps()]);
  // Keep serving the last good DB-backed settings through a DB blip rather
  // than flipping the branding back to env values.
  if (!stored && previous) return previous;
  return mergeSettings(SETTINGS_DEFAULTS, getEnvSettings(), stored?.data ?? {}, {
    updatedAt: stored?.updatedAt ?? null,
    brandingStamps: { ...files, ...stored?.stamps },
  });
}

async function settingsWithTtl(): Promise<EffectiveSettings> {
  const s = store();
  if (s.settings && s.settings.expires > Date.now()) return s.settings.value;
  if (s.pending) return s.pending;
  const generation = s.generation;
  const pending = loadSettings(s.settings?.value ?? null)
    .then((value) => {
      if (s.generation === generation) {
        s.settings = { value, expires: Date.now() + SETTINGS_TTL_MS };
      }
      return value;
    })
    .finally(() => {
      if (s.pending === pending) s.pending = null;
    });
  s.pending = pending;
  return pending;
}

/** Per request (React cache) on top of a 15 s in-process TTL. */
export const getSettings: () => Promise<EffectiveSettings> = cache(settingsWithTtl);

export type SettingsProvenance = {
  /** What env vars set (valid, non-empty fields only). */
  env: SettingsLayer;
  /** What the Settings page saved (validated field by field); {} when unreadable. */
  stored: SettingsLayer;
  /** The database could not be read: `stored` is empty and saving will fail. */
  storeUnavailable: boolean;
  /** Where each field's effective value comes from, as getSettings() resolves it. */
  sources: { [S in SettingsSection]: Record<string, SettingSource> };
};

/**
 * Which fields come from the Settings page, from env vars or from the
 * defaults, for the Settings page. Always reads the database (no cache), so
 * it reflects a save immediately.
 */
export async function getSettingsProvenance(): Promise<SettingsProvenance> {
  const stored = await readStoredSettings();
  const env = getEnvSettings().layer;
  const db = parseSettingsLayer(stored?.data ?? {});
  const sources = {} as SettingsProvenance["sources"];
  for (const section of SETTINGS_SECTIONS) {
    const keys = Object.keys(SETTINGS_DEFAULTS[section]);
    // Not in SETTINGS_DEFAULTS: its default depends on the currency.
    if (section === "quote") keys.push("showAmountInWords");
    sources[section] = Object.fromEntries(keys.map((key) => [key, settingSource(section, key, env, db)]));
  }
  return { env, stored: db, storeUnavailable: stored === null, sources };
}

export async function getPublicConfig(): Promise<PublicAppConfig> {
  const s = await getSettings();
  return {
    appName:
      getAppNameOverride() ||
      s.company.nameLocal ||
      (s.company.isDefault ? DEFAULT_APP_NAME : s.company.name),
    companyName: s.company.name,
    companyNameLocal: s.company.nameLocal,
    isDefaultCompany: s.company.isDefault,
    currency: s.money.currency,
    currencyLocale: s.money.currencyLocale,
    fractionDigits: s.money.fractionDigits,
    defaultTaxRate: s.quote.defaultTaxRate,
    validityDays: s.quote.validityDays,
    defaultSalesperson: s.quote.defaultSalesperson,
    showAmountInWords: s.quote.showAmountInWords,
    timezone: s.region.timezone,
    brandColor: s.appearance.brandColor,
    twVatLookup: s.features.twVatLookup,
    mailEnabled: s.mail.enabled,
    authEnabled: s.auth.enabled,
    logoUrl: `/api/branding/logo?v=${s.version}`,
    iconUrl: `/api/branding/icon?v=${s.version}`,
    version: s.version,
  };
}

type AssetSource = { db: BrandingKind } | { file: string };

// DB upload → legacy branding/<kind>.png mount → committed default logo.
// The icon falls back to the logo; the stamp has no default.
function assetSources(kind: BrandingKind): AssetSource[] {
  if (kind === "icon") {
    const [userIcon] = brandingCandidates("icon");
    return [{ db: "icon" }, { file: userIcon }, ...assetSources("logo")];
  }
  return [{ db: kind }, ...brandingCandidates(kind).map((file) => ({ file }))];
}

/** undefined when the database could not be read (fall through to files). */
async function dbAsset(kind: BrandingKind): Promise<BrandingAsset | null | undefined> {
  if (isBuildPhase()) return undefined;
  try {
    const [row] = await db
      .select({
        mime: brandingAssets.mime,
        dataBase64: brandingAssets.dataBase64,
        updatedAt: brandingAssets.updatedAt,
      })
      .from(brandingAssets)
      .where(eq(brandingAssets.kind, kind))
      .limit(1);
    if (!row) return null;
    const data = Buffer.from(row.dataBase64, "base64");
    if (data.length === 0) return null;
    return {
      data,
      mime: row.mime,
      version: hashString(`db:${kind}:${isoOf(row.updatedAt)}:${data.length}`),
    };
  } catch (error) {
    warnDbUnavailable("branding_assets", error);
    return undefined;
  }
}

/**
 * The DB upload for `kind`. When the read fails after an earlier one in this
 * process succeeded, the last good result is kept (as loadSettings keeps the
 * last good settings), so a database blip does not swap a branded logo or
 * app icon for the disk/default one and back. Only a cold start, with no
 * successful read yet, gives undefined and falls through to the files.
 */
async function dbAssetOrLastGood(kind: BrandingKind): Promise<BrandingAsset | null | undefined> {
  const s = store();
  const generation = s.generation;
  const asset = await dbAsset(kind);
  if (asset === undefined) return s.lastDbAssets.get(kind);
  if (s.generation === generation) s.lastDbAssets.set(kind, asset);
  return asset;
}

async function fileAsset(file: string): Promise<BrandingAsset | null> {
  let data: Buffer;
  try {
    data = await fs.readFile(file);
  } catch {
    return null;
  }
  if (data.length === 0) return null;
  return {
    data,
    mime: sniffImageMime(data) ?? "image/png",
    // Content hash: identical across restarts and replicas.
    version: createHash("sha256").update(data).digest("hex").slice(0, 16),
  };
}

async function loadAsset(kind: BrandingKind): Promise<BrandingAsset | null> {
  for (const source of assetSources(kind)) {
    const asset = "db" in source ? await dbAssetOrLastGood(source.db) : await fileAsset(source.file);
    if (asset) return asset;
  }
  return null;
}

/** The image for `kind` with a stable version (ETag), or null (stamp only). */
export async function getBrandingAsset(kind: BrandingKind): Promise<BrandingAsset | null> {
  // `/api/branding/<kind>?v=<settings.version>` is cached forever, so the
  // bytes must be read no earlier than that version: when the settings
  // reload sees a change (e.g. another replica's upload), reload the image
  // too instead of waiting for its own TTL.
  const { version: settingsVersion } = await getSettings();
  const s = store();
  const cached = s.assets.get(kind);
  if (cached && cached.expires > Date.now() && cached.settingsVersion === settingsVersion) {
    return cached.value;
  }
  const inflight = s.pendingAssets.get(kind);
  if (inflight && inflight.settingsVersion === settingsVersion) return inflight.promise;
  const generation = s.generation;
  const promise: Promise<BrandingAsset | null> = loadAsset(kind)
    .then((value) => {
      if (s.generation === generation) {
        s.assets.set(kind, { value, expires: Date.now() + SETTINGS_TTL_MS, settingsVersion });
      }
      return value;
    })
    .finally(() => {
      if (s.pendingAssets.get(kind)?.promise === promise) s.pendingAssets.delete(kind);
    });
  s.pendingAssets.set(kind, { promise, settingsVersion });
  return promise;
}

export type BrandingSource = "db" | "file" | "default" | "none";

/**
 * Where each branding image currently comes from, for the Settings page and
 * the dashboard setup checklist. "default" = the bundled placeholder logo
 * (or, for the icon, whatever the logo resolves to); "none" = no stamp.
 */
export async function getBrandingStatus(): Promise<Record<BrandingKind, BrandingSource>> {
  const kinds: BrandingKind[] = ["logo", "stamp", "icon"];
  const entries = await Promise.all(
    kinds.map(async (kind): Promise<[BrandingKind, BrandingSource]> => {
      if ((await dbAssetOrLastGood(kind)) != null) return [kind, "db"];
      const [ownFile] = brandingCandidates(kind);
      if (ownFile && (await fileAsset(ownFile))) return [kind, "file"];
      return [kind, kind === "stamp" ? "none" : "default"];
    })
  );
  return Object.fromEntries(entries) as Record<BrandingKind, BrandingSource>;
}

const dataUris = new WeakMap<BrandingAsset, string>();

function toDataUri(asset: BrandingAsset): string {
  let uri = dataUris.get(asset);
  if (!uri) {
    uri = `data:${asset.mime};base64,${asset.data.toString("base64")}`;
    dataUris.set(asset, uri);
  }
  return uri;
}

export async function getDocumentBranding(mode: "html" | "pdf"): Promise<DocumentBranding> {
  const s = await getSettings();
  const [logo, stamp] = await Promise.all([getBrandingAsset("logo"), getBrandingAsset("stamp")]);
  const src = (kind: BrandingKind, asset: BrandingAsset | null) => {
    if (!asset) return null;
    return mode === "pdf" ? toDataUri(asset) : `/api/branding/${kind}?v=${s.version}`;
  };
  return {
    company: s.company,
    payment: s.payment,
    logoSrc: src("logo", logo) ?? "",
    stampSrc: src("stamp", stamp),
    brandColor: s.appearance.brandColor,
    currency: s.money.currency,
    currencyLocale: s.money.currencyLocale,
    fractionDigits: s.money.fractionDigits,
    showAmountInWords: s.quote.showAmountInWords,
    footerText: s.quote.footerText,
    timezone: s.region.timezone,
  };
}
