import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useCustomers } from '@/contexts/GlobalProviders';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, User, UserPlus, Check, Phone } from 'lucide-react';
import { Customer } from '@/types';
import { toast } from 'sonner';
import { rankSearch } from '@/utils/search/rank';

interface CustomerPickerProps {
  customerId: string;
  onChange: (id: string) => void;
  onClose: () => void;
}

/**
 * Mobile-first customer picker:
 * - Full-screen overlay on mobile, floating panel on desktop
 * - Search-first workflow with instant results
 * - One-tap selection, quick-create if not found
 */
export function CustomerPicker({ customerId, onChange, onClose }: CustomerPickerProps) {
  const { items: customers, add } = useCustomers();
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return customers.slice(0, 8);
    return rankSearch(customers, query, 20);
  }, [customers, query]);

  const handleSelect = useCallback((c: Customer) => {
    onChange(customerId === c.id ? '' : c.id);
    onClose();
  }, [onChange, onClose, customerId]);

  const handleWalkIn = useCallback(() => {
    onChange('');
    onClose();
  }, [onChange, onClose]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await add({ name: newName.trim(), phone: newPhone.trim(), address: '', email: '', notes: '' });
      toast.success(`Customer "${newName.trim()}" added`);
      onChange(created.id);
      setShowCreate(false);
      onClose();
      setNewName('');
      setNewPhone('');
    } finally {
      setCreating(false);
    }
  }, [add, newName, newPhone, onChange, onClose]);

  return (
    /* Full-screen on mobile, constrained panel on desktop (parent positions it) */
    <div className="fixed inset-0 z-9999 flex flex-col bg-background lg:absolute lg:inset-auto lg:top-full lg:left-0 lg:right-0 lg:mt-1 lg:rounded-xl lg:border lg:shadow-2xl lg:max-h-96 lg:z-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-3 border-b bg-background shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            placeholder="Search by name or phone…"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowCreate(false); }}
            className="pl-9 h-11 text-base bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-muted transition-colors shrink-0"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Quick-create form ────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="px-3 py-3 border-b bg-muted/10 space-y-2 shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Customer</p>
          <div className="flex gap-2">
            <Input
              placeholder="Name *"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="h-10 text-sm flex-1"
              autoFocus
            />
            <Input
              placeholder="Phone"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              className="h-10 text-sm w-32"
              inputMode="tel"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-9"
              disabled={!newName.trim() || creating}
              onClick={handleCreate}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Add & Select
            </Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── List ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Walk-in option */}
        <button
          onClick={handleWalkIn}
          className="w-full flex items-center gap-3 px-4 py-3.5 border-b hover:bg-muted/50 active:bg-muted text-left transition-colors"
        >
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">Walk-in Customer</div>
            <div className="text-xs text-muted-foreground">No customer record</div>
          </div>
          {!customerId && <Check className="h-4 w-4 text-primary shrink-0" />}
        </button>

        {/* Customer rows */}
        {filtered.map(c => (
          <button
            key={c.id}
            onClick={() => handleSelect(c)}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b hover:bg-muted/50 active:bg-muted text-left transition-colors"
          >
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{c.name}</div>
              {c.phone && (
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" />{c.phone}
                </div>
              )}
            </div>
            {customerId === c.id && <Check className="h-4 w-4 text-primary shrink-0" />}
          </button>
        ))}

        {/* No results → offer quick create */}
        {filtered.length === 0 && query && !showCreate && (
          <div className="px-4 py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No customer found for <strong>"{query}"</strong></p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowCreate(true); setNewName(query); }}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Add "{query}"
            </Button>
          </div>
        )}

        {customers.length === 0 && !query && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">No customers yet</p>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Add First Customer
            </Button>
          </div>
        )}
      </div>

      {/* ── Footer: Add new ──────────────────────────────────────────────────── */}
      {!showCreate && customers.length > 0 && (
        <div className="px-3 py-3 border-t bg-background shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-10 text-sm"
            onClick={() => { setShowCreate(true); if (query) setNewName(query); }}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add New Customer
          </Button>
        </div>
      )}
    </div>
  );
}
