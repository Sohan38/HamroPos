/**
 * CartPanel — Standalone memoized component for the POS cart sidebar / drawer.
 *
 * Extracted from SalesPos to prevent React re-creating the component function
 * reference on every parent render.  Wrapped in React.memo so it only
 * re-renders when its own props actually change.
 */
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShoppingCart, User, Trash2, Minus, Plus, Banknote, QrCode,
  CreditCard, SplitSquareHorizontal, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomerPicker } from '@/components/pos/CustomerPicker';

import { PaymentMethod, CartItem } from '@/types';

interface CartPanelProps {
  inDrawer?: boolean;
  cart: CartItem[];
  cartCount: number;
  discount: number;
  discountType: 'flat' | 'percent';
  discountValue: number;
  taxPercent: number;
  taxAmount: number;
  subtotal: number;
  grandTotal: number;
  paidAmount: number | '';
  paymentMethod: PaymentMethod;
  customerId: string;
  showCustomer: boolean;
  selectedCustomerName?: string;
  change: number;
  isDiscountsEnabled: boolean;
  symbol: string;
  format: (n: number) => string;
  onSetDiscountType: (t: 'flat' | 'percent') => void;
  onSetDiscountValue: (v: number) => void;
  onSetTaxPercent: (v: number) => void;
  onSetPaymentMethod: (m: PaymentMethod) => void;
  onSetPaidAmount: (v: number | '') => void;
  onSetCustomerId: (id: string) => void;
  onToggleCustomer: () => void;
  onCloseCustomer: () => void;
  onClearCart: () => void;
  onRemoveFromCart: (id: string) => void;
  onUpdateCartQuantity: (id: string, delta: number) => void;
  onSetCartQuantity: (id: string, qty: number) => void;
  onCheckout: () => void;
}

