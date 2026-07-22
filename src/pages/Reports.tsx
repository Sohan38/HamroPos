import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useSales, useExpenses, usePurchases, useInventory, useCredit } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import {
  format as formatDate, subDays, startOfWeek, startOfMonth, startOfYear,
  startOfDay, parseISO, isAfter, isBefore, isToday, endOfDay,
} from 'date-fns';
import { TrendingUp, TrendingDown, Package, ArrowLeft } from 'lucide-react';

const COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
  '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#3b82f6',
];

export default function Reports() {
  const [, setLocation] = useLocation();
  const { items: sales } = useSales();
  const { items: expenses } = useExpenses();
  const { items: purchases } = usePurchases();
  const { items: inventory } = useInventory();
  const { items: credits } = useCredit();
  const { format } = useCurrency();

  const [timeframe, setTimeframe] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getDateRange = () => {
    const today = new Date();
    switch (timeframe) {
      case 'today': return { start: startOfDay(today), end: endOfDay(today) };
      case 'yesterday': {
        const y = subDays(today, 1);
        return { start: startOfDay(y), end: endOfDay(y) };
      }
      case 'week': return { start: startOfWeek(today, { weekStartsOn: 0 }), end: endOfDay(today) };
      case 'month': return { start: startOfMonth(today), end: endOfDay(today) };
      case 'year': return { start: startOfYear(today), end: endOfDay(today) };
      case 'custom': {
        const s = customStart ? startOfDay(new Date(customStart)) : new Date(0);
        const e = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(today);
        return { start: s, end: e };
      }
      default: return { start: new Date(0), end: endOfDay(today) };
    }
  };

  const { start, end } = getDateRange();

  const inRange = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return isAfter(d, start) && isBefore(d, end);
    } catch { return false; }
  };

  const filteredSales = sales.filter(s => inRange(s.date));
  const filteredExpenses = expenses.filter(e => inRange(e.date));
  const filteredPurchases = purchases.filter(p => inRange(p.date));
  const filteredCredits = credits.filter(c => inRange(c.date));

  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((s, x) => s + x.grandTotal, 0);
    const totalExpenses = filteredExpenses.reduce((s, x) => s + x.amount, 0);
    const totalPurchases = filteredPurchases.reduce((s, x) => s + x.grandTotal, 0);
    const totalDiscount = filteredSales.reduce((s, x) => s + x.discount, 0);
    const totalTax = filteredSales.reduce((s, x) => s + x.tax, 0);

    // COGS: sum of (purchaseRate * qty) for each sold item
    let cogs = 0;
    const productSalesMap: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};

    for (const sale of filteredSales) {
      for (const item of sale.items) {
        const product = inventory.find(p => p.id === item.productId);
        const buyRate = product?.purchaseRate ?? 0;
        const itemCOGS = buyRate * item.quantity;
        const itemProfit = item.subtotal - itemCOGS;
        cogs += itemCOGS;

        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = { name: item.productName, qty: 0, revenue: 0, profit: 0 };
        }
        productSalesMap[item.productId].qty += item.quantity;
        productSalesMap[item.productId].revenue += item.subtotal;
        productSalesMap[item.productId].profit += itemProfit;
      }
    }

    const grossProfit = totalRevenue - cogs;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Expenses by category
    const expByCategory: Record<string, number> = {};
    for (const e of filteredExpenses) {
      expByCategory[e.category] = (expByCategory[e.category] || 0) + e.amount;
    }
    const expensePieData = Object.entries(expByCategory)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);

    // Sales by payment method
    const payByMethod: Record<string, number> = {};
    for (const s of filteredSales) {
      payByMethod[s.paymentMethod] = (payByMethod[s.paymentMethod] || 0) + s.grandTotal;
    }
    const paymentPieData = Object.entries(payByMethod)
      .map(([name, value]) => ({ name: name.toUpperCase(), value }));

    // Pending vs paid credit
    const pendingCredit = filteredCredits.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
    const collectedCredit = filteredCredits.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);

    return {
      totalRevenue, totalExpenses, totalPurchases, totalDiscount, totalTax,
      cogs, grossProfit, netProfit, grossMargin,
      topProducts, expensePieData, paymentPieData, pendingCredit, collectedCredit,
      salesCount: filteredSales.length,
    };
  }, [filteredSales, filteredExpenses, filteredPurchases, filteredCredits, inventory]);

  // Daily chart (last 30 days or filtered range)
  const dailyChart = useMemo(() => {
    const days = Math.min(30, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = formatDate(startOfDay(date), 'yyyy-MM-dd');
      const dayRevenue = filteredSales.filter(s => s.date.startsWith(dateStr)).reduce((s, x) => s + x.grandTotal, 0);
      const dayExpenses = filteredExpenses.filter(e => e.date.startsWith(dateStr)).reduce((s, e) => s + e.amount, 0);
      data.push({ date: formatDate(date, 'd MMM'), Revenue: dayRevenue, Expenses: dayExpenses });
    }
    return data;
  }, [filteredSales, filteredExpenses, start, end]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground text-sm">{stats.salesCount} sales in selected period</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[160px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {timeframe === 'custom' && (
            <div className="flex gap-2">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-36 bg-card text-sm" />
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-36 bg-card text-sm" />
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-xl font-bold text-primary mt-1">{format(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">COGS</p>
            <p className="text-xl font-bold mt-1">{format(stats.cogs)}</p>
          </CardContent>
        </Card>
        <Card className={stats.grossProfit >= 0 ? 'bg-green-500/10 border-green-200' : 'bg-destructive/10'}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Gross Profit</p>
            <p className={`text-xl font-bold mt-1 ${stats.grossProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {format(stats.grossProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.grossMargin.toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>
        <Card className={stats.netProfit >= 0 ? 'bg-green-500/10 border-green-200' : 'bg-destructive/10'}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Net Profit</p>
            <div className="flex items-center gap-1 mt-1">
              <p className={`text-xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {format(Math.abs(stats.netProfit))}
              </p>
              {stats.netProfit >= 0
                ? <TrendingUp className="h-4 w-4 text-green-600" />
                : <TrendingDown className="h-4 w-4 text-destructive" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-lg font-bold text-destructive mt-1">{format(stats.totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Purchases</p>
            <p className="text-lg font-bold mt-1">{format(stats.totalPurchases)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending Credit</p>
            <p className="text-lg font-bold text-orange-500 mt-1">{format(stats.pendingCredit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Collected Credit</p>
            <p className="text-lg font-bold text-green-600 mt-1">{format(stats.collectedCredit)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChart} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                <Tooltip formatter={(v: number, name) => [format(v), name]} />
                <Legend />
                <Bar dataKey="Revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expenses" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.expensePieData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No expense data</div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.expensePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {stats.expensePieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => format(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment method breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sales by Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.paymentPieData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No sales data</div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.paymentPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                      {stats.paymentPieData.map((entry, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => format(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top selling products */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Top Selling Products
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.topProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No sales data</div>
          ) : (
            <div className="divide-y">
              <div className="hidden md:grid grid-cols-12 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/30">
                <span className="col-span-1">#</span>
                <span className="col-span-5">Product</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-2 text-right">Revenue</span>
                <span className="col-span-2 text-right">Profit</span>
              </div>
              {stats.topProducts.map((p, i) => (
                <div key={i} className="flex flex-col md:grid md:grid-cols-12 px-4 py-3 gap-2 md:gap-0 text-sm hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2 col-span-6 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-medium truncate">{p.name}</span>
                  </div>
                  {/* Mobile details layout */}
                  <div className="flex justify-between items-center md:contents text-xs md:text-sm text-muted-foreground">
                    <span className="md:col-span-2 md:text-right">
                      <span className="md:hidden">Qty: </span>{p.qty}
                    </span>
                    <span className="md:col-span-2 md:text-right font-semibold text-foreground">
                      <span className="md:hidden text-muted-foreground font-normal">Revenue: </span>{format(p.revenue)}
                    </span>
                    <span className={`md:col-span-2 md:text-right font-semibold ${p.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      <span className="md:hidden text-muted-foreground font-normal">Profit: </span>{format(p.profit)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
