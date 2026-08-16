import { Link, useLocation } from 'wouter';
import { Home, Package, ShoppingCart, Hotel, MoreHorizontal, Settings, Users, Truck, FileText, UtensilsCrossed, Receipt, Wallet, Banknote, ArrowUpFromLine, Utensils, Factory } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useBackModal } from '@/contexts/NavigationContext';
import { useFeature } from '@/hooks/useFeature';

export function BottomNav() {
  const [location] = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isHotelEnabled = useFeature('hospitality', 'hotelGrid');
  const isRestaurantEnabled = useFeature('hospitality', 'restaurantBilling');
  const isConsumptionEnabled = useFeature('consumption', 'enabled');

  useBackModal(isMoreOpen, () => setIsMoreOpen(false), 'bottom-nav-more');

  // Dynamically assemble main navigation tabs
  const mainNavItems = [
    { href: '/', label: 'Dashboard', icon: Home, show: true },
    { href: '/inventory', label: 'Inventory', icon: Package, show: true },
    { href: '/inventory/production', label: 'Production', icon: Factory, show: true },
    { href: '/sales', label: 'Sales', icon: ShoppingCart, show: true },
  ];

  if (isHotelEnabled) {
    mainNavItems.push({ href: '/hotel', label: 'Hotel', icon: Hotel, show: true });
  } else {
    // Fallback: put Reports or Settings in 4th slot if Hotel is disabled
    mainNavItems.push({ href: '/reports', label: 'Reports', icon: FileText, show: true });
  }

  // Dynamically assemble more sheets options
  const moreNavItems = [
    { href: '/purchases', label: 'Purchases', icon: Truck, show: true },
    { href: '/dispositions', label: 'Dispositions', icon: FileText, show: true },
    { href: '/inventory/consumption', label: 'Consumption', icon: Utensils, show: isConsumptionEnabled },
    { href: '/restaurant', label: 'Restaurant', icon: UtensilsCrossed, show: isRestaurantEnabled },
    { href: '/expenses', label: 'Expenses', icon: Receipt, show: true },
    { href: '/cash-book', label: 'Cash Book', icon: Wallet, show: true },
    { href: '/credit', label: 'Credit', icon: Banknote, show: true },
    { href: '/payables', label: 'Payables', icon: ArrowUpFromLine, show: true },
    // If reports is already in mainNavItems, don't show it here to prevent duplication
    { href: '/reports', label: 'Reports', icon: FileText, show: isHotelEnabled },
    { href: '/customers', label: 'Customers', icon: Users, show: true },
    { href: '/suppliers', label: 'Suppliers', icon: Truck, show: true },
    { href: '/settings', label: 'Settings', icon: Settings, show: true },
  ].filter(item => item.show);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {mainNavItems.map((item) => {
          const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex-1 flex justify-center">
              <div
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full py-1 gap-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "fill-primary/20")} />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </div>
            </Link>
          );
        })}

        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <button className="flex-1 flex flex-col items-center justify-center py-1 gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-xl px-0 pb-0 pt-6">
            <SheetHeader className="px-6 mb-4">
              <SheetTitle>More Menu</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-60px)] px-6 pb-6">
              <div className="grid grid-cols-3 gap-4 pb-8">
                {moreNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 hover:bg-muted active:scale-95 transition-all"
                  >
                    <div className="p-3 bg-background rounded-full shadow-sm text-primary">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-medium text-center">{item.label}</span>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
