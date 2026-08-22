import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  BookOpen,
  RefreshCw,
  Search,
  X,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  Truck,
  ShoppingCart,
  Receipt,
  UserCheck,
  RotateCcw,
  Building2,
  Wallet,
  Landmark,
  QrCode,
  CreditCard,
  Layers,
  ChevronRight,
  Download,
  Info,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import {
  format as formatDate,
  parseISO,
  isToday,
  isYesterday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
} from 'date-fns';
import { useStorageProvider } from '@/storage/StorageContext';
import {
  useCredit,
  useExpenses,
  useFinancialAccounts,
  usePurchases,
  useSales,
  useSuppliers,
  useLocations,
} from '@/contexts/GlobalProviders';
import {
  FinancialPostingService,
  type FinancialDaybookRow,
} from '@/services/financialPostingService';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateGroupedList } from '@/components/DateGroupedList';

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all';
type FlowFilter = 'all' | 'inflow' | 'outflow';
type SourceTypeFilter =
  | 'all'
  | 'sale'
  | 'purchase'
  | 'supplier_payment'
  | 'customer_payment'
  | 'expense'
  | 'transfer'
  | 'financial_reversal'
  | 'opening_balance';

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

const SOURCE_FILTERS: Array<{ id: SourceTypeFilter; label: string }> = [
  { id: 'all', label: 'All Sources' },
  { id: 'sale', label: 'Sales' },
  { id: 'purchase', label: 'Purchases' },
  { id: 'supplier_payment', label: 'Supplier Payments' },
  { id: 'customer_payment', label: 'Customer Payments' },
  { id: 'expense', label: 'Expenses' },
  { id: 'transfer', label: 'Transfers' },
  { id: 'financial_reversal', label: 'Adjustments' },
];

