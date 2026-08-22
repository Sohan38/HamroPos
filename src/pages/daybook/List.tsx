import { useEffect, useMemo, useState } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { useStorageProvider } from '@/storage/StorageContext';
import { useCredit, useExpenses, useFinancialAccounts, usePurchases, useSales } from '@/contexts/GlobalProviders';
import { FinancialPostingService, type FinancialDaybookRow } from '@/services/financialPostingService';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function DaybookList() {
    const storage = useStorageProvider();
    const { items: accounts, refresh: refreshAccounts } = useFinancialAccounts();
    const { items: sales } = useSales();
    const { items: purchases } = usePurchases();
    const { items: expenses } = useExpenses();
    const { items: credits } = useCredit();
    const { format } = useCurrency();
    const [rows, setRows] = useState<FinancialDaybookRow[]>([]);
    const [allRows, setAllRows] = useState<FinancialDaybookRow[]>([]);
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');

    const sourceLabel = (row: FinancialDaybookRow) => {
        const labels: Record<string, string> = {
            sale: 'Sales',
            purchase: 'Purchases',
            expense: 'Expenses',
            customer_payment: 'Customer payment',
            supplier_payment: 'Supplier payment',
            transfer: 'Account transfer',
            opening_balance: 'Opening balance',
            financial_reversal: 'Correction / reversal',
        };
        return row.transaction.reference
            ? `${labels[row.transaction.sourceType] ?? 'Financial entry'} · ${row.transaction.reference}`
            : labels[row.transaction.sourceType] ?? 'Financial entry';
    };

    const descriptionLabel = (row: FinancialDaybookRow) => {
        if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(row.transaction.description.match(/\b[0-9a-f-]{36}\b/i)?.[0] ?? '')) {
            return row.transaction.description;
        }

        if (row.transaction.sourceType === 'purchase') {
            const purchase = purchases.find(item => item.id === row.transaction.sourceId);
            return `Purchase${purchase?.invoiceNumber ? ` ${purchase.invoiceNumber}` : ''}${purchase?.supplierName ? ` · ${purchase.supplierName}` : ''}`;
        }
        if (row.transaction.sourceType === 'sale') {
            const sale = sales.find(item => item.id === row.transaction.sourceId);
            return `Sale${sale?.customerName ? ` · ${sale.customerName}` : ''}`;
        }
        if (row.transaction.sourceType === 'expense') {
            return expenses.find(item => item.id === row.transaction.sourceId)?.description ?? 'Expense';
        }
        if (row.transaction.sourceType === 'customer_payment') {
            const credit = credits.find(item => item.id === row.transaction.sourceId);
            return `Customer payment${credit?.customerName ? ` · ${credit.customerName}` : ''}`;
        }
        if (row.transaction.sourceType === 'supplier_payment') return 'Supplier payment';
        if (row.transaction.sourceType === 'financial_reversal') return 'Correction / reversal';
        return row.transaction.type === 'transfer' ? 'Account transfer' : 'Financial entry';
    };

    const load = async () => {
        await FinancialPostingService.ensureDefaultAccounts(storage);
        const ledgerRows = await FinancialPostingService.getDaybook(storage);
        setAllRows(ledgerRows);
        setRows(ledgerRows.filter(row => (!start || row.movement.date >= `${start}T00:00:00.000Z`) && (!end || row.movement.date <= `${end}T23:59:59.999Z`)));
        refreshAccounts();
    };

    useEffect(() => { void load(); }, [start, end]);

    const balances = useMemo(() => accounts.map(account => ({
        account,
        balance: allRows
            .filter(row => row.movement.accountId === account.id)
            .reduce((sum, row) => sum + row.movement.amount, 0),
    })), [accounts, allRows]);

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto pb-24 md:pb-8">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <BookOpen className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">Daybook</h1>
                        <p className="text-sm text-muted-foreground">Posted financial movements</p>
                    </div>
                </div>
                <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Refresh daybook" title="Refresh daybook">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="text-sm space-y-1"><span className="text-muted-foreground">From</span><Input type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
                <label className="text-sm space-y-1"><span className="text-muted-foreground">To</span><Input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {balances.filter(({ balance }) => balance !== 0).map(({ account, balance }) => (
                    <Card key={account.id}><CardContent className="p-4"><p className="text-xs text-muted-foreground truncate">{account.name}</p><p className="font-semibold mt-1">{format(balance)}</p></CardContent></Card>
                ))}
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40"><tr className="text-left"><th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Account</th><th className="p-3">Source</th><th className="p-3 text-right">Movement</th></tr></thead>
                        <tbody className="divide-y">
                            {rows.map(row => <tr key={row.movement.id}><td className="p-3 whitespace-nowrap">{new Date(row.movement.date).toLocaleString()}</td><td className="p-3">{descriptionLabel(row)}</td><td className="p-3">{row.account?.name ?? 'Unassigned account'}</td><td className="p-3">{sourceLabel(row)}</td><td className={`p-3 text-right font-medium ${row.movement.amount >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{row.movement.amount >= 0 ? '+' : ''}{format(row.movement.amount)}</td></tr>)}
                            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No posted movements for this period.</td></tr>}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
