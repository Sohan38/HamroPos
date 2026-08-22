import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { v4 as uuidv4 } from 'uuid';
import {
  Building2,
  Landmark,
  Wallet,
  QrCode,
  CreditCard,
  UserCheck,
  Plus,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  X,
  MoreVertical,
  Edit2,
  SlidersHorizontal,
  FileText,
  DollarSign,
  Layers,
  History,
  CheckCircle2,
  AlertCircle,
  PiggyBank,
} from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';
import { useStorageProvider } from '@/storage/StorageContext';
import { useFinancialAccounts } from '@/contexts/GlobalProviders';
import {
  FinancialPostingService,
  type FinancialDaybookRow,
} from '@/services/financialPostingService';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { FinancialAccount, FinancialAccountType, FinancialAccountStatus } from '@/types';

type TabFilter = 'all' | 'cash' | 'bank' | 'cooperative' | 'digital' | 'other';

export default function AccountsList() {
  const [, setLocation] = useLocation();
  const storage = useStorageProvider();
  const { items: accounts, refresh: refreshAccounts } = useFinancialAccounts();
  const { format } = useCurrency();

  const [ledgerRows, setLedgerRows] = useState<FinancialDaybookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  // Dialog States
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [openingBalanceDialogOpen, setOpeningBalanceDialogOpen] = useState(false);
  const [selectedAccountForAction, setSelectedAccountForAction] = useState<FinancialAccount | null>(null);

  // Form States - Account
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<FinancialAccountType>('bank');
  const [institutionName, setInstitutionName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountNotes, setAccountNotes] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [savingAccount, setSavingAccount] = useState(false);

  // Form States - Transfer
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferRef, setTransferRef] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [savingTransfer, setSavingTransfer] = useState(false);

  // Form States - Opening Balance
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [balanceNotes, setBalanceNotes] = useState('');
  const [savingBalance, setSavingBalance] = useState(false);

  // Load ledger entries to calculate balances
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      await FinancialPostingService.ensureDefaultAccounts(storage);
      const rows = await FinancialPostingService.getDaybook(storage);
      setLedgerRows(rows);
      refreshAccounts();
    } catch (error) {
      console.error('[Accounts] Failed to load data:', error);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [storage, refreshAccounts]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Compute live balances per account
  const accountBalancesMap = useMemo(() => {
    const map = new Map<string, number>();
    accounts.forEach(acc => map.set(acc.id, 0));
    ledgerRows.forEach(row => {
      const accId = row.movement.accountId;
      const current = map.get(accId) ?? 0;
      map.set(accId, current + Number(row.movement.amount || 0));
    });
    return map;
  }, [accounts, ledgerRows]);

  // Summary Totals
  const summaryTotals = useMemo(() => {
    let totalCash = 0;
    let totalBank = 0;
    let totalCooperative = 0;
    let totalDigital = 0;
    let totalReceivables = 0;
    let totalPayables = 0;

    accounts.forEach(acc => {
      const balance = accountBalancesMap.get(acc.id) ?? 0;
      if (acc.type === 'cash') totalCash += balance;
      else if (acc.type === 'bank') totalBank += balance;
      else if (acc.type === 'cooperative') totalCooperative += balance;
      else if (acc.type === 'digital' || acc.type === 'card') totalDigital += balance;
      else if (acc.type === 'receivable') totalReceivables += balance;
      else if (acc.type === 'payable') totalPayables += balance;
    });

    const totalLiquid = totalCash + totalBank + totalCooperative + totalDigital;

    return {
      totalCash,
      totalBank,
      totalCooperative,
      totalDigital,
      totalLiquid,
      totalReceivables,
      totalPayables,
    };
  }, [accounts, accountBalancesMap]);

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      if (acc.status === 'inactive') return false;

      // Tab filter
      if (activeTab === 'cash' && acc.type !== 'cash') return false;
      if (activeTab === 'bank' && acc.type !== 'bank') return false;
      if (activeTab === 'cooperative' && acc.type !== 'cooperative') return false;
      if (activeTab === 'digital' && acc.type !== 'digital' && acc.type !== 'card') return false;
      if (activeTab === 'other' && (acc.type === 'cash' || acc.type === 'bank' || acc.type === 'cooperative' || acc.type === 'digital' || acc.type === 'card')) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          acc.name.toLowerCase().includes(q) ||
          (acc.institutionName || '').toLowerCase().includes(q) ||
          (acc.accountNumber || '').toLowerCase().includes(q) ||
          acc.type.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [accounts, activeTab, searchTerm]);

  // Open Create Account Modal
  const handleOpenCreateAccount = () => {
    setEditingAccount(null);
    setAccountName('');
    setAccountType('bank');
    setInstitutionName('');
    setAccountNumber('');
    setAccountNotes('');
    setInitialBalance('0');
    setAccountDialogOpen(true);
  };

  // Open Edit Account Modal
  const handleOpenEditAccount = (acc: FinancialAccount) => {
    setEditingAccount(acc);
    setAccountName(acc.name);
    setAccountType(acc.type);
    setInstitutionName(acc.institutionName || '');
    setAccountNumber(acc.accountNumber || '');
    setAccountNotes(acc.notes || '');
    setInitialBalance('0');
    setAccountDialogOpen(true);
  };

  // Save Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) {
      toast.error('Please provide an account name.');
      return;
    }

    setSavingAccount(true);
    try {
      const now = new Date().toISOString();
      const accountId = editingAccount ? editingAccount.id : `acc-${uuidv4().slice(0, 8)}`;

      const payload: FinancialAccount = {
        id: accountId,
        name: accountName.trim(),
        type: accountType,
        status: editingAccount ? editingAccount.status : 'active',
        institutionName: institutionName.trim() || null,
        accountNumber: accountNumber.trim() || null,
        notes: accountNotes.trim() || null,
        paymentMethods: accountType === 'cash' ? ['cash'] : accountType === 'bank' ? ['bank'] : accountType === 'digital' ? ['qr'] : accountType === 'card' ? ['card'] : [],
        isSystem: editingAccount?.isSystem ?? false,
        createdAt: editingAccount?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
        version: (editingAccount?.version ?? 0) + 1,
      };

      await storage.save('financialAccounts', payload);

      // If initial opening balance entered for a brand new account, post it to ledger!
      const initBal = Number(initialBalance) || 0;
      if (!editingAccount && initBal > 0) {
        await FinancialPostingService.postOpeningBalance(storage, {
          id: uuidv4(),
          date: now,
          accountId: payload.id,
          amount: initBal,
          description: `Initial opening balance for ${payload.name}`,
        });
      }

      toast.success(editingAccount ? 'Account updated' : 'Account created successfully');
      setAccountDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save account');
    } finally {
      setSavingAccount(false);
    }
  };

  // Open Transfer Modal
  const handleOpenTransfer = (fromAcc?: FinancialAccount) => {
    const validAccounts = accounts.filter(a => a.status === 'active' && a.type !== 'receivable' && a.type !== 'payable');
    setTransferFromId(fromAcc ? fromAcc.id : validAccounts[0]?.id || '');
    setTransferToId(validAccounts.find(a => a.id !== (fromAcc ? fromAcc.id : validAccounts[0]?.id))?.id || '');
    setTransferAmount('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferRef('');
    setTransferNotes('');
    setTransferDialogOpen(true);
  };

  // Execute Transfer
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(transferAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid transfer amount.');
      return;
    }
    if (!transferFromId || !transferToId) {
      toast.error('Please select both source and destination accounts.');
      return;
    }
    if (transferFromId === transferToId) {
      toast.error('Source and destination accounts must be different.');
      return;
    }

    setSavingTransfer(true);
    try {
      const fromAccount = accounts.find(a => a.id === transferFromId);
      const toAccount = accounts.find(a => a.id === transferToId);

      await FinancialPostingService.postTransfer(storage, {
        id: uuidv4(),
        date: new Date(`${transferDate}T${new Date().toLocaleTimeString('en-GB')}`).toISOString(),
        amount,
        fromAccountId: transferFromId,
        toAccountId: transferToId,
        description: `Transfer: ${fromAccount?.name ?? 'Account'} ➔ ${toAccount?.name ?? 'Account'}${transferNotes ? ` · ${transferNotes}` : ''}`,
      });

      toast.success(`Transferred ${format(amount)} from ${fromAccount?.name} to ${toAccount?.name}`);
      setTransferDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete transfer');
    } finally {
      setSavingTransfer(false);
    }
  };

  // Open Opening Balance Modal
  const handleOpenOpeningBalance = (acc: FinancialAccount) => {
    setSelectedAccountForAction(acc);
    setBalanceAmount(String(accountBalancesMap.get(acc.id) ?? 0));
    setBalanceDate(new Date().toISOString().split('T')[0]);
    setBalanceNotes('');
    setOpeningBalanceDialogOpen(true);
  };

  // Save Opening Balance Posting
  const handleSaveOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountForAction) return;

    const amount = Number(balanceAmount);
    if (isNaN(amount)) {
      toast.error('Please enter a valid amount.');
      return;
    }

    setSavingBalance(true);
    try {
      await FinancialPostingService.postOpeningBalance(storage, {
        id: uuidv4(),
        date: new Date(`${balanceDate}T${new Date().toLocaleTimeString('en-GB')}`).toISOString(),
        accountId: selectedAccountForAction.id,
        amount,
        description: `Opening balance / baseline adjustment for ${selectedAccountForAction.name}${balanceNotes ? ` · ${balanceNotes}` : ''}`,
      });

      toast.success(`Opening balance posted for ${selectedAccountForAction.name}`);
      setOpeningBalanceDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post opening balance');
    } finally {
      setSavingBalance(false);
    }
  };

  const getAccountIcon = (type: FinancialAccountType) => {
    switch (type) {
      case 'cash': return Wallet;
      case 'bank': return Landmark;
      case 'cooperative': return PiggyBank;
      case 'digital': return QrCode;
      case 'card': return CreditCard;
      case 'receivable': return UserCheck;
      case 'payable': return Building2;
      default: return DollarSign;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto pb-28 md:pb-12">
      {/* ── 1. Page Header ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
            <Building2 className="size-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Accounts & Banking</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Manage Cash Drawers, Banks, Cooperatives (Sahakari), Wallets & Internal Transfers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenTransfer()}
            className="h-9 gap-1.5 text-xs rounded-xl font-medium"
          >
            <ArrowRightLeft className="size-3.5" />
            Transfer Funds
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreateAccount}
            className="h-9 gap-1.5 text-xs rounded-xl font-medium shadow-sm"
          >
            <Plus className="size-4" />
            Add Account / Bank
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="h-9 w-9 rounded-xl"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── 2. Liquid Assets Summary Metrics ─────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/20 col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Liquid Funds</span>
              <DollarSign className="size-4 text-emerald-600" />
            </div>
            <p className="text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
              {format(summaryTotals.totalLiquid)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cash + Banks + Sahakari + QR
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Cash in Hand</span>
              <Wallet className="size-4 text-primary" />
            </div>
            <p className="text-lg md:text-xl font-bold text-foreground mt-1">
              {format(summaryTotals.totalCash)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Counter & Drawer cash
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Bank & Sahakari</span>
              <Landmark className="size-4 text-blue-600" />
            </div>
            <p className="text-lg md:text-xl font-bold text-foreground mt-1">
              {format(summaryTotals.totalBank + summaryTotals.totalCooperative)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Banks: {format(summaryTotals.totalBank)} · Sahakari: {format(summaryTotals.totalCooperative)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Digital / QR</span>
              <QrCode className="size-4 text-purple-600" />
            </div>
            <p className="text-lg md:text-xl font-bold text-foreground mt-1">
              {format(summaryTotals.totalDigital)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              eSewa, Khalti, Card
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. Filter Tabs & Search Bar ──────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Accounts' },
            { id: 'cash', label: 'Cash' },
            { id: 'bank', label: 'Banks' },
            { id: 'cooperative', label: 'Sahakari' },
            { id: 'digital', label: 'Digital / QR' },
            { id: 'other', label: 'Receivables / Payables' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabFilter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search accounts..."
            className="pl-9 pr-8 h-9 text-xs rounded-xl"
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
      </div>

      {/* ── 4. Accounts Grid ─────────────────────────────────── */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="size-8 mx-auto animate-spin text-primary opacity-60" />
          <p className="text-sm text-muted-foreground">Loading accounts...</p>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Building2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold">No accounts found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                No accounts match the current filter. Add a new Bank, Sahakari, or Cash drawer.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleOpenCreateAccount}
              className="text-xs rounded-xl gap-1.5"
            >
              <Plus className="size-4" /> Add Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map(acc => {
            const balance = accountBalancesMap.get(acc.id) ?? 0;
            const Icon = getAccountIcon(acc.type);
            const isLiquid = acc.type === 'cash' || acc.type === 'bank' || acc.type === 'cooperative' || acc.type === 'digital';

            return (
              <Card
                key={acc.id}
                className="hover:shadow-md hover:border-primary/40 transition-all duration-150 bg-card overflow-hidden"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-muted text-foreground/80 shrink-0">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm leading-tight text-foreground">
                          {acc.name}
                        </h3>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">
                          {acc.institutionName ? `${acc.institutionName} · ` : ''}
                          {acc.type === 'cooperative' ? 'Sahakari' : acc.type}
                        </p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 text-xs">
                        {isLiquid && (
                          <DropdownMenuItem onClick={() => handleOpenTransfer(acc)}>
                            <ArrowRightLeft className="size-3.5 mr-2" />
                            Transfer from here
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleOpenOpeningBalance(acc)}>
                          <SlidersHorizontal className="size-3.5 mr-2" />
                          Set / Adjust Balance
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenEditAccount(acc)}>
                          <Edit2 className="size-3.5 mr-2" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation('/daybook')}>
                          <History className="size-3.5 mr-2" />
                          View in Daybook
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Account Number or Note if present */}
                  {acc.accountNumber && (
                    <div className="text-xs bg-muted/40 px-2.5 py-1 rounded-md font-mono text-muted-foreground flex justify-between">
                      <span>A/C:</span>
                      <span className="font-semibold text-foreground">{acc.accountNumber}</span>
                    </div>
                  )}

                  {/* Balance Display */}
                  <div className="border-t pt-2.5 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Current Balance</span>
                    <span
                      className={`text-base font-bold ${
                        balance > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : balance < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-foreground'
                      }`}
                    >
                      {format(balance)}
                    </span>
                  </div>

                  {/* Quick Action footer */}
                  {isLiquid && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenTransfer(acc)}
                        className="h-7 text-[11px] rounded-lg"
                      >
                        <ArrowRightLeft className="size-3 mr-1" /> Transfer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenOpeningBalance(acc)}
                        className="h-7 text-[11px] rounded-lg text-muted-foreground hover:text-foreground"
                      >
                        Adjust Bal
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── 5. Add / Edit Account Modal ──────────────────────── */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Account' : 'Add New Account / Bank / Sahakari'}
            </DialogTitle>
            <DialogDescription>
              Set up your bank accounts, cooperative deposits, or cash drawers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAccount} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-medium">Account Name *</label>
              <Input
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                placeholder="e.g. Nabil Bank Current, Sahakari Savings, Locker Cash"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">Account Type *</label>
                <Select
                  value={accountType}
                  onValueChange={val => setAccountType(val as FinancialAccountType)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="cooperative">Sahakari (Cooperative)</SelectItem>
                    <SelectItem value="cash">Cash Drawer</SelectItem>
                    <SelectItem value="digital">Digital Wallet / QR</SelectItem>
                    <SelectItem value="card">Card Clearing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Institution Name</label>
                <Input
                  value={institutionName}
                  onChange={e => setInstitutionName(e.target.value)}
                  placeholder="e.g. Nabil Bank, Shree Sahakari"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Account Number (Optional)</label>
              <Input
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                placeholder="e.g. 01201017500124"
              />
            </div>

            {!editingAccount && (
              <div className="space-y-2 p-3 bg-muted/40 rounded-xl border">
                <label className="text-xs font-semibold text-foreground block">
                  Initial Starting Balance (Opening Balance)
                </label>
                <p className="text-[11px] text-muted-foreground">
                  How much money is currently in this account right now?
                </p>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={initialBalance}
                  onChange={e => setInitialBalance(e.target.value)}
                  placeholder="0.00"
                  className="font-bold text-base"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium">Notes (Optional)</label>
              <Textarea
                value={accountNotes}
                onChange={e => setAccountNotes(e.target.value)}
                placeholder="Branch location, contact person, or remarks"
                rows={2}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAccountDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingAccount}>
                {savingAccount ? 'Saving...' : editingAccount ? 'Save Changes' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 6. Transfer Money Modal ──────────────────────────── */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="size-5 text-primary" />
              Transfer Funds Between Accounts
            </DialogTitle>
            <DialogDescription>
              Move money between your cash drawers, bank accounts, or Sahakari.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteTransfer} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">From Account *</label>
                <Select value={transferFromId} onValueChange={setTransferFromId}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter(a => a.status === 'active' && a.type !== 'receivable' && a.type !== 'payable')
                      .map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({format(accountBalancesMap.get(a.id) ?? 0)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">To Account *</label>
                <Select value={transferToId} onValueChange={setTransferToId}>
                  <SelectTrigger><SelectValue placeholder="Select target" /></SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter(a => a.status === 'active' && a.id !== transferFromId && a.type !== 'receivable' && a.type !== 'payable')
                      .map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({format(accountBalancesMap.get(a.id) ?? 0)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Transfer Amount *</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={transferAmount}
                onChange={e => setTransferAmount(e.target.value)}
                placeholder="0.00"
                required
                className="text-lg font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">Date *</label>
                <Input
                  type="date"
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Reference (Optional)</label>
                <Input
                  value={transferRef}
                  onChange={e => setTransferRef(e.target.value)}
                  placeholder="e.g. Cheque #, Voucher #"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Remarks (Optional)</label>
              <Input
                value={transferNotes}
                onChange={e => setTransferNotes(e.target.value)}
                placeholder="e.g. Daily cash deposit, Sahakari installment"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransferDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingTransfer}>
                {savingTransfer ? 'Processing...' : 'Complete Transfer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 7. Set / Adjust Opening Balance Modal ────────────── */}
      <Dialog open={openingBalanceDialogOpen} onOpenChange={setOpeningBalanceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-primary" />
              Set Opening Balance / Baseline
            </DialogTitle>
            <DialogDescription>
              Record the baseline opening balance for{' '}
              <span className="font-semibold text-foreground">
                {selectedAccountForAction?.name}
              </span>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveOpeningBalance} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-medium">Starting Amount *</label>
              <Input
                type="number"
                step="0.01"
                value={balanceAmount}
                onChange={e => setBalanceAmount(e.target.value)}
                placeholder="0.00"
                required
                className="text-lg font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Effective Date *</label>
              <Input
                type="date"
                value={balanceDate}
                onChange={e => setBalanceDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Remarks (Optional)</label>
              <Input
                value={balanceNotes}
                onChange={e => setBalanceNotes(e.target.value)}
                placeholder="e.g. Verified bank statement balance"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpeningBalanceDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingBalance}>
                {savingBalance ? 'Saving...' : 'Post Opening Balance'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
