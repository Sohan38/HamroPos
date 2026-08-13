import { useState, useEffect } from 'react';
import { useLocations } from '@/contexts/GlobalProviders';
import { useApp } from '@/contexts/AppContext';
import { Location } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, Check, Star } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { v4 as uuidv4 } from 'uuid';

export function LocationsTab() {
    const { items: locations, add, update, remove } = useLocations();
    const { settings, updateSettings } = useApp();

    // Dialog states
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formCode, setFormCode] = useState('');
    const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
    const [formNotes, setFormNotes] = useState('');

    // Filter
    const [showInactive, setShowInactive] = useState(false);

    const defaultLocation = locations.find(loc => loc.isDefault);
    const visibleLocations = showInactive ? locations : locations.filter(loc => loc.status !== 'inactive');

    const resetForm = () => {
        setFormName('');
        setFormCode('');
        setFormStatus('active');
        setFormNotes('');
        setEditingId(null);
        setIsCreating(false);
        setDeletingId(null);
    };

    const openCreate = () => {
        resetForm();
        setIsCreating(true);
    };

    const openEdit = (location: Location) => {
        setFormName(location.name);
        setFormCode(location.code ?? '');
        setFormStatus(location.status ?? 'active');
        setFormNotes(location.notes ?? '');
        setEditingId(location.id);
        setIsCreating(false);
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            toast.error('Location name is required');
            return;
        }

        try {
            if (editingId) {
                // Edit existing
                const current = locations.find(l => l.id === editingId);
                if (!current) return;

                await update(editingId, {
                    name: formName.trim(),
                    code: formCode.trim() || undefined,
                    status: formStatus,
                    notes: formNotes.trim() || undefined,
                });
                toast.success('Location updated');
            } else {
                // Create new
                await add({
                    name: formName.trim(),
                    code: formCode.trim() || undefined,
                    status: formStatus,
                    notes: formNotes.trim() || undefined,
                });
                toast.success('Location created');
            }
            resetForm();
        } catch (err) {
            console.error('Failed to save location:', err);
            toast.error('Failed to save location');
        }
    };

    const handleMakeDefault = async (locationId: string) => {
        try {
            // Unset previous default
            if (defaultLocation && defaultLocation.id !== locationId) {
                await update(defaultLocation.id, { isDefault: false });
            }
            // Set new default
            await update(locationId, { isDefault: true });
            // Update app settings
            updateSettings({ defaultLocationId: locationId });
            toast.success('Default location updated');
        } catch (err) {
            console.error('Failed to set default location:', err);
            toast.error('Failed to set default location');
        }
    };

    const handleToggleStatus = async (location: Location) => {
        try {
            const newStatus = (location.status ?? 'active') === 'active' ? 'inactive' : 'active';
            await update(location.id, { status: newStatus });
            toast.success(`Location ${newStatus}`);
        } catch (err) {
            console.error('Failed to toggle status:', err);
            toast.error('Failed to update location status');
        }
    };

    const handleDeleteClick = (location: Location) => {
        if (location.isDefault) {
            toast.error('Cannot delete the default location');
            return;
        }
        setDeletingId(location.id);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (!deletingId) return;
        try {
            await remove(deletingId);
            toast.success('Location deleted');
            setShowDeleteConfirm(false);
            resetForm();
        } catch (err) {
            console.error('Failed to delete location:', err);
            toast.error('Failed to delete location');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Locations</h2>
                    <p className="text-sm text-muted-foreground mt-1">Manage business locations and set defaults</p>
                </div>
                <Button onClick={openCreate} className="gap-2" size="lg">
                    <Plus className="h-4 w-4" /> Add Location
                </Button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="show-inactive"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="h-4 w-4"
                />
                <Label htmlFor="show-inactive" className="text-sm cursor-pointer">Show inactive locations</Label>
            </div>

            {/* Locations List */}
            <div className="space-y-3">
                {visibleLocations.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            {locations.length === 0 ? 'No locations yet' : 'All locations are inactive'}
                        </CardContent>
                    </Card>
                ) : (
                    visibleLocations.map((location) => {
                        const isActive = (location.status ?? 'active') === 'active';
                        const isDefaultLoc = location.isDefault;

                        return (
                            <Card key={location.id} className={isActive ? '' : 'opacity-60'}>
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between gap-4">
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold truncate">{location.name}</h3>
                                                {isDefaultLoc && (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                        <Star className="h-3 w-3" /> Default
                                                    </span>
                                                )}
                                                {!isActive && (
                                                    <span className="inline-flex text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                            {location.code && (
                                                <p className="text-xs text-muted-foreground mt-1">Code: {location.code}</p>
                                            )}
                                            {location.notes && (
                                                <p className="text-xs text-muted-foreground mt-1 truncate">{location.notes}</p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {!isDefaultLoc && isActive && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleMakeDefault(location.id)}
                                                    title="Set as default"
                                                    className="gap-1"
                                                >
                                                    <Star className="h-4 w-4" />
                                                </Button>
                                            )}

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleToggleStatus(location)}
                                                title={isActive ? 'Deactivate' : 'Activate'}
                                            >
                                                {isActive ? 'Deactivate' : 'Activate'}
                                            </Button>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openEdit(location)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>

                                            {!isDefaultLoc && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteClick(location)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isCreating || editingId !== null} onOpenChange={(open) => !open && resetForm()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Location' : 'Create Location'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="loc-name">Location Name *</Label>
                            <Input
                                id="loc-name"
                                placeholder="e.g. Main Store"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="loc-code">Code (optional)</Label>
                            <Input
                                id="loc-code"
                                placeholder="e.g. LOC001"
                                value={formCode}
                                onChange={(e) => setFormCode(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="loc-status">Status</Label>
                            <Select value={formStatus} onValueChange={(v) => setFormStatus(v as 'active' | 'inactive')}>
                                <SelectTrigger id="loc-status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="loc-notes">Notes (optional)</Label>
                            <Input
                                id="loc-notes"
                                placeholder="e.g. Downtown branch"
                                value={formNotes}
                                onChange={(e) => setFormNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                        <Button type="button" onClick={handleSave}>
                            {editingId ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            {showDeleteConfirm && deletingId && (
                <ConfirmDialog
                    isOpen={showDeleteConfirm}
                    title="Delete Location"
                    description="Are you sure you want to delete this location? Historical records referencing it will remain unchanged."
                    onConfirm={handleConfirmDelete}
                    onClose={() => setShowDeleteConfirm(false)}
                    confirmText="Delete"
                />
            )}
        </div>
    );
}
