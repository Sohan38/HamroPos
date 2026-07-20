import { v4 as uuidv4 } from 'uuid';
import { Product, ProductBatch, Supplier, Customer, PurchaseInvoice, SaleInvoice, Expense, HotelRoom } from '@/types';

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

// ─── Suppliers ────────────────────────────────────────────────────────────────
export const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1', name: 'Himalayan Distributors', phone: '9841000001',
    email: 'himalayan@example.com', address: 'New Road, Kathmandu',
    vatPan: '300001234', notes: 'Primary FMCG supplier',
    createdAt: daysAgo(90), updatedAt: daysAgo(90), deletedAt: null, version: 1,
  },
  {
    id: 'sup-2', name: 'Nepal Traders Pvt. Ltd.', phone: '9841000002',
    email: 'nepaltrade@example.com', address: 'Putalisadak, Kathmandu',
    vatPan: '300005678', notes: 'Electronics & stationery',
    createdAt: daysAgo(60), updatedAt: daysAgo(60), deletedAt: null, version: 1,
  },
  {
    id: 'sup-3', name: 'Kathmandu Wholesale Market', phone: '9851000003',
    email: 'kwm@example.com', address: 'Kalimati, Kathmandu',
    vatPan: '300009012', notes: 'Beverages and snacks',
    createdAt: daysAgo(45), updatedAt: daysAgo(45), deletedAt: null, version: 1,
  },
];

