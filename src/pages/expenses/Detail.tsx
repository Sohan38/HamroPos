import { useMemo } from 'react';
import { useLocation, useParams } from 'wouter';
import { useExpenses } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    Calendar,
    CreditCard,
    Edit,
    FileText,
    Link2,
    Pencil,
    Tag,
    Trash2,
    Zap,
    Droplets,
    Wifi,
    Utensils,
    Fuel,
    Wrench,
    Landmark,
    ShoppingCart,
    Package,
    Banknote,
} from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';

// Category icon mapping
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    salary: Banknote,
    electricity: Zap,
    water: Droplets,
    internet: Wifi,
    food: Utensils,
    fuel: Fuel,
    maintenance: Wrench,
    tax: Landmark,
    purchase: ShoppingCart,
    miscellaneous: Package,
};

function getCategoryIcon(category: string) {
    return CATEGORY_ICONS[category] ?? Package;
}

export default function ExpenseDetail() {
    const goBack = useSmartBack('/expenses');
    const [, setLocation] = useLocation();
    const { id } = useParams<{ id: string }>();
    const { items, remove } = useExpenses();
    const { format } = useCurrency();

    const expense = useMemo(() => items.find(e => e.id === id) ?? null, [items, id]);

    if (!expense) {
        return (
            <div className="p-4 md:p-6 max-w-2xl mx-auto pb-24 md:pb-6">
                <div className="flex items-center gap-3 mb-6">
                    <Button variant="ghost" size="icon" onClick={goBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl font-bold">Expense not found</h1>
                </div>
                <Button variant="outline" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Expenses
                </Button>
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

    const CategoryIcon = getCategoryIcon(expense.category);
    const isAuto = Boolean(expense.sourcePurchaseId);

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto pb-24 md:pb-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-bold truncate">Expense details</h1>
                        <p className="text-sm text-muted-foreground truncate">
                            {expense.description || expense.category}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={handleEdit}>
                        <Pencil className="h-4 w-4 mr-1.5" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                    </Button>
                </div>
            </div>

            {/* Hero card with amount */}
            <Card className="overflow-hidden">
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                            <CategoryIcon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                {expense.category}
                            </p>
                            <p className="text-sm font-medium truncate">
                                {expense.description || 'No description'}
                            </p>
                        </div>
                    </div>
                    <div className="mt-6 text-center">
                        <p className="text-4xl sm:text-5xl font-bold text-red-600 tabular-nums tracking-tight">
                            {format(expense.amount)}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Details card */}
            <Card>
                <CardContent className="p-4 sm:p-6">
                    <h2 className="text-base font-semibold mb-4">Details</h2>
                    <dl className="space-y-3">
                        {/* Date */}
                        <div className="flex items-center gap-3">
                            <dt className="flex items-center gap-2 text-sm text-muted-foreground w-32 shrink-0">
                                <Calendar className="h-4 w-4" /> Date
                            </dt>
                            <dd className="text-sm font-medium">
                                {formatDate(parseISO(expense.date), 'dd MMM yyyy')}
                            </dd>
                        </div>

                        {/* Payment method */}
                        <div className="flex items-center gap-3">
                            <dt className="flex items-center gap-2 text-sm text-muted-foreground w-32 shrink-0">
                                <CreditCard className="h-4 w-4" /> Method
                            </dt>
                            <dd className="text-sm font-medium capitalize">{expense.paymentMethod}</dd>
                        </div>

                        {/* Type */}
                        <div className="flex items-center gap-3">
                            <dt className="flex items-center gap-2 text-sm text-muted-foreground w-32 shrink-0">
                                <Tag className="h-4 w-4" /> Type
                            </dt>
                            <dd className="text-sm">
                                <Badge
                                    variant={isAuto ? 'secondary' : 'outline'}
                                    className="capitalize"
                                >
                                    {isAuto ? 'Auto' : 'Manual'}
                                </Badge>
                            </dd>
                        </div>

                        {/* Source purchase link (if auto) */}
                        {isAuto && (
                            <div className="flex items-center gap-3 pt-1">
                                <dt className="flex items-center gap-2 text-sm text-muted-foreground w-32 shrink-0">
                                    <Link2 className="h-4 w-4" /> Source
                                </dt>
                                <dd className="text-sm">
                                    <Button
                                        variant="link"
                                        className="p-0 h-auto text-sm text-primary"
                                        onClick={() => setLocation(`/purchases/${expense.sourcePurchaseId}`)}
                                    >
                                        View purchase
                                    </Button>
                                </dd>
                            </div>
                        )}
                    </dl>
                </CardContent>
            </Card>

            {/* Notes (only if present) */}
            {expense.notes && (
                <Card>
                    <CardContent className="p-4 sm:p-6">
                        <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4" /> Notes
                        </h2>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {expense.notes}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}