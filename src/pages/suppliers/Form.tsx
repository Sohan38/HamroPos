import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useSuppliers } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Building2, Phone, Mail, MapPin, Hash, FileText, User } from 'lucide-react';
import { toast } from 'sonner';

type FormData = {
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    vatPan: string;
    notes: string;
    status: 'active' | 'inactive';
};

const EMPTY_FORM: FormData = {
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    vatPan: '',
    notes: '',
    status: 'active',
};

export default function SupplierForm() {
    const goBack = useSmartBack('/suppliers');
    const { id } = useParams<{ id: string }>();
    const { items, add, update } = useSuppliers();
    const { format: _format } = useCurrency();

    const isNew = !id || id === 'new';
    const existing = !isNew ? items.find(s => s.id === id) : null;

    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (existing) {
            setForm({
                name: existing.name,
                contactPerson: existing.contactPerson ?? '',
                phone: existing.phone,
                email: existing.email,
                address: existing.address,
                vatPan: existing.vatPan,
                notes: existing.notes,
                status: existing.status ?? 'active',
            });
        }
    }, [existing]);

    const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
    };

    const validate = (): boolean => {
        const newErrors: typeof errors = {};
        if (!form.name.trim()) newErrors.name = 'Business name is required';
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            newErrors.email = 'Enter a valid email address';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                contactPerson: form.contactPerson.trim(),
                phone: form.phone.trim(),
                email: form.email.trim(),
                address: form.address.trim(),
                vatPan: form.vatPan.trim(),
                notes: form.notes.trim(),
                status: form.status,
            };
            if (isNew) {
                add(payload as any);
                toast.success('Supplier added');
            } else if (existing) {
                update(existing.id, payload);
                toast.success('Supplier updated');
            }
            goBack();
        } catch {
            toast.error('Failed to save supplier');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto pb-32">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="icon" onClick={goBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold">{isNew ? 'Add Supplier' : 'Edit Supplier'}</h1>
                    <p className="text-xs text-muted-foreground">
                        {isNew ? 'Create a new supplier record' : `Editing ${existing?.name ?? ''}`}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="md:rounded-2xl md:border md:bg-card md:overflow-hidden md:shadow-sm space-y-0">

                    {/* Business info */}
                    <section className="px-4 py-4 space-y-4">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Business Information</p>

                        <div className="space-y-1">
                            <Label htmlFor="name" className="text-sm">
                                Business Name <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="name"
                                    placeholder="e.g. Himalayan Distributors"
                                    value={form.name}
                                    onChange={set('name')}
                                    className={`pl-9 ${errors.name ? 'border-destructive' : ''}`}
                                />
                            </div>
                            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="contactPerson" className="text-sm">
                                Contact Person <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                            </Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="contactPerson"
                                    placeholder="e.g. Ram Sharma"
                                    value={form.contactPerson}
                                    onChange={set('contactPerson')}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="vatPan" className="text-sm">
                                PAN / VAT Number <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                            </Label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="vatPan"
                                    placeholder="e.g. 300001234"
                                    value={form.vatPan}
                                    onChange={set('vatPan')}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-2">
                            <Label className="text-sm">Status</Label>
                            <div className="flex gap-2">
                                {(['active', 'inactive'] as const).map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, status: s }))}
                                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all capitalize ${form.status === s
                                                ? s === 'active'
                                                    ? 'bg-green-50 border-green-400 text-green-700'
                                                    : 'bg-muted border-border text-muted-foreground'
                                                : 'border-border text-muted-foreground hover:bg-muted/50'
                                            }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <div className="border-t" />

                    {/* Contact details */}
                    <section className="px-4 py-4 space-y-4">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Contact Details</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="phone" className="text-sm">Phone</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="phone"
                                        type="tel"
                                        inputMode="tel"
                                        placeholder="e.g. 9841000001"
                                        value={form.phone}
                                        onChange={set('phone')}
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="email" className="text-sm">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        inputMode="email"
                                        placeholder="e.g. supplier@example.com"
                                        value={form.email}
                                        onChange={set('email')}
                                        className={`pl-9 ${errors.email ? 'border-destructive' : ''}`}
                                    />
                                </div>
                                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="address" className="text-sm">Address</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="address"
                                    placeholder="e.g. New Road, Kathmandu"
                                    value={form.address}
                                    onChange={set('address')}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </section>

                    <div className="border-t" />

                    {/* Notes */}
                    <section className="px-4 py-4 space-y-3">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Notes</p>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <textarea
                                id="notes"
                                placeholder="Any additional notes about this supplier..."
                                value={form.notes}
                                onChange={set('notes')}
                                rows={3}
                                maxLength={500}
                                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                            />
                        </div>
                    </section>
                </div>

                {/* Sticky save bar */}
                <div className="fixed left-0 right-0 bottom-0 md:static md:mt-4 bg-card border-t md:border md:rounded-xl p-4 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:shadow-none z-40">
                    <Button type="button" variant="outline" className="flex-1 md:flex-none md:w-28" onClick={goBack}>
                        Cancel
                    </Button>
                    <Button type="submit" className="flex-1 gap-2" disabled={saving}>
                        <Save className="h-4 w-4" />
                        {isNew ? 'Add Supplier' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