// ─── Products ─────────────────────────────────────────────────────────────────
export const SEED_PRODUCTS: Product[] = [
  {
    id: 'prd-1', barcode: '8901058857304', name: 'Wai Wai Noodles',
    category: 'Food', brand: 'CG Foods', supplierId: 'sup-1', supplierIds: ['sup-1', 'sup-3'],
    unit: 'packet', quantity: 120, minimumStock: 20,
    purchaseRate: 18, sellingRate: 25, profitPerUnit: 7, notes: '',
    createdAt: daysAgo(60), updatedAt: daysAgo(2), deletedAt: null, version: 3,
  },
  {
    id: 'prd-2', barcode: '8901396018556', name: 'Coca-Cola 500ml',
    category: 'Beverages', brand: 'Coca-Cola', supplierId: 'sup-3', supplierIds: ['sup-3'],
    unit: 'bottle', quantity: 48, minimumStock: 12,
    purchaseRate: 55, sellingRate: 75, profitPerUnit: 20, notes: '',
    createdAt: daysAgo(50), updatedAt: daysAgo(1), deletedAt: null, version: 4,
  },
  {
    id: 'prd-3', barcode: '8901030872931', name: 'Parle-G Biscuit 200g',
    category: 'Food', brand: 'Parle', supplierId: 'sup-1', supplierIds: ['sup-1'],
    unit: 'packet', quantity: 75, minimumStock: 15,
    purchaseRate: 35, sellingRate: 50, profitPerUnit: 15, notes: '',
    createdAt: daysAgo(55), updatedAt: daysAgo(3), deletedAt: null, version: 2,
  },
  {
    id: 'prd-4', barcode: '8901030852352', name: 'Tata Salt 1kg',
    category: 'Grocery', brand: 'Tata', supplierId: 'sup-1', supplierIds: ['sup-1', 'sup-2'],
    unit: 'packet', quantity: 60, minimumStock: 10,
    purchaseRate: 18, sellingRate: 28, profitPerUnit: 10, notes: '',
    createdAt: daysAgo(55), updatedAt: daysAgo(4), deletedAt: null, version: 2,
  },
  {
    id: 'prd-5', barcode: '8901063027734', name: 'Sunflower Oil 1L',
    category: 'Grocery', brand: 'Fortune', supplierId: 'sup-1', supplierIds: ['sup-1'],
    unit: 'bottle', quantity: 8, minimumStock: 10,
    purchaseRate: 195, sellingRate: 240, profitPerUnit: 45, notes: 'Low stock — order soon',
    createdAt: daysAgo(40), updatedAt: daysAgo(1), deletedAt: null, version: 5,
  },
  {
    id: 'prd-6', barcode: '8901234567890', name: 'Reynolds Pen Blue',
    category: 'Stationery', brand: 'Reynolds', supplierId: 'sup-2', supplierIds: ['sup-2'],
    unit: 'pcs', quantity: 200, minimumStock: 30,
    purchaseRate: 8, sellingRate: 15, profitPerUnit: 7, notes: '',
    createdAt: daysAgo(45), updatedAt: daysAgo(5), deletedAt: null, version: 2,
  },
  {
    id: 'prd-7', barcode: '8901030821977', name: 'Surf Excel 500g',
    category: 'Household', brand: 'HUL', supplierId: 'sup-1', supplierIds: ['sup-1'],
    unit: 'packet', quantity: 35, minimumStock: 8,
    purchaseRate: 85, sellingRate: 115, profitPerUnit: 30, notes: '',
    createdAt: daysAgo(50), updatedAt: daysAgo(6), deletedAt: null, version: 2,
  },
  {
    id: 'prd-8', barcode: '8901396095213', name: 'Sprite 500ml',
    category: 'Beverages', brand: 'Coca-Cola', supplierId: 'sup-3', supplierIds: ['sup-3'],
    unit: 'bottle', quantity: 36, minimumStock: 12,
    purchaseRate: 50, sellingRate: 70, profitPerUnit: 20, notes: '',
    createdAt: daysAgo(30), updatedAt: daysAgo(2), deletedAt: null, version: 2,
  },
  {
    id: 'prd-9', barcode: '8901030885909', name: 'Lays Classic 52g',
    category: 'Snacks', brand: "Lay's", supplierId: 'sup-3', supplierIds: ['sup-3', 'sup-1'],
    unit: 'packet', quantity: 4, minimumStock: 15,
    purchaseRate: 22, sellingRate: 35, profitPerUnit: 13, notes: '',
    createdAt: daysAgo(35), updatedAt: daysAgo(1), deletedAt: null, version: 3,
  },
  {
    id: 'prd-10', barcode: '8904109400032', name: 'Dettol Hand Wash 200ml',
    category: 'Household', brand: 'Dettol', supplierId: 'sup-1', supplierIds: ['sup-1'],
    unit: 'bottle', quantity: 22, minimumStock: 5,
    purchaseRate: 110, sellingRate: 150, profitPerUnit: 40, notes: '',
    createdAt: daysAgo(28), updatedAt: daysAgo(7), deletedAt: null, version: 2,
  },
  {
    id: 'prd-11', barcode: '8906042491034', name: 'Notebook A4 200 Pages',
    category: 'Stationery', brand: 'Navneet', supplierId: 'sup-2', supplierIds: ['sup-2'],
    unit: 'pcs', quantity: 45, minimumStock: 10,
    purchaseRate: 120, sellingRate: 180, profitPerUnit: 60, notes: '',
    createdAt: daysAgo(25), updatedAt: daysAgo(3), deletedAt: null, version: 2,
  },
  {
    id: 'prd-12', barcode: '8901030845484', name: 'Maggi 2-Minute Noodles',
    category: 'Food', brand: 'Nestle', supplierId: 'sup-1', supplierIds: ['sup-1', 'sup-3'],
    unit: 'packet', quantity: 95, minimumStock: 20,
    purchaseRate: 14, sellingRate: 22, profitPerUnit: 8, notes: '',
    createdAt: daysAgo(50), updatedAt: daysAgo(2), deletedAt: null, version: 4,
  },
];

