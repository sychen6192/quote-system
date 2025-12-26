"use client";

import { useState } from "react";
import { useRouter } from "@/navigation";
import {
  useForm,
  useFieldArray,
  useWatch,
  // Path,
  UseFormRegister,
  FieldError,
  Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { createQuote } from "@/actions/create-quote";
import { updateQuote } from "@/actions/update-quote";
import { quoteFormSchema, type QuoteFormData } from "@/lib/schemas/quote";
import { toast } from "sonner";
import { useTranslations, useFormatter } from "next-intl";
import { toBasisPoints, calculateQuoteFinancials } from "@/lib/utils";

// ✅ 修正 Interface 定義，確保 id 是可選的
interface QuoteFormProps {
  initialData: Partial<QuoteFormData> & { id?: number };
}

export default function QuoteForm({ initialData }: QuoteFormProps) {
  const t = useTranslations("QuoteForm");
  const format = useFormatter();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  // ✅ 修正 useForm 初始化
  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema) as Resolver<QuoteFormData>,

    defaultValues: {
      ...initialData,
      items: initialData.items || [],
      taxRate: initialData.taxRate ?? 5,
      companyName: initialData.companyName || "",
      salesperson: initialData.salesperson || "",
      email: initialData.email || "",
    } as QuoteFormData,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // --- 即時計算邏輯 ---
  const items = useWatch({ control: form.control, name: "items" });
  const taxRate = useWatch({ control: form.control, name: "taxRate" });

  const itemsForCalc = (items || []).map((item) => ({
    quantity: Number(item.quantity) || 0,
    unitPrice: Math.round((Number(item.unitPrice) || 0) * 100),
    isTaxable: item.isTaxable ?? true,
  }));

  const taxRateBP = toBasisPoints(Number(taxRate) || 0);
  const financials = calculateQuoteFinancials(itemsForCalc, taxRateBP);
  // ------------------

  const onSubmit = async (data: QuoteFormData) => {
    setIsPending(true);
    try {
      const res = initialData?.id
        ? await updateQuote(initialData.id, data)
        : await createQuote(data);

      if (res.success) {
        toast.success(
          initialData?.id ? t("messages.updated") : t("messages.created")
        );
        router.push(initialData?.id ? `/quotes/${initialData.id}` : "/");
        router.refresh();
      } else {
        toast.error(t("messages.error"));
        console.error("Server Action Error:", res.error);
      }
    } catch (error) {
      console.error(error);
      toast.error(t("messages.error"));
    } finally {
      setIsPending(false);
    }
  };

  const handleCancel = () => {
    if (form.formState.isDirty) {
      if (window.confirm(t("messages.confirmDiscard"))) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-8 max-w-5xl mx-auto py-4 md:py-10 px-4 md:px-0"
    >
      <div className="border-b pb-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {initialData?.id
            ? t("header.editTitle", { id: initialData.id })
            : t("header.createTitle")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {initialData?.id ? t("header.editDesc") : t("header.createDesc")}
        </p>
      </div>

      {/* Customer Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t("sections.customerDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label={t("fields.companyName")}
            name="companyName"
            register={form.register}
            error={form.formState.errors.companyName}
            disabled={isPending}
            required
            placeholder="Acme Corp."
          />
          <FormField
            label={t("fields.contactPerson")}
            name="contactPerson"
            register={form.register}
            error={form.formState.errors.contactPerson}
            disabled={isPending}
            placeholder="John Doe"
          />
          <FormField
            label={t("fields.email")}
            name="email"
            type="email"
            register={form.register}
            error={form.formState.errors.email}
            disabled={isPending}
            placeholder="john@example.com"
          />
          <FormField
            label={t("fields.phone")}
            name="phone"
            register={form.register}
            error={form.formState.errors.phone}
            disabled={isPending}
            placeholder="+1 234 567 890"
          />
          <FormField
            label={t("fields.vatNumber")}
            name="vatNumber"
            register={form.register}
            error={form.formState.errors.vatNumber}
            disabled={isPending}
          />
          <FormField
            label={t("fields.salesperson")}
            name="salesperson"
            register={form.register}
            error={form.formState.errors.salesperson}
            required
            disabled={isPending}
          />
          <div className="col-span-1 md:col-span-2 space-y-2">
            <label className="text-sm font-medium">{t("fields.address")}</label>
            <Textarea
              {...form.register("address")}
              rows={2}
              disabled={isPending}
              className={
                form.formState.errors.address ? "border-destructive" : ""
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          <FormField
            label={t("fields.issuedDate")}
            name="issuedDate"
            type="date"
            register={form.register}
            error={form.formState.errors.issuedDate}
            disabled={isPending}
          />
          <FormField
            label={t("fields.validUntil")}
            name="validUntil"
            type="date"
            register={form.register}
            error={form.formState.errors.validUntil}
            disabled={isPending}
          />
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("sections.items")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%] min-w-[200px] pl-4">
                    {t("table.product")}
                  </TableHead>
                  <TableHead className="w-[15%] min-w-[80px]">
                    {t("table.qty")}
                  </TableHead>
                  <TableHead className="w-[20%] min-w-[100px]">
                    {t("table.price")}
                  </TableHead>
                  <TableHead className="w-[15%] min-w-[100px] text-right">
                    {t("table.amount")}
                  </TableHead>
                  <TableHead className="w-[5%] min-w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const qty = Number(items?.[index]?.quantity) || 0;
                  const price = Number(items?.[index]?.unitPrice) || 0;
                  const lineAmount = qty * price;

                  return (
                    <TableRow key={field.id}>
                      <TableCell className="align-top pl-4">
                        <Input
                          {...form.register(`items.${index}.productName`)}
                          placeholder={t("placeholders.itemName")}
                          disabled={isPending}
                          className={
                            form.formState.errors.items?.[index]?.productName
                              ? "border-destructive"
                              : ""
                          }
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          // ✅ 修正：使用 valueAsNumber 確保輸出為數字
                          {...form.register(`items.${index}.quantity`, {
                            valueAsNumber: true,
                          })}
                          min="1"
                          disabled={isPending}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          {...form.register(`items.${index}.unitPrice`, {
                            valueAsNumber: true,
                          })}
                          min="0"
                          step="1"
                          disabled={isPending}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm align-middle">
                        {format.number(lineAmount, {
                          style: "currency",
                          currency: "TWD",
                          maximumFractionDigits: 0,
                        })}
                      </TableCell>
                      <TableCell className="align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={isPending}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="p-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  productName: "",
                  quantity: 1,
                  unitPrice: 0,
                  isTaxable: true,
                })
              }
              disabled={isPending}
            >
              <Plus className="h-4 w-4 mr-2" /> {t("actions.addItem")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totals Section */}
      <div className="flex justify-end">
        <Card className="w-full md:w-[350px]">
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("summary.subtotal")}:
              </span>
              <span className="font-medium">
                {format.number(financials.subtotal / 100, {
                  style: "currency",
                  currency: "TWD",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {t("summary.taxRate")} (%):
              </span>
              <Input
                type="number"
                {...form.register("taxRate", { valueAsNumber: true })}
                className="w-20 h-8 text-right"
                step="0.01"
                min="0"
                disabled={isPending}
              />
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("summary.taxAmount")}:
              </span>
              <span className="font-medium">
                {format.number(financials.taxAmount / 100, {
                  style: "currency",
                  currency: "TWD",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>

            <div className="border-t pt-4 flex justify-between items-center">
              <span className="font-bold text-lg">{t("summary.total")}:</span>
              <span className="font-bold text-2xl text-primary">
                {format.number(financials.totalAmount / 100, {
                  style: "currency",
                  currency: "TWD",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-center justify-between border-t pt-6 mt-8 gap-4">
        <Button
          type="button"
          variant="ghost"
          onClick={handleCancel}
          disabled={isPending}
          className="w-full sm:w-auto text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("actions.cancel")}
        </Button>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto min-w-[150px] shadow-sm"
            disabled={isPending}
          >
            {isPending ? (
              <span className="animate-pulse">{t("actions.saving")}</span>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {initialData?.id ? t("actions.update") : t("actions.save")}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

// 輔助 FormField 元件
interface FormFieldProps {
  label: string;
  name: any; // 使用 any 避免過度嚴格的型別檢查，解決路徑推斷報錯
  register: UseFormRegister<QuoteFormData>;
  error?: FieldError;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

function FormField({
  label,
  name,
  register,
  error,
  type = "text",
  disabled,
  required,
  placeholder,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      <Input
        {...register(name)}
        type={type}
        disabled={disabled}
        placeholder={placeholder}
        className={
          error ? "border-destructive focus-visible:ring-destructive" : ""
        }
      />
      {error && (
        <p className="text-destructive text-xs font-medium animate-in fade-in-0 slide-in-from-top-1">
          {error.message}
        </p>
      )}
    </div>
  );
}
