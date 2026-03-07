import { z } from "zod";

export const zipSchema = z.string().regex(/^\d{5}$/, "ZIP must be exactly 5 digits");

export const trackEventSchema = z.object({
  event: z.string().min(1),
  click_id: z.string().min(1),
  account_id: z.string().min(1).optional(),
  timestamp: z.string().datetime().optional(),
  meta: z.record(z.unknown()).optional(),
});

const leadBaseSchema = z.object({
  lead_id: z.string().min(1),
  click_id: z.string().min(1),
  created: z.string().datetime().optional(),
});

export const leadsgateCallbackSchema = z.discriminatedUnion("type", [
  leadBaseSchema.extend({
    type: z.literal("soldLead"),
    price: z.number(),
  }),
  leadBaseSchema.extend({
    type: z.literal("rejectLead"),
  }),
  leadBaseSchema.extend({
    type: z.literal("newLead"),
  }),
]);

