import { useMemo, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useCustomers, useSales, useCredit } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useCustomerStats } from '@/hooks/useCustomerStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Phone, MapPin, Mail, FileText, ShoppingCart,
  TrendingUp, Calendar, Hash, Edit2, Check, X, User,
  AlertCircle, ShoppingBag,
} from 'lucide-react';
import { format as formatDate, parseISO, formatDistanceToNow } from 'date-fns';

export default function CustomerDetail() {
  const goBack = useSmartBack('/customers');
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { items: customers, update } = useCustomers();
  const { format } = useCurrency();
  const stats = useCustomerStats(id);

  const customer = useMemo(() => customers.find(c => c.id === id), [customers, id]);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', email: '', notes: '' });

  const startEdit = () => {
    if (!customer) return;
    setForm({ name: customer.name, phone: customer.phone, address: customer.address, email: customer.email, notes: customer.notes });
    setEditing(true);
  };

  const saveEdit = () => {
    if (!customer || !form.name.trim()) return;
    update(customer.id, { name: form.name.trim(), phone: form.phone, address: form.address, email: form.email, notes: form.notes });
    setEditing(false);
  };

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Customer not found.</p>
        <Button variant="outline" className="mt-4" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const initials = customer.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto pb-24 md:pb-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{customer.name}</h1>
            {customer.phone && (
              <p className="text-xs text-muted-foreground">{customer.phone}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={!form.name.trim()}>
                <Check className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* ── Profile card ────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
              {initials || <User className="h-6 w-6" />}
            </div>

            {editing ? (
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
                <Input placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                <Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" />
                <Input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="sm:col-span-2" />
              </div>
            ) : (
              <div className="flex-1 space-y-2">
                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />{customer.phone}
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />{customer.address}
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />{customer.email}
                  </div>
                )}
                {customer.notes && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />{customer.notes}
                  </div>
                )}
                {!customer.phone && !customer.address && !customer.email && !customer.notes && (
                  <p className="text-sm text-muted-foreground italic">No contact details</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />Total Spent</p>
            <p className="text-lg font-bold mt-1 text-primary">{format(stats?.totalSpent ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" />Visits</p>
            <p className="text-lg font-bold mt-1">{stats?.visitCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-3 w-3" />Avg Order</p>
            <p className="text-lg font-bold mt-1">{format(stats?.avgOrderValue ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className={stats?.outstandingCredit ? 'border-orange-300/60' : ''}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />Credit Due
            </p>
            <p className={`text-lg font-bold mt-1 ${stats?.outstandingCredit ? 'text-orange-500' : ''}`}>
              {format(stats?.outstandingCredit ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Last purchase info */}
      {stats?.lastPurchaseDate && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          Last purchase{' '}
          <span className="font-medium text-foreground">
            {formatDistanceToNow(new Date(stats.lastPurchaseDate), { addSuffix: true })}
          </span>
          {' '}·{' '}
          {(() => {
            try { return formatDate(parseISO(stats.lastPurchaseDate), 'dd MMM yyyy'); }
            catch { return formatDate(new Date(stats.lastPurchaseDate), 'dd MMM yyyy'); }
          })()}
        </div>
      )}

      {/* ── Quick action ────────────────────────────────────────────────────── */}
      <Button className="w-full h-12 text-base gap-2" onClick={() => setLocation('/sales/new')}>
        <ShoppingBag className="h-4 w-4" />
        New Sale
      </Button>

      {/* ── Purchase history ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Purchase History
            {stats?.visitCount ? (
              <Badge variant="secondary" className="ml-auto font-normal">{stats.visitCount}</Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!stats || stats.sales.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <ShoppingCart className="mx-auto h-8 w-8 mb-3 opacity-20" />
              No purchases yet
            </div>
          ) : (
            <div className="divide-y">
              {stats.sales.map(sale => {
                let dateStr = '';
                try { dateStr = formatDate(parseISO(sale.date), 'dd MMM yyyy, h:mm a'); }
                catch { dateStr = formatDate(new Date(sale.date), 'dd MMM yyyy, h:mm a'); }

                return (
                  <button
                    key={sale.id}
                    onClick={() => setLocation(`/sales/${sale.id}`)}
                    className="w-full flex items-start justify-between gap-3 px-4 py-3.5 hover:bg-muted/40 active:bg-muted text-left transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {sale.items.slice(0, 2).map(i => i.productName).join(', ')}
                        {sale.items.length > 2 ? ` +${sale.items.length - 2} more` : ''}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{dateStr}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize h-4">
                          {sale.paymentMethod}
                        </Badge>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-primary tabular-nums shrink-0">
                      {format(sale.grandTotal)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
