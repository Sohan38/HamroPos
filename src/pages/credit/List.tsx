import { useLocation } from 'wouter';
import { useCredit } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Banknote, Plus, Calendar, User, ChevronRight, CheckCircle2, Clock, TrendingDown } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

export default function CreditList() {
  const [, setLocation] = useLocation();
  const { items } = useCredit();
  const { format } = useCurrency();

  const totalPending = items
    .filter(i => i.status !== 'paid')
    .reduce((s, i) => s + Math.max(0, i.amount - (i.paidAmount ?? 0)), 0);
  const totalReceived = items
    .reduce((s, i) => s + (i.paidAmount ?? 0) + (i.status === 'paid' && !i.paidAmount ? i.amount : 0), 0);

  const statusConfig = {
    pending: {
      label: 'Pending',
      className: 'bg-orange-500/10 text-orange-600 border-orange-200',
      icon: <Clock className="h-3 w-3" />,
    },
    partial: {
      label: 'Partial',
      className: 'bg-blue-500/10 text-blue-600 border-blue-200',
      icon: <TrendingDown className="h-3 w-3" />,
    },
    paid: {
      label: 'Settled',
      className: 'bg-green-500/10 text-green-600 border-green-200',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Credit (Udharo)</h1>
          <p className="text-muted-foreground">Manage unpaid balances</p>
        </div>
        <Button onClick={() => setLocation('/credit/new')} size="lg" className="w-full md:w-auto shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> Add Credit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-orange-500/10 border-orange-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-orange-800">Total Pending</p>
            <h2 className="text-2xl font-bold text-orange-600 mt-1">{format(totalPending)}</h2>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-green-800">Total Received</p>
            <h2 className="text-2xl font-bold text-green-600 mt-1">{format(totalReceived)}</h2>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <Banknote className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No credit records</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((credit) => {
            const paidAmount = credit.paidAmount ?? 0;
            const remaining = Math.max(0, credit.amount - paidAmount);
            const progressPct = credit.amount > 0 ? Math.min(100, (paidAmount / credit.amount) * 100) : 0;
            const statusCfg = statusConfig[credit.status] ?? statusConfig.pending;

            return (
              <Card
                key={credit.id}
                className="hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setLocation(`/credit/${credit.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                      credit.status === 'paid'
                        ? 'bg-green-500/10 text-green-600'
                        : credit.status === 'partial'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-orange-500/10 text-orange-600',
                    )}>
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{credit.customerName}</span>
                        <Badge variant="outline" className={cn('flex items-center gap-1 text-[10px] shrink-0', statusCfg.className)}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{credit.description}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(parseISO(credit.date), 'MMM d')}
                        {credit.dueDate && ` • Due: ${formatDate(parseISO(credit.dueDate), 'MMM d')}`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            progressPct >= 100 ? 'bg-green-500' : progressPct > 0 ? 'bg-blue-500' : 'bg-orange-400',
                          )}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {credit.status !== 'paid' ? (
                        <div>
                          <span className="text-xs text-muted-foreground">Remaining </span>
                          <span className="font-bold text-orange-600">{format(remaining)}</span>
                          <span className="text-xs text-muted-foreground"> / {format(credit.amount)}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-green-600">{format(credit.amount)}</span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
