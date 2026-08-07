import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { usePurchases, useSuppliers } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Truck, Plus, Calendar, ChevronRight,
  Clock, TrendingDown, CheckCircle2, AlertCircle, ArrowUpFromLine, Receipt
} from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

export default function PayablesList() {
  const [, setLocation] = useLocation();
  const { items: purchases } = usePurchases();
  const { items: suppliers } = useSuppliers();
  const { format } = useCurrency();

  // Only show invoices that have something owed (unpaid or partial)
  const payables = useMemo(() =>
    purchases
      .filter(p => {
        const ps = p.paymentStatus ?? (p.paidAmount && p.paidAmount > 0 ? 'partial' : 'unpaid');
        return ps !== 'paid' && (p.status ?? 'received') !== 'cancelled';
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [purchases],
  );

  const totalOwed = useMemo(() =>
    payables.reduce((s, p) => {
      const paid = p.paidAmount ?? 0;
      return s + Math.max(0, p.grandTotal - paid);
    }, 0),
    [payables],
  );

  const totalPartial = useMemo(() =>
    payables.reduce((s, p) => s + (p.paidAmount ?? 0), 0),
    [payables],
  );

  const statusConfig = {
    unpaid: {
      label: 'Unpaid',
      className: 'bg-rose-500/10 text-rose-600 border-rose-200/40 dark:border-rose-500/20',
      icon: <Clock className="h-3 w-3" />,
    },
    partial: {
      label: 'Partial',
      className: 'bg-sky-500/10 text-sky-600 border-sky-200/40 dark:border-sky-500/20',
      icon: <TrendingDown className="h-3 w-3" />,
    },
    paid: {
      label: 'Paid',
      className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200/40 dark:border-emerald-500/20',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-24 md:pb-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Payables</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and track outstanding payments to suppliers</p>
        </div>
        <Button onClick={() => setLocation('/purchases/new')} className="w-full sm:w-auto h-11 px-5 shadow-sm rounded-xl gap-2 font-medium shrink-0">
          <Plus className="h-4 w-4" /> New Purchase
        </Button>
      </div>

      {/* Modern Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border border-rose-500/10 bg-rose-500/[0.02] dark:bg-rose-500/[0.01] rounded-2xl shadow-sm overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-rose-700/80 uppercase tracking-wider">Total Owed</p>
              <h2 className="text-3xl font-black text-rose-600 tracking-tight">{format(totalOwed)}</h2>
              <p className="text-xs text-muted-foreground font-medium">{payables.length} unpaid invoices</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600">
              <ArrowUpFromLine className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-sky-500/10 bg-sky-500/[0.02] dark:bg-sky-500/[0.01] rounded-2xl shadow-sm overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-sky-700/80 uppercase tracking-wider">Paid So Far</p>
              <h2 className="text-3xl font-black text-sky-600 tracking-tight">{format(totalPartial)}</h2>
              <p className="text-xs text-muted-foreground font-medium">Accumulated partial settlements</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List Section */}
      {payables.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-dashed flex flex-col items-center justify-center p-6 space-y-3">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">All Settled!</h3>
          <p className="text-sm text-muted-foreground max-w-sm">No pending balances or outstanding invoices found for any supplier.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Outstanding Invoices</h2>
          <div className="space-y-3">
            {payables.map((invoice) => {
              const supplier = suppliers.find(s => s.id === invoice.supplierId);
              const paid = invoice.paidAmount ?? 0;
              const remaining = Math.max(0, invoice.grandTotal - paid);
              const progressPct = invoice.grandTotal > 0
                ? Math.min(100, (paid / invoice.grandTotal) * 100) : 0;
              const ps = invoice.paymentStatus ?? (paid > 0 ? 'partial' : 'unpaid');
              const statusCfg = statusConfig[ps] ?? statusConfig.unpaid;

              return (
                <Card
                  key={invoice.id}
                  className="group hover:border-primary/30 dark:hover:border-primary/20 hover:shadow-md/5 hover:bg-muted/30 transition-all duration-300 cursor-pointer rounded-2xl overflow-hidden border border-border"
                  onClick={() => setLocation(`/payables/${invoice.id}`)}
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={cn(
                          'h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105',
                          ps === 'unpaid'
                            ? 'bg-rose-500/10 text-rose-600'
                            : 'bg-sky-500/10 text-sky-600',
                        )}>
                          <Truck className="h-5.5 w-5.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-foreground truncate text-[15px] leading-tight">
                            {supplier?.name ?? invoice.supplierName ?? 'Unknown Supplier'}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1">
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">
                              {invoice.invoiceNumber || 'No Ref#'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(parseISO(invoice.date), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn('flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border shrink-0', statusCfg.className)}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {/* Progress Slider */}
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between items-end text-xs">
                        <span className="text-muted-foreground font-medium">Payment Progress</span>
                        <span className="font-bold text-foreground">{progressPct.toFixed(0)}% paid</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            progressPct >= 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-sky-500' : 'bg-rose-500',
                          )}
                          style={{ width: `${Math.max(progressPct, 1.5)}%` }}
                        />
                      </div>
                    </div>

                    {/* Amount Metrics Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/60 text-sm">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Receipt className="h-3.5 w-3.5" />
                        <span>{invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs text-muted-foreground">Owed</span>
                        <span className="font-extrabold text-rose-600 text-base">{format(remaining)}</span>
                        <span className="text-xs text-muted-foreground">/ {format(invoice.grandTotal)}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors ml-1 shrink-0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {payables.length > 0 && (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/40 px-3 py-1.5 rounded-full border border-border/40">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/80" />
            Select an invoice to settle payments
          </span>
        </div>
      )}
    </div>
  );
}
