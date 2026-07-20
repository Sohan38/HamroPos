import { useRef } from 'react';
import { format as formatDate, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, X } from 'lucide-react';
import { SaleInvoice, AppSettings } from '@/types';

interface SaleBillPrintProps {
  sale: SaleInvoice;
  settings: AppSettings;
  customerName?: string;
  open: boolean;
  onClose: () => void;
}

export function SaleBillPrint({ sale, settings, customerName, open, onClose }: SaleBillPrintProps) {
  const billRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = billRef.current;
    if (!printContent) return;

    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bill - ${sale.id.slice(-6).toUpperCase()}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: monospace; font-size: 12px; padding: 8px; width: 300px; }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; }
            .item-name { flex: 1; }
            .item-qty { width: 40px; text-align: center; }
            .item-rate { width: 55px; text-align: right; }
            .item-total { width: 60px; text-align: right; }
            h1 { font-size: 16px; }
            h2 { font-size: 13px; }
            .total-row { font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const subtotal = sale.items.reduce((s, i) => s + i.subtotal, 0);
  const billDate = (() => {
    try { return formatDate(parseISO(sale.date), 'dd/MM/yyyy h:mm a'); }
    catch { return formatDate(new Date(sale.date), 'dd/MM/yyyy h:mm a'); }
  })();
  const billId = sale.id.slice(-6).toUpperCase();
  const change = sale.paidAmount > sale.grandTotal ? sale.paidAmount - sale.grandTotal : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" /> Sale Bill
          </DialogTitle>
        </DialogHeader>

        {/* Printable content */}
        <div
          ref={billRef}
          className="font-mono text-xs leading-relaxed border rounded-lg p-4 bg-white text-black max-h-[60vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="text-center mb-2">
            <div className="font-bold text-base">{settings.businessName || 'Business Name'}</div>
            {settings.address && <div>{settings.address}</div>}
            {settings.phone && <div>Ph: {settings.phone}</div>}
            {settings.vatNumber && <div>VAT/PAN: {settings.vatNumber}</div>}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="flex justify-between text-xs mb-1">
            <span>Bill #: {billId}</span>
            <span>{billDate}</span>
          </div>
          {customerName && (
            <div className="text-xs mb-1">Customer: {customerName}</div>
          )}
          <div className="text-xs mb-1 capitalize">Payment: {sale.paymentMethod}</div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Column headers */}
          <div className="flex text-xs font-bold mb-1">
            <span className="flex-1">Item</span>
            <span className="w-10 text-center">Qty</span>
            <span className="w-14 text-right">Rate</span>
            <span className="w-16 text-right">Total</span>
          </div>

          <div className="border-t border-dashed border-gray-400 mb-1" />

          {/* Items */}
          {sale.items.map((item, i) => (
            <div key={i} className="flex text-xs mb-1">
              <span className="flex-1 truncate pr-1">{item.productName}</span>
              <span className="w-10 text-center">{item.quantity}</span>
              <span className="w-14 text-right">{item.sellingRate.toFixed(2)}</span>
              <span className="w-16 text-right">{item.subtotal.toFixed(2)}</span>
            </div>
          ))}

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Totals */}
          <div className="flex justify-between text-xs mb-1">
            <span>Subtotal</span>
            <span>{settings.currencySymbol} {subtotal.toFixed(2)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-xs mb-1">
              <span>Discount</span>
              <span>- {settings.currencySymbol} {sale.discount.toFixed(2)}</span>
            </div>
          )}
          {sale.tax > 0 && (
            <div className="flex justify-between text-xs mb-1">
              <span>Tax</span>
              <span>{settings.currencySymbol} {sale.tax.toFixed(2)}</span>
            </div>
          )}

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="flex justify-between font-bold text-sm mb-1">
            <span>TOTAL</span>
            <span>{settings.currencySymbol} {sale.grandTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs mb-1">
            <span>Paid</span>
            <span>{settings.currencySymbol} {sale.paidAmount.toFixed(2)}</span>
          </div>
          {change > 0 && (
            <div className="flex justify-between text-xs font-bold">
              <span>Change</span>
              <span>{settings.currencySymbol} {change.toFixed(2)}</span>
            </div>
          )}

          <div className="border-t border-dashed border-gray-400 my-3" />
          <div className="text-center text-xs">Thank you for shopping!</div>
          <div className="text-center text-xs">Please come again.</div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            <X className="h-4 w-4 mr-2" /> Close
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
