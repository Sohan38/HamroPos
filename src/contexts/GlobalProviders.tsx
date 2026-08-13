import React from 'react';
import { Product, ProductBatch, Supplier, Customer, PurchaseInvoice, SaleInvoice, HotelRoom, HotelBill, RestaurantBill, Expense, CashBookEntry, Credit, InventoryDisposition, Location } from '../types';
import { createStorageContext } from './createStorageContext';

export const { Provider: InventoryProvider, useStorage: useInventory } = createStorageContext<Product>('inventory');
export const { Provider: LocationsProvider, useStorage: useLocations } = createStorageContext<Location>('locations');
export const { Provider: ProductBatchesProvider, useStorage: useProductBatches } = createStorageContext<ProductBatch>('productBatches');
export const { Provider: SuppliersProvider, useStorage: useSuppliers } = createStorageContext<Supplier>('suppliers');
export const { Provider: CustomersProvider, useStorage: useCustomers } = createStorageContext<Customer>('customers');
export const { Provider: PurchasesProvider, useStorage: usePurchases } = createStorageContext<PurchaseInvoice>('purchases');
export const { Provider: SalesProvider, useStorage: useSales } = createStorageContext<SaleInvoice>('sales');
export const { Provider: DispositionsProvider, useStorage: useDispositions } = createStorageContext<InventoryDisposition>('dispositions');
export const { Provider: HotelRoomsProvider, useStorage: useHotelRooms } = createStorageContext<HotelRoom>('hotelRooms');
export const { Provider: HotelBillsProvider, useStorage: useHotelBills } = createStorageContext<HotelBill>('hotelBills');
export const { Provider: RestaurantBillsProvider, useStorage: useRestaurantBills } = createStorageContext<RestaurantBill>('restaurantBills');
export const { Provider: ExpensesProvider, useStorage: useExpenses } = createStorageContext<Expense>('expenses');
export const { Provider: CashBookProvider, useStorage: useCashBook } = createStorageContext<CashBookEntry>('cashBook');
export const { Provider: CreditProvider, useStorage: useCredit } = createStorageContext<Credit>('credit');

export function GlobalProviders({ children }: { children: React.ReactNode }) {
  return (
    <InventoryProvider>
      <LocationsProvider>
        <ProductBatchesProvider>
          <SuppliersProvider>
            <CustomersProvider>
              <PurchasesProvider>
                <SalesProvider>
                  <DispositionsProvider>
                    <HotelRoomsProvider>
                      <HotelBillsProvider>
                        <RestaurantBillsProvider>
                          <ExpensesProvider>
                            <CashBookProvider>
                              <CreditProvider>
                                {children}
                              </CreditProvider>
                            </CashBookProvider>
                          </ExpensesProvider>
                        </RestaurantBillsProvider>
                      </HotelBillsProvider>
                    </HotelRoomsProvider>
                  </DispositionsProvider>
                </SalesProvider>
              </PurchasesProvider>
            </CustomersProvider>
          </SuppliersProvider>
        </ProductBatchesProvider>
      </LocationsProvider>
    </InventoryProvider>
  );
}
