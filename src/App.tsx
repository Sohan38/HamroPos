import React, { useEffect } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import { AppProvider } from '@/contexts/AppContext';
import { GlobalProviders } from '@/contexts/GlobalProviders';
import { Shell } from '@/components/layout/Shell';
import { seedDemoData } from '@/utils/seedHelper';

// Pages
import Dashboard from '@/pages/Dashboard';
import InventoryList from '@/pages/inventory/List';
import InventoryForm from '@/pages/inventory/Form';
import InventoryDetail from '@/pages/inventory/Detail';
import SalesPos from '@/pages/sales/Pos';
import SalesList from '@/pages/sales/List';
import SaleDetail from '@/pages/sales/Detail';
import Settings from '@/pages/settings';
import Reports from '@/pages/Reports';
import Search from '@/pages/Search';
import NotFound from '@/pages/not-found';

import CustomerList from '@/pages/customers/List';
import SupplierList from '@/pages/suppliers/List';
import ExpenseList from '@/pages/expenses/List';
import ExpenseForm from '@/pages/expenses/Form';
import PurchaseList from '@/pages/purchases/List';
import PurchaseForm from '@/pages/purchases/Form';
import CreditList from '@/pages/credit/List';
import CreditForm from '@/pages/credit/Form';
import CashBookList from '@/pages/cash-book/List';
import CashBookForm from '@/pages/cash-book/Form';
import HotelGrid from '@/pages/hotel/Grid';
import HotelRoomForm from '@/pages/hotel/RoomForm';
import HotelBillingList from '@/pages/hotel/BillingList';
import HotelBillingForm from '@/pages/hotel/BillingForm';
import RestaurantBillingList from '@/pages/restaurant/BillingList';
import RestaurantBillingForm from '@/pages/restaurant/BillingForm';

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        
        <Route path="/inventory" component={InventoryList} />
        <Route path="/inventory/new" component={InventoryForm} />
        <Route path="/inventory/:id/edit" component={InventoryForm} />
        <Route path="/inventory/:id" component={InventoryDetail} />
        
        <Route path="/sales" component={SalesList} />
        <Route path="/sales/new" component={SalesPos} />
        <Route path="/sales/:id" component={SaleDetail} />
        
        <Route path="/purchases" component={PurchaseList} />
        <Route path="/purchases/new" component={PurchaseForm} />

        <Route path="/hotel" component={HotelGrid} />
        <Route path="/hotel/rooms/new" component={HotelRoomForm} />
        <Route path="/hotel/rooms/:id" component={HotelRoomForm} />
        <Route path="/hotel/billing" component={HotelBillingList} />
        <Route path="/hotel/billing/new" component={HotelBillingForm} />

        <Route path="/restaurant" component={RestaurantBillingList} />
        <Route path="/restaurant/new" component={RestaurantBillingForm} />

        <Route path="/expenses" component={ExpenseList} />
        <Route path="/expenses/new" component={ExpenseForm} />

        <Route path="/cash-book" component={CashBookList} />
        <Route path="/cash-book/entry/:type" component={CashBookForm} />

        <Route path="/credit" component={CreditList} />
        <Route path="/credit/new" component={CreditForm} />

        <Route path="/customers" component={CustomerList} />
        <Route path="/suppliers" component={SupplierList} />

        <Route path="/settings" component={Settings} />
        <Route path="/reports" component={Reports} />
        <Route path="/search" component={Search} />

        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

// Run once on module load (before React renders) so seed data is in localStorage
// before any context reads it.
seedDemoData();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <GlobalProviders>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </GlobalProviders>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
