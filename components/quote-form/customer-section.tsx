"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Building2, Loader2, Search } from "lucide-react";
import { lookupVatNumber } from "@/actions/lookup-vat";
import { searchCustomers } from "@/actions/search";
import { useAppConfig } from "@/components/providers/app-config-provider";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { QuoteFormValues } from "@/lib/schemas/quote";
import type { CustomerOption } from "@/services/customers";
import { AsyncCombobox, Highlight } from "./async-combobox";
import { useEditor } from "./editor-context";
import { RequiredMark, fieldClass } from "./field-bits";

type CustomerField = "companyName" | "contactPerson" | "email" | "phone" | "vatNumber" | "address";

export function CustomerSection() {
  const t = useTranslations("QuoteForm");
  const form = useFormContext<QuoteFormValues>();
  const { onSessionExpired } = useEditor();
  const { twVatLookup } = useAppConfig();
  const [lookingUp, setLookingUp] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const fill = (field: CustomerField, value: string) =>
    form.setValue(field, value, { shouldDirty: true, shouldValidate: true });

  const pickCustomer = (option: CustomerOption) => {
    fill("companyName", option.companyName);
    fill("contactPerson", option.contactPerson ?? "");
    fill("email", option.email ?? "");
    fill("phone", option.phone ?? "");
    fill("vatNumber", option.vatNumber ?? "");
    fill("address", option.address ?? "");
    setAnnouncement(t("customer.filled", { company: option.companyName }));
  };

  const lookUpVat = async () => {
    const vat = String(form.getValues("vatNumber") ?? "").trim();
    if (!/^\d{8}$/.test(vat)) {
      toast.error(t("vatLookup.invalid"));
      form.setFocus("vatNumber");
      return;
    }
    setLookingUp(true);
    try {
      const result = await lookupVatNumber(vat);
      if (result.success) {
        fill("companyName", result.company.companyName);
        if (result.company.address) fill("address", result.company.address);
        if (!String(form.getValues("contactPerson") ?? "").trim() && result.company.responsibleName) {
          fill("contactPerson", result.company.responsibleName);
        }
        toast.success(t("vatLookup.filled"), { description: result.company.companyName });
        return;
      }
      switch (result.code) {
        case "UNAUTHORIZED":
          onSessionExpired();
          return;
        case "INVALID":
          toast.error(t("vatLookup.invalid"));
          return;
        case "NOT_FOUND":
          toast.error(t("vatLookup.notFound"));
          return;
        case "DISABLED":
          toast.error(t("vatLookup.disabled"));
          return;
        case "RATE_LIMITED":
          toast.error(t("vatLookup.rateLimited"));
          return;
        default:
          toast.error(t("vatLookup.error"));
      }
    } catch {
      if (navigator.onLine === false) toast.error(t("messages.offline"));
      else onSessionExpired();
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
      <FormField
        control={form.control}
        name="companyName"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>
              {t("fields.companyName")}
              <RequiredMark />
            </FormLabel>
            <FormControl>
              <AsyncCombobox<CustomerOption>
                ref={field.ref}
                name={field.name}
                value={String(field.value ?? "")}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                onPick={pickCustomer}
                search={searchCustomers}
                getKey={(option) => option.companyName.toLowerCase()}
                onSessionError={onSessionExpired}
                aria-required="true"
                placeholder={t("placeholders.companyName")}
                className={fieldClass}
                labels={{
                  searching: t("combobox.searching"),
                  empty: t("combobox.noCustomers"),
                  error: t("combobox.error"),
                  offline: t("combobox.offline"),
                  results: (count) => t("combobox.results", { count }),
                  listbox: t("combobox.customers"),
                }}
                renderOption={(option, query) => (
                  <>
                    <span className="flex items-center gap-2 font-medium">
                      <Building2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        <Highlight text={option.companyName} query={query} />
                      </span>
                    </span>
                    {(option.vatNumber || option.contactPerson || option.email) && (
                      <span className="truncate pl-[1.375rem] text-xs text-muted-foreground">
                        {[option.vatNumber, option.contactPerson, option.email]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </>
                )}
              />
            </FormControl>
            <FormMessage />
            <span className="sr-only" aria-live="polite">
              {announcement}
            </span>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="contactPerson"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("fields.contactPerson")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                autoComplete="off"
                placeholder={t("placeholders.contactPerson")}
                className={fieldClass}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("fields.email")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t("placeholders.email")}
                className={fieldClass}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("fields.phone")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder={t("placeholders.phone")}
                className={fieldClass}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="vatNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("fields.vatNumber")}</FormLabel>
            <div className="flex gap-2">
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode={twVatLookup ? "numeric" : "text"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={twVatLookup ? t("placeholders.vatNumber") : undefined}
                  className={fieldClass}
                  onKeyDown={(event) => {
                    if (
                      twVatLookup &&
                      event.key === "Enter" &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void lookUpVat();
                    }
                  }}
                />
              </FormControl>
              {twVatLookup && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={lookUpVat}
                  disabled={lookingUp}
                  aria-label={t("vatLookup.label")}
                  className="h-11 shrink-0 md:h-9"
                >
                  {lookingUp ? (
                    <Loader2 aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Search aria-hidden="true" />
                  )}
                  <span aria-hidden="true">{t("vatLookup.button")}</span>
                </Button>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="address"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>{t("fields.address")}</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                value={field.value ?? ""}
                rows={2}
                autoComplete="off"
                placeholder={t("placeholders.address")}
                className="min-h-[4.5rem] resize-y [field-sizing:content]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
