// src/lib/validations/day-off.ts
import { z } from 'zod';

/**
 * Day Off Request Schema
 * Validates day-off request submissions from staff
 * Requirements: 6.1, 6.2, 10.1
 */
export const DayOffRequestSchema = z.object({
  start_date: z
    .string()
    .min(1, { message: 'Start date is required' })
    .refine(
      (val) => !isNaN(Date.parse(val)),
      { message: 'Start date must be a valid date' }
    ),
  end_date: z
    .string()
    .min(1, { message: 'End date is required' })
    .refine(
      (val) => !isNaN(Date.parse(val)),
      { message: 'End date must be a valid date' }
    ),
  reason: z
    .string()
    .min(1, { message: 'Reason is required' })
    .max(500, { message: 'Reason must not exceed 500 characters' }),
}).refine(
  (data) => {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    return end >= start;
  },
  {
    message: 'End date must be after start date',
    path: ['end_date'],
  }
);

export type DayOffRequestInput = z.infer<typeof DayOffRequestSchema>;

/**
 * Day Off Approval Schema
 * Validates manager approval/rejection of day-off requests
 * Requirements: 6.3, 6.4, 10.1
 */
export const DayOffApprovalSchema = z.object({
  approved: z.boolean({ message: 'Approval decision is required' }),
});

export type DayOffApprovalInput = z.infer<typeof DayOffApprovalSchema>;

/**
 * Day Off Filter Schema
 * Validates filters for day-off request queries
 */
export const DayOffFilterSchema = z.object({
  staff_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export type DayOffFilterInput = z.infer<typeof DayOffFilterSchema>;
