import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
    product: any; // replace with your Inventory type
    format: (value: number) => string;
    onClick: () => void;
}

export const ProductCard = memo(function ProductCard({
    product,
    format,
    onClick,
}: Props) {
    return (
        <Card
            className="cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all active:scale-95 select-none"
            onClick={onClick}
        >
            <CardContent className="p-3 text-center">
                <div
                    className="font-semibold truncate text-sm"
                    title={product.name}
                >
                    {product.name}
                </div>

                <div className="text-xs text-muted-foreground mt-0.5">
                    {product.quantity} {product.unit}
                </div>

                <div className="text-primary font-bold text-sm mt-1 tabular-nums">
                    {format(product.sellingRate)}
                </div>
            </CardContent>
        </Card>
    );
});