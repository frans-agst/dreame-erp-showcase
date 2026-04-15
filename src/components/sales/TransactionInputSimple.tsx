'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { SoftCard } from '@/components/ui/SoftCard';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/Button';
import { FormSuccess } from '@/components/ui/FormSuccess';
import { FormError } from '@/components/ui/FormError';
import { createTransaction } from '@/actions/transactions';
import { getCurrentUserProfile, getAssignedStores } from '@/actions/sales';
import { getProducts, getStaff } from '@/actions/master-data';
import { useI18n } from '@/lib/i18n/context';
import { SimpleGiftManager } from './SimpleGiftManager';

interface TransactionInputProps {
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
}

export function TransactionInputSimple({ onSuccess, onError }: TransactionInputProps) {
  const { t } = useI18n();
  
  // State management
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form setup with minimal validation
  const form = useForm({
    defaultValues: {
      store_id: '',
      staff_id: '',
      transaction_date: new Date().toISOString().split('T')[0],
      inventory_source: 'in_store',
      items: [
        {
          product_id: '',
          quantity: 1,
          unit_price: 0,
          line_discount: 0,
          gift_details: []
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items'
  });

  // Load master data on mount
  useEffect(() => {
    async function loadData() {
      setIsDataLoading(true);
      try {
        const [productsRes, assignedStoresRes, staffRes, userRes] = await Promise.all([
          getProducts(true),
          getAssignedStores(),
          getStaff(true),
          getCurrentUserProfile(),
        ]);

        if (productsRes.success) setProducts(productsRes.data);
        if (assignedStoresRes.success) setStores(assignedStoresRes.data);
        if (staffRes.success) setStaffList(staffRes.data);
        if (userRes.success && userRes.data) {
          setCurrentUser(userRes.data);
          
          // Auto-fill store from user's current store
          const currentStoreId = userRes.data.current_store_id || userRes.data.store_id;
          if (currentStoreId) {
            form.setValue('store_id', currentStoreId);
          }
          
          // Pre-fill staff_id for staff role
          if (userRes.data.role === 'staff') {
            form.setValue('staff_id', userRes.data.id);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setFormError('Failed to load required data');
      } finally {
        setIsDataLoading(false);
      }
    }
    loadData();
  }, [form]);
  // Calculate transaction totals
  const calculateTotals = () => {
    const items = form.watch('items');
    let subtotal = 0;
    let totalDiscount = 0;

    items.forEach((item: any) => {
      const lineTotal = item.quantity * item.unit_price;
      subtotal += lineTotal;
      totalDiscount += item.line_discount || 0;
    });

    return {
      subtotal,
      totalDiscount,
      total: subtotal - totalDiscount
    };
  };

  const totals = calculateTotals();

  // Handle form submission
  const onSubmit = async (data: any) => {
    setIsLoading(true);
    setSuccessMessage(null);
    setFormError(null);

    try {
      // Basic validation
      if (!data.store_id || !data.staff_id || !data.items.length) {
        setFormError('Please fill in all required fields');
        return;
      }

      if (data.items.some((item: any) => !item.product_id || item.quantity <= 0 || item.unit_price <= 0)) {
        setFormError('Please ensure all products have valid quantity and price');
        return;
      }

      const result = await createTransaction(data);
      
      if (result.success && result.data) {
        setSuccessMessage('Transaction created successfully!');
        onSuccess?.(result.data.id);
        
        // Reset form
        form.reset({
          store_id: currentUser?.current_store_id || currentUser?.store_id || '',
          staff_id: currentUser?.role === 'staff' ? currentUser.id : '',
          transaction_date: new Date().toISOString().split('T')[0],
          inventory_source: 'in_store',
          items: [
            {
              product_id: '',
              quantity: 1,
              unit_price: 0,
              line_discount: 0,
              gift_details: []
            }
          ]
        });
      } else {
        const errorMessage = result.error || 'Failed to create transaction';
        setFormError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      const errorMessage = 'An unexpected error occurred';
      setFormError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Add new item to transaction
  const addItem = () => {
    append({
      product_id: '',
      quantity: 1,
      unit_price: 0,
      line_discount: 0,
      gift_details: []
    });
  };

  // Remove item from transaction
  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  // Update product price when product is selected
  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p: any) => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.product_id`, productId);
      form.setValue(`items.${index}.unit_price`, product.price_retail || product.price || 0);
    }
  };

  // Convert products to searchable options
  const getProductOptions = (excludeIds: string[] = []): SearchableSelectOption[] => {
    return products
      .filter((product: any) => !excludeIds.includes(product.id))
      .map((product: any) => ({
        value: product.id,
        label: `${product.name} (${product.sku})`,
        searchText: `${product.name} ${product.sku} ${product.category || ''}`
      }));
  };

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-green"></div>
      </div>
    );
  }
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">
          {t('sales.multiProductTransaction')}
        </h1>
        <p className="text-secondary mt-1">
          {t('sales.createNewTransaction')}
        </p>
      </div>

      <SoftCard>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Transaction Date */}
          <FormField
            label={t('sales.transactionDate')}
            htmlFor="transaction_date"
            required
          >
            <Input
              id="transaction_date"
              type="date"
              {...form.register('transaction_date')}
              max={new Date().toISOString().split('T')[0]}
            />
          </FormField>

          {/* Staff Selection */}
          <FormField
            label={t('sales.staff')}
            htmlFor="staff_id"
            required
          >
            <Select
              id="staff_id"
              {...form.register('staff_id')}
            >
              <option value="">{t('form.selectStaff')}</option>
              {staffList
                .filter((staff: any) => staff.role === 'staff' || staff.role === 'manager')
                .sort((a: any, b: any) => {
                  if (a.role === 'manager' && b.role !== 'manager') return -1;
                  if (a.role !== 'manager' && b.role === 'manager') return 1;
                  return a.full_name.localeCompare(b.full_name);
                })
                .map((staff: any) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.role === 'manager' ? 'Manager' : 'Staff'} - {staff.full_name}
                  </option>
                ))}
            </Select>
          </FormField>

          {/* Store Selection */}
          <FormField
            label={t('form.store')}
            htmlFor="store_id"
            required
          >
            <Select
              id="store_id"
              {...form.register('store_id')}
              disabled={stores.length === 1}
            >
              <option value="">{t('form.selectStore')}</option>
              {stores.map((store: any) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </FormField>
          
          {/* Inventory Source */}
          <FormField
            label="Inventory Source"
            htmlFor="inventory_source"
            hint="Choose whether to take products from store inventory or warehouse"
          >
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="in_store"
                  {...form.register('inventory_source')}
                  className="w-4 h-4 text-accent-green border-secondary/30 focus:ring-accent-green focus:ring-2"
                />
                <span className="text-sm text-primary">
                  In Store
                  <span className="text-xs text-secondary block">Deduct from inventory</span>
                </span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="warehouse"
                  {...form.register('inventory_source')}
                  className="w-4 h-4 text-accent-green border-secondary/30 focus:ring-accent-green focus:ring-2"
                />
                <span className="text-sm text-primary">
                  Warehouse
                  <span className="text-xs text-secondary block">No inventory deduction</span>
                </span>
              </label>
            </div>
          </FormField>

          {/* Products Section */}
          <div className="border border-secondary/20 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-primary">
                {t('sales.products')}
              </h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addItem}
                disabled={fields.length >= 20}
              >
                {t('sales.addProduct')}
              </Button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => {
                const selectedProductIds = form.watch('items').map((item: any) => item.product_id).filter(Boolean);
                const availableProducts = getProductOptions(
                  selectedProductIds.filter((_, i) => i !== index)
                );

                return (
                  <div key={field.id} className="border border-secondary/10 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-primary">
                        Product {index + 1}
                      </h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-accent-red hover:text-accent-red/80"
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    {/* Product Selection - Full Width */}
                    <FormField
                      label={t('sales.product')}
                      htmlFor={`items.${index}.product_id`}
                      required
                    >
                      <SearchableSelect
                        options={availableProducts}
                        value={form.watch(`items.${index}.product_id`) || ''}
                        onChange={(value) => handleProductChange(index, value)}
                        placeholder={t('form.selectProduct')}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Before Tax Price - Calculated, Read-only */}
                      <FormField
                        label={t('sales.priceBeforeTax')}
                        htmlFor={`items.${index}.price_before_tax`}
                        hint="Calculated automatically"
                      >
                        <Input
                          type="text"
                          value={(() => {
                            const afterTaxPrice = form.watch(`items.${index}.unit_price`) || 0;
                            const beforeTaxPrice = afterTaxPrice / 1.11;
                            return `Rp ${Math.round(beforeTaxPrice).toLocaleString('id-ID')}`;
                          })()}
                          readOnly
                          className="bg-background"
                        />
                      </FormField>

                      {/* After Tax Price (Unit Price) - Editable */}
                      <FormField
                        label={t('sales.priceAfterTax')}
                        htmlFor={`items.${index}.unit_price`}
                        required
                      >
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                        />
                      </FormField>

                      {/* Quantity */}
                      <FormField
                        label={t('common.quantity')}
                        htmlFor={`items.${index}.quantity`}
                        required
                      >
                        <Input
                          type="number"
                          min="1"
                          {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                        />
                      </FormField>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Discount (was Line Discount) */}
                      <FormField
                        label={t('common.discount')}
                        htmlFor={`items.${index}.line_discount`}
                      >
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...form.register(`items.${index}.line_discount`, { valueAsNumber: true })}
                          placeholder="0"
                        />
                      </FormField>

                      {/* Total Price (was Line Total) Display */}
                      <div>
                        <label className="text-sm font-medium text-primary block mb-2">
                          {t('sales.totalPrice')}
                        </label>
                        <div className="px-3 py-2 bg-background border border-secondary/30 rounded-lg">
                          <span className="text-accent-green font-medium">
                            Rp {(() => {
                              const quantity = form.watch(`items.${index}.quantity`) || 0;
                              const unitPrice = form.watch(`items.${index}.unit_price`) || 0;
                              const lineDiscount = form.watch(`items.${index}.line_discount`) || 0;
                              const lineTotal = (quantity * unitPrice) - lineDiscount;
                              return lineTotal.toLocaleString('id-ID');
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Gift Products for this item */}
                    <SimpleGiftManager
                      itemIndex={index}
                      form={form}
                      products={products}
                      excludeProductId={form.watch(`items.${index}.product_id`)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transaction Totals */}
          <div className="bg-accent-greenLight rounded-xl p-6">
            <h3 className="text-lg font-medium text-primary mb-4">
              {t('sales.transactionSummary')}
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-secondary">{t('sales.subtotal')}</span>
                <span className="text-primary font-medium">
                  Rp {totals.subtotal.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">{t('sales.totalDiscount')}</span>
                <span className="text-primary font-medium">
                  Rp {totals.totalDiscount.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t border-secondary/20 pt-2">
                <span className="text-primary">{t('sales.total')}</span>
                <span className="text-accent-green">
                  Rp {totals.total.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>
          {/* Success Message */}
          <FormSuccess message={successMessage || undefined} />
          
          {/* Form Error */}
          {formError && (
            <div className="bg-accent-redLight rounded-xl p-4">
              <FormError message={formError} />
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                form.reset();
                setSuccessMessage(null);
                setFormError(null);
              }}
              className="flex-1"
            >
              {t('common.reset')}
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={totals.total <= 0}
              className="flex-1"
              size="lg"
            >
              {t('sales.createTransaction')}
            </Button>
          </div>
        </form>
      </SoftCard>
    </div>
  );
}