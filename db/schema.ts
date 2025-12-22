import { pgTable, serial, text, integer, boolean, timestamp, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Customers Table
export const customers = pgTable('customers', {
    id: serial('id').primaryKey(),
    companyName: text('company_name').notNull(),
    contactPerson: text('contact_person'),
    phone: text('phone'),
    address: text('address'),
    vatNumber: text('vat_number'),
    email: text('email'),
    createdAt: timestamp('created_at').defaultNow(),
});

// 2. Quotations Table
export const quotations = pgTable('quotations', {
    id: serial('id').primaryKey(),
    quotationNumber: text('quotation_number').notNull().unique(),
    customerId: integer('customer_id').references(() => customers.id),
    salesperson: text('salesperson').notNull(),
    issuedDate: date('issued_date').defaultNow(),
    validUntil: date('valid_until').notNull(),
    shippingDate: date('shipping_date'),
    paymentMethod: text('payment_method'),
    shippingMethod: text('shipping_method'),
    // Financials stored in Cents (Integer)
    subtotal: integer('subtotal').notNull().default(0),
    taxRate: integer('tax_rate').default(500), // 500 = 5.00%
    taxAmount: integer('tax_amount').notNull().default(0),
    otherFees: integer('other_fees').default(0),
    totalAmount: integer('total_amount').notNull().default(0),
    status: text('status', { enum: ['draft', 'sent', 'accepted', 'rejected'] }).default('draft'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
});

// 3. Quotation Items Table
export const quotationItems = pgTable('quotation_items', {
    id: serial('id').primaryKey(),
    quotationId: integer('quotation_id').references(() => quotations.id, { onDelete: 'cascade' }),
    productName: text('product_name').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull(), // Stored in Cents
    isTaxable: boolean('is_taxable').default(true),
});

// Relations
export const quotationsRelations = relations(quotations, ({ one, many }) => ({
    customer: one(customers, { fields: [quotations.customerId], references: [customers.id] }),
    items: many(quotationItems),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
    quotation: one(quotations, { fields: [quotationItems.quotationId], references: [quotations.id] }),
}));