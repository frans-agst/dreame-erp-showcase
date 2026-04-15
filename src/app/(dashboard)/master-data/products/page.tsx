'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { SoftCard } from '@/components/ui/SoftCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProductSchema, ProductInput } from '@/lib/validations/master-data';
import { PRODUCT_CATEGORIES, PRODUCT_SUB_CATEGORIES, PRICE_CHANNELS } from '@/lib/product-categories';
import {
  getProducts,
  createProduct,
  updateProduct,
  softDeleteProduct,
  exportProductPrices,
  previewPriceUpdates,
  applyPriceUpdates,
  PriceUpdateRow,
  PriceUpdatePreview,
} from '@/actions/master-data';
import { FilteredProduct, FullProduct } from '@/lib/price-filter';
import { useI18n } from '@/lib/i18n/context';

type ProductFormData = ProductInput;

export default function ProductsPage() {
  const { t } = useI18n();
  const [products, setProducts] = useState<FilteredProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<FilteredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FilteredProduct | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FilteredProduct | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Bulk price update state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [pricePreview, setPricePreview] = useState<PriceUpdatePreview[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(ProductSchema),
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const result = await getProducts(!showInactive);
    if (result.success) {
      setProducts(result.data);
    }
    setLoading(false);
  }, [showInactive]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Filter products based on search and filters
  useEffect(() => {
    let result = products;

    // Search filter (SKU or Name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.sku.toLowerCase().includes(query) ||
          p.name.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter) {
      result = result.filter((p) => p.category === categoryFilter);
    }

    // Sub-category filter
    if (subCategoryFilter) {
      result = result.filter(
        (p) => (p as unknown as { sub_category?: string }).sub_category === subCategoryFilter
      );
    }

    setFilteredProducts(result);
  }, [products, searchQuery, categoryFilter, subCategoryFilter]);

  // Get unique categories and sub-categories from products
  const uniqueCategories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort() as string[];
  const uniqueSubCategories = [...new Set(
    products
      .map((p) => (p as unknown as { sub_category?: string }).sub_category)
      .filter(Boolean)
  )].sort() as string[];

  const openCreateModal = () => {
    setEditingProduct(null);
    reset({ 
      sku: '', 
      name: '', 
      price: 0, 
      category: '', 
      sub_category: '',
      channel_pricing: {
        brandstore: 0,
        retailer: 0,
        modern_channel_1: 0,
        modern_channel_2: 0,
        modern_channel_3: 0,
      },
    });
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: FilteredProduct) => {
    setEditingProduct(product);
    // Get price from the product - could be 'price' (filtered) or 'price_retail' (full)
    const price = 'price' in product ? product.price : ('price_retail' in product ? (product as unknown as { price_retail: number }).price_retail : 0);
    // Get channel_pricing from the product
    const fullProduct = product as unknown as FullProduct;
    const channelPricing = fullProduct.channel_pricing || {};
    reset({
      sku: product.sku,
      name: product.name,
      price: price,
      category: product.category || '',
      sub_category: (product as unknown as { sub_category?: string }).sub_category || '',
      channel_pricing: {
        brandstore: channelPricing.brandstore || 0,
        retailer: channelPricing.retailer || 0,
        modern_channel_1: channelPricing.modern_channel_1 || 0,
        modern_channel_2: channelPricing.modern_channel_2 || 0,
        modern_channel_3: channelPricing.modern_channel_3 || 0,
      },
    });
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setSubmitError(null);
    reset();
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = editingProduct
        ? await updateProduct(editingProduct.id, data)
        : await createProduct(data);

      if (result.success) {
        closeModal();
        fetchProducts();
      } else {
        setSubmitError(result.error);
      }
    } catch {
      setSubmitError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setIsSubmitting(true);
    const result = await softDeleteProduct(deleteConfirm.id);

    if (result.success) {
      setDeleteConfirm(null);
      fetchProducts();
    } else {
      setSubmitError(result.error);
    }
    setIsSubmitting(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Export prices to Excel
  const handleExportPrices = async () => {
    setIsExporting(true);
    try {
      const result = await exportProductPrices();
      
      if (result.success) {
        // Use xlsx library to create Excel file
        const XLSX = await import('xlsx');
        const worksheet = XLSX.utils.json_to_sheet(result.data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Product Prices');
        
        // Download file
        XLSX.writeFile(workbook, `product-prices-${new Date().toISOString().split('T')[0]}.xlsx`);
      } else {
        setSubmitError(result.error);
      }
    } catch (error) {
      console.error('Error exporting prices:', error);
      setSubmitError('Failed to export prices');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle file selection and auto-trigger preview
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportError(null);
      
      // Auto-trigger preview
      setIsImporting(true);
      
      try {
        const XLSX = await import('xlsx');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as PriceUpdateRow[];

        // Validate required columns
        if (jsonData.length === 0) {
          setImportError('File is empty');
          setIsImporting(false);
          return;
        }

        const firstRow = jsonData[0];
        const requiredColumns = ['sku', 'brandstore', 'retailer', 'modern_channel_1', 'modern_channel_2', 'modern_channel_3'];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));
        
        if (missingColumns.length > 0) {
          setImportError(`Missing required columns: ${missingColumns.join(', ')}`);
          setIsImporting(false);
          return;
        }

        // Get preview from server
        const result = await previewPriceUpdates(jsonData);
        
        if (result.success) {
          setPricePreview(result.data);
          setIsImportModalOpen(true);
        } else {
          setImportError(result.error);
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        setImportError('Failed to parse file. Please ensure it is a valid Excel file.');
      } finally {
        setIsImporting(false);
      }
    }
  };

  // Apply price updates
  const handleApplyImport = async () => {
    if (!importFile || pricePreview.length === 0) return;

    setIsImporting(true);
    setImportError(null);
    
    try {
      const XLSX = await import('xlsx');
      const data = await importFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as PriceUpdateRow[];

      // Filter only rows with changes
      const updatesToApply = jsonData.filter(row => {
        const preview = pricePreview.find(p => p.sku === row.sku);
        return preview?.has_changes;
      });

      const result = await applyPriceUpdates(updatesToApply);
      
      if (result.success) {
        setImportSuccess(`Successfully updated ${result.data.updated} products. Skipped ${result.data.skipped} products.`);
        setIsImportModalOpen(false);
        setImportFile(null);
        setPricePreview([]);
        fetchProducts(); // Refresh product list
        
        // Reset file input
        const fileInput = document.getElementById('price-import-file') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
        
        // Clear success message after 5 seconds
        setTimeout(() => setImportSuccess(null), 5000);
      } else {
        setImportError(result.error);
      }
    } catch (error) {
      console.error('Error applying updates:', error);
      setImportError('Failed to apply updates');
    } finally {
      setIsImporting(false);
    }
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportFile(null);
    setPricePreview([]);
    setImportError(null);
    
    // Reset file input
    const fileInput = document.getElementById('price-import-file') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const columns: Column<FilteredProduct>[] = [
    {
      key: 'sku',
      header: t('form.sku'),
      sortable: true,
    },
    {
      key: 'name',
      header: t('form.name'),
      sortable: true,
    },
    {
      key: 'category',
      header: t('form.category'),
      sortable: true,
      render: (row) => row.category || '-',
    },
    {
      key: 'sub_category',
      header: t('form.subCategory') || 'Sub Category',
      sortable: true,
      render: (row) => (row as unknown as { sub_category?: string }).sub_category || '-',
    },
    {
      key: 'brandstore',
      header: 'Brandstore',
      render: (row) => {
        const fullProduct = row as unknown as FullProduct;
        return formatPrice(fullProduct.channel_pricing?.brandstore || 0);
      },
    },
    {
      key: 'retailer',
      header: 'Retailer',
      render: (row) => {
        const fullProduct = row as unknown as FullProduct;
        return formatPrice(fullProduct.channel_pricing?.retailer || 0);
      },
    },
    {
      key: 'modern_channel_1',
      header: 'MC 1',
      render: (row) => {
        const fullProduct = row as unknown as FullProduct;
        return formatPrice(fullProduct.channel_pricing?.modern_channel_1 || 0);
      },
    },
    {
      key: 'modern_channel_2',
      header: 'MC 2',
      render: (row) => {
        const fullProduct = row as unknown as FullProduct;
        return formatPrice(fullProduct.channel_pricing?.modern_channel_2 || 0);
      },
    },
    {
      key: 'modern_channel_3',
      header: 'MC 3',
      render: (row) => {
        const fullProduct = row as unknown as FullProduct;
        return formatPrice(fullProduct.channel_pricing?.modern_channel_3 || 0);
      },
    },
    {
      key: 'is_active',
      header: t('common.status'),
      render: (row) => (
        <StatusBadge
          status={row.is_active ? 'green' : 'red'}
          label={row.is_active ? t('status.active') : t('status.inactive')}
        />
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(row)}
            className="text-accent-green hover:text-accent-green/80 text-sm font-medium"
          >
            {t('common.edit')}
          </button>
          <button
            onClick={() => setDeleteConfirm(row)}
            className="text-accent-red hover:text-accent-red/80 text-sm font-medium"
          >
            {t('common.delete')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('sidebar.products')}</h1>
          <p className="text-secondary mt-1">{t('masterData.manageProducts')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-secondary/20 text-accent-green focus:ring-accent-green/20"
            />
            {t('masterData.showInactive')}
          </label>
          <Button 
            variant="secondary" 
            onClick={handleExportPrices}
            isLoading={isExporting}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Prices
          </Button>
          <div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              id="price-import-file"
              disabled={isImporting}
            />
            <label htmlFor="price-import-file" className={`cursor-pointer ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="inline-flex items-center justify-center px-4 py-2 rounded-xl font-medium transition-colors bg-background hover:bg-secondary/10 text-primary border border-secondary/20">
                {isImporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Import Prices
                  </>
                )}
              </span>
            </label>
          </div>
          <Button onClick={openCreateModal}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('masterData.addProduct')}
          </Button>
        </div>
      </div>

      {/* Import Success Message */}
      {importSuccess && (
        <div className="p-4 rounded-xl bg-accent-greenLight text-accent-green">
          {importSuccess}
        </div>
      )}

      {/* Import Error Message */}
      {importError && (
        <div className="p-4 rounded-xl bg-accent-redLight text-accent-red">
          {importError}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by SKU or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="sm:w-48"
        >
          <option value="">All Categories</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>
        <Select
          value={subCategoryFilter}
          onChange={(e) => setSubCategoryFilter(e.target.value)}
          className="sm:w-48"
        >
          <option value="">All Sub Categories</option>
          {uniqueSubCategories.map((subCat) => (
            <option key={subCat} value={subCat}>
              {subCat}
            </option>
          ))}
        </Select>
        {(searchQuery || categoryFilter || subCategoryFilter) && (
          <Button
            variant="secondary"
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('');
              setSubCategoryFilter('');
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      {(searchQuery || categoryFilter || subCategoryFilter) && (
        <p className="text-sm text-secondary">
          Showing {filteredProducts.length} of {products.length} products
        </p>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredProducts}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage={t('masterData.noProducts')}
        pageSize={10}
      />

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
          />
          <SoftCard className="relative z-10 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-primary mb-6">
              {editingProduct ? t('masterData.editProduct') : t('masterData.addProduct')}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label={t('form.sku')}
                  htmlFor="sku"
                  error={errors.sku?.message}
                  required
                >
                  <Input
                    id="sku"
                    {...register('sku')}
                    error={!!errors.sku}
                    placeholder="e.g., PROD-001"
                  />
                </FormField>

                <FormField
                  label={t('form.name')}
                  htmlFor="name"
                  error={errors.name?.message}
                  required
                >
                  <Input
                    id="name"
                    {...register('name')}
                    error={!!errors.name}
                    placeholder={t('masterData.productName')}
                  />
                </FormField>

                <FormField
                  label={t('form.category')}
                  htmlFor="category"
                  error={errors.category?.message}
                >
                  <Select
                    id="category"
                    {...register('category')}
                    error={!!errors.category}
                  >
                    <option value="">{t('form.selectCategory') || 'Select Category'}</option>
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  label={t('form.subCategory') || 'Sub Category'}
                  htmlFor="sub_category"
                  error={errors.sub_category?.message}
                >
                  <Select
                    id="sub_category"
                    {...register('sub_category')}
                    error={!!errors.sub_category}
                  >
                    <option value="">{t('form.selectSubCategory') || 'Select Sub Category'}</option>
                    {PRODUCT_SUB_CATEGORIES.map((subCat) => (
                      <option key={subCat.value} value={subCat.value}>
                        {subCat.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              {/* Price Channels Section */}
              <div className="border-t border-secondary/20 pt-4 mt-4">
                <h3 className="text-sm font-medium text-secondary mb-3">Channel Prices</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {PRICE_CHANNELS.map((channel) => (
                    <FormField
                      key={channel.key}
                      label={`${channel.label}`}
                      htmlFor={`channel_pricing.${channel.key}`}
                      hint={channel.description}
                    >
                      <Input
                        id={`channel_pricing.${channel.key}`}
                        type="number"
                        step="1"
                        {...register(`channel_pricing.${channel.key}` as const, { valueAsNumber: true })}
                        placeholder="0"
                      />
                    </FormField>
                  ))}
                </div>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-accent-redLight text-accent-red text-sm">
                  {submitError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeModal}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {editingProduct ? t('common.update') : t('common.create')}
                </Button>
              </div>
            </form>
          </SoftCard>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteConfirm(null)}
          />
          <SoftCard className="relative z-10 w-full max-w-sm mx-4">
            <h2 className="text-xl font-semibold text-primary mb-2">
              {t('masterData.deleteProduct')}
            </h2>
            <p className="text-secondary mb-6">
              {t('masterData.confirmDeleteProduct')} &quot;{deleteConfirm.name}&quot;?
              {deleteConfirm.is_active && (
                <span className="block mt-2 text-sm">
                  {t('masterData.deactivateNote')}
                </span>
              )}
            </p>

            {submitError && (
              <div className="p-3 rounded-xl bg-accent-redLight text-accent-red text-sm mb-4">
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteConfirm(null);
                  setSubmitError(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                isLoading={isSubmitting}
              >
                {t('common.delete')}
              </Button>
            </div>
          </SoftCard>
        </div>
      )}

      {/* Import Preview Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeImportModal}
          />
          <SoftCard className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <h2 className="text-xl font-semibold text-primary mb-4">
              Preview Price Updates
            </h2>
            <p className="text-secondary mb-4">
              Review the changes below. Only products with price changes will be updated.
            </p>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 rounded-xl bg-accent-greenLight">
                <p className="text-sm text-secondary">Total Products</p>
                <p className="text-2xl font-semibold text-primary">{pricePreview.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-accent-blueLight">
                <p className="text-sm text-secondary">With Changes</p>
                <p className="text-2xl font-semibold text-primary">
                  {pricePreview.filter(p => p.has_changes).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-accent-orangeLight">
                <p className="text-sm text-secondary">No Changes</p>
                <p className="text-2xl font-semibold text-primary">
                  {pricePreview.filter(p => !p.has_changes).length}
                </p>
              </div>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-auto border border-secondary/20 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-background sticky top-0">
                  <tr className="border-b border-secondary/20">
                    <th className="text-left p-4 font-medium text-secondary w-32">SKU</th>
                    <th className="text-left p-4 font-medium text-secondary w-48">Product</th>
                    <th className="text-left p-4 font-medium text-secondary w-40">Channel</th>
                    <th className="text-right p-4 font-medium text-secondary w-32">Old Price</th>
                    <th className="text-center p-4 font-medium text-secondary w-12">→</th>
                    <th className="text-right p-4 font-medium text-secondary w-32">New Price</th>
                    <th className="text-center p-4 font-medium text-secondary w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pricePreview.flatMap((preview) => {
                    const channels: Array<keyof typeof preview.old_prices> = [
                      'brandstore',
                      'retailer',
                      'modern_channel_1',
                      'modern_channel_2',
                      'modern_channel_3',
                    ];
                    
                    const channelLabels = {
                      brandstore: 'Brandstore',
                      retailer: 'Retailer',
                      modern_channel_1: 'MC 1',
                      modern_channel_2: 'MC 2',
                      modern_channel_3: 'MC 3',
                    };
                    
                    return channels.map((channel, idx) => {
                      const oldPrice = preview.old_prices[channel];
                      const newPrice = preview.new_prices[channel];
                      const hasChange = oldPrice !== newPrice;
                      
                      return (
                        <tr 
                          key={`${preview.sku}-${channel}`}
                          className={`border-b border-secondary/10 ${hasChange ? 'bg-accent-yellowLight/20' : ''}`}
                        >
                          {idx === 0 && (
                            <>
                              <td className="p-4 font-medium align-top" rowSpan={5}>
                                <div className="font-mono text-xs">{preview.sku}</div>
                              </td>
                              <td className="p-4 align-top" rowSpan={5}>
                                <div className="line-clamp-2 leading-relaxed">
                                  {preview.product_name}
                                </div>
                              </td>
                            </>
                          )}
                          <td className="p-4 text-secondary">
                            {channelLabels[channel]}
                          </td>
                          <td className="p-4 text-right tabular-nums">{formatPrice(oldPrice)}</td>
                          <td className="p-4 text-center text-secondary">→</td>
                          <td className="p-4 text-right font-medium tabular-nums">{formatPrice(newPrice)}</td>
                          <td className="p-4 text-center">
                            {hasChange ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-lg bg-accent-orange/20 text-accent-orange text-xs font-medium">
                                Changed
                              </span>
                            ) : (
                              <span className="text-secondary text-xs">No change</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>

            {importError && (
              <div className="p-3 rounded-xl bg-accent-redLight text-accent-red text-sm mt-4">
                {importError}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="secondary"
                onClick={closeImportModal}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApplyImport}
                isLoading={isImporting}
                disabled={pricePreview.filter(p => p.has_changes).length === 0}
              >
                Apply {pricePreview.filter(p => p.has_changes).length} Updates
              </Button>
            </div>
          </SoftCard>
        </div>
      )}
    </div>
  );
}