// ─── Customers ────────────────────────────────────────────────────────────────
export const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1', name: 'Rajesh Sharma', phone: '9841111111',
    address: 'Baneshwor, Kathmandu', email: 'rajesh@example.com', notes: 'Regular customer',
    createdAt: daysAgo(80), updatedAt: daysAgo(80), deletedAt: null, version: 1,
  },
  {
    id: 'cust-2', name: 'Sunita Thapa', phone: '9841222222',
    address: 'Lalitpur-3', email: '', notes: '',
    createdAt: daysAgo(70), updatedAt: daysAgo(70), deletedAt: null, version: 1,
  },
  {
    id: 'cust-3', name: 'Bikas KC', phone: '9851333333',
    address: 'Bhaktapur', email: 'bikas@example.com', notes: 'Wholesale buyer',
    createdAt: daysAgo(60), updatedAt: daysAgo(60), deletedAt: null, version: 1,
  },
  {
    id: 'cust-4', name: 'Manisha Rai', phone: '9861444444',
    address: 'Thamel, Kathmandu', email: '', notes: '',
    createdAt: daysAgo(45), updatedAt: daysAgo(45), deletedAt: null, version: 1,
  },
  {
    id: 'cust-5', name: 'Prakash Gurung', phone: '9841555555',
    address: 'Pokhara-8', email: 'prakash@example.com', notes: '',
    createdAt: daysAgo(30), updatedAt: daysAgo(30), deletedAt: null, version: 1,
  },
];

// ─── Purchases ────────────────────────────────────────────────────────────────
export const SEED_PURCHASES: PurchaseInvoice[] = [
  {
    id: 'pur-1', invoiceNumber: 'SUP-2024-001', supplierId: 'sup-1',
    date: daysAgo(25),
    items: [
      { productId: 'prd-1', productName: 'Wai Wai Noodles', quantity: 50, purchaseRate: 18, subtotal: 900 },
      { productId: 'prd-3', productName: 'Parle-G Biscuit 200g', quantity: 30, purchaseRate: 35, subtotal: 1050 },
      { productId: 'prd-12', productName: 'Maggi 2-Minute Noodles', quantity: 40, purchaseRate: 14, subtotal: 560 },
    ],
    discount: 100, tax: 0, grandTotal: 2410, paymentMethod: 'cash', notes: '',
    createdAt: daysAgo(25), updatedAt: daysAgo(25), deletedAt: null, version: 1,
  },
  {
    id: 'pur-2', invoiceNumber: 'SUP-2024-002', supplierId: 'sup-3',
    date: daysAgo(20),
    items: [
      { productId: 'prd-2', productName: 'Coca-Cola 500ml', quantity: 24, purchaseRate: 55, subtotal: 1320 },
      { productId: 'prd-8', productName: 'Sprite 500ml', quantity: 24, purchaseRate: 50, subtotal: 1200 },
      { productId: 'prd-9', productName: 'Lays Classic 52g', quantity: 30, purchaseRate: 22, subtotal: 660 },
    ],
    discount: 0, tax: 0, grandTotal: 3180, paymentMethod: 'qr', notes: '',
    createdAt: daysAgo(20), updatedAt: daysAgo(20), deletedAt: null, version: 1,
  },
  {
    id: 'pur-3', invoiceNumber: 'SUP-2024-003', supplierId: 'sup-2',
    date: daysAgo(14),
    items: [
      { productId: 'prd-6', productName: 'Reynolds Pen Blue', quantity: 100, purchaseRate: 8, subtotal: 800 },
      { productId: 'prd-11', productName: 'Notebook A4 200 Pages', quantity: 20, purchaseRate: 120, subtotal: 2400 },
    ],
    discount: 200, tax: 0, grandTotal: 3000, paymentMethod: 'bank', notes: 'Monthly stationery order',
    createdAt: daysAgo(14), updatedAt: daysAgo(14), deletedAt: null, version: 1,
  },
  {
    id: 'pur-4', invoiceNumber: 'SUP-2024-004', supplierId: 'sup-1',
    date: daysAgo(7),
    items: [
      { productId: 'prd-4', productName: 'Tata Salt 1kg', quantity: 25, purchaseRate: 18, subtotal: 450 },
      { productId: 'prd-5', productName: 'Sunflower Oil 1L', quantity: 10, purchaseRate: 195, subtotal: 1950 },
      { productId: 'prd-7', productName: 'Surf Excel 500g', quantity: 15, purchaseRate: 85, subtotal: 1275 },
      { productId: 'prd-10', productName: 'Dettol Hand Wash 200ml', quantity: 12, purchaseRate: 110, subtotal: 1320 },
    ],
    discount: 0, tax: 0, grandTotal: 4995, paymentMethod: 'cash', notes: '',
    createdAt: daysAgo(7), updatedAt: daysAgo(7), deletedAt: null, version: 1,
  },
  {
    id: 'pur-5', invoiceNumber: 'SUP-2024-005', supplierId: 'sup-3',
    date: daysAgo(2),
    items: [
      { productId: 'prd-2', productName: 'Coca-Cola 500ml', quantity: 24, purchaseRate: 55, subtotal: 1320 },
      { productId: 'prd-9', productName: 'Lays Classic 52g', quantity: 30, purchaseRate: 22, subtotal: 660 },
    ],
    discount: 0, tax: 0, grandTotal: 1980, paymentMethod: 'cash', notes: '',
    createdAt: daysAgo(2), updatedAt: daysAgo(2), deletedAt: null, version: 1,
  },
];

