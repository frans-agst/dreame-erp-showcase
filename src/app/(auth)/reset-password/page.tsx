'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PasswordResetSchema, type PasswordResetInput } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

function ResetPasswordForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PasswordResetInput>({
    resolver: zodResolver(PasswordResetSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');

  // Check for valid session on mount
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // Check if session exists and is a recovery session (password reset)
      if (error || !session) {
        setTokenError(true);
        return;
      }

      // Verify this is actually a password recovery session
      // Supabase sets the session type when coming from a password reset email
      if (session.user.aud !== 'authenticated') {
        setTokenError(true);
      }
    };

    checkSession();
  }, []);

  const onSubmit = async (data: PasswordResetInput) => {
    setIsLoading(true);
    setFormError(null);

    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      // Sign out the user after password reset to ensure they log in with new password
      await supabase.auth.signOut();

      setShowSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login?reset=success');
      }, 3000);
    } catch {
      setFormError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    
    return strength;
  };

  const passwordStrength = getPasswordStrength(password || '');
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

  if (tokenError) {
    return (
      <div className="bg-surface border border-border rounded-3xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        {/* Theme Toggle */}
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>

        {/* Error Message */}
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-primary mb-4">Invalid or Expired Link</h1>
          <p className="text-secondary mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          
          <div className="space-y-3">
            <Link
              href="/forgot-password"
              className="block w-full py-3 px-4 rounded-xl font-medium bg-neutral-600 dark:bg-neutral-200 text-white dark:text-neutral-900 hover:bg-neutral-500 dark:hover:bg-neutral-300 transition-all duration-200 text-center"
            >
              Request New Reset Link
            </Link>
            <Link
              href="/login"
              className="block text-sm text-secondary hover:text-primary transition-colors duration-200"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="bg-surface border border-border rounded-3xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        {/* Theme Toggle */}
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>

        {/* Success Message */}
        <div className="text-center">
          <div className="text-accent-green text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-primary mb-4">Password Reset Successful</h1>
          <p className="text-secondary mb-6">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
          <p className="text-sm text-secondary mb-8">
            Redirecting to login page in 3 seconds...
          </p>
          
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-medium bg-neutral-600 dark:bg-neutral-200 text-white dark:text-neutral-900 hover:bg-neutral-500 dark:hover:bg-neutral-300 transition-all duration-200"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold text-primary">Set New Password</h1>
        <p className="text-secondary mt-2">Enter your new password below</p>
      </div>

      {/* Form Error */}
      {formError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-800">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Password Field */}
        <div>
          <label 
            htmlFor="password" 
            className="block text-sm font-medium text-primary mb-2"
          >
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={isLoading}
              {...register('password')}
              className={`
                w-full px-4 py-3 pr-12 rounded-xl border bg-surface
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
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          
          {/* Password Strength Indicator */}
          {password && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      index < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-secondary">
                Password strength: {strengthLabels[passwordStrength - 1] || 'Too weak'}
              </p>
            </div>
          )}
          
          {errors.password && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div>
          <label 
            htmlFor="confirmPassword" 
            className="block text-sm font-medium text-primary mb-2"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={isLoading}
              {...register('confirmPassword')}
              className={`
                w-full px-4 py-3 pr-12 rounded-xl border bg-surface
                text-primary placeholder:text-muted
                focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
                ${errors.confirmPassword 
                  ? 'border-red-300 dark:border-red-700' 
                  : 'border-border hover:border-secondary'
                }
              `}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
            >
              {showConfirmPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Password Requirements */}
        <div className="text-xs text-secondary space-y-1">
          <p className="font-medium">Password must contain:</p>
          <ul className="space-y-1 ml-4">
            <li className={`flex items-center gap-2 ${password && password.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}`}>
              <span>{password && password.length >= 8 ? '✓' : '•'}</span>
              At least 8 characters
            </li>
            <li className={`flex items-center gap-2 ${password && /[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}`}>
              <span>{password && /[A-Z]/.test(password) ? '✓' : '•'}</span>
              One uppercase letter
            </li>
            <li className={`flex items-center gap-2 ${password && /[a-z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}`}>
              <span>{password && /[a-z]/.test(password) ? '✓' : '•'}</span>
              One lowercase letter
            </li>
            <li className={`flex items-center gap-2 ${password && /[0-9]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}`}>
              <span>{password && /[0-9]/.test(password) ? '✓' : '•'}</span>
              One number
            </li>
          </ul>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || passwordStrength < 4}
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
              Updating Password...
            </span>
          ) : (
            'Update Password'
          )}
        </button>

        {/* Back to Login */}
        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-secondary hover:text-primary transition-colors duration-200"
          >
            ← Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="bg-surface border border-border rounded-3xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}