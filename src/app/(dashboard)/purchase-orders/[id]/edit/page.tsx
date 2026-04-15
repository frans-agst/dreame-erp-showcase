'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SoftCard } from '@/components/ui/SoftCard';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PurchaseOrderSchema } from '@/lib/validations/purchase-order';
import { calculateAfterTax, calculateLineTotal } from '@/lib/calculations';
import { getPurchaseOrderById, updatePurchaseOrder } from '@/actions/purchase-orders';
import { getProducts } from '@/actions/master-data';
import { Product, PurchaseOrder } from '@/types';
import { FilteredProduct } from '@/lib/price-filter';

// Form-specific type
type POFormData = z.input<typeof PurchaseOrderSchema>;

// Format number as currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function EditPurchaseOrderPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.id as string;

  const [products, setProducts] = useState<FilteredProduct[]>([]);
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<POFormData>({
    resolver: zodResolver(PurchaseOrderSchema),
    defaultValues: {
      dealer_name: '',
      po_date: '',
      items: [{ product_id: '', quantity: 1, before_tax: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');

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
  };

  const totals = calculateTotals();

  // Load data on mount
  const loadData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const [productsRes, poRes] = await Promise.all([
        getProducts(true),
        getPurchaseOrderById(poId),
      ]);

      if (productsRes.success) {
        setProducts(productsRes.data);
      }

      if (poRes.success) {
        const poData = poRes.data;
        setPO(poData);

        // Check if PO is draft
        if (poData.status !== 'draft') {
          setFormError('Only draft purchase orders can be edited');
          return;
        }

        // Reset form with PO data
        reset({
          dealer_name: poData.dealer_name,
          po_date: poData.po_date,
          items: poData.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            before_tax: item.before_tax,
          })),
        });
      } else {
        setFormError(poRes.error);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setFormError('Failed to load purchase order');
    } finally {
      setIsDataLoading(false);
    }
  }, [poId, reset]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle product selection - auto-populate price from channel_pricing
  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      // Get price from channel_pricing based on PO's price_source, or fallback to retailer
      const priceSource = po?.price_source || 'retailer';
      const fullProduct = product as unknown as { channel_pricing?: Record<string, number> };
      const price = fullProduct.channel_pricing?.[priceSource] || fullProduct.channel_pricing?.retailer || 0;
      setValue(`items.${index}.before_tax`, price);
    }
  };

  const onSubmit = async (data: POFormData) => {
    setIsLoading(true);
    setFormError(null);

    try {
      const result = await updatePurchaseOrder(poId, data);

      if (result.success) {
        router.push(`/purchase-orders/${poId}`);
      } else {
        setFormError(result.error);
      }
    } catch (error) {
      console.error('Error updating PO:', error);
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
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!po || po.status !== 'draft') {
    return (
      <SoftCard className="bg-accent-redLight border border-accent-red/20">
        <p className="text-accent-red">{formError || 'Only draft purchase orders can be edited'}</p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => router.push('/purchase-orders')}
        >
          Back to List
        </Button>
      </SoftCard>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">Edit Purchase Order</h1>
        <p className="text-secondary mt-1">Update {po.po_number}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Section */}
        <SoftCard>
          <h2 className="text-lg font-semibold text-primary mb-4">PO Header</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="PO Date"
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
              label="Dealer Name"
              htmlFor="dealer_name"
              error={errors.dealer_name?.message}
              required
            >
              <Input
                id="dealer_name"
                type="text"
                placeholder="Enter dealer name"
                {...register('dealer_name')}
                error={!!errors.dealer_name}
              />
            </FormField>
          </div>
        </SoftCard>

        {/* Items Section */}
        <SoftCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary">Items</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Item
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
                    <span className="text-sm font-medium text-secondary">Item {index + 1}</span>
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

                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    {/* Product Selection */}
                    <div className="md:col-span-2">
                      <FormField
                        label="Product"
                        htmlFor={`items.${index}.product_id`}
                        error={errors.items?.[index]?.product_id?.message}
                        required
                      >
                        <Select
                          id={`items.${index}.product_id`}
                          {...register(`items.${index}.product_id`)}
                          error={!!errors.items?.[index]?.product_id}
                          onChange={(e) => {
                            register(`items.${index}.product_id`).onChange(e);
                            handleProductChange(index, e.target.value);
                          }}
                        >
                          <option value="">Select product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.sku} - {product.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </div>

                    {/* Quantity */}
                    <div>
                      <FormField
                        label="Qty"
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

                    {/* Before Tax */}
                    <div>
                      <FormField
                        label="Before Tax"
                        htmlFor={`items.${index}.before_tax`}
                        error={errors.items?.[index]?.before_tax?.message}
                        required
                      >
                        <Input
                          id={`items.${index}.before_tax`}
                          type="number"
                          step="0.01"
                          min="0"
                          {...register(`items.${index}.before_tax`, { valueAsNumber: true })}
                          error={!!errors.items?.[index]?.before_tax}
                        />
                      </FormField>
                    </div>

                    {/* After Tax (calculated) */}
                    <div>
                      <FormField label="After Tax" htmlFor={`after_tax_${index}`}>
                        <Input
                          id={`after_tax_${index}`}
                          type="text"
                          value={formatCurrency(afterTax)}
                          readOnly
                          className="bg-background"
                        />
                      </FormField>
                    </div>

                    {/* Line Total (calculated) */}
                    <div>
                      <FormField label="Line Total" htmlFor={`line_total_${index}`}>
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
          <h2 className="text-lg font-semibold text-primary mb-4">Totals</h2>
          <div className="flex flex-col items-end space-y-2">
            <div className="flex justify-between w-full max-w-sm">
              <span className="text-secondary">Total Before Tax:</span>
              <span className="font-medium text-primary">{formatCurrency(totals.totalBeforeTax)}</span>
            </div>
            <div className="flex justify-between w-full max-w-sm">
              <span className="text-secondary">VAT (11%):</span>
              <span className="font-medium text-primary">{formatCurrency(totals.totalAfterTax - totals.totalBeforeTax)}</span>
            </div>
            <div className="flex justify-between w-full max-w-sm pt-2 border-t border-secondary/20">
              <span className="text-lg font-semibold text-primary">Grand Total:</span>
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
            onClick={() => router.push(`/purchase-orders/${poId}`)}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Update Purchase Order
          </Button>
        </div>
      </form>
    </div>
  );
}
