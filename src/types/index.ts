export interface StorageRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
  syncStatus?: 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';
  lastSyncedAt?: string | null;
  deviceId?: string;
}

export interface Location extends StorageRecord {
  name: string;
  code?: string;
  isDefault?: boolean;
  notes?: string;
}

export type ProductUnit = 'pcs' | 'packet' | 'box' | 'bottle' | 'kg' | 'gram' | 'litre' | 'ml' | 'plate' | 'cup' | 'glass' | 'meter' | 'roll' | 'dozen' | 'custom';

export interface Product extends StorageRecord {
  barcode: string;
  name: string;
  category: string;
  brand: string;
  supplierId: string;
  supplierIds?: string[]; // multiple suppliers support
  unit: ProductUnit;
  quantity: number;
  minimumStock: number;
  purchaseRate: number;
  sellingRate: number;
  profitPerUnit: number;
  hasExpiry?: boolean;    // does this product have expiry dates?
  hasVariants?: boolean;  // does this product have variants (size, color, etc)?
  variants?: Array<{ name: string; quantity: number }>;
  supplierStocks?: SupplierProductRecord[]; // per-supplier stock (drives total when multiple suppliers)
  notes: string;
  imageBase64?: string;
}

/** A single received batch of a product — tracks supplier, dates, and remaining qty */
export interface ProductBatch extends StorageRecord {
  productId: string;
  supplierId: string;            // which supplier this batch came from
  purchaseInvoiceId?: string;    // optional link to purchase invoice
  batchNumber: string;           // e.g. "B-2024-001"
  manufacturingDate: string | null;
  /** If set, expiryDate is auto-calculated as mfgDate + expiryMonths months */
  expiryMonths: number | null;
  expiryDate: string | null;     // final expiry (auto or manual)
  initialQuantity: number;       // how many entered stock in this batch
  quantity: number;              // remaining stock in this batch
  purchaseRate: number;
  notes: string;

}

export interface ProductBatchLocation extends StorageRecord {
  batchId: string;
  locationId: string;
  quantity: number;
  dateReceived?: string | null;
}

export type BatchFormData = Omit<
  ProductBatch,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "version"
>;

/** Per-supplier stock and cost data for a product */
export interface SupplierProductRecord {
  supplierId: string;
  locationId: string;       // effective identity for supplier stock in a product record
  supplierSku?: string;     // supplier's own SKU for this product
  cost: number;             // supplier-specific purchase cost
  stock: number;            // stock from this supplier at this location
  reorderLevel?: number;    // trigger a restock alert at this level
  lastPurchaseDate?: string;
  notes?: string;
}

export interface Supplier extends StorageRecord {
  name: string;
  contactPerson?: string;
  phone: string;
  email: string;
  address: string;
  vatPan: string;
  notes: string;
  status?: 'active' | 'inactive';
}

export interface Customer extends StorageRecord {
  name: string;
  phone: string;
  address: string;
  email: string;
  notes: string;
}

export type PaymentMethod = 'cash' | 'qr' | 'card' | 'bank' | 'split' | 'credit';

export type DispositionReason = 'expired' | 'damaged' | 'defective' | 'supplier_recall' | 'wrong_item_supplied' | 'other';
export type DispositionResolution = 'return_to_supplier' | 'supplier_replacement' | 'supplier_credit' | 'supplier_refund' | 'write_off' | 'reversal';
export type DispositionStatus = 'completed' | 'reversed';
export type DispositionSettlementType = 'none' | 'credit' | 'refund' | 'replacement';
export type DispositionSettlementStatus = 'pending' | 'completed' | 'cancelled';

export interface InventoryDisposition extends StorageRecord {
  referenceNumber: string;
  date: string;
  performedById: string | null;
  performedByName: string | null;
  reason: DispositionReason;
  resolution: DispositionResolution;
  status: DispositionStatus;
  productId: string;
  productName: string;
  batchId: string | null;
  batchNumber: string | null;
  purchaseInvoiceId: string | null;
  purchaseInvoiceNumber: string | null;
  supplierId: string | null;
  supplierName: string | null;
  quantity: number;
  unitCost: number;
  totalValue: number;
  settlementAmount: number;
  settlementMethod: PaymentMethod | null;
  settlementType: DispositionSettlementType;
  settlementStatus?: DispositionSettlementStatus | null;
  settlementReference?: string | null;
  settlementDate?: string | null;
  notes: string | null;
  reversalOfId: string | null;
  reversedById: string | null;
  replacementPurchaseInvoiceId: string | null;
  idempotencyKey: string | null;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  purchaseRate: number;
  subtotal: number;
  /** Optional variant selection for products that use variants. */
  variantName?: string;
  /** Optional receiving information used when the product tracks batches. */
  batchId?: string;
  batchNumber?: string;
  manufacturingDate?: string | null;
  expiryMonths?: number | null;
  expiryDate?: string | null;
  notes?: string;
}

