
import type { AvailablePlan, SubscriptionTier } from '@/lib/types';

export type PlanLimits = {
  companies: number;
  contacts: number;
  jobOpenings: number;
};

const premiumLimitsConfig: PlanLimits = {
  companies: 100,
  contacts: 100,
  jobOpenings: 100,
};

export const PLAN_LIMITS: Record<'free' | 'premium', PlanLimits> = {
  'free': {
    companies: 25,
    contacts: 25,
    jobOpenings: 30,
  },
  'premium': premiumLimitsConfig,
};

// Helper function to get limits based on the simplified tier type ('free' or 'premium')
export function getLimitsForTier(tierType: 'free' | 'premium'): PlanLimits {
  return PLAN_LIMITS[tierType] || PLAN_LIMITS.free;
}


const freeFeatures: AvailablePlan['features'] = [
  { text: 'Track up to 30 job openings', included: true },
  { text: 'Manage up to 25 contacts', included: true },
  { text: 'Store up to 25 companies', included: true },
  { text: 'Basic email templates', included: true },
  { text: 'Community support', included: false },
];

const premiumFeatures: AvailablePlan['features'] = [
  { text: 'Track up to 100 job openings', included: true },
  { text: 'Manage up to 100 contacts', included: true },
  { text: 'Store up to 100 companies', included: true },
  { text: 'Advanced contact management & tagging', included: true },
  { text: 'Custom follow-up cadence', included: true },
  { text: 'Unlimited saved email templates', included: true },
  { text: 'AI-powered email suggestions (Coming Soon)', included: true },
  { text: 'Priority support', included: true },
  // { text: 'Team features (Coming Soon)', included: true }, // Keep this commented or remove if not planned soon
];

export const ALL_AVAILABLE_PLANS: AvailablePlan[] = [
  {
    id: 'free',
    tierTypeForLimits: 'free',
    name: 'Free Tier',
    priceMonthly: 0,
    durationMonths: 12 * 99, // Effectively infinite for free tier
    description: 'Core features free.',
    features: freeFeatures,
    cta: 'Switch to Free',
    isPopular: false,
  },
  {
    id: 'premium-monthly',
    tierTypeForLimits: 'premium',
    name: 'Premium - Monthly',
    priceMonthly: 100, // INR
    durationMonths: 1,
    description: 'Full access monthly.',
    features: premiumFeatures,
    cta: 'Subscribe Monthly',
    isPopular: false,
  },
  {
    id: 'premium-half-yearly',
    tierTypeForLimits: 'premium',
    name: 'Premium - 6 Months',
    priceMonthly: 100, // Base monthly price for calculation
    durationMonths: 6,
    discountPercentage: 5, // 5% discount
    description: 'Save 5% biannually.',
    features: premiumFeatures,
    cta: 'Subscribe for 6 Months',
    isPopular: true,
  },
  {
    id: 'premium-yearly',
    tierTypeForLimits: 'premium',
    name: 'Premium - 12 Months',
    priceMonthly: 100, // Base monthly price for calculation
    durationMonths: 12,
    discountPercentage: 10, // 10% discount
    description: 'Best value annually.',
    features: premiumFeatures,
    cta: 'Subscribe for 12 Months',
    isPopular: false,
  },
];

