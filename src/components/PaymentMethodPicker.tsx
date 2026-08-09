import { Button } from '@/components/ui/button';
import { Banknote, CreditCard, MoreHorizontal, QrCode, SplitSquareHorizontal } from 'lucide-react';

const SETTLE_PAYMENT_METHODS = ['cash', 'qr', 'card', 'bank', 'other'] as const;
export type SettlePaymentMethod = typeof SETTLE_PAYMENT_METHODS[number];

const PAYMENT_METHOD_LABELS: Record<SettlePaymentMethod, string> = {
    cash: 'Cash',
    qr: 'QR / Mobile Pay',
    card: 'Card',
    bank: 'Bank Transfer',
    other: 'Other',
};

interface PaymentMethodPickerProps {
    label?: string;
    selectedMethod: SettlePaymentMethod;
    onSelect: (method: SettlePaymentMethod) => void;
    methods?: readonly SettlePaymentMethod[];
}

export function PaymentMethodPicker({
    label = 'Payment method',
    selectedMethod,
    onSelect,
    methods = SETTLE_PAYMENT_METHODS,
}: PaymentMethodPickerProps) {
    return (
        <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                {label}
            </label>
            <div className="grid grid-cols-5 gap-1.5">
                {methods.map(method => (
                    <Button
                        key={method}
                        variant={selectedMethod === method ? 'default' : 'outline'}
                        className="flex-col h-14 gap-1 text-xs"
                        onClick={() => onSelect(method)}
                    >
                        {method === 'cash' && <Banknote className="h-4 w-4" />}
                        {method === 'qr' && <QrCode className="h-4 w-4" />}
                        {method === 'card' && <CreditCard className="h-4 w-4" />}
                        {method === 'bank' && <SplitSquareHorizontal className="h-4 w-4" />}
                        {method === 'other' && <MoreHorizontal className="h-4 w-4" />}
                        <span className="capitalize">{PAYMENT_METHOD_LABELS[method]}</span>
                    </Button>
                ))}
            </div>
        </div>
    );
}
