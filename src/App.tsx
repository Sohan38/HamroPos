import { Suspense, lazy } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import { useFeature } from '@/hooks/useFeature';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import { AppProvider } from '@/contexts/AppContext';
import { GlobalProviders } from '@/contexts/GlobalProviders';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { Shell } from '@/components/layout/Shell';

/**
 * Retries a dynamic import up to `retries` times with exponential backoff.
 * Capacitor's WebView can fail to load JS chunks on cold start; this prevents
 * those transient failures from turning into a permanent blank screen.
 */
function retryLazy<T extends { default: any }>(
  factory: () => Promise<T>,
  retries = 3
): React.LazyExoticComponent<T['default']> {
  return lazy(() =>
    factory().catch((err) => {
      if (retries <= 0) throw err;
      return new Promise<T>((resolve) =>
        setTimeout(() => resolve(retryLazy(factory, retries - 1) as any), 500)
      );
    })
  );
}

const Dashboard = retryLazy(() => import('@/pages/Dashboard'));
const InventoryList = retryLazy(() => import('@/pages/inventory/List'));
const InventoryForm = retryLazy(() => import('@/pages/inventory/Form'));
const InventoryDetail = retryLazy(() => import('@/pages/inventory/Detail'));
const SalesPos = retryLazy(() => import('@/pages/sales/Pos'));
const SalesList = retryLazy(() => import('@/pages/sales/List'));
const SaleDetail = retryLazy(() => import('@/pages/sales/Detail'));
const Settings = retryLazy(() => import('@/pages/settings'));
const Reports = retryLazy(() => import('@/pages/Reports'));
const Search = retryLazy(() => import('@/pages/Search'));
const NotFound = retryLazy(() => import('@/pages/not-found'));

const CustomerList = retryLazy(() => import('@/pages/customers/List'));
const CustomerDetail = retryLazy(() => import('@/pages/customers/Detail'));
const SupplierList = retryLazy(() => import('@/pages/suppliers/List'));
const SupplierDetail = retryLazy(() => import('@/pages/suppliers/Detail'));
const SupplierForm = retryLazy(() => import('@/pages/suppliers/Form'));
const ExpenseList = retryLazy(() => import('@/pages/expenses/List'));
const ExpenseForm = retryLazy(() => import('@/pages/expenses/Form'));
const PurchaseList = retryLazy(() => import('@/pages/purchases/List'));
const PurchaseForm = retryLazy(() => import('@/pages/purchases/Form'));
const PurchaseDetail = retryLazy(() => import('@/pages/purchases/Detail'));
const CreditList = retryLazy(() => import('@/pages/credit/List'));
const CreditForm = retryLazy(() => import('@/pages/credit/Form'));
const CashBookList = retryLazy(() => import('@/pages/cash-book/List'));
const CashBookForm = retryLazy(() => import('@/pages/cash-book/Form'));
const HotelGrid = retryLazy(() => import('@/pages/hotel/Grid'));
const HotelRoomForm = retryLazy(() => import('@/pages/hotel/RoomForm'));
const HotelBillingList = retryLazy(() => import('@/pages/hotel/BillingList'));
const HotelBillingForm = retryLazy(() => import('@/pages/hotel/BillingForm'));
const RestaurantBillingList = retryLazy(() => import('@/pages/restaurant/BillingList'));
const RestaurantBillingForm = retryLazy(() => import('@/pages/restaurant/BillingForm'));

import { LicenseProvider } from '@/license/LicenseContext';

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <ErrorBoundary>
        <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center opacity-0 animate-[fadeIn_0.15s_ease-in_0.15s_forwards]"><Spinner className="size-5 text-muted-foreground" /></div>}>
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
            <Route path="/purchases/:id/edit" component={PurchaseForm} />
            <Route path="/purchases/:id" component={PurchaseDetail} />

            <Route path="/hotel">
              {() => {
                const isEnabled = useFeature('hospitality', 'hotelGrid');
                return isEnabled ? <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><HotelGrid /></Suspense> : <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><NotFound /></Suspense>;
              }}
            </Route>
            <Route path="/hotel/rooms/new">
              {() => {
                const isEnabled = useFeature('hospitality', 'hotelGrid');
                return isEnabled ? <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><HotelRoomForm /></Suspense> : <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><NotFound /></Suspense>;
              }}
            </Route>
            <Route path="/hotel/rooms/:id">
              {() => {
                const isEnabled = useFeature('hospitality', 'hotelGrid');
                return isEnabled ? <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><HotelRoomForm /></Suspense> : <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><NotFound /></Suspense>;
              }}
            </Route>
            <Route path="/hotel/billing">
              {() => {
                const isEnabled = useFeature('hospitality', 'hotelGrid');
                return isEnabled ? <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><HotelBillingList /></Suspense> : <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><NotFound /></Suspense>;
              }}
            </Route>
            <Route path="/hotel/billing/new">
              {() => {
                const isEnabled = useFeature('hospitality', 'hotelGrid');
                return isEnabled ? <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><HotelBillingForm /></Suspense> : <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><NotFound /></Suspense>;
              }}
            </Route>

            <Route path="/restaurant">
              {() => {
                const isEnabled = useFeature('hospitality', 'restaurantBilling');
                return isEnabled ? <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><RestaurantBillingList /></Suspense> : <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><NotFound /></Suspense>;
              }}
            </Route>
            <Route path="/restaurant/new">
              {() => {
                const isEnabled = useFeature('hospitality', 'restaurantBilling');
                return isEnabled ? <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><RestaurantBillingForm /></Suspense> : <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}><NotFound /></Suspense>;
              }}
            </Route>

            <Route path="/expenses" component={ExpenseList} />
            <Route path="/expenses/new" component={ExpenseForm} />

            <Route path="/cash-book" component={CashBookList} />
            <Route path="/cash-book/entry/:type" component={CashBookForm} />

            <Route path="/credit" component={CreditList} />
            <Route path="/credit/new" component={CreditForm} />

            <Route path="/customers" component={CustomerList} />
            <Route path="/customers/:id" component={CustomerDetail} />
            <Route path="/suppliers" component={SupplierList} />
            <Route path="/suppliers/new">
              {() => <SupplierForm />}
            </Route>
            <Route path="/suppliers/:id/edit">
              {(params) => <SupplierForm id={params.id} />}
            </Route>
            <Route path="/suppliers/:id" component={SupplierDetail} />

            <Route path="/settings" component={Settings} />
            <Route path="/reports" component={Reports} />
            <Route path="/search" component={Search} />

            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
    </Shell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <LicenseProvider>
          <QueryClientProvider client={queryClient}>
            <GlobalProviders>
              <TooltipProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                  <NavigationProvider>
                    <Router />
                  </NavigationProvider>
                </WouterRouter>
                <Toaster />
              </TooltipProvider>
            </GlobalProviders>
          </QueryClientProvider>
        </LicenseProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;

