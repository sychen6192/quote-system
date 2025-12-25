import { z } from 'zod';

export const quoteFormSchema = z.object({
    companyName: z.string().min(1, 'Company name is required'),
    contactPerson: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    vatNumber: z.string().optional(),
    salesperson: z.string().min(1, 'Salesperson is required'),
    issuedDate: z.string(),
    validUntil: z.string(),
    shippingDate: z.string().optional(),
    paymentMethod: z.string().optional(),
    shippingMethod: z.string().optional(),
    taxRate: z.coerce.number().min(0).default(5),
    notes: z.string().optional(),
    items: z.array(z.object({
        productName: z.string().min(1, "Product name is required."),
        quantity: z.coerce.number().min(1, "Qty must be larger than 0"),
        unitPrice: z.coerce.number().min(0, "Price must not be larger than 0"),
        isTaxable: z.boolean().default(false),
    })),
});

export type QuoteFormData = z.infer<typeof quoteFormSchema>;