import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canonicalPlanName,
  FALLBACK_PLANS,
  fetchPlans,
  type SiincPlan,
} from './plans';

// vi.mock calls are hoisted above imports by vitest's transform, so this
// still runs before src/lib/plans.ts's `import 'server-only'` executes.
vi.mock('server-only', () => ({}));

const REAL_CONTRACT_PAYLOAD = {
  plans: [
    {
      name: 'Basic',
      rate_per_gb: '1.5000',
      min_charge: '60.00',
      min_usage_gb: 0,
      is_negotiated: false,
    },
    {
      name: 'Enterprise',
      rate_per_gb: null,
      min_charge: null,
      min_usage_gb: 5000,
      is_negotiated: true,
    },
  ],
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('fetchPlans', () => {
  it('maps the live API contract into SiincPlan[] with lowercase ids', async () => {
    vi.stubEnv('PLANS_READ_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(REAL_CONTRACT_PAYLOAD)),
    );

    const result = await fetchPlans();

    expect(result.live).toBe(true);
    expect(result.plans).toEqual<SiincPlan[]>([
      {
        name: 'Basic',
        id: 'basic',
        ratePerGb: '1.5000',
        minCharge: '60.00',
        minUsageGb: 0,
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
    ]);
  });

  it('calls the API with the X-Api-Key header and default base URL', async () => {
    vi.stubEnv('PLANS_READ_KEY', 'test-key');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ plans: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchPlans();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.siinc.io/api/plans/',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Api-Key': 'test-key' }),
      }),
    );
  });

  it('falls back when fetch rejects', async () => {
    vi.stubEnv('PLANS_READ_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    const result = await fetchPlans();

    expect(result).toEqual({ plans: FALLBACK_PLANS, live: false });
  });

  it('falls back on a non-200 response', async () => {
    vi.stubEnv('PLANS_READ_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ plans: [] }, false, 500)),
    );

    const result = await fetchPlans();

    expect(result).toEqual({ plans: FALLBACK_PLANS, live: false });
  });

  it('falls back on a malformed response body', async () => {
    vi.stubEnv('PLANS_READ_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ notPlans: true })),
    );

    const result = await fetchPlans();

    expect(result).toEqual({ plans: FALLBACK_PLANS, live: false });
  });

  it('falls back without calling fetch when PLANS_READ_KEY is missing', async () => {
    vi.stubEnv('PLANS_READ_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPlans();

    expect(result).toEqual({ plans: FALLBACK_PLANS, live: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('canonicalPlanName', () => {
  it('resolves a known id to its canonical display name', () => {
    expect(canonicalPlanName('professional', FALLBACK_PLANS)).toBe(
      'Professional',
    );
  });

  it('is case-insensitive on id and name', () => {
    expect(canonicalPlanName('STANDARD', FALLBACK_PLANS)).toBe('Standard');
  });

  it('capitalises an unknown id as a fallback label', () => {
    expect(canonicalPlanName('gold', FALLBACK_PLANS)).toBe('Gold');
  });
});
