'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { PasswordResetRequestSchema, type PasswordResetRequestInput } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(PasswordResetRequestSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: PasswordResetRequestInput) => {
    setIsLoading(true);
    setFormError(null);
    setRateLimitError(false);

    try {
      // Check rate limiting (client-side)
      const lastResetKey = `password_reset_${data.email}`;
      const lastResetTime = localStorage.getItem(lastResetKey);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

      if (lastResetTime && (now - parseInt(lastResetTime)) < oneHour) {
        setRateLimitError(true);
        const timeLeft = Math.ceil((oneHour - (now - parseInt(lastResetTime))) / 60000);
        setFormError(`You can only request a password reset once per hour. Please wait ${timeLeft} more minutes.`);
        return;
      }

      const supabase = createClient();
      
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        // Check if it's a rate limiting error from Supabase
        if (error.message.toLowerCase().includes('rate') || 
            error.message.toLowerCase().includes('limit') ||
            error.message.toLowerCase().includes('too many') ||
            error.message.includes('429') ||
            error.message.includes('email rate limit exceeded')) {
          setRateLimitError(true);
          setFormError('Email rate limit exceeded. Please wait a few minutes before trying again.');
        } else {
          setFormError(error.message);
        }
        return;
      }

      // Store timestamp for rate limiting
      localStorage.setItem(lastResetKey, now.toString());

      setShowSuccess(true);
    } catch {
      setFormError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="bg-surface border border-border rounded-3xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        {/* Theme Toggle */}
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>

        {/* Success Message */}
        <div className="text-center">
          <div className="text-accent-green text-6xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-primary mb-4">Check Your Email</h1>
          <p className="text-secondary mb-6">
            We've sent a password reset link to <strong>{getValues('email')}</strong>
          </p>
          <p className="text-sm text-secondary mb-8">
            If you don't see the email, check your spam folder or try again with a different email address.
          </p>
          
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-medium bg-neutral-600 dark:bg-neutral-200 text-white dark:text-neutral-900 hover:bg-neutral-500 dark:hover:bg-neutral-300 transition-all duration-200"
          >
            Back to Login
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
          alt="Dreame ERP" 
          className="w-12 h-12 mx-auto mb-4"
          style={{ filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.3))' }}
        />
        <h1 className="text-2xl font-bold text-primary">Reset Your Password</h1>
        <p className="text-secondary mt-2">Enter your email address and we'll send you a reset link</p>
      </div>

      {/* Form Error */}
      {formError && (
        <div className={`mb-6 p-4 rounded-xl text-sm border ${
          rateLimitError 
            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
        }`}>
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
            Email Address
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
              Sending Reset Link...
            </span>
          ) : (
            'Send Reset Link'
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