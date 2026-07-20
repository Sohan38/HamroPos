import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { useInventory, useSales, useExpenses, useCredit, usePurchases, useProductBatches } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { format, isToday, parseISO, subDays, startOfDay } from 'date-fns';
import { getBatchStatus } from '@/components/BatchFormDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart, Truck, UtensilsCrossed, Hotel, Receipt, Banknote,
  TrendingUp, TrendingDown, Package, AlertTriangle, Wallet,
  BarChart3, ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import { useApp } from '@/contexts/AppContext';

// Compute cost-of-goods-sold for a set of sales using current inventory data for purchase rates
function computeCOGS(sales: ReturnType<typeof useSales>['items'], inventory: ReturnType<typeof useInventory>['items']) {
  let cogs = 0;
  for (const sale of sales) {
    for (const item of sale.items) {
      const product = inventory.find(p => p.id === item.productId);
      const buyRate = product?.purchaseRate ?? 0;
      cogs += buyRate * item.quantity;
    }
  }
  return cogs;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { items: inventory } = useInventory();
  const { items: sales } = useSales();
  const { items: expenses } = useExpenses();
  const { items: credits } = useCredit();
  const { items: purchases } = usePurchases();
  const { items: batches } = useProductBatches();
  const { format: formatCurrency } = useCurrency();
  const { settings } = useApp();

  const metrics = useMemo(() => {
    const todaySales = sales.filter(s => {
      try { return isToday(parseISO(s.date)); } catch { return isToday(new Date(s.date)); }
    });
    const todayExpenses = expenses.filter(e => {
      try { return isToday(parseISO(e.date)); } catch { return isToday(new Date(e.date)); }
    });

    const todayRevenue = todaySales.reduce((s, x) => s + x.grandTotal, 0);
    const todayExpensesTotal = todayExpenses.reduce((s, x) => s + x.amount, 0);
    const todayCOGS = computeCOGS(todaySales, inventory);
    const todayGrossProfit = todayRevenue - todayCOGS;
    const todayNetProfit = todayGrossProfit - todayExpensesTotal;

    const qrSalesToday = todaySales.filter(s => s.paymentMethod === 'qr').reduce((s, x) => s + x.grandTotal, 0);

    // Purchases today
    const todayPurchases = purchases.filter(p => {
      try { return isToday(parseISO(p.date)); } catch { return isToday(new Date(p.date)); }
    });
    const todayPurchaseTotal = todayPurchases.reduce((s, x) => s + x.grandTotal, 0);

    const pendingCreditTotal = credits.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
    const creditReceivedToday = credits.filter(c => c.status === 'paid' && c.paidAt && (() => {
      try { return isToday(parseISO(c.paidAt!)); } catch { return isToday(new Date(c.paidAt!)); }
    })()).reduce((s, c) => s + c.amount, 0);

    const lowStockItems = inventory.filter(i => i.quantity <= i.minimumStock && i.quantity > 0);
    const outOfStockItems = inventory.filter(i => i.quantity === 0);

    // Expiry alerts — one entry per batch, joined with product name
    type ExpiryAlert = { batchId: string; productId: string; productName: string; batchNo: string; expiryDate: string; qty: number };
    const expiredBatches: ExpiryAlert[] = [];
    const expiringSoonBatches: ExpiryAlert[] = [];
    for (const batch of batches) {
      if (!batch.expiryDate || batch.quantity <= 0) continue;
      const status = getBatchStatus(batch.expiryDate);
      const product = inventory.find(p => p.id === batch.productId);
      const productName = product?.name ?? 'Unknown Product';
      const entry: ExpiryAlert = {
        batchId: batch.id,
        productId: batch.productId,
        productName,
        batchNo: batch.batchNumber,
        expiryDate: batch.expiryDate,
        qty: batch.quantity,
      };
      if (status === 'expired') expiredBatches.push(entry);
      else if (status === 'expiring') expiringSoonBatches.push(entry);
    }
    // Sort: expired by expiryDate asc, expiring by expiryDate asc
    expiredBatches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    expiringSoonBatches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    const inventoryPurchaseValue = inventory.reduce((s, i) => s + i.purchaseRate * i.quantity, 0);
    const inventorySellingValue = inventory.reduce((s, i) => s + i.sellingRate * i.quantity, 0);
    const estimatedInventoryProfit = inventorySellingValue - inventoryPurchaseValue;

    // Best selling products (by quantity sold all time)
    const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const sale of sales) {
      for (const item of sale.items) {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.productName, qty: 0, revenue: 0 };
        }
        productSales[item.productId].qty += item.quantity;
        productSales[item.productId].revenue += item.subtotal;
      }
    }
    const bestSellers = Object.values(productSales)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      todayRevenue, todayExpensesTotal, todayGrossProfit, todayNetProfit,
      qrSalesToday, todayPurchaseTotal,
      pendingCreditTotal, creditReceivedToday,
      lowStockItems, outOfStockItems,
      expiredBatches, expiringSoonBatches,
      inventoryPurchaseValue, inventorySellingValue, estimatedInventoryProfit,
      inventoryCount: inventory.length,
      bestSellers,
    };
  }, [sales, expenses, credits, purchases, inventory, batches]);

  // 7-day chart data
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(startOfDay(date), 'yyyy-MM-dd');

      const daySales = sales.filter(s => s.date.startsWith(dateStr));
      const dayRevenue = daySales.reduce((s, x) => s + x.grandTotal, 0);
      const dayCOGS = computeCOGS(daySales, inventory);
      const dayExpenses = expenses.filter(e => e.date.startsWith(dateStr)).reduce((s, e) => s + e.amount, 0);

      data.push({
        name: format(date, 'EEE'),
        Revenue: dayRevenue,
        COGS: dayCOGS,
        Expenses: dayExpenses,
        Profit: dayRevenue - dayCOGS - dayExpenses,
      });
    }
    return data;
  }, [sales, expenses, inventory]);

  const recentSales = [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  const recentPurchases = [...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
  const recentExpenses = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

  const quickActions = [
    { label: 'New Sale', icon: ShoppingCart, href: '/sales/new', color: 'bg-blue-500/10 text-blue-600' },
    { label: 'Purchase', icon: Truck, href: '/purchases/new', color: 'bg-green-500/10 text-green-600' },
    { label: 'Hotel Bill', icon: Hotel, href: '/hotel/billing/new', color: 'bg-purple-500/10 text-purple-600' },
    { label: 'Restaurant', icon: UtensilsCrossed, href: '/restaurant/new', color: 'bg-orange-500/10 text-orange-600' },
    { label: 'Expense', icon: Receipt, href: '/expenses/new', color: 'bg-red-500/10 text-red-600' },
    { label: 'Credit', icon: Banknote, href: '/credit/new', color: 'bg-yellow-500/10 text-yellow-600' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{settings.businessName}</h1>
          <p className="text-muted-foreground text-sm">{format(new Date(), 'EEEE, MMMM do, yyyy')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLocation('/reports')}>
          <BarChart3 className="h-4 w-4 mr-2" /> Reports
        </Button>
      </div>

      {/* Today's key metrics — 2×2 on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardContent className="p-4">
            <p className="text-xs font-medium opacity-80">Today's Sales</p>
            <h2 className="text-xl font-bold mt-1">{formatCurrency(metrics.todayRevenue)}</h2>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Today's Expenses</p>
            <h2 className="text-xl font-bold mt-1 text-destructive">{formatCurrency(metrics.todayExpensesTotal)}</h2>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Gross Profit</p>
            <div className="flex items-center gap-1 mt-1">
              <h2 className={`text-xl font-bold ${metrics.todayGrossProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {formatCurrency(Math.abs(metrics.todayGrossProfit))}
              </h2>
              {metrics.todayGrossProfit >= 0
                ? <TrendingUp className="h-4 w-4 text-green-600" />
                : <TrendingDown className="h-4 w-4 text-destructive" />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Pending Credit</p>
            <h2 className="text-xl font-bold mt-1 text-orange-500">{formatCurrency(metrics.pendingCreditTotal)}</h2>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">QR Payments Today</p>
            <p className="font-bold text-lg mt-1">{formatCurrency(metrics.qrSalesToday)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Purchases Today</p>
            <p className="font-bold text-lg mt-1">{formatCurrency(metrics.todayPurchaseTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Credit Received Today</p>
            <p className="font-bold text-lg mt-1 text-green-600">{formatCurrency(metrics.creditReceivedToday)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Net Profit (Today)</p>
            <p className={`font-bold text-lg mt-1 ${metrics.todayNetProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {formatCurrency(Math.abs(metrics.todayNetProfit))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Products</p>
            <p className="font-bold text-lg mt-1">{metrics.inventoryCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Inventory (Cost)</p>
            <p className="font-bold text-lg mt-1">{formatCurrency(metrics.inventoryPurchaseValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Inventory (Retail)</p>
            <p className="font-bold text-lg mt-1">{formatCurrency(metrics.inventorySellingValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Est. Inv. Profit</p>
            <p className="font-bold text-lg mt-1 text-green-600">{formatCurrency(metrics.estimatedInventoryProfit)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock + Expiry alerts */}
      {(metrics.lowStockItems.length > 0 || metrics.outOfStockItems.length > 0 ||
        metrics.expiredBatches.length > 0 || metrics.expiringSoonBatches.length > 0) && (
        <Card className="border-orange-300/50">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-4 w-4" />
              Stock Alerts ({
                metrics.lowStockItems.length + metrics.outOfStockItems.length +
                metrics.expiredBatches.length + metrics.expiringSoonBatches.length
              })
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-3">

            {/* Out of stock */}
            {metrics.outOfStockItems.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500 mb-1.5">Out of Stock</p>
                <div className="flex flex-wrap gap-2">
                  {metrics.outOfStockItems.slice(0, 5).map(item => (
                    <Badge key={item.id} variant="destructive" className="text-xs cursor-pointer" onClick={() => setLocation('/inventory')}>
                      {item.name} — OUT
                    </Badge>
                  ))}
                  {metrics.outOfStockItems.length > 5 && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setLocation('/inventory')}>
                      +{metrics.outOfStockItems.length - 5} more
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Low stock */}
            {metrics.lowStockItems.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500 mb-1.5">Low Stock</p>
                <div className="flex flex-wrap gap-2">
                  {metrics.lowStockItems.slice(0, 5).map(item => (
                    <Badge key={item.id} className="text-xs bg-orange-100 text-orange-700 border-orange-300 cursor-pointer" onClick={() => setLocation('/inventory')}>
                      {item.name} — {item.quantity} left
                    </Badge>
                  ))}
                  {metrics.lowStockItems.length > 5 && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setLocation('/inventory')}>
                      +{metrics.lowStockItems.length - 5} more
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Expired batches */}
            {metrics.expiredBatches.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 mb-1.5">Expired Batches</p>
                <div className="flex flex-wrap gap-2">
                  {metrics.expiredBatches.slice(0, 5).map(b => (
                    <Badge
                      key={b.batchId}
                      className="text-xs bg-red-100 text-red-700 border-red-300 cursor-pointer"
                      onClick={() => setLocation(`/inventory/${b.productId}`)}
                    >
                      {b.productName} · {b.batchNo} — {b.qty} units
                    </Badge>
                  ))}
                  {metrics.expiredBatches.length > 5 && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setLocation('/inventory')}>
                      +{metrics.expiredBatches.length - 5} more
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Expiring soon batches */}
            {metrics.expiringSoonBatches.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-yellow-600 mb-1.5">Expiring Soon</p>
                <div className="flex flex-wrap gap-2">
                  {metrics.expiringSoonBatches.slice(0, 5).map(b => (
                    <Badge
                      key={b.batchId}
                      className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300 cursor-pointer"
                      onClick={() => setLocation(`/inventory/${b.productId}`)}
                    >
                      {b.productName} · {b.batchNo} — exp {format(parseISO(b.expiryDate), 'dd MMM')}
                    </Badge>
                  ))}
                  {metrics.expiringSoonBatches.length > 5 && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setLocation('/inventory')}>
                      +{metrics.expiringSoonBatches.length - 5} more
                    </Button>
                  )}
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-base font-semibold mb-3">Quick Actions</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => setLocation(action.href)}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border bg-card hover:bg-muted/50 active:scale-95 transition-all shadow-sm"
              data-testid={`button-quick-${action.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className={`p-2.5 rounded-full ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <span className="text-[11px] md:text-xs font-medium text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-day revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue vs Expenses — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip formatter={(v: number, name) => [formatCurrency(v), name]} />
                  <Legend />
                  <Area type="monotone" dataKey="Revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Expenses" stroke="hsl(var(--destructive))" fill="url(#expGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Best Sellers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Best Sellers</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.bestSellers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No sales yet</div>
            ) : (
              <div className="space-y-3">
                {metrics.bestSellers.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center
                      ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-300 text-orange-900' : 'bg-muted text-muted-foreground'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.qty} units sold</div>
                    </div>
                    <div className="text-sm font-semibold text-primary shrink-0">{formatCurrency(item.revenue)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recent Sales */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Recent Sales
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLocation('/sales')}>
                View All <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sales yet</p>
            ) : recentSales.map(sale => (
              <div
                key={sale.id}
                className="flex justify-between items-start py-2 border-b last:border-0 cursor-pointer hover:bg-muted/30 -mx-1 px-1 rounded transition-colors"
                onClick={() => setLocation(`/sales/${sale.id}`)}
              >
                <div>
                  <div className="text-xs font-medium">{sale.items.slice(0, 2).map(i => i.productName).join(', ')}{sale.items.length > 2 ? '…' : ''}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {(() => { try { return format(parseISO(sale.date), 'MMM d, h:mm a'); } catch { return format(new Date(sale.date), 'MMM d, h:mm a'); } })()}
                  </div>
                </div>
                <span className="text-xs font-bold text-primary shrink-0 ml-2">{formatCurrency(sale.grandTotal)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Purchases */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Recent Purchases
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLocation('/purchases')}>
                View All <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPurchases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No purchases yet</p>
            ) : recentPurchases.map(p => (
              <div key={p.id} className="flex justify-between items-start py-2 border-b last:border-0">
                <div>
                  <div className="text-xs font-medium">{p.invoiceNumber || `#${p.id.slice(-6)}`}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{p.items.length} items</div>
                </div>
                <span className="text-xs font-bold text-green-600 shrink-0 ml-2">{formatCurrency(p.grandTotal)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Recent Expenses
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLocation('/expenses')}>
                View All <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No expenses yet</p>
            ) : recentExpenses.map(e => (
              <div key={e.id} className="flex justify-between items-start py-2 border-b last:border-0">
                <div>
                  <div className="text-xs font-medium capitalize">{e.description || e.category}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">{e.category}</div>
                </div>
                <span className="text-xs font-bold text-destructive shrink-0 ml-2">{formatCurrency(e.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
