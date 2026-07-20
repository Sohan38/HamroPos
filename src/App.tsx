import { Suspense, lazy } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';

import { AppProvider } from '@/contexts/AppContext';
import { GlobalProviders } from '@/contexts/GlobalProviders';
import { Shell } from '@/components/layout/Shell';
import { seedDemoData } from '@/utils/seedHelper';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const InventoryList = lazy(() => import('@/pages/inventory/List'));
const InventoryForm = lazy(() => import('@/pages/inventory/Form'));
const InventoryDetail = lazy(() => import('@/pages/inventory/Detail'));
const SalesPos = lazy(() => import('@/pages/sales/Pos'));
const SalesList = lazy(() => import('@/pages/sales/List'));
const SaleDetail = lazy(() => import('@/pages/sales/Detail'));
const Settings = lazy(() => import('@/pages/settings'));
const Reports = lazy(() => import('@/pages/Reports'));
const Search = lazy(() => import('@/pages/Search'));
const NotFound = lazy(() => import('@/pages/not-found'));

const CustomerList = lazy(() => import('@/pages/customers/List'));
const SupplierList = lazy(() => import('@/pages/suppliers/List'));
const ExpenseList = lazy(() => import('@/pages/expenses/List'));
const ExpenseForm = lazy(() => import('@/pages/expenses/Form'));
const PurchaseList = lazy(() => import('@/pages/purchases/List'));
const PurchaseForm = lazy(() => import('@/pages/purchases/Form'));
const CreditList = lazy(() => import('@/pages/credit/List'));
const CreditForm = lazy(() => import('@/pages/credit/Form'));
const CashBookList = lazy(() => import('@/pages/cash-book/List'));
const CashBookForm = lazy(() => import('@/pages/cash-book/Form'));
const HotelGrid = lazy(() => import('@/pages/hotel/Grid'));
const HotelRoomForm = lazy(() => import('@/pages/hotel/RoomForm'));
const HotelBillingList = lazy(() => import('@/pages/hotel/BillingList'));
const HotelBillingForm = lazy(() => import('@/pages/hotel/BillingForm'));
const RestaurantBillingList = lazy(() => import('@/pages/restaurant/BillingList'));
const RestaurantBillingForm = lazy(() => import('@/pages/restaurant/BillingForm'));

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}>
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
      </Suspense>
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
