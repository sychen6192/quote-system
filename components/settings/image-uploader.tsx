"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImageOff, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { deleteBrandingAsset, uploadBrandingAsset } from "@/actions/settings";
import type { ActionResult } from "@/actions/types";
import { BRANDING_MIME_TYPES, MAX_BRANDING_BYTES } from "@/lib/settings/branding";
import type { BrandingKind } from "@/lib/settings/types";
import { useSettingsPage } from "./settings-context";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import { checkBrandingImage, type ImageWarning } from "./branding-model";
import type { BrandingSource } from "./model";

type Status = "idle" | "checking" | "uploading" | "removing";

const SOURCE_TONE: Record<BrandingSource, string> = {
  db: "bg-success/10 text-success",
  file: "bg-info/10 text-info",
  default: "bg-muted text-muted-foreground",
  none: "bg-muted text-muted-foreground",
};

// Transparent areas show as a checkerboard, so a white logo is still visible.
const CHECKERBOARD = {
  backgroundImage:
    "linear-gradient(45deg, hsl(var(--checker)) 25%, transparent 25%, transparent 75%, hsl(var(--checker)) 75%), linear-gradient(45deg, hsl(var(--checker)) 25%, transparent 25%, transparent 75%, hsl(var(--checker)) 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 8px 8px",
};

