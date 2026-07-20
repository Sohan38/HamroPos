import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useHotelRooms } from '@/contexts/GlobalProviders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function HotelRoomForm() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id?: string }>();
  const { items, add, update } = useHotelRooms();
  
  const isNew = !id || id === 'new';
  const existingRoom = !isNew ? items.find(i => i.id === id) : null;

  const [formData, setFormData] = useState({
    roomNumber: existingRoom?.roomNumber || '',
    roomType: existingRoom?.roomType || 'Standard',
    floor: existingRoom?.floor?.toString() || '1',
    capacity: existingRoom?.capacity?.toString() || '2',
    ratePerNight: existingRoom?.ratePerNight?.toString() || '',
    status: existingRoom?.status || 'available'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roomNumber || !formData.ratePerNight) {
      toast.error('Please fill required fields');
      return;
    }

    const payload = {
      roomNumber: formData.roomNumber,
      roomType: formData.roomType,
      floor: Number(formData.floor),
      capacity: Number(formData.capacity),
      ratePerNight: Number(formData.ratePerNight),
      status: formData.status as any,
      notes: '',
      currentGuestName: existingRoom?.currentGuestName || null,
      currentCheckIn: existingRoom?.currentCheckIn || null,
      currentCheckOut: existingRoom?.currentCheckOut || null,
    };

    if (isNew) {
      add(payload);
      toast.success('Room added');
    } else {
      update(id!, payload);
      toast.success('Room updated');
    }
    
    setLocation('/hotel');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/hotel')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{isNew ? 'Add Hotel Room' : 'Edit Room'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Room Number *</label>
                <Input 
                  value={formData.roomNumber}
                  onChange={e => setFormData({...formData, roomNumber: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Floor</label>
                <Input 
                  type="number"
                  value={formData.floor}
                  onChange={e => setFormData({...formData, floor: e.target.value})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Room Type</label>
                <Select value={formData.roomType} onValueChange={v => setFormData({...formData, roomType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Deluxe">Deluxe</SelectItem>
                    <SelectItem value="Suite">Suite</SelectItem>
                    <SelectItem value="Family">Family</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Capacity (Persons)</label>
                <Input 
                  type="number"
                  value={formData.capacity}
                  onChange={e => setFormData({...formData, capacity: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rate Per Night *</label>
                <Input 
                  type="number"
                  value={formData.ratePerNight}
                  onChange={e => setFormData({...formData, ratePerNight: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v as 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance'})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" size="lg" className="w-full md:w-auto">
                <Save className="mr-2 h-5 w-5" /> {isNew ? 'Save Room' : 'Update Room'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
