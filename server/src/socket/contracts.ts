import { z } from 'zod';

const table = z.object({ tableId: z.enum(['table-small', 'table-medium', 'table-high']) });
export const socketContracts: Record<string, z.ZodTypeAny> = {
  'table:join': table.extend({ buyIn: z.number().int().positive().max(100_000_000) }).strict(),
  'table:leave': table.extend({ forceFold: z.boolean().optional() }).strict(),
  'table:get-state': table.strict(),
  'game:action': table
    .extend({
      action: z.enum(['fold', 'check', 'call', 'raise', 'all-in']),
      amount: z.number().int().nonnegative().max(100_000_000).optional(),
    })
    .strict(),
  'global:chat-send': z.object({ message: z.string().trim().min(1).max(200) }).strict(),
  'chat:send': table.extend({ message: z.string().trim().min(1).max(200) }).strict(),
};