// ─── Sales ────────────────────────────────────────────────────────────────────
function makeSale(
  id: string, dAgo: number, customerId: string | null,
  items: SaleInvoice['items'], discount: number, tax: number, paymentMethod: SaleInvoice['paymentMethod']
): SaleInvoice {
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const grandTotal = subtotal - discount + tax;
  return {
    id, customerId, date: daysAgo(dAgo), items, discount, tax, grandTotal,
    paidAmount: grandTotal, paymentMethod, notes: '',
    createdAt: daysAgo(dAgo), updatedAt: daysAgo(dAgo), deletedAt: null, version: 1,
  };
}

export const SEED_SALES: SaleInvoice[] = [
  makeSale('sal-1', 28, 'cust-1', [
    { productId: 'prd-1', productName: 'Wai Wai Noodles', quantity: 5, sellingRate: 25, subtotal: 125 },
    { productId: 'prd-2', productName: 'Coca-Cola 500ml', quantity: 3, sellingRate: 75, subtotal: 225 },
  ], 0, 0, 'cash'),
  makeSale('sal-2', 25, 'cust-2', [
    { productId: 'prd-3', productName: 'Parle-G Biscuit 200g', quantity: 4, sellingRate: 50, subtotal: 200 },
    { productId: 'prd-12', productName: 'Maggi 2-Minute Noodles', quantity: 6, sellingRate: 22, subtotal: 132 },
    { productId: 'prd-4', productName: 'Tata Salt 1kg', quantity: 2, sellingRate: 28, subtotal: 56 },
  ], 0, 0, 'cash'),
  makeSale('sal-3', 22, 'cust-3', [
    { productId: 'prd-6', productName: 'Reynolds Pen Blue', quantity: 20, sellingRate: 15, subtotal: 300 },
    { productId: 'prd-11', productName: 'Notebook A4 200 Pages', quantity: 5, sellingRate: 180, subtotal: 900 },
  ], 50, 0, 'qr'),
  makeSale('sal-4', 18, null, [
    { productId: 'prd-7', productName: 'Surf Excel 500g', quantity: 3, sellingRate: 115, subtotal: 345 },
    { productId: 'prd-10', productName: 'Dettol Hand Wash 200ml', quantity: 2, sellingRate: 150, subtotal: 300 },
  ], 0, 0, 'cash'),
  makeSale('sal-5', 15, 'cust-1', [
    { productId: 'prd-1', productName: 'Wai Wai Noodles', quantity: 10, sellingRate: 25, subtotal: 250 },
    { productId: 'prd-8', productName: 'Sprite 500ml', quantity: 6, sellingRate: 70, subtotal: 420 },
    { productId: 'prd-9', productName: 'Lays Classic 52g', quantity: 4, sellingRate: 35, subtotal: 140 },
  ], 0, 0, 'cash'),
  makeSale('sal-6', 12, 'cust-4', [
    { productId: 'prd-5', productName: 'Sunflower Oil 1L', quantity: 3, sellingRate: 240, subtotal: 720 },
    { productId: 'prd-4', productName: 'Tata Salt 1kg', quantity: 3, sellingRate: 28, subtotal: 84 },
  ], 0, 0, 'cash'),
  makeSale('sal-7', 9, null, [
    { productId: 'prd-2', productName: 'Coca-Cola 500ml', quantity: 8, sellingRate: 75, subtotal: 600 },
    { productId: 'prd-8', productName: 'Sprite 500ml', quantity: 8, sellingRate: 70, subtotal: 560 },
  ], 0, 0, 'qr'),
  makeSale('sal-8', 7, 'cust-5', [
    { productId: 'prd-12', productName: 'Maggi 2-Minute Noodles', quantity: 12, sellingRate: 22, subtotal: 264 },
    { productId: 'prd-1', productName: 'Wai Wai Noodles', quantity: 8, sellingRate: 25, subtotal: 200 },
    { productId: 'prd-3', productName: 'Parle-G Biscuit 200g', quantity: 6, sellingRate: 50, subtotal: 300 },
  ], 30, 0, 'cash'),
  makeSale('sal-9', 4, 'cust-2', [
    { productId: 'prd-6', productName: 'Reynolds Pen Blue', quantity: 10, sellingRate: 15, subtotal: 150 },
    { productId: 'prd-11', productName: 'Notebook A4 200 Pages', quantity: 3, sellingRate: 180, subtotal: 540 },
  ], 0, 0, 'card'),
  makeSale('sal-10', 2, null, [
    { productId: 'prd-10', productName: 'Dettol Hand Wash 200ml', quantity: 2, sellingRate: 150, subtotal: 300 },
    { productId: 'prd-7', productName: 'Surf Excel 500g', quantity: 2, sellingRate: 115, subtotal: 230 },
    { productId: 'prd-2', productName: 'Coca-Cola 500ml', quantity: 4, sellingRate: 75, subtotal: 300 },
  ], 0, 0, 'cash'),
  // Today's sales
  makeSale('sal-11', 0, 'cust-1', [
    { productId: 'prd-1', productName: 'Wai Wai Noodles', quantity: 4, sellingRate: 25, subtotal: 100 },
    { productId: 'prd-2', productName: 'Coca-Cola 500ml', quantity: 2, sellingRate: 75, subtotal: 150 },
    { productId: 'prd-12', productName: 'Maggi 2-Minute Noodles', quantity: 3, sellingRate: 22, subtotal: 66 },
  ], 0, 0, 'cash'),
  makeSale('sal-12', 0, null, [
    { productId: 'prd-9', productName: 'Lays Classic 52g', quantity: 2, sellingRate: 35, subtotal: 70 },
    { productId: 'prd-8', productName: 'Sprite 500ml', quantity: 3, sellingRate: 70, subtotal: 210 },
  ], 0, 0, 'qr'),
];