export default function DaybookList() {
  const storage = useStorageProvider();
  const { items: accounts, refresh: refreshAccounts } = useFinancialAccounts();
  const { items: sales } = useSales();
  const { items: purchases } = usePurchases();
  const { items: expenses } = useExpenses();
  const { items: credits } = useCredit();
  const { items: suppliers } = useSuppliers();
  const { items: locations } = useLocations();
  const { format } = useCurrency();

  // Raw data state
  const [allRows, setAllRows] = useState<FinancialDaybookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters state
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedSourceType, setSelectedSourceType] = useState<SourceTypeFilter>('all');
  const [flowFilter, setFlowFilter] = useState<FlowFilter>('all');

  // Detail modal
  const [selectedRow, setSelectedRow] = useState<FinancialDaybookRow | null>(null);

  // Debounce search input for butter-smooth UI performance
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load ledger rows from storage
  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      await FinancialPostingService.ensureDefaultAccounts(storage);
      const ledgerRows = await FinancialPostingService.getDaybook(storage);
      setAllRows(ledgerRows);
      refreshAccounts();
    } catch (error) {
      console.error('[Daybook] Failed to load ledger entries:', error);
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  }, [storage, refreshAccounts]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Listen to external storage updates without full screen tearing
  useEffect(() => {
    const handleStorageChange = (e: any) => {
      const key = e.detail?.key;
      if (
        !key ||
        key === 'financialTransactions' ||
        key === 'financialMovements' ||
        key === 'financialAccounts'
      ) {
        void loadData();
      }
    };
    window.addEventListener('sohan-storage-changed', handleStorageChange);
    return () => window.removeEventListener('sohan-storage-changed', handleStorageChange);
  }, [loadData]);

  // Set date preset handler
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const d = formatDate(now, 'yyyy-MM-dd');
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'yesterday') {
      const d = formatDate(subDays(now, 1), 'yyyy-MM-dd');
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'week') {
      setStartDate(formatDate(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setEndDate(formatDate(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    } else if (preset === 'month') {
      setStartDate(formatDate(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(formatDate(endOfMonth(now), 'yyyy-MM-dd'));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Professional source label
  const getSourceDisplay = (row: FinancialDaybookRow) => {
    const type = row.transaction.sourceType;
    switch (type) {
      case 'purchase':
        return { label: 'Purchase Inward', badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20', icon: Truck };
      case 'supplier_payment':
        return { label: 'Supplier Payment', badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20', icon: Wallet };
      case 'sale':
        return { label: 'Sales Revenue', badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20', icon: ShoppingCart };
      case 'customer_payment':
        return { label: 'Customer Settlement', badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20', icon: UserCheck };
      case 'expense':
        return { label: 'Operating Expense', badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20', icon: Receipt };
      case 'transfer':
        return { label: 'Internal Transfer', badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20', icon: ArrowRightLeft };
      case 'opening_balance':
        return { label: 'Opening Balance', badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20', icon: Landmark };
      case 'financial_reversal':
        return { label: 'Reversal / Correction', badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20', icon: RotateCcw };
      default:
        return { label: 'Ledger Entry', badge: 'bg-muted text-muted-foreground border-border', icon: FileText };
    }
  };

  // Professional title / description formatting
  const getProfessionalDescription = (row: FinancialDaybookRow) => {
    const rawDesc = row.movement.description || row.transaction.description || '';
    
    // Normalize UUID-only or legacy descriptions
    if (rawDesc.startsWith('Reversal of ')) {
      const target = rawDesc.replace('Reversal of ', '').trim();
      if (target.toLowerCase().startsWith('purchase')) {
        return `Purchase Adjustment (Reversal) · ${target.replace(/^purchase\s*/i, '')}`;
      }
      if (target.toLowerCase().startsWith('supplier payment')) {
        return `Payable Payment Reversal · ${target.replace(/^supplier payment\s*·?\s*/i, '')}`;
      }
      if (target.toLowerCase().startsWith('customer payment')) {
        return `Customer Settlement Reversal · ${target.replace(/^customer payment\s*·?\s*/i, '')}`;
      }
      return `Adjustment & Reversal: ${target}`;
    }

    const isReceivableAccount = row.movement.accountId === 'financial-account-receivables' || row.account?.type === 'receivable';
    const isPayableAccount = row.movement.accountId === 'financial-account-payables' || row.account?.type === 'payable';

    if (row.transaction.sourceType === 'purchase') {
      const purchase = purchases.find(p => p.id === row.transaction.sourceId);
      const inv = purchase?.invoiceNumber ? ` #${purchase.invoiceNumber}` : '';
      const sup = purchase?.supplierName ? ` · ${purchase.supplierName}` : '';
      if (isPayableAccount) {
        return row.movement.amount >= 0
          ? `Supplier Payable Incurred (Inward)${inv}${sup}`
          : `Supplier Payable Adjusted${inv}${sup}`;
      }
      return `Purchase Inward${inv}${sup}`;
    }

    if (row.transaction.sourceType === 'supplier_payment') {
      const purchase = purchases.find(p => p.id === row.transaction.sourceId);
      const inv = purchase?.invoiceNumber ? ` #${purchase.invoiceNumber}` : '';
      const sup = purchase?.supplierName ? ` · ${purchase.supplierName}` : '';
      if (isPayableAccount) {
        return `Supplier Debt Cleared (Payable Settled)${inv}${sup}`;
      }
      return `Payment Paid to Supplier${inv}${sup}`;
    }

    if (row.transaction.sourceType === 'sale') {
      const sale = sales.find(s => s.id === row.transaction.sourceId);
      const cust = sale?.customerName ? ` · ${sale.customerName}` : '';
      if (isReceivableAccount) {
        return `Customer Credit Incurred (Receivable Increased)${cust}`;
      }
      return `Sale Revenue Received${cust}`;
    }

    if (row.transaction.sourceType === 'customer_payment') {
      const credit = credits.find(c => c.id === row.transaction.sourceId);
      const cust = credit?.customerName ? ` · ${credit.customerName}` : '';
      if (isReceivableAccount) {
        return `Customer Due Cleared (Receivable Settled)${cust}`;
      }
      return `Payment Received from Customer${cust}`;
    }

    if (row.transaction.sourceType === 'expense') {
      const exp = expenses.find(e => e.id === row.transaction.sourceId);
      return exp?.description ? `Expense: ${exp.description}` : rawDesc || 'Operating Expense';
    }

    return rawDesc || 'Financial Ledger Movement';
  };

  // Account balance cards computation
  const accountBalances = useMemo(() => {
    return accounts.map(account => {
      const balance = allRows
        .filter(row => row.movement.accountId === account.id)
        .reduce((sum, row) => sum + Number(row.movement.amount || 0), 0);

      let icon = Wallet;
      if (account.type === 'bank') icon = Landmark;
      else if (account.type === 'digital') icon = QrCode;
      else if (account.type === 'card') icon = CreditCard;
      else if (account.type === 'receivable') icon = UserCheck;
      else if (account.type === 'payable') icon = Building2;

      return {
        account,
        balance,
        icon,
      };
    });
  }, [accounts, allRows]);

  // Filtered rows memo
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      // 1. Date Range
      if (startDate && row.movement.date < `${startDate}T00:00:00.000Z`) return false;
      if (endDate && row.movement.date > `${endDate}T23:59:59.999Z`) return false;

      // 2. Account filter
      if (selectedAccountId !== 'all' && row.movement.accountId !== selectedAccountId) {
        return false;
      }

      // 3. Source Type filter
      if (selectedSourceType !== 'all' && row.transaction.sourceType !== selectedSourceType) {
        return false;
      }

      // 4. Flow filter
      if (flowFilter === 'inflow' && row.movement.amount <= 0) return false;
      if (flowFilter === 'outflow' && row.movement.amount >= 0) return false;

      // 5. Search term
      if (debouncedSearch) {
        const desc = (row.movement.description || row.transaction.description || '').toLowerCase();
        const profDesc = getProfessionalDescription(row).toLowerCase();
        const accountName = (row.account?.name || '').toLowerCase();
        const ref = (row.transaction.reference || '').toLowerCase();
        const amountStr = String(Math.abs(row.movement.amount));
        const matches =
          desc.includes(debouncedSearch) ||
          profDesc.includes(debouncedSearch) ||
          accountName.includes(debouncedSearch) ||
          ref.includes(debouncedSearch) ||
          amountStr.includes(debouncedSearch);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    allRows,
    startDate,
    endDate,
    selectedAccountId,
    selectedSourceType,
    flowFilter,
    debouncedSearch,
    purchases,
    sales,
    credits,
    expenses,
  ]);

  // Statistics for the filtered view
  const stats = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    filteredRows.forEach(row => {
      const amt = Number(row.movement.amount || 0);
      if (amt > 0) totalInflow += amt;
      else if (amt < 0) totalOutflow += Math.abs(amt);
    });
    return {
      totalInflow,
      totalOutflow,
      netMovement: totalInflow - totalOutflow,
      count: filteredRows.length,
    };
  }, [filteredRows]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRows.length === 0) return;
    const headers = ['Date', 'Time', 'Description', 'Source', 'Account', 'Amount', 'Reference', 'Transaction ID'];
    const csvLines = [headers.join(',')];

    filteredRows.forEach(row => {
      const d = new Date(row.movement.date);
      const dateStr = formatDate(d, 'yyyy-MM-dd');
      const timeStr = formatDate(d, 'HH:mm:ss');
      const desc = `"${getProfessionalDescription(row).replace(/"/g, '""')}"`;
      const src = `"${getSourceDisplay(row).label}"`;
      const acc = `"${(row.account?.name || 'Unassigned').replace(/"/g, '""')}"`;
      const amt = row.movement.amount;
      const ref = `"${(row.transaction.reference || '').replace(/"/g, '""')}"`;
      const id = row.transaction.id;

      csvLines.push([dateStr, timeStr, desc, src, acc, amt, ref, id].join(','));
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daybook_Export_${formatDate(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto pb-28 md:pb-12">
      {/* ── 1. Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
            <BookOpen className="size-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Financial Daybook</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Audit trail, ledger postings, and real-time cashflow movements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredRows.length === 0}
            className="h-9 gap-1.5 text-xs rounded-xl"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="h-9 w-9 rounded-xl"
            aria-label="Refresh Daybook"
            title="Refresh Daybook"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── 2. Account Balances Interactive Cards ─────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Account Balances
          </p>
          {selectedAccountId !== 'all' && (
            <button
              onClick={() => setSelectedAccountId('all')}
              className="text-xs text-primary hover:underline font-medium"
            >
              Reset to all accounts
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {accountBalances.map(({ account, balance, icon: Icon }) => {
            const isSelected = selectedAccountId === account.id;
            return (
              <Card
                key={account.id}
                onClick={() => setSelectedAccountId(isSelected ? 'all' : account.id)}
                className={`cursor-pointer transition-all duration-150 select-none hover:border-primary/50 hover:shadow-sm ${
                  isSelected
                    ? 'ring-2 ring-primary border-primary bg-primary/5'
                    : 'bg-card'
                }`}
              >
                <CardContent className="p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="size-3.5" />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">
                      {account.type}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium truncate" title={account.name}>
                      {account.name}
                    </p>
                    <p
                      className={`text-sm font-bold truncate mt-0.5 ${
                        balance > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : balance < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-foreground'
                      }`}
                    >
                      {format(balance)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── 3. Period Summary Metrics ─────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Inflow</span>
              <ArrowDownLeft className="size-4 text-emerald-600" />
            </div>
            <p className="text-lg md:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              +{format(stats.totalInflow)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500/10 via-card to-card border-rose-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Outflow</span>
              <ArrowUpRight className="size-4 text-rose-600" />
            </div>
            <p className="text-lg md:text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              -{format(stats.totalOutflow)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Net Cashflow</span>
              <DollarSign className="size-4 text-primary" />
            </div>
            <p
              className={`text-lg md:text-xl font-bold mt-1 ${
                stats.netMovement >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {stats.netMovement >= 0 ? '+' : ''}
              {format(stats.netMovement)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Movements</span>
              <Layers className="size-4 text-muted-foreground" />
            </div>
            <p className="text-lg md:text-xl font-bold text-foreground mt-1">
              {stats.count} <span className="text-xs font-normal text-muted-foreground">entries</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Search and Filter Bar ─────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-4">
          {/* Search and Date Quick Presets */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by description, reference, party, account, or amount..."
                className="pl-9 pr-8 h-10 rounded-xl"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Date Preset Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {DATE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleDatePresetChange(preset.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-colors ${
                    datePreset === preset.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Pickers when 'custom' is active */}
          {datePreset === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
              <label className="text-xs font-medium space-y-1 block">
                <span className="text-muted-foreground">From Date</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="h-9 rounded-lg"
                />
              </label>
              <label className="text-xs font-medium space-y-1 block">
                <span className="text-muted-foreground">To Date</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="h-9 rounded-lg"
                />
              </label>
            </div>
          )}

          {/* Source and Flow Secondary Filters */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs">
            <div className="flex items-center gap-1.5 mr-2 text-muted-foreground">
              <Filter className="size-3.5" />
              <span>Filter:</span>
            </div>

            {/* Flow selector */}
            <div className="flex rounded-lg border bg-muted/30 p-0.5">
              <button
                onClick={() => setFlowFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  flowFilter === 'all'
                    ? 'bg-background shadow-xs text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Flows
              </button>
              <button
                onClick={() => setFlowFilter('inflow')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  flowFilter === 'inflow'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                + Inflow
              </button>
              <button
                onClick={() => setFlowFilter('outflow')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  flowFilter === 'outflow'
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                - Outflow
              </button>
            </div>

            {/* Source dropdown */}
            <Select
              value={selectedSourceType}
              onValueChange={val => setSelectedSourceType(val as SourceTypeFilter)}
            >
              <SelectTrigger className="h-8 w-44 rounded-lg text-xs">
                <SelectValue placeholder="Source category" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_FILTERS.map(sf => (
                  <SelectItem key={sf.id} value={sf.id} className="text-xs">
                    {sf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reset active filters button */}
            {(searchTerm || selectedAccountId !== 'all' || selectedSourceType !== 'all' || flowFilter !== 'all' || datePreset !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedAccountId('all');
                  setSelectedSourceType('all');
                  setFlowFilter('all');
                  handleDatePresetChange('all');
                }}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground ml-auto"
              >
                Clear all filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 5. Responsive Day-Grouped Transaction List ─────────── */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="size-8 mx-auto animate-spin text-primary opacity-60" />
            <p className="text-sm text-muted-foreground">Loading daybook transactions...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center space-y-3">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <BookOpen className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold">No movements found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  There are no financial movements matching the active date or filter parameters.
                </p>
              </div>
              {(searchTerm || selectedAccountId !== 'all' || selectedSourceType !== 'all' || flowFilter !== 'all' || datePreset !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedAccountId('all');
                    setSelectedSourceType('all');
                    setFlowFilter('all');
                    handleDatePresetChange('all');
                  }}
                  className="text-xs rounded-xl"
                >
                  Reset filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <DateGroupedList
            items={filteredRows}
            getDate={row => row.movement.date}
            getId={row => row.movement.id}
            itemLabel="movement"
            formatTotal={total => `${total >= 0 ? '+' : ''}${format(total)}`}
            getAmount={row => row.movement.amount}
            renderItem={row => {
              const src = getSourceDisplay(row);
              const Icon = src.icon;
              const isPositive = row.movement.amount >= 0;
              const formattedTime = formatDate(parseISO(row.movement.date), 'h:mm a');
              const description = getProfessionalDescription(row);

              return (
                <Card
                  onClick={() => setSelectedRow(row)}
                  className="cursor-pointer transition-all duration-150 hover:shadow-md hover:border-primary/40 bg-card active:scale-[0.998]"
                >
                  <CardContent className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                    {/* Left: Icon & Details */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`size-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isPositive
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        }`}
                      >
                        <Icon className="size-5" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate text-foreground">
                            {description}
                          </p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4.5 font-medium ${src.badge}`}>
                            {src.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span className="font-medium text-foreground/80">
                            {row.account?.name || 'Unassigned Account'}
                          </span>
                          <span>&middot;</span>
                          <span>{formattedTime}</span>
                          {row.transaction.reference && (
                            <>
                              <span>&middot;</span>
                              <span className="font-mono text-[11px] bg-muted px-1.5 py-0.2 rounded">
                                Ref: {row.transaction.reference}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Arrow */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p
                          className={`text-sm sm:text-base font-bold tracking-tight ${
                            isPositive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {format(row.movement.amount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {row.transaction.status}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              );
            }}
          />
        )}
      </div>

      {/* ── 6. Transaction Details Audit Modal ─────────────────── */}
      <Dialog open={Boolean(selectedRow)} onOpenChange={open => !open && setSelectedRow(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Info className="size-5 text-primary" />
              Movement Details
            </DialogTitle>
            <DialogDescription>
              Complete ledger audit details and transaction metadata
            </DialogDescription>
          </DialogHeader>

          {selectedRow && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="p-3.5 rounded-xl bg-muted/50 border space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Description</p>
                    <p className="font-semibold text-base mt-0.5">
                      {getProfessionalDescription(selectedRow)}
                    </p>
                  </div>
                  <Badge variant="outline" className={`capitalize ${getSourceDisplay(selectedRow).badge}`}>
                    {getSourceDisplay(selectedRow).label}
                  </Badge>
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Amount Posted</span>
                  <span
                    className={`text-lg font-bold ${
                      selectedRow.movement.amount >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {selectedRow.movement.amount >= 0 ? '+' : ''}
                    {format(selectedRow.movement.amount)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg border bg-card space-y-1">
                  <span className="text-muted-foreground block">Ledger Account</span>
                  <span className="font-semibold text-foreground">
                    {selectedRow.account?.name || 'Unassigned'} ({selectedRow.account?.type || 'standard'})
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border bg-card space-y-1">
                  <span className="text-muted-foreground block">Posted Date & Time</span>
                  <span className="font-semibold text-foreground">
                    {formatDate(parseISO(selectedRow.movement.date), 'dd MMM yyyy, h:mm:ss a')}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border bg-card space-y-1">
                  <span className="text-muted-foreground block">Source Type</span>
                  <span className="font-mono text-foreground">{selectedRow.transaction.sourceType}</span>
                </div>
                <div className="p-2.5 rounded-lg border bg-card space-y-1">
                  <span className="text-muted-foreground block">Transaction Status</span>
                  <span className="font-semibold text-foreground capitalize">
                    {selectedRow.transaction.status}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Movement ID:</span>
                  <span className="truncate max-w-[220px]">{selectedRow.movement.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction ID:</span>
                  <span className="truncate max-w-[220px]">{selectedRow.transaction.id}</span>
                </div>
                {selectedRow.transaction.idempotencyKey && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Idempotency Key:</span>
                    <span className="truncate max-w-[220px]">{selectedRow.transaction.idempotencyKey}</span>
                  </div>
                )}
                {selectedRow.transaction.sourceId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source ID:</span>
                    <span className="truncate max-w-[220px]">{selectedRow.transaction.sourceId}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
