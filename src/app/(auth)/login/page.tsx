'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginSchema, type LoginInput } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';
import { syncAndRefresh } from '@/lib/auth/sync-metadata';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Check for password reset success message
  useEffect(() => {
    if (searchParams.get('reset') === 'success') {
      setResetSuccess(true);
      // Clear the URL parameter
      router.replace('/login');
    }
  }, [searchParams, router]);

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setFormError(null);

    try {
      const supabase = createClient();
      
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      // Sync JWT metadata with profile data (role, branch_id)
      // This ensures RLS policies work correctly
      if (authData.user) {
        await syncAndRefresh(authData.user.id);
      }

      setShowSuccess(true);
      
      // Redirect to dashboard after successful login
      router.push('/dashboard');
      router.refresh();
    } catch {
      setFormError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-3xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      {/* Theme Toggle */}
      <div className="flex justify-end mb-4">
        <ThemeToggle />
      </div>

      {/* Logo/Header */}
      <div className="text-center mb-8">
        <img 
          src="/logo-icon.svg" 
          alt="OmniERP ERP" 
          className="w-12 h-12 mx-auto mb-4"
          style={{ filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.3))' }}
        />
        <h1 className="text-2xl font-bold text-primary">OmniERP Retail ERP</h1>
        <p className="text-secondary mt-2">Sign in to your account</p>
      </div>

      {/* Password Reset Success Message */}
      {resetSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm border border-green-200 dark:border-green-800">
          ✅ Your password has been successfully reset. You can now sign in with your new password.
        </div>
      )}

      {/* Success Toast */}
      {showSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-primary text-sm border border-border">
          Login successful! Redirecting...
        </div>
      )}

      {/* Form Error */}
      {formError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-800">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email Field */}
        <div>
          <label 
            htmlFor="email" 
            className="block text-sm font-medium text-primary mb-2"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            disabled={isLoading}
            {...register('email')}
            className={`
              w-full px-4 py-3 rounded-xl border bg-surface
              text-primary placeholder:text-muted
              focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              ${errors.email 
                ? 'border-red-300 dark:border-red-700' 
                : 'border-border hover:border-secondary'
              }
            `}
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-primary"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              className="text-sm text-secondary hover:text-primary transition-colors duration-200 bg-transparent border-none cursor-pointer p-0"
            >
              Forgot password?
            </button>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            disabled={isLoading}
            {...register('password')}
            className={`
              w-full px-4 py-3 rounded-xl border bg-surface
              text-primary placeholder:text-muted
              focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              ${errors.password 
                ? 'border-red-300 dark:border-red-700' 
                : 'border-border hover:border-secondary'
              }
            `}
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`
            w-full py-3 px-4 rounded-xl font-medium
            bg-neutral-600 dark:bg-neutral-200 text-white dark:text-neutral-900
            hover:bg-neutral-500 dark:hover:bg-neutral-300
            focus:outline-none focus:ring-2 focus:ring-neutral-400/20 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
          `}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg 
                className="animate-spin h-5 w-5" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Signing in...
            </span>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="bg-surface border border-border rounded-3xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