// ─── Expenses ─────────────────────────────────────────────────────────────────
export const SEED_EXPENSES = [
  {
    id: 'exp-1', date: daysAgo(28), category: 'electricity' as const,
    description: 'Monthly electricity bill', amount: 1800, paymentMethod: 'cash' as const, notes: '',
    createdAt: daysAgo(28), updatedAt: daysAgo(28), deletedAt: null, version: 1,
  },
  {
    id: 'exp-2', date: daysAgo(20), category: 'internet' as const,
    description: 'Broadband monthly plan', amount: 1200, paymentMethod: 'qr' as const, notes: '',
    createdAt: daysAgo(20), updatedAt: daysAgo(20), deletedAt: null, version: 1,
  },
  {
    id: 'exp-3', date: daysAgo(15), category: 'salary' as const,
    description: 'Staff salary - Ram Bahadur', amount: 12000, paymentMethod: 'bank' as const, notes: '',
    createdAt: daysAgo(15), updatedAt: daysAgo(15), deletedAt: null, version: 1,
  },
  {
    id: 'exp-4', date: daysAgo(8), category: 'maintenance' as const,
    description: 'Shop repairs', amount: 3500, paymentMethod: 'cash' as const, notes: 'Fixed broken shelf',
    createdAt: daysAgo(8), updatedAt: daysAgo(8), deletedAt: null, version: 1,
  },
  {
    id: 'exp-5', date: daysAgo(3), category: 'fuel' as const,
    description: 'Delivery vehicle fuel', amount: 800, paymentMethod: 'cash' as const, notes: '',
    createdAt: daysAgo(3), updatedAt: daysAgo(3), deletedAt: null, version: 1,
  },
  {
    id: 'exp-6', date: new Date().toISOString(), category: 'miscellaneous' as const,
    description: 'Office supplies', amount: 450, paymentMethod: 'cash' as const, notes: '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null, version: 1,
  },
];

