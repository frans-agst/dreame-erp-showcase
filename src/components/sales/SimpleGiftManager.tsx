'use client';

import { useState } from 'react';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n/context';

interface SimpleGiftManagerProps {
  itemIndex: number;
  form: any;
  products: any[];
  excludeProductId?: string;
}

export function SimpleGiftManager({ 
  itemIndex, 
  form, 
  products, 
  excludeProductId 
}: SimpleGiftManagerProps) {
  const { t } = useI18n();
  const [giftProductId, setGiftProductId] = useState<string>('');
  const [giftQty, setGiftQty] = useState<number>(1);

  const currentGifts = form.watch(`items.${itemIndex}.gift_details`) || [];

  // Get available products for gifts (exclude main product and already selected gifts)
  const getGiftProductOptions = (): SearchableSelectOption[] => {
    const excludeIds = [excludeProductId, ...currentGifts.map((g: any) => g.product_id)].filter(Boolean);
    
    return products
      .filter((product: any) => !excludeIds.includes(product.id))
      .map((product: any) => ({
        value: product.id,
        label: `${product.name} (${product.sku})`,
        searchText: `${product.name} ${product.sku} ${product.category || ''}`
      }));
  };

  // Add gift to the item
  const handleAddGift = () => {
    if (!giftProductId || giftQty < 1) return;
    
    const product = products.find((p: any) => p.id === giftProductId);
    if (!product) return;
    
    // Check if gift already exists
    const existingIndex = currentGifts.findIndex((g: any) => g.product_id === giftProductId);
    if (existingIndex >= 0) {
      // Update quantity
      const updatedGifts = [...currentGifts];
      updatedGifts[existingIndex].qty += giftQty;
      form.setValue(`items.${itemIndex}.gift_details`, updatedGifts);
    } else {
      // Check max 2 gifts limit
      if (currentGifts.length >= 2) return;
      
      // Add new gift
      const newGift = {
        product_id: giftProductId,
        name: product.name,
        qty: giftQty,
      };
      
      form.setValue(`items.${itemIndex}.gift_details`, [...currentGifts, newGift]);
    }
    
    // Reset gift inputs
    setGiftProductId('');
    setGiftQty(1);
  };

  // Remove gift from the item
  const handleRemoveGift = (productId: string) => {
    const updatedGifts = currentGifts.filter((g: any) => g.product_id !== productId);
    form.setValue(`items.${itemIndex}.gift_details`, updatedGifts);
  };

  return (
    <div className="border-t border-secondary/10 pt-4 space-y-3">
      <h5 className="text-sm font-medium text-primary">
        {t('form.gifts') || 'Gift Products'} ({t('sales.optional') || 'Optional'}) - Max 2
      </h5>
      <p className="text-xs text-secondary">
        {t('sales.giftNote') || 'Add gift products for this item (maximum 2 gifts per product)'}
      </p>
      
      {/* Gift input row - hide when max reached */}
      {currentGifts.length < 2 && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-secondary mb-1 block">
              {t('sales.giftProduct') || 'Gift Product'}
            </label>
            <SearchableSelect
              options={getGiftProductOptions()}
              value={giftProductId}
              onChange={setGiftProductId}
              placeholder={t('form.selectProduct') || 'Select Product'}
            />
          </div>
          <div className="w-20">
            <label className="text-xs text-secondary mb-1 block">
              {t('common.quantity') || 'Quantity'}
            </label>
            <Input
              type="number"
              min="1"
              value={giftQty}
              onChange={(e) => setGiftQty(parseInt(e.target.value) || 1)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddGift}
            disabled={!giftProductId}
          >
            {t('sales.addGift') || 'Add Gift'}
          </Button>
        </div>
      )}
      
      {/* Max gifts reached message */}
      {currentGifts.length >= 2 && (
        <p className="text-xs text-accent-orange">
          {t('sales.maxGiftsReached') || 'Maximum 2 gifts reached for this product'}
        </p>
      )}

      {/* Selected gifts list */}
      {currentGifts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-secondary">
            {t('sales.selectedGifts') || 'Selected Gifts'}:
          </p>
          {currentGifts.map((gift: any) => (
            <div
              key={gift.product_id}
              className="flex items-center justify-between bg-background rounded-lg px-3 py-2"
            >
              <span className="text-sm text-primary">
                {gift.name} × {gift.qty}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveGift(gift.product_id)}
                className="text-accent-red hover:text-accent-red/80 text-sm"
              >
                {t('sales.removeGift') || 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}