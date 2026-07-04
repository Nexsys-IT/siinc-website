import 'server-only';

// Server-only: reads PLANS_READ_KEY, never bundled for the client.

export interface SiincPlan {
  name: string; // canonical, e.g. "Standard"
  id: string; // lowercase slug, e.g. "standard"
  ratePerGb: string | null; // "1.3500" or null (negotiated)
  minCharge: string | null;
  minUsageGb: number;
  isNegotiated: boolean;
}

// Mirrors today's site: three public plans, no rates shown.
export const FALLBACK_PLANS: SiincPlan[] = [
  {
    name: 'Standard',
    id: 'standard',
    ratePerGb: null,
    minCharge: null,
    minUsageGb: 100,
    isNegotiated: false,
  },
  {
    name: 'Professional',
    id: 'professional',
    ratePerGb: null,
    minCharge: null,
    minUsageGb: 500,
    isNegotiated: false,
  },
  {
    name: 'Enterprise',
    id: 'enterprise',
    ratePerGb: null,
    minCharge: null,
    minUsageGb: 5000,
    isNegotiated: true,
  },
];

// Shape of a single plan as returned by the SIINC front-end's /api/plans/.
interface ApiPlan {
  name: string;
  rate_per_gb: string | null;
  min_charge: string | null;
  min_usage_gb: number;
  is_negotiated: boolean;
}

function isApiPlan(value: unknown): value is ApiPlan {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.name === 'string' &&
    (typeof p.rate_per_gb === 'string' || p.rate_per_gb === null) &&
    (typeof p.min_charge === 'string' || p.min_charge === null) &&
    typeof p.min_usage_gb === 'number' &&
    typeof p.is_negotiated === 'boolean'
  );
}

function isApiPlansPayload(value: unknown): value is { plans: ApiPlan[] } {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  return Array.isArray(payload.plans) && payload.plans.every(isApiPlan);
}

/**
 * Fetch live plans from the SIINC front-end. Any failure (missing key,
 * network error, non-200, unexpected shape, empty list) resolves to the
 * static fallback rather than throwing, so callers can always render
 * something.
 */
export async function fetchPlans(): Promise<{
  plans: SiincPlan[];
  live: boolean;
}> {
  // Fresh array per call: callers may sort/splice result.plans without
  // corrupting FALLBACK_PLANS for every later request in a long-lived server.
  const fallback = { plans: [...FALLBACK_PLANS], live: false };

  try {
    const apiKey = process.env.PLANS_READ_KEY;
    if (!apiKey) {
      return fallback;
    }

    const baseUrl = process.env.SIINC_APP_URL ?? 'https://app.siinc.io';
    const response = await fetch(`${baseUrl}/api/plans/`, {
      headers: { 'X-Api-Key': apiKey },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return fallback;
    }

    const data: unknown = await response.json();
    // The front-end always seeds plans and fails closed, so an empty list
    // means something upstream is broken — treat it as a failure.
    if (!isApiPlansPayload(data) || data.plans.length === 0) {
      return fallback;
    }

    const plans: SiincPlan[] = data.plans.map((p) => ({
      name: p.name,
      id: p.name.toLowerCase(),
      ratePerGb: p.rate_per_gb,
      minCharge: p.min_charge,
      minUsageGb: p.min_usage_gb,
      isNegotiated: p.is_negotiated,
    }));

    return { plans, live: true };
  } catch {
    return fallback;
  }
}

/**
 * Resolve a plan id/name to its canonical display name (case-insensitive).
 * Unknown ids fall back to the input with its first letter capitalised.
 */
export function canonicalPlanName(id: string, plans: SiincPlan[]): string {
  const needle = id.toLowerCase();
  const match = plans.find(
    (plan) =>
      plan.id.toLowerCase() === needle || plan.name.toLowerCase() === needle,
  );
  if (match) {
    return match.name;
  }

  return id.charAt(0).toUpperCase() + id.slice(1);
}