// ─── Product Batches ──────────────────────────────────────────────────────────
// Perishable products get realistic batches with different suppliers & dates.
// Some batches expire soon or are already expired so the UI badges are visible.
const mfgDate = (daysAgoN: number) =>
  new Date(now.getTime() - daysAgoN * 86400000).toISOString().split('T')[0];
const expDate = (daysFromNow: number) =>
  new Date(now.getTime() + daysFromNow * 86400000).toISOString().split('T')[0];

export const SEED_BATCHES: ProductBatch[] = [
  // ── Wai Wai Noodles (prd-1) – 2 batches, sup-1 & sup-3 ─────────────────
  {
    id: 'batch-1', productId: 'prd-1', supplierId: 'sup-1',
    batchNumber: 'B-2024-001', manufacturingDate: mfgDate(60),
    expiryMonths: 9, expiryDate: expDate(210),     // good
    initialQuantity: 80, quantity: 64, purchaseRate: 18, notes: '',
    createdAt: daysAgo(60), updatedAt: daysAgo(2), deletedAt: null, version: 2,
  },
  {
    id: 'batch-2', productId: 'prd-1', supplierId: 'sup-3',
    batchNumber: 'B-2024-002', manufacturingDate: mfgDate(30),
    expiryMonths: 9, expiryDate: expDate(240),     // good
    initialQuantity: 60, quantity: 56, purchaseRate: 18, notes: '',
    createdAt: daysAgo(30), updatedAt: daysAgo(1), deletedAt: null, version: 2,
  },

  // ── Coca-Cola 500ml (prd-2) – 2 batches ─────────────────────────────────
  {
    id: 'batch-3', productId: 'prd-2', supplierId: 'sup-3',
    batchNumber: 'B-2024-003', manufacturingDate: mfgDate(25),
    expiryMonths: 12, expiryDate: expDate(340),    // good
    initialQuantity: 50, quantity: 36, purchaseRate: 55, notes: '',
    createdAt: daysAgo(25), updatedAt: daysAgo(1), deletedAt: null, version: 3,
  },
  {
    id: 'batch-4', productId: 'prd-2', supplierId: 'sup-3',
    batchNumber: 'B-2024-004', manufacturingDate: mfgDate(20),
    expiryMonths: 12, expiryDate: expDate(345),    // good
    initialQuantity: 24, quantity: 12, purchaseRate: 55, notes: '',
    createdAt: daysAgo(20), updatedAt: daysAgo(1), deletedAt: null, version: 2,
  },

  // ── Parle-G Biscuit (prd-3) – 1 batch expiring soon ─────────────────────
  {
    id: 'batch-5', productId: 'prd-3', supplierId: 'sup-1',
    batchNumber: 'B-2024-005', manufacturingDate: mfgDate(150),
    expiryMonths: 6, expiryDate: expDate(20),      // expiring soon (within 30 days)
    initialQuantity: 100, quantity: 75, purchaseRate: 35, notes: 'Check before sale',
    createdAt: daysAgo(150), updatedAt: daysAgo(3), deletedAt: null, version: 2,
  },

  // ── Sunflower Oil 1L (prd-5) – 1 batch already expired ──────────────────
  {
    id: 'batch-6', productId: 'prd-5', supplierId: 'sup-1',
    batchNumber: 'B-2024-006', manufacturingDate: mfgDate(400),
    expiryMonths: 12, expiryDate: expDate(-40),    // EXPIRED 40 days ago
    initialQuantity: 20, quantity: 8, purchaseRate: 195, notes: 'Do not sell — expired',
    createdAt: daysAgo(400), updatedAt: daysAgo(40), deletedAt: null, version: 3,
  },

  // ── Lays Classic 52g (prd-9) – expiring soon ────────────────────────────
  {
    id: 'batch-7', productId: 'prd-9', supplierId: 'sup-3',
    batchNumber: 'B-2024-007', manufacturingDate: mfgDate(90),
    expiryMonths: 3, expiryDate: expDate(0),       // expires today!
    initialQuantity: 50, quantity: 4, purchaseRate: 22, notes: '',
    createdAt: daysAgo(90), updatedAt: daysAgo(1), deletedAt: null, version: 3,
  },

  // ── Maggi (prd-12) – 2 batches from different suppliers ─────────────────
  {
    id: 'batch-8', productId: 'prd-12', supplierId: 'sup-1',
    batchNumber: 'B-2024-008', manufacturingDate: mfgDate(50),
    expiryMonths: 12, expiryDate: expDate(315),    // good
    initialQuantity: 60, quantity: 48, purchaseRate: 14, notes: '',
    createdAt: daysAgo(50), updatedAt: daysAgo(2), deletedAt: null, version: 2,
  },
  {
    id: 'batch-9', productId: 'prd-12', supplierId: 'sup-3',
    batchNumber: 'B-2024-009', manufacturingDate: mfgDate(20),
    expiryMonths: 12, expiryDate: expDate(345),    // good
    initialQuantity: 50, quantity: 47, purchaseRate: 14, notes: '',
    createdAt: daysAgo(20), updatedAt: daysAgo(1), deletedAt: null, version: 2,
  },

  // ── Dettol Hand Wash (prd-10) – expiring soon ───────────────────────────
  {
    id: 'batch-10', productId: 'prd-10', supplierId: 'sup-1',
    batchNumber: 'B-2024-010', manufacturingDate: mfgDate(300),
    expiryMonths: 12, expiryDate: expDate(15),     // expiring in 15 days
    initialQuantity: 30, quantity: 22, purchaseRate: 110, notes: 'Sell first — expiring soon',
    createdAt: daysAgo(300), updatedAt: daysAgo(7), deletedAt: null, version: 2,
  },
];

