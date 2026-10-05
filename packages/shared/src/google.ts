import { z } from 'zod';

/**
 * "Ver horario": a place's hours, phone and website fetched live from Google, never stored.
 * The other statuses explain why there's nothing to show.
 */
export const googleDetailsResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    /** Google's own weekday lines in the requested language, e.g. "lunes: 8:00–19:00". */
    weekdayHours: z.array(z.string()),
    openNow: z.boolean().nullable(),
    phone: z.string().nullable(),
    website: z.string().nullable(),
    googleMapsUrl: z.string().nullable(),
    /** OPERATIONAL, CLOSED_TEMPORARILY or CLOSED_PERMANENTLY. */
    businessStatus: z.string().nullable(),
  }),
  /** Google has no matching listing for this place. */
  z.object({ status: z.literal('not_found') }),
  /** This month's free Google allowance is used up, or Google isn't configured. */
  z.object({ status: z.literal('unavailable') }),
  /** This user reached today's lookup limit. */
  z.object({ status: z.literal('limit_reached') }),
]);
export type GoogleDetailsResponse = z.infer<typeof googleDetailsResponseSchema>;