export const CartPanel = React.memo(({
  inDrawer = false,
  cart,
  cartCount,
  discount,
  discountType,
  discountValue,
  taxPercent,
  taxAmount,
  subtotal,
  grandTotal,
  paidAmount,
  paymentMethod,
  customerId: _customerId,
  showCustomer,
  selectedCustomerName,
  change,
  isDiscountsEnabled,
  symbol,
  format,
  onSetDiscountType,
  onSetDiscountValue,
  onSetTaxPercent,
  onSetPaymentMethod,
  onSetPaidAmount,
  onToggleCustomer,
  onCloseCustomer,
  onSetCustomerId,
  onClearCart,
  onRemoveFromCart,
  onUpdateCartQuantity,
  onSetCartQuantity,
  onCheckout,
}: CartPanelProps) => (
  <div className={`flex flex-col ${inDrawer ? 'h-full' : 'flex-1'}`}>
    {/* Cart header */}
    <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
      <h2 className="text-base font-bold flex items-center gap-2">
        <ShoppingCart className="h-4 w-4" />
        Order
        {cart.length > 0 && (
          <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
            {cartCount}
          </span>
        )}
      </h2>
      <div className="flex gap-1 items-center">
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
          onClick={onToggleCustomer}>
          <User className="h-3.5 w-3.5" />
          {selectedCustomerName ? selectedCustomerName.split(' ')[0] : 'Customer'}
        </Button>
        {cart.length > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive"
            onClick={onClearCart}>
            Clear
          </Button>
        )}
      </div>
    </div>

    {/* Customer picker */}
    {showCustomer && (
      <CustomerPicker
        customerId={_customerId}
        onChange={onSetCustomerId}
        onClose={onCloseCustomer}
      />
    )}

    {/* Cart items */}
    <div className="flex-1 overflow-y-auto">
      <div className="p-3">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
            <ShoppingCart className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">Cart is empty</p>
            <p className="text-xs mt-1">Search or tap a product to add</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.productId}
                className="flex flex-col gap-2 p-3 bg-muted/30 rounded-xl border">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium text-sm line-clamp-2 flex-1">{item.productName}</span>
                  <button onClick={() => onRemoveFromCart(item.productId)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1 -mr-1 -mt-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{format(item.sellingRate)} each</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-destructive/10 text-destructive transition-colors active:scale-95"
                      onClick={() => {
                        if (item.quantity === 1) onRemoveFromCart(item.productId);
                        else onUpdateCartQuantity(item.productId, -1);
                      }}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      className="h-8 w-12 text-center text-sm p-0 font-semibold"
                      value={item.quantity}
                      onChange={e => onSetCartQuantity(item.productId, parseInt(e.target.value))}
                      min={1}
                      max={item.maxQuantity}
                    />
                    <button
                      className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-green-500/10 text-green-600 transition-colors active:scale-95"
                      onClick={() => onUpdateCartQuantity(item.productId, 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-bold text-sm ml-1 w-20 text-right tabular-nums">{format(item.subtotal)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Checkout panel */}
    <div className="p-3 border-t bg-muted/10 space-y-3 shrink-0">
      <div className={isDiscountsEnabled ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1'}>
        {isDiscountsEnabled && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">Discount</span>
              <div className="flex border rounded-md overflow-hidden bg-background h-5 text-[10px]">
                <button
                  type="button"
                  className={cn(
                    'px-1.5 font-medium transition-colors',
                    discountType === 'flat' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                  onClick={() => { onSetDiscountType('flat'); onSetDiscountValue(0); }}
                >
                  {symbol}
                </button>
                <button
                  type="button"
                  className={cn(
                    'px-1.5 font-medium transition-colors border-l',
                    discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                  onClick={() => { onSetDiscountType('percent'); onSetDiscountValue(0); }}
                >
                  %
                </button>
              </div>
            </div>
            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                className="h-9 text-sm pr-7"
                value={discountValue || ''}
                min={0}
                max={discountType === 'percent' ? 100 : subtotal}
                onChange={e => {
                  const val = Number(e.target.value);
                  const maxLimit = discountType === 'percent' ? 100 : subtotal;
                  onSetDiscountValue(Math.max(0, Math.min(maxLimit, val)));
                }}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none pointer-events-none">
                {discountType === 'percent' ? '%' : symbol}
              </span>
            </div>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tax %</label>
          <Select value={taxPercent.toString()} onValueChange={v => onSetTaxPercent(Number(v))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">No Tax</SelectItem>
              <SelectItem value="13">13% VAT</SelectItem>
              <SelectItem value="5">5%</SelectItem>
              <SelectItem value="10">10%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span><span className="tabular-nums">{format(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span><span className="tabular-nums">- {format(discount)}</span>
          </div>
        )}
        {taxAmount > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Tax ({taxPercent}%)</span><span className="tabular-nums">{format(taxAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-1.5 border-t font-bold text-lg">
          <span>Total</span>
          <span className="text-primary text-xl tabular-nums">{format(grandTotal)}</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {(['cash', 'qr', 'card', 'bank', 'credit'] as PaymentMethod[]).map(m => (
          <Button
            key={m}
            variant={paymentMethod === m ? 'default' : 'outline'}
            className="flex-col h-14 gap-1 text-xs"
            onClick={() => onSetPaymentMethod(m)}
          >
            {m === 'cash' && <Banknote className="h-4 w-4" />}
            {m === 'qr' && <QrCode className="h-4 w-4" />}
            {m === 'card' && <CreditCard className="h-4 w-4" />}
            {m === 'bank' && <SplitSquareHorizontal className="h-4 w-4" />}
            {m === 'credit' && <BookOpen className="h-4 w-4" />}
            <span className="capitalize">{m === 'bank' ? 'Bank' : m === 'credit' ? 'Credit' : m}</span>
          </Button>
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <label className="text-xs text-muted-foreground">{paymentMethod === 'credit' ? 'Paid now' : 'Paid Amount'}</label>
          {paymentMethod === 'credit' && <span className="text-[11px] text-orange-600 font-medium">0 = full credit</span>}
        </div>
        <Input
          type="number"
          inputMode="decimal"
          placeholder={paymentMethod === 'credit' ? '0 for full credit' : `${format(grandTotal)} (exact)`}
          className={`h-11 text-base font-bold ${paidAmount !== '' && Number(paidAmount) < grandTotal ? 'border-destructive' : ''}`}
          value={paidAmount === 0 ? '' : paidAmount}
          onChange={e => onSetPaidAmount(e.target.value ? Number(e.target.value) : '')}
        />
        {paidAmount !== '' && Number(paidAmount) < grandTotal && (
          <p className={`text-xs ${paymentMethod === 'credit' ? 'text-orange-600' : 'text-destructive'}`}>
            {paymentMethod === 'credit' ? `Credit due: ${format(grandTotal - Number(paidAmount))}` : `Short by ${format(grandTotal - Number(paidAmount))}`}
          </p>
        )}
        {change > 0 && (
          <div className="text-sm font-semibold text-green-600 tabular-nums">Change: {format(change)}</div>
        )}
      </div>

      {paymentMethod === 'credit' && !selectedCustomerName && (
        <p className="rounded-lg bg-orange-500/10 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
          Select a customer above to save this sale as credit.
        </p>
      )}
      <Button
        size="lg"
        className="w-full h-13 text-base font-bold shadow-md"
        disabled={cart.length === 0 || (paymentMethod !== 'credit' && paidAmount !== '' && Number(paidAmount) < grandTotal) || (paymentMethod === 'credit' && !selectedCustomerName)}
        onClick={onCheckout}
      >
        <ShoppingCart className="h-5 w-5 mr-2" />
        {paymentMethod === 'credit' ? 'Save Credit' : 'Checkout'} • {format(grandTotal)}
      </Button>
    </div>
  </div>
));

CartPanel.displayName = 'CartPanel';
