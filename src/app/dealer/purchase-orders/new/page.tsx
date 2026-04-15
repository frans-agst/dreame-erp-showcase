'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SoftCard } from '@/components/ui/SoftCard';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { calculateAfterTax, calculateLineTotal } from '@/lib/calculations';
import { getDealerProducts, createDealerPurchaseOrder, getDealerStores, getAvailableCreditNotes } from '@/actions/dealer';
import { DealerProduct, Store, CreditNote } from '@/types';
import { useI18n } from '@/lib/i18n/context';

// Dealer PO form schema - store selection required for reporting
const DealerPOSchema = z.object({
  po_date: z.string().min(1, 'PO date is required'),
  store_id: z.string().min(1, 'Store selection is required'),
  credit_note_id: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().min(1, 'Product is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
  })).min(1, 'At least one item is required'),
});

type DealerPOFormData = z.infer<typeof DealerPOSchema>;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function NewDealerPurchaseOrderPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<DealerProduct[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DealerPOFormData>({
    resolver: zodResolver(DealerPOSchema),
    defaultValues: {
      po_date: today,
      store_id: '',
      credit_note_id: '',
      items: [{ product_id: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');
  const watchCreditNoteId = watch('credit_note_id');
  const watchStoreId = watch('store_id');

  // Calculate totals based on retailer prices (tax-inclusive)
  const calculateTotals = useCallback(() => {
    let totalBeforeTax = 0;
    let totalAfterTax = 0;
    let grandTotal = 0;

    watchItems?.forEach((item) => {
      const product = products.find(p => p.id === item.product_id);
      if (product && item.quantity) {
        const priceIncludingTax = product.price; // retailer price (tax-inclusive)
        const beforeTax = priceIncludingTax / 1.11; // Reverse calculate to get before-tax price
        const afterTax = priceIncludingTax; // The price IS after tax
        const lineTotal = calculateLineTotal(afterTax, item.quantity);
        totalBeforeTax += beforeTax * item.quantity;
        totalAfterTax += afterTax * item.quantity;
        grandTotal += lineTotal;
      }
    });

    // Calculate credit note discount
    let creditNoteAmount = 0;
    let maxCreditNoteUsage = 0;
    if (watchCreditNoteId) {
      const selectedCreditNote = creditNotes.find(cn => cn.id === watchCreditNoteId);
      if (selectedCreditNote) {
        maxCreditNoteUsage = grandTotal * 0.5; // Max 50% of grand total
        creditNoteAmount = Math.min(selectedCreditNote.amount, maxCreditNoteUsage);
      }
    }

    const finalTotal = grandTotal - creditNoteAmount;

    return { 
      totalBeforeTax, 
      totalAfterTax, 
      grandTotal, 
      creditNoteAmount,
      maxCreditNoteUsage,
      finalTotal 
    };
  }, [watchItems, watchCreditNoteId, products, creditNotes]);

  const totals = calculateTotals();

  // Load initial data - get all stores and products
  useEffect(() => {
    async function loadData() {
      setIsDataLoading(true);
      try {
        const [storesRes, productsRes, creditNotesRes] = await Promise.all([
          getDealerStores(),
          getDealerProducts(true),
          getAvailableCreditNotes(),
        ]);
        
        if (storesRes.success) {
          setStores(storesRes.data);
        } else {
          setFormError('Failed to load stores');
        }
        
        if (productsRes.success) {
          setProducts(productsRes.data);
        }

        if (creditNotesRes.success) {
          setCreditNotes(creditNotesRes.data);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setFormError('Failed to load data');
      } finally {
        setIsDataLoading(false);
      }
    }
    loadData();
  }, [setValue]);

  const getProductPrice = useCallback((productId: string): number => {
    const product = products.find(p => p.id === productId);
    return product?.price || 0;
  }, [products]);

  const onSubmit = async (data: DealerPOFormData) => {
    setIsLoading(true);
    setFormError(null);

    try {
      const result = await createDealerPurchaseOrder({
        po_date: data.po_date,
        store_id: data.store_id,
        credit_note_id: data.credit_note_id || null,
        items: data.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      });

      if (result.success) {
        router.push(`/dealer/purchase-orders/${result.data.id}`);
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
    append({ product_id: '', quantity: 1 });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">{t('purchaseOrders.createPO')}</h1>
        <p className="text-secondary mt-1">Select store for reporting purposes</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Section - Store selection and PO date */}
        <SoftCard>
          <h2 className="text-lg font-semibold text-primary mb-4">{t('dealer.orderDetails')}</h2>
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

            {/* Store Selection - Required for reporting */}
            <FormField 
              label="Select Store" 
              htmlFor="store_id"
              error={errors.store_id?.message}
              required
            >
              <SearchableSelect
                id="store_id"
                options={stores.map((store) => ({
                  value: store.id,
                  label: `${store.account?.channel_type || ''} - ${store.name}`,
                  searchText: `${store.name} ${store.account?.name || ''}`,
                }))}
                value={watchStoreId || ''}
                onChange={(value) => {
                  setValue('store_id', value);
                }}
                placeholder="Select store"
                error={!!errors.store_id}
              />
            </FormField>

            {/* Credit Note Selection (Optional) */}
            {creditNotes.length > 0 && (
              <FormField 
                label="Apply Credit Note (Optional)" 
                htmlFor="credit_note_id"
                error={errors.credit_note_id?.message}
              >
                <SearchableSelect
                  id="credit_note_id"
                  options={[
                    { value: '', label: 'No credit note' },
                    ...creditNotes.map((cn) => ({
                      value: cn.id,
                      label: `${formatCurrency(cn.amount)} - ${cn.description || 'Credit Note'}${cn.expires_at ? ` (Expires: ${new Date(cn.expires_at).toLocaleDateString()})` : ''}`,
                      searchText: `${cn.amount} ${cn.description || ''}`,
                    }))
                  ]}
                  value={watchCreditNoteId || ''}
                  onChange={(value) => {
                    setValue('credit_note_id', value);
                  }}
                  placeholder="Select credit note (optional)"
                  error={!!errors.credit_note_id}
                />
              </FormField>
            )}
          </div>

          {/* Credit Note Info */}
          {watchCreditNoteId && totals.creditNoteAmount > 0 && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Credit Note Applied
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {totals.creditNoteAmount < (creditNotes.find(cn => cn.id === watchCreditNoteId)?.amount || 0) 
                      ? `Using ${formatCurrency(totals.creditNoteAmount)} (max 50% of order total)`
                      : `Discount: ${formatCurrency(totals.creditNoteAmount)}`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </SoftCard>

        {/* Items Section */}
        <SoftCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary">{t('dealer.items')}</h2>
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
              const priceIncludingTax = item?.product_id ? getProductPrice(item.product_id) : 0;
              const beforeTax = priceIncludingTax / 1.11; // Reverse calculate
              const afterTax = priceIncludingTax; // The price IS after tax
              const lineTotal = priceIncludingTax && item?.quantity 
                ? calculateLineTotal(afterTax, item.quantity) 
                : 0;

              return (
                <div key={field.id} className="border border-secondary/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-secondary">{t('dealer.items')} {index + 1}</span>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Unit Price (calculated) */}
                    <div>
                      <FormField label={t('sales.unitPrice')} htmlFor={`unit_price_${index}`}>
                        <Input
                          id={`unit_price_${index}`}
                          type="text"
                          value={formatCurrency(beforeTax)}
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
              <span className="text-lg font-semibold text-blue-600">{formatCurrency(totals.grandTotal)}</span>
            </div>
            {totals.creditNoteAmount > 0 && (
              <>
                <div className="flex justify-between w-full max-w-sm">
                  <span className="text-secondary">Credit Note Discount:</span>
                  <span className="font-medium text-green-600">-{formatCurrency(totals.creditNoteAmount)}</span>
                </div>
                <div className="flex justify-between w-full max-w-sm pt-2 border-t-2 border-primary/30">
                  <span className="text-xl font-bold text-primary">Final Total:</span>
                  <span className="text-xl font-bold text-green-600">{formatCurrency(totals.finalTotal)}</span>
                </div>
              </>
            )}
          </div>
        </SoftCard>

        {formError && (
          <SoftCard className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <FormError message={formError} />
          </SoftCard>
        )}

        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/dealer/purchase-orders')}
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
