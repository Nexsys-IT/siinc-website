import { Suspense } from 'react';

import SignupForm from './signup-form';

import { fetchPlans } from '@/lib/plans';

export default async function SignupPage() {
  const { plans } = await fetchPlans();
  // Only id/name cross the server/client boundary - see SignupPlanOption.
  const planOptions = plans.map((plan) => ({ id: plan.id, name: plan.name }));

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupForm plans={planOptions} />
    </Suspense>
  );
}