// ─── Hotel Rooms ──────────────────────────────────────────────────────────────
export const SEED_HOTEL_ROOMS: HotelRoom[] = [
  {
    id: 'room-1', roomNumber: '101', roomType: 'Standard', floor: 1, capacity: 2,
    status: 'occupied', currentGuestName: 'Arjun Patel', currentCheckIn: daysAgo(2),
    currentCheckOut: daysAgo(-1), ratePerNight: 1500, notes: 'Garden view',
    createdAt: daysAgo(60), updatedAt: daysAgo(2), deletedAt: null, version: 3,
  },
  {
    id: 'room-2', roomNumber: '102', roomType: 'Standard', floor: 1, capacity: 2,
    status: 'available', currentGuestName: null, currentCheckIn: null,
    currentCheckOut: null, ratePerNight: 1500, notes: '',
    createdAt: daysAgo(60), updatedAt: daysAgo(5), deletedAt: null, version: 2,
  },
  {
    id: 'room-3', roomNumber: '201', roomType: 'Deluxe', floor: 2, capacity: 3,
    status: 'reserved', currentGuestName: 'Sita Maharjan', currentCheckIn: daysAgo(-1),
    currentCheckOut: daysAgo(-3), ratePerNight: 2500, notes: 'Mountain view',
    createdAt: daysAgo(55), updatedAt: daysAgo(1), deletedAt: null, version: 2,
  },
  {
    id: 'room-4', roomNumber: '202', roomType: 'Deluxe', floor: 2, capacity: 3,
    status: 'cleaning', currentGuestName: null, currentCheckIn: null,
    currentCheckOut: null, ratePerNight: 2500, notes: 'Being cleaned after checkout',
    createdAt: daysAgo(55), updatedAt: new Date().toISOString(), deletedAt: null, version: 4,
  },
  {
    id: 'room-5', roomNumber: '301', roomType: 'Suite', floor: 3, capacity: 4,
    status: 'available', currentGuestName: null, currentCheckIn: null,
    currentCheckOut: null, ratePerNight: 5000, notes: 'Penthouse suite, panoramic view',
    createdAt: daysAgo(50), updatedAt: daysAgo(10), deletedAt: null, version: 2,
  },
];
