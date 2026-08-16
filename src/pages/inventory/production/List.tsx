import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Factory } from 'lucide-react';

export function ProductionList() {
    const [, setLocation] = useLocation();

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6 p-4 pb-28 md:p-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Operations</p>
                    <h1 className="text-2xl font-bold tracking-tight">Production</h1>
                </div>
                <Button onClick={() => setLocation('/inventory/production/new')} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Production
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Factory className="h-5 w-5" />
                        Production overview
                    </CardTitle>
                    <CardDescription>Create and review production transactions for material conversion.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                        Production listing and detail views are not yet implemented in this phase. Use the new production form to create a transaction.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
