
import type { Json } from './database.types';

export interface Company {
  id: string;
  user_id?: string;
  created_at?: string;
  name: string;
  website?: string | null;
  linkedin_url?: string | null;
  notes?: string | null;
}

export interface Contact {
  id: string;
  user_id?: string;
  created_at?: string;
  name: string;
  role?: string | null;
  email: string;
  linkedin_url?: string | null;
  phone?: string | null;
  company_id?: string | null;
  company_name_cache?: string | null;
  notes?: string | null;
  tags?: string[] | null;
}

export interface FollowUp {
  id: string;
  job_opening_id: string;
  user_id?: string;
  created_at?: string;
  follow_up_date: Date; 
  original_due_date?: Date | null; 
  email_content?: string | null;
  status: 'Pending' | 'Sent' | 'Skipped';
}

// Represents a contact as associated with a job opening, primarily for display and form handling
export interface JobOpeningAssociatedContact {
  contact_id: string; // ID from the main 'contacts' table
  name: string;
  email: string;
  // We don't store company_name_cache or role here as it's derived from the main Contact record
}


export interface JobOpening {
  id: string;
  user_id?: string;
  created_at?: string;
  company_id?: string | null;
  company_name_cache: string;
  // Removed: contact_id, contact_name_cache, contact_email_cache
  associated_contacts?: JobOpeningAssociatedContact[]; // New way to store multiple contacts
  role_title: string;
  initial_email_date: Date;
  followUps?: FollowUp[];
  status: 
    | 'Watching' 
    | 'Applied' 
    | 'Emailed' 
    | '1st Follow Up'
    | '2nd Follow Up'
    | '3rd Follow Up'
    | 'No Response' 
    | 'Replied - Positive' 
    | 'Replied - Negative' 
    | 'Interviewing' 
    | 'Offer' 
    | 'Rejected' 
    | 'Closed';
  tags?: string[] | null;
  job_description_url?: string | null;
  notes?: string | null;
}

export type Tag = {
  id: string;
  name: string;
  color?: string;
};

export type SubscriptionTier = 'free' | 'basic' | 'premium';
export type UsagePreference = 'job_hunt' | 'sales' | 'networking' | 'other';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending_payment' | 'trialing' | 'payment_failed';

export interface UserSubscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  plan_start_date: Date | null;
  plan_expiry_date: Date | null;
  status: SubscriptionStatus;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_subscription_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface AvailablePlan {
  id: SubscriptionTier;
  name: string;
  priceMonthly: number;
  priceAnnual?: number;
  description: string;
  features: PlanFeature[];
  cta: string;
  isCurrent?: boolean;
  isPopular?: boolean;
  disabled?: boolean;
}

export interface FollowUpTemplateContent {
  subject: string;
  openingLine: string;
  signature: string;
}

export interface DefaultFollowUpTemplates {
  followUp1: FollowUpTemplateContent;
  followUp2: FollowUpTemplateContent;
  followUp3: FollowUpTemplateContent;
}

export interface UserSettings {
  user_id: string;
  follow_up_cadence_days: [number, number, number] | Json;
  default_email_templates: DefaultFollowUpTemplates | Json;
  usage_preference: UsagePreference;
  created_at?: string;
  updated_at?: string;
}
    

    