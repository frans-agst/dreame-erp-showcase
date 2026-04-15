// src/lib/validations/auth.ts
import { z } from 'zod';

/**
 * Login Schema
 * Validates user login credentials
 * Requirements: 1.1, 10.1
 */
export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Email must be a valid email address' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .min(8, { message: 'Password must be at least 8 characters' }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * SignUp Schema
 * Validates new user registration data
 * Requirements: 1.1, 10.1
 */
export const SignUpSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Email must be a valid email address' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .min(8, { message: 'Password must be at least 8 characters' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
  full_name: z
    .string()
    .min(1, { message: 'Full name is required' })
    .min(2, { message: 'Full name must be at least 2 characters' })
    .max(100, { message: 'Full name must not exceed 100 characters' }),
  role: z.enum(['admin', 'manager', 'staff'], {
    message: 'Role must be admin, manager, or staff',
  }),
  store_id: z
    .string()
    .uuid({ message: 'Store ID must be a valid UUID' })
    .nullable()
    .optional(),
}).refine(
  (data) => {
    // Staff and managers must have a store_id
    if ((data.role === 'staff' || data.role === 'manager') && !data.store_id) {
      return false;
    }
    return true;
  },
  {
    message: 'Staff and managers must be assigned to a store',
    path: ['store_id'],
  }
);

export type SignUpInput = z.infer<typeof SignUpSchema>;

/**
 * Password Reset Request Schema
 */
export const PasswordResetRequestSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Email must be a valid email address' }),
});

export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;

/**
 * Password Reset Schema
 */
export const PasswordResetSchema = z.object({
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .min(8, { message: 'Password must be at least 8 characters' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
  confirmPassword: z
    .string()
    .min(1, { message: 'Please confirm your password' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type PasswordResetInput = z.infer<typeof PasswordResetSchema>;
