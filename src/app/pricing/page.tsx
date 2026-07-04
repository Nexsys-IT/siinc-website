import React from 'react';

import type { Metadata } from 'next';

import { FAQ } from '@/components/sections/faq';
import Pricing from '@/components/sections/pricing';
import { fetchPlans } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Pricing - Flexible Plans for Your Needs',
  description:
    'Flexible pricing plans for ACC backup. Contact us for detailed pricing information tailored to your requirements. Multiple plan options available.',
  openGraph: {
    title: 'SIINC Pricing - Flexible ACC Backup Plans',
    description:
      'Flexible pricing plans for ACC backup. Contact us for detailed pricing information tailored to your requirements.',
  },
};

const page = async () => {
  const { plans } = await fetchPlans();

  return (
    <>
      <Pricing headerTag="h1" plans={plans} />
      <FAQ />
    </>
  );
};

export default page;
