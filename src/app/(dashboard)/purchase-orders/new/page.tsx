'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SoftCard } from '@/components/ui/SoftCard';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { PurchaseOrderV2Schema } from '@/lib/validations/purchase-order';
import { calculateAfterTax, calculateLineTotal } from '@/lib/calculations';
import { createPurchaseOrderV2 } from '@/actions/purchase-orders';
import { getAccounts, getStoresByAccount, getProductsWithFullPricing } from '@/actions/master-data';
import { Account, Store } from '@/types';
import { FullProduct } from '@/lib/price-filter';
import { useI18n } from '@/lib/i18n/context';

// Form-specific type
type POFormData = z.input<typeof PurchaseOrderV2Schema>;

// Channel type to available price keys mapping
const CHANNEL_PRICE_KEYS: Record<string, string[]> = {
  'Modern Channel': ['modern_channel_1', 'modern_channel_2', 'modern_channel_3'],
  'Retailer': ['retailer'],
  'Brandstore': ['brandstore'],
  'Dealer': ['retailer'],
  'Hangon': ['retailer'],
};

// Format number as currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function NewPurchaseOrderPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<FullProduct[]>([]);
  const [availablePriceKeys, setAvailablePriceKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  // Local string state for after-tax inputs so typing isn't interrupted by recalculation
  const [afterTaxInputs, setAfterTaxInputs] = useState<string[]>(['0']);
  const afterTaxInputsRef = useRef<string[]>(['0']);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<POFormData>({
    resolver: zodResolver(PurchaseOrderV2Schema),
    defaultValues: {
      account_id: '',
      store_id: null,
      price_source: 'retailer',
      po_date: today,
      items: [{ product_id: '', quantity: 1, before_tax: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');
  const watchAccountId = watch('account_id');
  const watchPriceSource = watch('price_source');

  // Calculate totals
  const calculateTotals = () => {
    let totalBeforeTax = 0;
    let totalAfterTax = 0;
    let grandTotal = 0;

    watchItems?.forEach((item) => {
      if (item.before_tax && item.quantity) {
        const afterTax = calculateAfterTax(item.before_tax);
        const lineTotal = calculateLineTotal(afterTax, item.quantity);
        totalBeforeTax += item.before_tax * item.quantity;
        totalAfterTax += afterTax * item.quantity;
        grandTotal += lineTotal;
      }
    });

    return { totalBeforeTax, totalAfterTax, grandTotal };
  };  const totals = calculateTotals();

  // Load initial data on mount
  useEffect(() => {
    async function loadData() {
      setIsDataLoading(true);
      try {
        const [accountsRes, productsRes] = await Promise.all([
          getAccounts(true),
          getProductsWithFullPricing(true),
        ]);
        
        if (accountsRes.success) {
          setAccounts(accountsRes.data);
        }
        if (productsRes.success) {
          setProducts(productsRes.data);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsDataLoading(false);
      }
    }
    loadData();
  }, []);


  // Load stores when account changes
  useEffect(() => {
    async function loadStores() {
      if (!watchAccountId) {
        setStores([]);
        setAvailablePriceKeys([]);
        return;
      }

      try {
        const storesRes = await getStoresByAccount(watchAccountId, true);
        if (storesRes.success) {
          setStores(storesRes.data);
        }

        // Get channel type for the selected account
        const selectedAccount = accounts.find(a => a.id === watchAccountId);
        if (selectedAccount) {
          const channelKeys = CHANNEL_PRICE_KEYS[selectedAccount.channel_type] || [];
          setAvailablePriceKeys(channelKeys);
          
          // Reset price source if current selection is not available for this channel type
          // Default to the first available key for the channel type, or 'retailer' as fallback
          if (!channelKeys.includes(watchPriceSource)) {
            setValue('price_source', channelKeys[0] || 'retailer');
          }
        }
      } catch (error) {
        console.error('Error loading stores:', error);
      }
    }
    loadStores();
  }, [watchAccountId, accounts, watchPriceSource, setValue]);

  // Get price for a product based on price source (all from channel_pricing)
  // Prices in channel_pricing are tax-inclusive (after tax)
  const getProductPrice = useCallback((product: FullProduct, priceSource: string): number => {
    let taxInclusivePrice = 0;
    if (product.channel_pricing && product.channel_pricing[priceSource]) {
      taxInclusivePrice = product.channel_pricing[priceSource];
    } else if (product.channel_pricing?.retailer) {
      taxInclusivePrice = product.channel_pricing.retailer;
    }
    // Return after-tax price directly (channel_pricing values are tax-inclusive)
    return taxInclusivePrice;
  }, []);

  // Handle product selection - auto-populate after_tax price, derive before_tax
  const handleProductChange = useCallback((index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const afterTax = getProductPrice(product, watchPriceSource);
      const beforeTax = afterTax > 0 ? Math.round((afterTax / 1.11) * 100) / 100 : 0;
      setValue(`items.${index}.before_tax`, beforeTax);
      // Sync local display state
      const newInputs = [...afterTaxInputsRef.current];
      while (newInputs.length <= index) newInputs.push('0');
      newInputs[index] = String(afterTax);
      afterTaxInputsRef.current = newInputs;
      setAfterTaxInputs([...newInputs]);
    }
  }, [products, watchPriceSource, setValue, getProductPrice]);

  // Handle manual after-tax input change — update local string only
  const handleAfterTaxChange = useCallback((index: number, raw: string) => {
    const newInputs = [...afterTaxInputsRef.current];
    while (newInputs.length <= index) newInputs.push('0');
    newInputs[index] = raw;
    afterTaxInputsRef.current = newInputs;
    setAfterTaxInputs([...newInputs]);
  }, []);

  // On blur — commit the after-tax value to the form as before_tax
  const handleAfterTaxBlur = useCallback((index: number) => {
    const raw = afterTaxInputsRef.current[index] ?? '0';
    const afterTax = parseFloat(raw) || 0;
    const beforeTax = afterTax > 0 ? Math.round((afterTax / 1.11) * 100) / 100 : 0;
    setValue(`items.${index}.before_tax`, beforeTax);
  }, [setValue]);

  // Update all item prices when price source changes
  useEffect(() => {
    if (!watchPriceSource || !watchItems) return;
    const newInputs: string[] = [];
    watchItems.forEach((item, index) => {
      if (item.product_id) {
        const product = products.find((p) => p.id === item.product_id);
        if (product) {
          const afterTax = getProductPrice(product, watchPriceSource);
          const beforeTax = afterTax > 0 ? Math.round((afterTax / 1.11) * 100) / 100 : 0;
          setValue(`items.${index}.before_tax`, beforeTax);
          newInputs[index] = String(afterTax);
          return;
        }
      }
      newInputs[index] = afterTaxInputsRef.current[index] ?? '0';
    });
    afterTaxInputsRef.current = newInputs;
    setAfterTaxInputs([...newInputs]);
  }, [watchPriceSource, products, getProductPrice, setValue, watchItems]);

  const onSubmit = async (data: POFormData) => {
    setIsLoading(true);
    setFormError(null);

    try {
      const result = await createPurchaseOrderV2(data);

      if (result.success) {
        router.push(`/purchase-orders/${result.data.id}`);
      } else {
        setFormError(result.error);
      }
    } catch (error) {
      console.error('Error creating PO:', error);
      setFormError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = () => {
    append({ product_id: '', quantity: 1, before_tax: 0 });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
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
        <h1 className="text-2xl font-semibold text-primary">{t('purchaseOrders.createPO')}</h1>
        <p className="text-secondary mt-1">{t('purchaseOrders.manageOrders')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Section */}
        <SoftCard>
          <h2 className="text-lg font-semibold text-primary mb-4">{t('purchaseOrders.poHeader')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label={t('purchaseOrders.poDate')}
              htmlFor="po_date"
              error={errors.po_date?.message}
              required
            >
              <Input
                id="po_date"
                type="date"
                {...register('po_date')}
                error={!!errors.po_date}
              />
            </FormField>

            <FormField
              label={t('form.account')}
              htmlFor="account_id"
              error={errors.account_id?.message}
              required
            >
              <Select
                id="account_id"
                {...register('account_id')}
                error={!!errors.account_id}
              >
                <option value="">{t('form.selectAccount')}</option>
                {[...accounts]
                  .sort((a, b) => `${a.channel_type} - ${a.name}`.localeCompare(`${b.channel_type} - ${b.name}`))
                  .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.channel_type} - {account.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label={`${t('form.store')} (${t('sales.optional')})`}
              htmlFor="store_id"
              error={errors.store_id?.message}
            >
              <Select
                id="store_id"
                {...register('store_id')}
                error={!!errors.store_id}
                disabled={!watchAccountId || stores.length === 0}
              >
                <option value="">{t('common.all')} {t('form.store').toLowerCase()}</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label={t('form.priceSource')}
              htmlFor="price_source"
              error={errors.price_source?.message}
              required
            >
              <Select
                id="price_source"
                {...register('price_source')}
                error={!!errors.price_source}
              >
                <option value="brandstore">Brandstore (Staff)</option>
                <option value="retailer">Retailer (Dealer & Hangon)</option>
                <option value="modern_channel_1">Modern Channel 1 (Best Yamada)</option>
                <option value="modern_channel_2">Modern Channel 2 (Electronic City)</option>
                <option value="modern_channel_3">Modern Channel 3 (Atria & Hartono)</option>
              </Select>
            </FormField>
          </div>
        </SoftCard>


        {/* Items Section */}
        <SoftCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary">{t('purchaseOrders.items')}</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('purchaseOrders.addItem')}
            </Button>
          </div>

          {errors.items?.message && (
            <div className="mb-4">
              <FormError message={errors.items.message} />
            </div>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => {
              const item = watchItems?.[index];
              const afterTax = item?.before_tax ? calculateAfterTax(item.before_tax) : 0;
              const lineTotal = item?.before_tax && item?.quantity 
                ? calculateLineTotal(afterTax, item.quantity) 
                : 0;

              return (
                <div key={field.id} className="border border-secondary/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-secondary">{t('purchaseOrders.item')} {index + 1}</span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-accent-red hover:text-accent-red/80"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* First Row: Product, SKU, Quantity */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                    {/* Product Name Selection - Wider */}
                    <div className="md:col-span-6">
                      <FormField
                        label={t('sales.product')}
                        htmlFor={`items.${index}.product_id`}
                        error={errors.items?.[index]?.product_id?.message}
                        required
                      >
                        <SearchableSelect
                          id={`items.${index}.product_id`}
                          options={products.map((product) => ({
                            value: product.id,
                            label: product.name,
                            searchText: `${product.sku} ${product.name} ${product.category || ''}`,
                          }))}
                          value={item?.product_id || ''}
                          onChange={(value) => {
                            setValue(`items.${index}.product_id`, value);
                            handleProductChange(index, value);
                          }}
                          placeholder={t('form.selectProduct')}
                          error={!!errors.items?.[index]?.product_id}
                        />
                      </FormField>
                    </div>

                    {/* SKU Display */}
                    <div className="md:col-span-4">
                      <FormField
                        label={t('form.sku')}
                        htmlFor={`items.${index}.sku`}
                      >
                        <Input
                          id={`items.${index}.sku`}
                          type="text"
                          value={item?.product_id ? products.find(p => p.id === item.product_id)?.sku || '' : ''}
                          readOnly
                          className="bg-background text-sm"
                        />
                      </FormField>
                    </div>

                    {/* Quantity - Narrower */}
                    <div className="md:col-span-2">
                      <FormField
                        label={t('common.quantity')}
                        htmlFor={`items.${index}.quantity`}
                        error={errors.items?.[index]?.quantity?.message}
                        required
                      >
                        <Input
                          id={`items.${index}.quantity`}
                          type="number"
                          min="1"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          error={!!errors.items?.[index]?.quantity}
                        />
                      </FormField>
                    </div>
                  </div>

                  {/* Second Row: Prices */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* After Tax (editable) */}
                    <div>
                      <FormField
                        label={t('purchaseOrders.afterTax')}
                        htmlFor={`after_tax_input_${index}`}
                        required
                      >
                        <Input
                          id={`after_tax_input_${index}`}
                          type="number"
                          step="1"
                          min="0"
                          value={afterTaxInputs[index] ?? '0'}
                          onChange={(e) => handleAfterTaxChange(index, e.target.value)}
                          onBlur={() => handleAfterTaxBlur(index)}
                        />
                      </FormField>
                    </div>

                    {/* Before Tax (calculated, read-only) */}
                    <div>
                      <FormField
                        label={t('purchaseOrders.beforeTax')}
                        htmlFor={`before_tax_display_${index}`}
                      >
                        <Input
                          id={`before_tax_display_${index}`}
                          type="text"
                          value={formatCurrency(item?.before_tax || 0)}
                          readOnly
                          className="bg-background"
                        />
                      </FormField>
                    </div>

                    {/* Line Total (calculated) */}
                    <div>
                      <FormField label={t('sales.totalPrice')} htmlFor={`line_total_${index}`}>
                        <Input
                          id={`line_total_${index}`}
                          type="text"
                          value={formatCurrency(lineTotal)}
                          readOnly
                          className="bg-background font-medium"
                        />
                      </FormField>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SoftCard>

        {/* Totals Section */}
        <SoftCard>
          <h2 className="text-lg font-semibold text-primary mb-4">{t('common.total')}</h2>
          <div className="flex flex-col items-end space-y-2">
            <div className="flex justify-between w-full max-w-sm">
              <span className="text-secondary">{t('purchaseOrders.beforeTax')}:</span>
              <span className="font-medium text-primary">{formatCurrency(totals.totalBeforeTax)}</span>
            </div>
            <div className="flex justify-between w-full max-w-sm">
              <span className="text-secondary">VAT (11%):</span>
              <span className="font-medium text-primary">{formatCurrency(totals.totalAfterTax - totals.totalBeforeTax)}</span>
            </div>
            <div className="flex justify-between w-full max-w-sm pt-2 border-t border-secondary/20">
              <span className="text-lg font-semibold text-primary">{t('purchaseOrders.grandTotal')}:</span>
              <span className="text-lg font-semibold text-accent-green">{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </SoftCard>

        {/* Form Error */}
        {formError && (
          <SoftCard className="bg-accent-redLight border border-accent-red/20">
            <FormError message={formError} />
          </SoftCard>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/purchase-orders')}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {t('purchaseOrders.createPO')}
          </Button>
        </div>
      </form>
    </div>
  );
}