export function ImageUploader({
  kind,
  source,
  version,
  className,
}: {
  kind: BrandingKind;
  source: BrandingSource;
  /** settings version: the server image URL changes with every upload */
  version: string;
  className?: string;
}) {
  const t = useTranslations("Settings.branding");
  const tValidation = useTranslations("Validation");
  const router = useRouter();
  const { sessionExpired } = useSettingsPage();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ImageWarning[]>([]);
  const [localPreview, setLocalPreview] = useState<{ url: string; version: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const serverSrc = `/api/branding/${kind}?v=${encodeURIComponent(version)}`;
  // A fresh upload stays on screen until the server's new image has loaded
  // (see onLoad below), so the preview never blinks empty.
  const preview = localPreview?.url ?? null;

  const onServerImageLoad = () => {
    if (!localPreview || localPreview.version === version) return;
    URL.revokeObjectURL(localPreview.url);
    setLocalPreview(null);
  };

  const busy = status !== "idle";
  const hasImage = source !== "none" || preview !== null;
  // The logo and seal are printed on white paper: preview them there in both
  // themes (a navy logo would vanish on the dark checkerboard). The icon
  // shows on the app's own surfaces, so it follows the theme.
  const onPaper = kind !== "icon" && hasImage;
  const label = t(`${kind}.title`);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const onFailure = (result: Exclude<ActionResult, { success: true }>) => {
    if (result.code === "UNAUTHORIZED") {
      sessionExpired();
    } else if (result.code === "VALIDATION") {
      const key = Object.values(result.fieldErrors).flat()[0] ?? "unsupportedImage";
      setError(key);
    } else {
      toast.error(t("uploadFailed"));
    }
  };

  async function upload(file: File) {
    setError(null);
    setWarnings([]);
    // Checked before reading, so a huge file is never loaded into memory.
    if (file.size > MAX_BRANDING_BYTES) {
      setError("imageTooLarge");
      return;
    }
    setStatus("checking");
    const check = checkBrandingImage(kind, new Uint8Array(await file.arrayBuffer()));
    if (!check.ok) {
      setStatus("idle");
      setError(check.error);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { url, version };
    });
    setStatus("uploading");

    const body = new FormData();
    body.set("kind", kind);
    body.set("file", file);
    let result: ActionResult;
    try {
      result = await uploadBrandingAsset(body);
    } catch (thrown) {
      console.error(thrown);
      setStatus("idle");
      sessionExpired();
      return;
    }
    setStatus("idle");
    if (!result.success) {
      URL.revokeObjectURL(url);
      setLocalPreview(null);
      onFailure(result);
      return;
    }
    setWarnings(check.warnings);
    toast.success(t("uploaded", { name: label }), { duration: 2500 });
    router.refresh();
  }

  async function remove() {
    setStatus("removing");
    let result: ActionResult;
    try {
      result = await deleteBrandingAsset(kind);
    } catch (thrown) {
      console.error(thrown);
      setStatus("idle");
      sessionExpired();
      return;
    }
    setStatus("idle");
    setConfirmRemove(false);
    if (!result.success) {
      onFailure(result);
      return;
    }
    setWarnings([]);
    setError(null);
    toast.success(t("removed", { name: label }), { duration: 2500 });
    router.refresh();
  }

  const pick = () => inputRef.current?.click();

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const describedBy = [hintId, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">{label}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(`${kind}.description`)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            SOURCE_TONE[source]
          )}
        >
          {t(`source.${kind}.${source}`)}
        </span>
      </div>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = busy ? "none" : "copy";
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "relative overflow-hidden rounded-lg border-2 border-dashed transition-colors [--checker:220_13%_91%]",
          !onPaper && "dark:[--checker:217_33%_24%]",
          dragging ? "border-primary bg-primary/5" : "border-border",
          error && !dragging && "border-destructive/60"
        )}
      >
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          aria-label={hasImage ? t("replaceLabel", { name: label }) : t("uploadLabel", { name: label })}
          aria-describedby={describedBy}
          className={cn(
            "group relative flex h-36 w-full items-center justify-center bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-progress",
            !onPaper && "dark:bg-slate-900"
          )}
          style={CHECKERBOARD}
        >
          {hasImage ? (
            <>
              {source !== "none" ? (
                // eslint-disable-next-line @next/next/no-img-element -- cache-busted API image
                <img
                  key={serverSrc}
                  src={serverSrc}
                  alt=""
                  onLoad={onServerImageLoad}
                  className={cn(
                    "max-h-full max-w-full object-contain p-4 transition-opacity",
                    kind === "icon" && "aspect-square h-28 rounded-2xl p-2",
                    (busy || preview) && "opacity-0"
                  )}
                />
              ) : null}
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob: preview
                <img
                  src={preview}
                  alt=""
                  className={cn(
                    "absolute inset-0 m-auto max-h-full max-w-full object-contain p-4 transition-opacity",
                    kind === "icon" && "aspect-square h-28 rounded-2xl p-2",
                    busy && "opacity-60"
                  )}
                />
              ) : null}
            </>
          ) : (
            <span className="flex flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
              <span className="flex size-10 items-center justify-center rounded-full bg-background shadow-card ring-1 ring-border">
                <ImagePlus aria-hidden="true" className="size-5 text-primary" />
              </span>
              <span className="font-medium text-foreground">{t("dropHere")}</span>
              <span className="text-xs">{t("orClick")}</span>
            </span>
          )}
          {hasImage && !busy ? (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-1.5 bg-foreground/75 py-1.5 text-xs font-medium text-background opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
            >
              <Upload className="size-3.5" />
              {t("replace")}
            </span>
          ) : null}
        </button>
        {busy ? (
          <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-sm font-medium backdrop-blur-[1px]"
          >
            <Loader2 aria-hidden="true" className="size-5 animate-spin text-primary" />
            {status === "removing" ? t("removing") : t("uploading")}
            <span className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-primary/15">
              <span className="block h-full w-1/3 animate-[settings-progress_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
            </span>
          </div>
        ) : null}
        {dragging ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/10 text-sm font-semibold text-primary">
            {t("dropToUpload")}
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={BRANDING_MIME_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />

      <p id={hintId} className="text-xs text-muted-foreground">
        {t(`${kind}.hint`)}
      </p>
      <FieldError id={errorId}>{error ? tValidation(error) : null}</FieldError>
      {warnings.length ? (
        <ul className="space-y-1 text-xs text-warning">
          {warnings.map((warning) => (
            <li key={warning}>{t(`warnings.${warning}`)}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={pick} disabled={busy} className="h-11 md:h-9">
          <Upload aria-hidden="true" />
          {source === "db" ? t("replace") : t("upload")}
        </Button>
        {source === "db" ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmRemove(true)}
            disabled={busy}
            className="h-11 text-destructive hover:bg-destructive/10 hover:text-destructive md:h-9"
          >
            <Trash2 aria-hidden="true" />
            {t("remove")}
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={(open) => status !== "removing" && setConfirmRemove(open)}>
        <AlertDialogContent className="rounded-xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ImageOff aria-hidden="true" className="size-5 text-destructive" />
              {t(`${kind}.removeTitle`)}
            </AlertDialogTitle>
            <AlertDialogDescription>{t(`${kind}.removeEffect`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel disabled={status === "removing"} className="mt-0 h-11 md:h-9">
              {t("cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void remove()}
              disabled={status === "removing"}
              className="h-11 md:h-9"
            >
              {status === "removing" ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {t("remove")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
