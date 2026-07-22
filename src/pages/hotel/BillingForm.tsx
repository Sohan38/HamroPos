import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useHotelRooms, useHotelBills } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function HotelBillingForm() {
  const goBack = useSmartBack('/hotel/billing');
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const roomIdQuery = searchParams.get('room');
  
  const { items: rooms, update: updateRoom } = useHotelRooms();
  const { add: addBill } = useHotelBills();
  const { format } = useCurrency();

  const [roomId, setRoomId] = useState(roomIdQuery || '');
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [checkIn, setCheckIn] = useState(new Date().toISOString().split('T')[0]);
  const [checkOut, setCheckOut] = useState('');
  const [additionalItems, setAdditionalItems] = useState<{desc: string, amount: number}[]>([]);
  const [discount, setDiscount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  
  const selectedRoom = rooms.find(r => r.id === roomId);

  // If room is occupied, auto-fill check in from room details
  useMemo(() => {
    if (selectedRoom && selectedRoom.status === 'occupied' && selectedRoom.currentGuestName) {
      setGuestName(selectedRoom.currentGuestName);
      if (selectedRoom.currentCheckIn) {
        setCheckIn(selectedRoom.currentCheckIn.split('T')[0]);
      }
      setCheckOut(new Date().toISOString().split('T')[0]);
    }
  }, [selectedRoom]);

  const numberOfNights = useMemo(() => {
    if (!checkIn || !checkOut) return 1;
    const diffTime = Math.abs(new Date(checkOut).getTime() - new Date(checkIn).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 0 ? 1 : diffDays; // minimum 1 night
  }, [checkIn, checkOut]);

  const roomCharge = (selectedRoom?.ratePerNight || 0) * numberOfNights;
  const additionalTotal = additionalItems.reduce((s, i) => s + i.amount, 0);
  const grandTotal = roomCharge + additionalTotal - Number(discount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !guestName) {
      toast.error('Please fill required fields');
      return;
    }

    if (selectedRoom.status === 'available') {
      // Just checking in
      updateRoom(selectedRoom.id, {
        status: 'occupied',
        currentGuestName: guestName,
        currentCheckIn: new Date(checkIn).toISOString(),
      });
      toast.success('Guest checked in successfully');
      setLocation('/hotel');
    } else {
      // Checking out & Billing
      addBill({
        invoiceNumber: `HB-${Math.floor(Math.random()*10000)}`,
        guestName,
        phone,
        address: '',
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.roomNumber,
        checkIn: new Date(checkIn).toISOString(),
        checkOut: new Date(checkOut).toISOString(),
        numberOfNights,
        roomCharge,
        additionalItems: additionalItems.map(i => ({ description: i.desc, category: 'other', amount: i.amount })),
        discount: Number(discount),
        tax: 0,
        grandTotal,
        paidAmount: Number(paidAmount) || grandTotal,
        dueAmount: grandTotal - (Number(paidAmount) || grandTotal),
        paymentMethod: 'cash',
        notes: ''
      });

      updateRoom(selectedRoom.id, {
        status: 'cleaning',
        currentGuestName: null,
        currentCheckIn: null,
        currentCheckOut: null
      });

      toast.success('Bill generated and guest checked out');
      setLocation('/hotel/billing');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Hotel Billing / Check In</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Room *</label>
                <Select value={roomId} onValueChange={setRoomId}>
                  <SelectTrigger><SelectValue placeholder="Choose a room" /></SelectTrigger>
                  <SelectContent>
                    {rooms.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.roomNumber} - {r.roomType} ({r.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Guest Name *</label>
                <Input 
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Check In Date</label>
                  <Input 
                    type="date"
                    value={checkIn}
                    onChange={e => setCheckIn(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Check Out Date</label>
                  <Input 
                    type="date"
                    value={checkOut}
                    onChange={e => setCheckOut(e.target.value)}
                    min={checkIn}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedRoom?.status === 'occupied' && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Additional Charges</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAdditionalItems([...additionalItems, {desc: '', amount: 0}])}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                {additionalItems.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-2 bg-muted/10 p-2 rounded-lg border sm:border-0 sm:p-0 sm:bg-transparent">
                    <Input 
                      placeholder="Description" 
                      value={item.desc}
                      onChange={e => {
                        const newItems = [...additionalItems];
                        newItems[index].desc = e.target.value;
                        setAdditionalItems(newItems);
                      }}
                      className="w-full sm:flex-1"
                    />
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Input 
                        type="number" 
                        placeholder="Amount" 
                        className="w-full sm:w-24"
                        value={item.amount || ''}
                        onChange={e => {
                          const newItems = [...additionalItems];
                          newItems[index].amount = Number(e.target.value);
                          setAdditionalItems(newItems);
                        }}
                      />
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => {
                        setAdditionalItems(additionalItems.filter((_, i) => i !== index));
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card className="sticky top-20 border-primary/20 bg-muted/10">
            <CardContent className="p-6 space-y-6">
              <h3 className="font-bold text-lg border-b pb-2">Bill Summary</h3>
              
              {selectedRoom ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Room Rate ({numberOfNights} nights)</span>
                    <span>{format(roomCharge)}</span>
                  </div>
                  {additionalTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Additional Items</span>
                      <span>{format(additionalTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-muted-foreground">Discount</span>
                    <Input 
                      type="number" 
                      className="w-24 h-8" 
                      value={discount} 
                      onChange={e => setDiscount(e.target.value)} 
                    />
                  </div>
                  
                  <div className="border-t pt-4 mt-4 flex justify-between items-center">
                    <span className="font-bold text-lg">Grand Total</span>
                    <span className="font-bold text-2xl text-primary">{format(grandTotal)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">Select a room to view summary</div>
              )}

              {selectedRoom?.status === 'occupied' && (
                <div className="pt-4 space-y-2 border-t">
                  <label className="text-sm font-medium">Amount Paid</label>
                  <Input 
                    type="number" 
                    className="h-12 text-lg" 
                    value={paidAmount} 
                    onChange={e => setPaidAmount(e.target.value)} 
                    placeholder={`Full amount: ${grandTotal}`}
                  />
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={!selectedRoom}>
                <Save className="mr-2 h-5 w-5" /> 
                {selectedRoom?.status === 'available' ? 'Check In Guest' : 'Generate Bill & Check Out'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
