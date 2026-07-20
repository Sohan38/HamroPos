import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Package, ShoppingCart, Hotel, MoreHorizontal, Settings, Users, Truck, FileText, UtensilsCrossed, Receipt, Wallet, Banknote, Search, Menu, X, Sun, Moon } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function TopNav() {
  const { settings, theme, setTheme, currentUser } = useApp();
  const [, setLocation] = useLocation();

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b bg-card px-4 shadow-sm md:h-16 lg:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile menu trigger could go here if we want a left drawer instead of bottom "more" */}
        <div className="font-bold text-lg text-primary truncate max-w-[150px] sm:max-w-[300px]">
          {settings.businessName}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/search')} className="text-muted-foreground hover:text-foreground">
          <Search className="h-5 w-5" />
        </Button>
        
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
          {theme === 'light' ? <Sun className="h-5 w-5" /> : theme === 'dark' ? <Moon className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {currentUser?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                {currentUser ? (
                  <>
                    <p className="font-medium">{currentUser.name}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground capitalize">{currentUser.role}</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Guest User</p>
                    <p className="w-[200px] text-sm text-muted-foreground">Admin mode active</p>
                  </>
                )}
              </div>
            </div>
            <DropdownMenuItem onClick={() => setLocation('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
