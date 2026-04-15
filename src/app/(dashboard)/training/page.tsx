'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { TrainingMaterial, UserRole } from '@/types';
import {
  getTrainingMaterials,
  createTrainingMaterial,
  updateTrainingMaterial,
  deleteTrainingMaterial,
} from '@/actions/training';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createBrowserClient } from '@supabase/ssr';

export default function TrainingPage() {
  const { t } = useI18n();
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', url: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      // Get user role
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.app_metadata?.role) {
        setUserRole(user.app_metadata.role as UserRole);
      }

      // Load materials
      const result = await getTrainingMaterials();
      if (result.success) {
        setMaterials(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const handleOpenMaterial = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleAdd = () => {
    setEditingId(null);
    setFormData({ title: '', url: '' });
    setFormError(null);
    setShowForm(true);
  };

  const handleEdit = (material: TrainingMaterial) => {
    setEditingId(material.id);
    setFormData({ title: material.title, url: material.url });
    setFormError(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ title: '', url: '' });
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const result = editingId
      ? await updateTrainingMaterial(editingId, formData)
      : await createTrainingMaterial(formData);

    if (result.success) {
      if (editingId) {
        setMaterials(materials.map(m => m.id === editingId ? result.data : m));
      } else {
        setMaterials([result.data, ...materials]);
      }
      handleCancel();
    } else {
      setFormError(result.error);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirm') + '?')) return;
    
    const result = await deleteTrainingMaterial(id);
    if (result.success) {
      setMaterials(materials.filter(m => m.id !== id));
    } else {
      setError(result.error);
    }
  };

  const canManage = userRole === 'admin' || userRole === 'manager';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">{t('training.title')}</h1>
        {canManage && (
          <Button onClick={handleAdd}>
            {t('common.add')}
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium text-primary mb-4">
            {editingId ? t('common.edit') : t('common.add')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                {t('form.name')}
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Training Material Title"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                URL (Google Drive)
              </label>
              <Input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://drive.google.com/..."
                required
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? t('common.loading') : t('common.save')}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {materials.length === 0 ? (
        <EmptyState
          title={t('training.noMaterials')}
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => (
            <div
              key={material.id}
              className="bg-surface border border-border rounded-xl p-6 group"
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => handleOpenMaterial(material.url)}
                  className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-colors"
                >
                  <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-primary truncate">{material.title}</h3>
                  <button
                    onClick={() => handleOpenMaterial(material.url)}
                    className="text-sm text-secondary mt-1 flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    {t('training.openMaterial')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(material)}
                      className="p-2 text-secondary hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                      title={t('common.edit')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(material.id)}
                      className="p-2 text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={t('common.delete')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
