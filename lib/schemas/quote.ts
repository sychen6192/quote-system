import { z } from "zod";

export const quoteFormSchema = z.object({
    companyName: z.string().min(1, "Company name is required"),
    contactPerson: z.string().optional(),
    phone: z.string().optional(),

    // ✅ 修正：使用簡單的 optional + refine，避免複雜的 Union 型別讓 TS 混亂
    email: z.string().email("Invalid email address").optional().or(z.literal("")),

    address: z.string().optional(),
    vatNumber: z.string().optional(),
    salesperson: z.string().min(1, "Salesperson is required"),

    issuedDate: z.string(),
    validUntil: z.string(),
    shippingDate: z.string().optional(),
    paymentMethod: z.string().optional(),
    shippingMethod: z.string().optional(),

    // ✅ 確保數字轉換
    taxRate: z.coerce.number().min(0).default(5),
    notes: z.string().optional(),

    items: z.array(
        z.object({
            productName: z.string().min(1, "Product name is required"),
            // ✅ 確保數字轉換，避免 HTML Input 傳回字串導致錯誤
            quantity: z.coerce.number().min(1, "Qty must be > 0"),
            unitPrice: z.coerce.number().min(0, "Price must be >= 0"),
            isTaxable: z.boolean().default(false),
        })
    ).default([]),
});

export type QuoteFormData = z.infer<typeof quoteFormSchema>;