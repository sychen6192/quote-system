"use client";

import { useState } from "react";
import { useRouter } from "@/navigation";
import {
  useForm,
  useFieldArray,
  useWatch,
  Path,
  UseFormRegister,
  FieldError,
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

interface QuoteFormProps {
  initialData: QuoteFormData & { id?: number };
}

export default function QuoteForm({ initialData }: QuoteFormProps) {
  const t = useTranslations("QuoteForm");
  const format = useFormatter();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  // ✅ 1. 初始化 Form (這裡就是原本缺少的定義)
  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: initialData,
  });

  // ✅ 2. 處理動態列表
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // ✅ 3. 即時計算金額邏輯
  const items = useWatch({ control: form.control, name: "items" });
  const taxRate = useWatch({ control: form.control, name: "taxRate" }) || 0;

  // 使用 reduce 計算小計，確保數值安全
  const subtotal = items.reduce((acc, item) => {
    const qty = Math.floor(Number(item.quantity) || 0);
    const price = Math.floor(Number(item.unitPrice) || 0);
    return acc + qty * price;
  }, 0);

  const taxAmount = Math.round(subtotal * (Number(taxRate) / 100));
  const total = Math.round(subtotal + taxAmount);

  // ✅ 4. 送出表單邏輯
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
        router.push("/");
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
      // ✅ 5. 間距優化 (手機版)
      className="space-y-8 max-w-5xl mx-auto py-4 md:py-10 px-4 md:px-0"
    >
      {/* --- Section 1: Header --- */}
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

      {/* --- Section 2: Customer Details --- */}
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
            required
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
            required
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

          {/* Address */}
          <div className="col-span-1 md:col-span-2 space-y-2">
            <label className="text-sm font-medium">
              {t("fields.address")} <span className="text-destructive">*</span>
            </label>
            <Textarea
              {...form.register("address")}
              rows={2}
              disabled={isPending}
              className={
                form.formState.errors.address ? "border-destructive" : ""
              }
            />
            {form.formState.errors.address && (
              <p className="text-destructive text-xs">
                {form.formState.errors.address.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- Section 3: Dates --- */}
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

      {/* --- Section 4: Items Table (Mobile Optimized) --- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("sections.items")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {/* ✅ 6. 加入橫向捲軸，防止手機版輸入框被擠扁 */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* ✅ 7. 設定 min-w 確保欄位不會消失 */}
                  <TableHead className="w-[40%] min-w-[200px] pl-4">
                    {t("table.product")}
                  </TableHead>
                  <TableHead className="w-[15%] min-w-[80px]">
                    {t("table.qty")}
                  </TableHead>
                  <TableHead className="w-[20%] min-w-[100px]">
                    {t("table.price")}
                  </TableHead>
                  <TableHead className="w-[20%] min-w-[100px] text-right">
                    {t("table.amount")}
                  </TableHead>
                  <TableHead className="w-[5%] min-w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
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
                      {format.number(
                        (items[index]?.quantity || 0) *
                          (items[index]?.unitPrice || 0),
                        {
                          style: "currency",
                          currency: "TWD",
                          maximumFractionDigits: 0,
                        }
                      )}
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
                ))}
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

      {/* --- Section 5: Totals --- */}
      <div className="flex justify-end">
        <Card className="w-full md:w-[350px]">
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("summary.subtotal")}:
              </span>
              <span className="font-medium">
                {format.number(subtotal, {
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
                disabled={isPending}
              />
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("summary.taxAmount")}:
              </span>
              <span className="font-medium">
                {format.number(taxAmount, {
                  style: "currency",
                  currency: "TWD",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>

            <div className="border-t pt-4 flex justify-between items-center">
              <span className="font-bold text-lg">{t("summary.total")}:</span>
              <span className="font-bold text-2xl text-primary">
                {format.number(total, {
                  style: "currency",
                  currency: "TWD",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Section 6: Bottom Actions --- */}
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

// ------------------------------------------------------------
// Type-Safe Sub-Component: FormField
// ------------------------------------------------------------
interface FormFieldProps {
  label: string;
  name: Path<QuoteFormData>;
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
