'use client';

import Link from 'next/link';

import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { SiincPlan } from '@/lib/plans';
import { cn } from '@/lib/utils';

// The plans API has no feature bullets, so the marketing copy for each plan
// stays local, keyed by plan id. A plan without a matching entry here (e.g.
// a brand-new plan added server-side) simply renders with no feature list.
const PLAN_FEATURES: Record<string, string[]> = {
  standard: [
    'Daily incremental backups',
    'File-level restore',
    'Email support',
  ],
  professional: [
    'Hourly incremental backups',
    'Granular restore (file/folder/project)',
    'Compliance reports & audit logs',
    'BYO storage (Azure/AWS/S3)',
    '24×7 priority support',
  ],
  enterprise: [
    'All Professional features',
    'Custom backup schedules',
    'Dedicated support team',
    'SLA guarantees',
    'Custom integrations',
    'On-premises deployment option',
  ],
};

// Which plan gets the highlighted "popular" treatment is a marketing
// choice, not something the plans API expresses.
const POPULAR_PLAN_ID = 'professional';

function formatRate(plan: SiincPlan): string {
  if (plan.ratePerGb === null) {
    return 'Custom pricing';
  }

  return `From $${Number(plan.ratePerGb).toFixed(2)}/GB/mo`;
}

export default function Pricing({
  headerTag = 'h2',
  plans,
}: {
  headerTag?: 'h1' | 'h2';
  plans: SiincPlan[];
}) {
  return (
    <section className="py-16 md:py-28 lg:py-32">
      <div className="container">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          {headerTag === 'h1' ? (
            <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Flexible pricing plans
            </h1>
          ) : (
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Flexible pricing plans
            </h2>
          )}
          <p className="text-muted-foreground text-lg text-balance">
            Choose the plan that best fits your needs. Contact us for detailed
            pricing information tailored to your requirements.
          </p>
        </div>

        <div className="mt-8 grid gap-8 sm:grid-cols-2 md:mt-12 lg:mt-20 lg:grid-cols-3">
          {plans.map((plan) => {
            const popular = plan.id === POPULAR_PLAN_ID;

            return (
              <div
                key={plan.id}
                className={cn(
                  popular &&
                    'from-mint/70 to-sand-100 scale-[1.075] rounded-3xl bg-linear-to-b p-3',
                )}
              >
                <Card
                  className={cn(
                    'h-full border-none bg-zinc-100 dark:bg-zinc-900',
                    popular &&
                      'bg-background ring-accent shadow-accent/20 relative shadow-lg ring-2',
                  )}
                >
                  <CardHeader>
                    <h3 className="text-2xl font-semibold">{plan.name}</h3>
                    <p className="text-muted-foreground text-sm">
                      {formatRate(plan)}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col space-y-6">
                    <Button
                      asChild
                      variant={popular ? 'default' : 'outline'}
                      size="lg"
                      className={popular ? 'bg-accent hover:bg-accent/90' : ''}
                    >
                      <Link href={`/signup?plan=${plan.id}`}>Get started</Link>
                    </Button>

                    <div className="space-y-4">
                      {(PLAN_FEATURES[plan.id] ?? []).map((feature) => (
                        <div key={feature} className="flex items-center gap-3">
                          <Check className="size-4 shrink-0" />
                          <span className="text-muted-foreground text-sm">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
