import { z } from 'zod';

const quoteItemSchema = z.object({
    productName: z.string().min(1, 'Product name is required'),
    quantity: z.coerce.number().min(1),
    unitPrice: z.coerce.number().min(0),
    isTaxable: z.boolean().default(true),
});

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
    taxRate: z.coerce.number().default(5),
    items: z.array(quoteItemSchema).min(1),
    notes: z.string().optional(),
});

export type QuoteFormData = z.infer<typeof quoteFormSchema>;