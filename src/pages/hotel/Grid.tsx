import { useState } from 'react';
import { useLocation } from 'wouter';
import { useHotelRooms } from '@/contexts/GlobalProviders';
import { useCurrency as useCurrencyHook } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Hotel, Plus, Edit, BedDouble, Calendar, CheckSquare, Wrench, Sparkles, AlertCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format as formatDate, parseISO } from 'date-fns';

const STATUS_COLORS = {
  available: 'bg-green-500/10 text-green-600 border-green-200',
  occupied: 'bg-red-500/10 text-red-600 border-red-200',
  reserved: 'bg-orange-500/10 text-orange-600 border-orange-200',
  cleaning: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  maintenance: 'bg-gray-500/10 text-gray-600 border-gray-200',
};

const STATUS_ICONS = {
  available: CheckSquare,
  occupied: BedDouble,
  reserved: Calendar,
  cleaning: Sparkles,
  maintenance: Wrench,
};

export default function HotelGrid() {
  const [, setLocation] = useLocation();
  const { items, update } = useHotelRooms();
  const { format } = useCurrencyHook();

  const handleStatusChange = (id: string, status: any) => {
    update(id, { status });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Hotel Rooms</h1>
          <p className="text-muted-foreground">{items.length} total rooms</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={() => setLocation('/hotel/billing/new')} className="flex-1 md:flex-none">
            New Bill
          </Button>
          <Button onClick={() => setLocation('/hotel/rooms/new')} className="flex-1 md:flex-none">
            <Plus className="mr-2 h-4 w-4" /> Add Room
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        <Badge variant="outline" className="px-3 py-1 text-sm whitespace-nowrap bg-background">All ({items.length})</Badge>
        <Badge variant="outline" className={`px-3 py-1 text-sm whitespace-nowrap ${STATUS_COLORS.available}`}>Available ({items.filter(r => r.status === 'available').length})</Badge>
        <Badge variant="outline" className={`px-3 py-1 text-sm whitespace-nowrap ${STATUS_COLORS.occupied}`}>Occupied ({items.filter(r => r.status === 'occupied').length})</Badge>
        <Badge variant="outline" className={`px-3 py-1 text-sm whitespace-nowrap ${STATUS_COLORS.cleaning}`}>Cleaning ({items.filter(r => r.status === 'cleaning').length})</Badge>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <Hotel className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No rooms added</h3>
          <p className="text-muted-foreground mb-6">Create rooms to start managing your hotel.</p>
          <Button onClick={() => setLocation('/hotel/rooms/new')} variant="outline">Add First Room</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {items.map((room) => {
            const StatusIcon = STATUS_ICONS[room.status];
            
            return (
              <Card 
                key={room.id} 
                className={`overflow-hidden border-2 transition-all ${STATUS_COLORS[room.status]}`}
              >
                <CardContent className="p-0">
                  <div className="p-3 md:p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-2xl font-bold font-mono tracking-tighter">{room.roomNumber}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-current opacity-70 hover:opacity-100">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/hotel/rooms/${room.id}`)}>
                            Edit Room Details
                          </DropdownMenuItem>
                          {Object.keys(STATUS_COLORS).map(status => (
                            <DropdownMenuItem key={status} onClick={() => handleStatusChange(room.id, status)}>
                              Set to {status.charAt(0).toUpperCase() + status.slice(1)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider mb-4 opacity-80">
                      <StatusIcon className="h-3.5 w-3.5" />
                      {room.status}
                    </div>

                    <div className="space-y-1 text-sm bg-background/50 rounded-lg p-2 backdrop-blur-sm">
                      <div className="flex justify-between font-medium">
                        <span>{room.roomType}</span>
                        <span>{format(room.ratePerNight)}</span>
                      </div>
                      
                      {room.status === 'occupied' && room.currentGuestName && (
                        <div className="pt-2 mt-2 border-t border-current/10">
                          <p className="font-semibold truncate">{room.currentGuestName}</p>
                          <p className="text-xs opacity-80">
                            In: {room.currentCheckIn ? formatDate(parseISO(room.currentCheckIn), 'MMM d') : '-'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {room.status === 'available' && (
                    <Button 
                      className="w-full rounded-none h-10 bg-current/10 hover:bg-current/20 text-current border-0" 
                      variant="ghost"
                      onClick={() => setLocation(`/hotel/billing/new?room=${room.id}`)}
                    >
                      Check In
                    </Button>
                  )}
                  {room.status === 'occupied' && (
                    <Button 
                      className="w-full rounded-none h-10 bg-current/10 hover:bg-current/20 text-current border-0 font-bold" 
                      variant="ghost"
                      onClick={() => setLocation(`/hotel/billing/new?room=${room.id}`)}
                    >
                      Checkout Bill
                    </Button>
                  )}
                  {room.status === 'cleaning' && (
                    <Button 
                      className="w-full rounded-none h-10 bg-current/10 hover:bg-current/20 text-current border-0" 
                      variant="ghost"
                      onClick={() => handleStatusChange(room.id, 'available')}
                    >
                      Mark Cleaned
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
