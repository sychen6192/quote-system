"use client";

import { useId, useMemo, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useFormContext, useWatch } from "react-hook-form";
import { Check, Palette, Pipette, Plus } from "lucide-react";
import { settingsSectionSchemas } from "@/lib/settings/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { BRAND_PRESETS, brandPreviewVars, normalizeHex, presetForHex } from "./branding-model";
import { buildSectionPatch } from "./model";
import { useSettingsPage } from "./settings-context";
import {
  FieldSource,
  SaveBar,
  saveSections,
  SectionFormProvider,
  SectionHeading,
  SettingsCard,
  useSettingsForm,
} from "./settings-form";
import { ImageUploader } from "./image-uploader";

type ColorForm = { brandColor: string };

const schema = settingsSectionSchemas.appearance;

export function BrandingSection() {
  const t = useTranslations("Settings.branding");
  const headingId = useId();
  const { data } = useSettingsPage();
  const initial = useMemo<ColorForm>(
    () => ({ brandColor: String(data.values.appearance.brandColor) }),
    [data.values.appearance.brandColor]
  );

  const { form, formRef, submit, saving, isDirty, discard, api } = useSettingsForm<ColorForm, ColorForm>({
    tab: "branding",
    schema,
    initial,
    toForm: (output) => output,
    save: (output, changed) =>
      saveSections([["appearance", buildSectionPatch("appearance", changed, output)]]),
  });

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <SectionHeading id={headingId} icon={Palette} title={t("title")} />

      <SettingsCard title={t("imagesTitle")}>
        <div className="grid gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
          <ImageUploader kind="logo" source={data.branding.logo} version={data.version} />
          <ImageUploader kind="stamp" source={data.branding.stamp} version={data.version} />
          <ImageUploader kind="icon" source={data.branding.icon} version={data.version} />
        </div>
      </SettingsCard>

      <SectionFormProvider api={api}>
        <Form {...form}>
          <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
            <SettingsCard title={t("colorTitle")}>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
                <ColorField />
                <ColorPreview />
              </div>
            </SettingsCard>
            <SaveBar dirty={isDirty} saving={saving} onDiscard={discard} />
          </form>
        </Form>
      </SectionFormProvider>
    </section>
  );
}

function ColorField() {
  const t = useTranslations("Settings.branding");
  const { control, setValue } = useFormContext<ColorForm>();
  const groupLabelId = useId();
  const pickerId = useId();
  const value = useWatch({ control, name: "brandColor" }) ?? "";
  const normalized = normalizeHex(value);
  const preset = normalized ? presetForHex(normalized) : null;
  const custom = normalized !== null && preset === null;

  const choose = (hex: string) =>
    setValue("brandColor", hex, { shouldDirty: true, shouldValidate: true, shouldTouch: true });

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <div className="flex min-h-6 items-center justify-between gap-2">
          <p id={groupLabelId} className="text-sm font-medium leading-none">
            {t("presets")}
          </p>
          <FieldSource section="appearance" name="brandColor" current={value} label={t("colorTitle")} />
        </div>
        <div>
          <ToggleGroup
            type="single"
            value={preset ? (BRAND_PRESETS.find((p) => p.key === preset)?.hex ?? "") : ""}
            onValueChange={(hex) => hex && choose(hex)}
            aria-labelledby={groupLabelId}
            className="flex flex-wrap justify-start gap-2.5"
          >
            {BRAND_PRESETS.map(({ key, hex }) => (
              <ToggleGroupItem
                key={key}
                value={hex}
                aria-label={t(`colors.${key}`)}
                title={t(`colors.${key}`)}
                className="size-11 min-w-0 rounded-full p-0 ring-offset-2 ring-offset-card hover:bg-transparent data-[state=on]:bg-transparent data-[state=on]:ring-2 data-[state=on]:ring-foreground md:size-9"
              >
                <span
                  aria-hidden="true"
                  className="flex size-full items-center justify-center rounded-full shadow-inner ring-1 ring-black/10"
                  style={{ backgroundColor: hex }}
                >
                  {preset === key ? <Check className="size-4 text-white" strokeWidth={3} /> : null}
                </span>
              </ToggleGroupItem>
            ))}
            <label
              htmlFor={pickerId}
              title={t("customColor")}
              className={cn(
                "relative flex size-11 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-card focus-within:ring-2 focus-within:ring-ring md:size-9",
                custom && "ring-2 ring-foreground"
              )}
              style={{
                background: custom
                  ? normalized!
                  : "conic-gradient(from 90deg, #ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)",
              }}
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm">
                {custom ? (
                  <Pipette aria-hidden="true" className="size-3.5" />
                ) : (
                  <Plus aria-hidden="true" className="size-3.5" />
                )}
              </span>
              <span className="sr-only">{t("customColor")}</span>
              <input
                id={pickerId}
                type="color"
                value={(normalized ?? "#1d4ed8").toLowerCase()}
                onChange={(event) => choose(event.target.value.toUpperCase())}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          </ToggleGroup>
        </div>
      </div>

      <FormField
        control={control}
        name="brandColor"
        render={({ field }) => (
          <FormItem className="max-w-xs">
            <FormLabel>{t("hex")}</FormLabel>
            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute left-2.5 top-1/2 size-5 -translate-y-1/2 rounded-md ring-1 ring-black/10"
                style={{ backgroundColor: normalized ?? "transparent" }}
              />
              <FormControl>
                <Input
                  {...field}
                  onBlur={() => {
                    const hex = normalizeHex(field.value);
                    if (hex && hex !== field.value) field.onChange(hex);
                    field.onBlur();
                  }}
                  spellCheck={false}
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={7}
                  placeholder="#1D4ED8"
                  className="h-11 pl-10 font-mono uppercase tracking-wide md:h-9"
                />
              </FormControl>
            </div>
            <FormDescription>{t("hexHint")}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

/** The colour on a few real controls and on the paper, in the current theme. */
function ColorPreview() {
  const t = useTranslations("Settings.branding.preview");
  const { data } = useSettingsPage();
  const { control } = useFormContext<ColorForm>();
  const value = useWatch({ control, name: "brandColor" }) ?? "";
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const mode = mounted && resolvedTheme === "dark" ? "dark" : "light";
  // While the hex field holds a half-typed value, keep showing the saved colour.
  const hex = normalizeHex(value) ?? normalizeHex(String(data.values.appearance.brandColor)) ?? "#1D4ED8";
  const vars = (brandPreviewVars(hex, mode) ?? undefined) as CSSProperties | undefined;

  return (
    <div className="space-y-3 rounded-xl border bg-background p-4" style={vars}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("label")}</p>
      <div aria-hidden="true" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" tabIndex={-1} className="pointer-events-none">
            <Plus />
            {t("button")}
          </Button>
          <Badge variant="outline" className="border-primary/30 bg-accent text-accent-foreground">
            {t("badge")}
          </Badge>
          <Switch checked tabIndex={-1} className="pointer-events-none" />
        </div>
        <p className="text-sm">
          <span className="font-medium text-primary underline underline-offset-4">{t("link")}</span>
        </p>
        <div className="overflow-hidden rounded-lg bg-paper text-paper-foreground ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: hex }}>
              {t("document")}
            </span>
            <span className="font-mono text-[10px] text-slate-500">{hex}</span>
          </div>
          <div className="h-5" style={{ backgroundColor: hex }} />
          <div className="space-y-1.5 px-3 py-2.5">
            <div className="h-1.5 w-3/4 rounded-full bg-slate-200" />
            <div className="h-1.5 w-1/2 rounded-full bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
