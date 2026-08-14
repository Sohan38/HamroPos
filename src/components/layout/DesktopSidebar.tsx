import { Link, useLocation } from 'wouter';
import { Home, Package, ShoppingCart, Hotel, Truck, FileText, UtensilsCrossed, Receipt, Wallet, Banknote, Users, Settings, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFeature } from '@/hooks/useFeature';

export function DesktopSidebar() {
  const [location] = useLocation();
  const isHotelEnabled = useFeature('hospitality', 'hotelGrid');
  const isRestaurantEnabled = useFeature('hospitality', 'restaurantBilling');

  const NAV_GROUPS = [
    {
      title: 'Main',
      items: [
        { href: '/', label: 'Dashboard', icon: Home, show: true },
        { href: '/sales', label: 'Sales (POS)', icon: ShoppingCart, show: true },
        { href: '/inventory', label: 'Inventory', icon: Package, show: true },
        { href: '/locations', label: 'Locations', icon: ArrowLeftRight, show: true },
      ]
    },
    {
      title: 'Operations',
      items: [
        { href: '/hotel', label: 'Hotel', icon: Hotel, show: isHotelEnabled },
        { href: '/restaurant', label: 'Restaurant', icon: UtensilsCrossed, show: isRestaurantEnabled },
        { href: '/dispositions', label: 'Dispositions', icon: FileText, show: true },
        { href: '/purchases', label: 'Purchases', icon: Truck, show: true },
      ]
    },
    {
      title: 'Finance',
      items: [
        { href: '/expenses', label: 'Expenses', icon: Receipt, show: true },
        { href: '/cash-book', label: 'Cash Book', icon: Wallet, show: true },
        { href: '/credit', label: 'Credit (Udharo)', icon: Banknote, show: true },
        { href: '/payables', label: 'Payables', icon: ArrowUpFromLine, show: true },
        { href: '/reports', label: 'Reports', icon: FileText, show: true },
      ]
    },
    {
      title: 'Management',
      items: [
        { href: '/customers', label: 'Customers', icon: Users, show: true },
        { href: '/suppliers', label: 'Suppliers', icon: Truck, show: true },
        { href: '/settings', label: 'Settings', icon: Settings, show: true },
      ]
    }
  ];

  return (
    <div className="hidden md:flex flex-col w-64 border-r bg-card h-[calc(100vh-64px)] fixed left-0 top-16 z-30">
      <ScrollArea className="flex-1 py-4">
        <div className="px-3 space-y-6">
          {NAV_GROUPS.map((group, i) => {
            const visibleItems = group.items.filter(item => item.show);
            if (visibleItems.length === 0) return null;

            return (
              <div key={i} className="space-y-1">
                <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {group.title}
                </h4>
                {visibleItems.map((item) => {
                  const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