export type PurchaseStatus = 'draft' | 'received' | 'cancelled';
export type PurchasePaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface PurchaseInvoice extends StorageRecord {
  invoiceNumber: string;
  supplierId: string;
  supplierName?: string | null;
  date: string;
  items: PurchaseItem[];
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  notes: string;
  referenceNumber?: string;
  status?: PurchaseStatus;
  paymentStatus?: PurchasePaymentStatus;
  paidAmount?: number;
  payments?: CreditPayment[];
}

export interface SaleCostAllocation {
  batchId: string;
  quantity: number;
  purchaseRate: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  sellingRate: number;
  subtotal: number;
  /** Optional variant selected at the POS (for example, Red or XL). */
  variantName?: string;
  /** Actual batch cost allocation used for this sale line when batched inventory is involved. */
  costAllocations?: SaleCostAllocation[];
}

export interface SaleInvoice extends StorageRecord {
  customerId: string | null;
  customerName?: string | null;
  date: string;
  items: SaleItem[];
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  splitPayments?: { method: PaymentMethod; amount: number }[];
  notes: string;
}

export interface HotelRoom extends StorageRecord {
  roomNumber: string;
  roomType: string;
  floor: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';
  currentGuestName: string | null;
  currentCheckIn: string | null;
  currentCheckOut: string | null;
  ratePerNight: number;
  notes: string;
  imageBase64?: string;
}

export interface HotelBillItem {
  description: string;
  category: 'food' | 'laundry' | 'drinks' | 'other';
  amount: number;
}

export interface HotelBill extends StorageRecord {
  invoiceNumber: string;
  guestName: string;
  phone: string;
  address: string;
  roomId: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  numberOfNights: number;
  roomCharge: number;
  additionalItems: HotelBillItem[];
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  notes: string;
}

export interface RestaurantItem {
  name: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface RestaurantBill extends StorageRecord {
  billNumber: string;
  tableNumber: string;
  date: string;
  items: RestaurantItem[];
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  notes: string;
}

export type ExpenseCategory = 'salary' | 'electricity' | 'water' | 'internet' | 'food' | 'fuel' | 'maintenance' | 'tax' | 'purchase' | 'miscellaneous';

export interface Expense extends StorageRecord {
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes: string;
  /** Optional link to a purchase that auto-generated this expense */
  sourcePurchaseId?: string;
}

export interface CashBookEntry extends StorageRecord {
  date: string;
  openingCash: number;
  cashIn: number;
  cashOut: number;
  closingCash: number;
  reason: string;
  notes: string;
}

export interface CreditPayment {
  date: string;
  amount: number;
  note: string;
}

export interface Credit extends StorageRecord {
  customerId: string;
  customerName: string;
  phone: string;
  description: string;
  amount: number;
  paidAmount: number;
  date: string;
  dueDate: string | null;
  status: 'pending' | 'partial' | 'paid';
  paidAt: string | null;
  notes: string;
  sourceSaleId?: string;
  payments: CreditPayment[];
}

export interface FeatureConfig {
  inventory: {
    batches: boolean;
    expiry: boolean;
    variants: boolean;
    serialNumbers: boolean;
    barcodeSupport: boolean;
    multiUnits: boolean;
  };
  sales: {
    returns: boolean;
    creditSales: boolean;
    discounts: boolean;
    layaway: boolean;
    quotations: boolean;
  };
  customers: {
    loyalty: boolean;
    membership: boolean;
  };
  hospitality: {
    hotelGrid: boolean;
    restaurantBilling: boolean;
  };
}

export interface AppSettings {
  businessName: string;
  businessLogoBase64: string | null;
  phone: string;
  address: string;
  vatNumber: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  lowStockThreshold: number;
  defaultLocationId?: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  features: FeatureConfig;
}

export type UserRole = 'admin' | 'manager' | 'cashier' | 'receptionist' | 'staff';

export interface AppUser extends StorageRecord {
  name: string;
  pin: string;
  role: UserRole;
  isActive: boolean;
}


/** Shared types for the POS cart subsystem. */
export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  sellingRate: number;
  maxQuantity: number;
  subtotal: number;
  /** Optional variant selected for this cart line. */
  variantName?: string;
}
