import { useMemo } from 'react';
import { useLocation, useParams } from 'wouter';
import { useExpenses } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export default function ExpenseDetail() {
    const goBack = useSmartBack('/expenses');
    const [, setLocation] = useLocation();
    const { id } = useParams<{ id: string }>();
    const { items, remove } = useExpenses();
    const { format } = useCurrency();

    const expense = useMemo(() => items.find(e => e.id === id) ?? null, [items, id]);

    if (!expense) {
        return (
            <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto pb-24 md:pb-6">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="icon" onClick={goBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl font-bold">Expense not found</h1>
                </div>
            </div>
        );
    }

    const handleEdit = () => setLocation(`/expenses/${expense.id}/edit`);
    const handleDelete = async () => {
        if (!confirm('Delete this expense?')) return;
        await remove(expense.id);
        toast.success('Expense deleted');
        setLocation('/expenses');
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto pb-24 md:pb-6">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={goBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold">Expense</h1>
            </div>

            <Card>
                <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                {expense.description || expense.category}
                                {expense.sourcePurchaseId && (<Badge className="ml-2 text-xs">Auto</Badge>)}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">{formatDate(parseISO(expense.date), 'PPP')}</p>
                            <p className="text-sm text-muted-foreground mt-1 capitalize">Category: {expense.category}</p>
                            <p className="text-sm text-muted-foreground mt-1">Method: {expense.paymentMethod}</p>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-2xl text-red-600">{format(expense.amount)}</div>
                        </div>
                    </div>

                    {expense.notes && (
                        <div>
                            <h3 className="text-sm font-medium">Notes</h3>
                            <p className="text-sm text-muted-foreground mt-1">{expense.notes}</p>
                        </div>
                    )}

                    <div className="pt-4 flex justify-between items-center">
                        <div>
                            {expense.sourcePurchaseId && (
                                <Button variant="ghost" onClick={() => setLocation(`/purchases/${expense.sourcePurchaseId}`)}>
                                    View purchase
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleEdit}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </Button>
                            <Button variant="destructive" onClick={handleDelete}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
