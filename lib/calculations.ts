export function calculateQuoteTotals(items: { quantity: number; unitPrice: number }[], taxRate: number = 0) {
    const subtotal = items.reduce((acc, item) => {
        return acc + (item.quantity * item.unitPrice);
    }, 0);

    const taxAmount = Math.round(subtotal * (taxRate / 100));

    const totalAmount = subtotal + taxAmount;

    return { subtotal, taxAmount, totalAmount };
}