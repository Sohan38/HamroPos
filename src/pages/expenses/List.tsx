import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useExpenses } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Receipt, Plus, Calendar, Edit, Search } from 'lucide-react';
import { format as formatDate, parseISO, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDateTime, sortByLatestFirst } from '@/lib/date';
import { rankSearch } from '@/utils/search/rank';

type DatePreset = 'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom';

export default function ExpenseList() {
  const [, setLocation] = useLocation();
  const { items } = useExpenses();
  const { format } = useCurrency();
  const [query, setQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  const datePresets: { id: DatePreset; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7days', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'custom', label: 'Custom' },
  ];

  const applyDatePreset = (preset: DatePreset) => {
    const today = new Date();

    if (preset === 'custom') {
      setCustomDateFrom(dateFrom);
      setCustomDateTo(dateTo);
      setDatePreset('custom');
      setCustomOpen(true);
      return;
    }

    if (preset === 'all') {
      setDatePreset('all');
      setDateFrom('');
      setDateTo('');
      return;
    }

    const start = preset === 'today'
      ? startOfDay(today)
      : preset === 'yesterday'
        ? startOfDay(subDays(today, 1))
        : preset === '7days'
          ? startOfDay(subDays(today, 6))
          : startOfMonth(today);

    const end = endOfDay(today);
    setDatePreset(preset);
    setDateFrom(formatDate(start, 'yyyy-MM-dd'));
    setDateTo(formatDate(end, 'yyyy-MM-dd'));
  };

  const applyCustomDates = () => {
    setDatePreset('custom');
    setDateFrom(customDateFrom);
    setDateTo(customDateTo);
    setCustomOpen(false);
  };

  const matchesDateRange = (value: string) => {
    const candidate = parseISO(value);
    const fromDate = dateFrom ? startOfDay(parseISO(dateFrom)) : null;
    const toDate = dateTo ? endOfDay(parseISO(dateTo)) : null;

    if (fromDate && candidate < fromDate) return false;
    if (toDate && candidate > toDate) return false;
    return true;
  };

  const processedExpenses = useMemo(() => {
    const searchableItems = items.map(expense => ({
      ...expense,
      name: expense.description || expense.category,
      category: expense.paymentMethod,
      phone: undefined,
    }));

    let results = searchableItems;
    if (query.trim()) {
      results = rankSearch(searchableItems, query, items.length);
    }

    if (dateFrom || dateTo) {
      results = results.filter(expense => matchesDateRange(expense.date));
    }

    return sortByLatestFirst(results, item => item.date, item => item.createdAt);
  }, [items, query, dateFrom, dateTo]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Expenses</h1>
          <p className="text-muted-foreground">{items.length} records</p>
        </div>
        <Button onClick={() => setLocation('/expenses/new')} size="lg" className="w-full md:w-auto shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> Add Expense
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search description, category, or payment method..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-11 bg-card rounded-xl border-border"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {datePresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyDatePreset(preset.id)}
                className={cn(
                  'px-3 py-2 text-xs font-semibold rounded-xl border transition-all whitespace-nowrap',
                  datePreset === preset.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <Receipt className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No expenses recorded</h3>
        </div>
      ) : processedExpenses.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-dashed">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="font-semibold">No matching expenses</h3>
          <p className="text-sm text-muted-foreground mt-1">Try a different description, category, or date range.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {processedExpenses.map((expense) => (
            <Card key={expense.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setLocation(`/expenses/${expense.id}`)}>
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-600 shrink-0">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {expense.description || expense.category}
                      {expense.sourcePurchaseId && (
                        <Badge className="ml-2 text-xs" variant="secondary">Auto</Badge>
                      )}
                    </div>
                    <div className="text-sm flex items-center gap-2 text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateTime(expense.date)} • <span className="capitalize">{expense.category}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between md:flex-col items-end md:items-end w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-border md:pl-6">
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-lg text-red-600">{format(expense.amount)}</div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {expense.paymentMethod}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={(ev) => { ev.stopPropagation(); setLocation(`/expenses/${expense.id}/edit`); }} aria-label="Edit expense">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
