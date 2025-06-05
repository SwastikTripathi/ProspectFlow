
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Search as SearchIcon, Briefcase, Trash2, XCircle, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { JobOpening, Company, Contact, FollowUp, UserSettings, DefaultFollowUpTemplates, JobOpeningAssociatedContact, ContactFormEntry } from '@/lib/types';
import { AddJobOpeningDialog, type AddJobOpeningFormValues, DEFAULT_FOLLOW_UP_CADENCE_DAYS } from './components/AddJobOpeningDialog';
import { EditJobOpeningDialog, type EditJobOpeningFormValues } from './components/EditJobOpeningDialog';
import { JobOpeningList } from './components/JobOpeningList';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import type { TablesInsert, TablesUpdate } from '@/lib/database.types';
import { isToday, isValid, startOfDay, add, isBefore, format } from 'date-fns';
import { Separator } from '@/components/ui/separator';


type SortOptionValue = 'nextFollowUpDate_asc' | 'initialEmailDate_desc' | 'initialEmailDate_asc';

const SORT_OPTIONS: { value: SortOptionValue; label: string }[] = [
  { value: 'nextFollowUpDate_asc', label: 'Next Follow-up Date (Earliest First)' },
  { value: 'initialEmailDate_desc', label: 'Initial Email Date (Newest First)' },
  { value: 'initialEmailDate_asc', label: 'Initial Email Date (Oldest First)' },
];

const emailingCycleStatuses: JobOpening['status'][] = ['Emailed', '1st Follow Up', '2nd Follow Up', '3rd Follow Up'];

async function determineNewJobOpeningStatus(
  jobOpeningId: string,
  currentJobOpeningStatus: JobOpening['status'],
  userId: string
): Promise<JobOpening['status'] | null> {

  if (!emailingCycleStatuses.includes(currentJobOpeningStatus)) {
    return null;
  }

  const { data: followUps, error: followUpsError } = await supabase
    .from('follow_ups')
    .select('status, created_at')
    .eq('job_opening_id', jobOpeningId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (followUpsError) {
    console.error('Error fetching follow-ups for status determination:', followUpsError);
    return null;
  }

  if (!followUps || followUps.length === 0) {
    return 'Emailed';
  }

  const sentFollowUpsCount = followUps.filter(fu => fu.status === 'Sent').length;

  if (sentFollowUpsCount === 0) {
    return 'Emailed';
  } else if (sentFollowUpsCount === 1) {
    return '1st Follow Up';
  } else if (sentFollowUpsCount === 2) {
    return '2nd Follow Up';
  } else if (sentFollowUpsCount >= 3) {
    return '3rd Follow Up';
  }
  return currentJobOpeningStatus; 
}


export default function JobOpeningsPage() {
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInNotes, setSearchInNotes] = useState(true);
  const [sortOption, setSortOption] = useState<SortOptionValue>('nextFollowUpDate_asc');

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOpening, setEditingOpening] = useState<JobOpening | null>(null);
  const [openingToDelete, setOpeningToDelete] = useState<JobOpening | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setCurrentUser(session?.user ?? null);
        if (!session?.user) {
            setJobOpenings([]);
            setCompanies([]);
            setContacts([]);
            setUserSettings(null);
            setIsLoading(false);
        }
      }
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
        setCurrentUser(user);
    });
    return () => {authListener.subscription.unsubscribe()};
  }, []);

  const fetchPageData = useCallback(async () => {
    if (!currentUser) {
      setJobOpenings([]);
      setCompanies([]);
      setContacts([]);
      setUserSettings(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [
        jobOpeningsResponse,
        companiesResponse,
        contactsResponse,
        allFollowUpsResponse, // Fetching all follow-ups
        userSettingsResponse,
        jobOpeningContactsResponse,
      ] = await Promise.all([
        supabase.from('job_openings').select('*').eq('user_id', currentUser.id),
        supabase.from('companies').select('*').eq('user_id', currentUser.id).order('name', { ascending: true }),
        supabase.from('contacts').select('*').eq('user_id', currentUser.id).order('name', { ascending: true }),
        supabase.from('follow_ups').select('id, job_opening_id, follow_up_date, original_due_date, email_subject, email_body, status, created_at').eq('user_id', currentUser.id).order('created_at', { ascending: true }),
        supabase.from('user_settings').select('*').eq('user_id', currentUser.id).single(),
        supabase.from('job_opening_contacts').select('*').eq('user_id', currentUser.id),
      ]);

      if (jobOpeningsResponse.error) throw jobOpeningsResponse.error;
      if (companiesResponse.error) throw companiesResponse.error;
      if (contactsResponse.error) throw contactsResponse.error;
      if (allFollowUpsResponse.error) throw allFollowUpsResponse.error;
      if (userSettingsResponse.error && userSettingsResponse.error.code !== 'PGRST116') throw userSettingsResponse.error;
      if (jobOpeningContactsResponse.error) throw jobOpeningContactsResponse.error;

      const allDbFollowUps = allFollowUpsResponse.data || [];
      const allDbContacts = contactsResponse.data || [];
      const allJobOpeningContactLinks = jobOpeningContactsResponse.data || [];
      setUserSettings(userSettingsResponse.data as UserSettings | null);

      const openingsWithDetails = (jobOpeningsResponse.data || []).map(jo => {
        const normalizedInitialEmailDate = startOfDay(new Date(jo.initial_email_date));

        const followUpsForThisOpening = allDbFollowUps
          .filter(fuDb => fuDb.job_opening_id === jo.id)
          .map(fuDb => ({
            ...fuDb,
            id: fuDb.id,
            follow_up_date: startOfDay(new Date(fuDb.follow_up_date)),
            original_due_date: fuDb.original_due_date ? startOfDay(new Date(fuDb.original_due_date)) : null,
            email_subject: fuDb.email_subject, // Keep
            email_body: fuDb.email_body,       // Keep
          } as FollowUp))
          .sort((a,b) => (a.original_due_date || a.created_at!).getTime() - (b.original_due_date || b.created_at!).getTime());


        const associatedContacts: JobOpeningAssociatedContact[] = allJobOpeningContactLinks
          .filter(link => link.job_opening_id === jo.id)
          .map(link => {
            const contactDetail = allDbContacts.find(c => c.id === link.contact_id);
            return {
              contact_id: link.contact_id,
              name: contactDetail?.name || 'Unknown Contact',
              email: contactDetail?.email || 'unknown@example.com',
            };
          });

        return {
          ...jo,
          initial_email_date: normalizedInitialEmailDate,
          followUps: followUpsForThisOpening,
          associated_contacts: associatedContacts,
        };
      });

      setJobOpenings(openingsWithDetails as JobOpening[]);
      setCompanies(companiesResponse.data || []);
      setContacts(allDbContacts);

    } catch (error: any) {
      toast({ title: 'Error Fetching Data', description: error.message, variant: 'destructive' });
      setJobOpenings([]);
      setCompanies([]);
      setContacts([]);
      setUserSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (currentUser) {
        fetchPageData();
    } else {
        setIsLoading(false);
    }
  }, [currentUser, fetchPageData]);

  useEffect(() => {
    if (searchParams?.get('new') === 'true' && currentUser) {
      setIsAddDialogOpen(true);
      if (typeof window !== "undefined") {
        window.history.replaceState({}, '', '/job-openings');
      }
    }
  }, [searchParams, currentUser]);

  const handleAddNewCompanyToListSupabase = async (companyName: string): Promise<Company | null> => {
    if (!currentUser) {
      toast({ title: 'Authentication Error', description: 'You must be logged in.', variant: 'destructive' });
      return null;
    }
    const trimmedName = companyName.trim();
    if (!trimmedName) {
        toast({ title: 'Validation Error', description: 'Company name cannot be empty.', variant: 'destructive'});
        return null;
    }
    const existingCompany = companies.find(c => c.name.toLowerCase() === trimmedName.toLowerCase() && c.user_id === currentUser.id);
    if (existingCompany) {
        toast({ title: 'Company Exists', description: `${existingCompany.name} already exists. Selecting it.`, variant: 'default' });
        return existingCompany;
    }

    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([{ name: trimmedName, user_id: currentUser.id }])
        .select()
        .single();
      if (error) throw error;
      if (data) {
        toast({ title: "Company Added", description: `${data.name} added to directory.` });
        await fetchPageData();
        return data as Company;
      }
      return null;
    } catch (error: any) {
      toast({ title: 'Error Adding Company', description: error.message, variant: 'destructive' });
      return null;
    }
  };

  const handleAddNewContactToListSupabase = async (contactName: string, contactEmail?: string, companyId?: string, companyNameCache?: string): Promise<Contact | null> => {
    if (!currentUser) {
      toast({ title: 'Authentication Error', description: 'You must be logged in.', variant: 'destructive' });
      return null;
    }
    const trimmedName = contactName.trim();
    const trimmedEmail = contactEmail?.trim();

    if (!trimmedName || !trimmedEmail) {
        toast({ title: 'Validation Error', description: 'Contact name and email are required.', variant: 'destructive'});
        return null;
    }

    const existingContact = contacts.find(c => c.email.toLowerCase() === trimmedEmail.toLowerCase() && c.user_id === currentUser.id);
    if(existingContact) {
        toast({ title: 'Contact Exists', description: `${existingContact.name} with this email already exists. Selecting it.`, variant: 'default' });
        return existingContact;
    }

    try {
      const contactToInsert: TablesInsert<'contacts'> = {
        name: trimmedName,
        email: trimmedEmail,
        user_id: currentUser.id,
        company_id: companyId || null,
        company_name_cache: companyNameCache || null,
        tags: [],
      };
      const { data, error } = await supabase
        .from('contacts')
        .insert([contactToInsert])
        .select()
        .single();
      if (error) throw error;
      if (data) {
        toast({ title: "Contact Added", description: `${data.name} added to directory.` });
        await fetchPageData();
        return data as Contact;
      }
      return null;
    } catch (error: any) {
      console.error("Error adding contact to Supabase:", error);
      toast({ title: 'Error Adding Contact', description: error.message, variant: 'destructive' });
      return null;
    }
  };

  const handleAddJobOpening = async (values: AddJobOpeningFormValues) => {
    if (!currentUser) {
      toast({ title: 'Authentication Error', description: 'You must be logged in.', variant: 'destructive' });
      return;
    }

    let companyIdToLink: string | null = values.company_id || null;
    let resolvedCompanyNameCache: string = values.companyName;

    if (!companyIdToLink && values.companyName) {
      const company = await handleAddNewCompanyToListSupabase(values.companyName);
      if (company?.id) {
        companyIdToLink = company.id;
        resolvedCompanyNameCache = company.name;
      } else {
        toast({ title: 'Company Issue', description: `Could not resolve company: ${values.companyName}. Job opening not saved.`, variant: 'destructive' });
        return;
      }
    } else if (companyIdToLink) {
        const c = companies.find(comp => comp.id === companyIdToLink);
        if(c) resolvedCompanyNameCache = c.name;
    }

    const normalizedInitialEmailDateForDb = startOfDay(values.initialEmailDate).toISOString();

    const jobOpeningToInsert: TablesInsert<'job_openings'> = {
      user_id: currentUser.id,
      company_id: companyIdToLink,
      company_name_cache: resolvedCompanyNameCache,
      role_title: values.roleTitle,
      initial_email_date: normalizedInitialEmailDateForDb,
      status: 'Emailed',
      job_description_url: values.jobDescriptionUrl || null,
      notes: values.notes || null,
      tags: [],
    };

    try {
      const { data: newJobOpeningData, error: jobError } = await supabase
        .from('job_openings')
        .insert([jobOpeningToInsert])
        .select()
        .single();

      if (jobError) throw jobError;

      if (newJobOpeningData) {
        for (const formContact of values.contacts) {
          let resolvedContactId: string | null = formContact.contact_id || null;
          if (!resolvedContactId && formContact.contactName && formContact.contactEmail) {
            const newContact = await handleAddNewContactToListSupabase(
              formContact.contactName,
              formContact.contactEmail,
              companyIdToLink || undefined,
              resolvedCompanyNameCache || undefined
            );
            if (newContact?.id) {
              resolvedContactId = newContact.id;
            } else {
              console.warn(`Could not resolve or create contact: ${formContact.contactName}. Skipping link for this contact.`);
              continue;
            }
          }

          if (resolvedContactId) {
            const { error: linkError } = await supabase
              .from('job_opening_contacts')
              .insert({
                job_opening_id: newJobOpeningData.id,
                contact_id: resolvedContactId,
                user_id: currentUser.id,
              });
            if (linkError) {
              console.error(`Error linking contact ${resolvedContactId} to job opening ${newJobOpeningData.id}:`, linkError);
              toast({ title: 'Contact Link Error', description: `Could not link contact ${formContact.contactName}. Error: ${JSON.stringify(linkError)}`, variant: 'destructive'});
            }
          }
        }

        const followUpDetails = [
          values.followUp1,
          values.followUp2,
          values.followUp3,
        ];

        const initialDateForCadenceCalc = startOfDay(new Date(values.initialEmailDate));
        const currentCadence = (userSettings?.follow_up_cadence_days as [number, number, number]) || DEFAULT_FOLLOW_UP_CADENCE_DAYS;

        const followUpsToInsert: TablesInsert<'follow_ups'>[] = currentCadence
          .map((days, index) => ({
            job_opening_id: newJobOpeningData.id,
            user_id: currentUser.id,
            follow_up_date: startOfDay(add(initialDateForCadenceCalc, {days})).toISOString(),
            original_due_date: startOfDay(add(initialDateForCadenceCalc, {days})).toISOString(),
            email_subject: followUpDetails[index]?.subject || null,
            email_body: followUpDetails[index]?.body || null,
            status: 'Pending' as FollowUp['status'],
          }));


        if (followUpsToInsert.length > 0) {
          const { error: followUpError } = await supabase.from('follow_ups').insert(followUpsToInsert);
          if (followUpError) {
            console.error('Error saving follow-ups:', followUpError);
            toast({
              title: 'Follow-up Save Error',
              description: `Job opening saved, but follow-ups had an issue: ${followUpError.message}`,
              variant: 'destructive',
            });
          }
        }
        toast({
          title: "Job Opening Added",
          description: `${newJobOpeningData.role_title} at ${newJobOpeningData.company_name_cache} has been added.`,
        });
        await fetchPageData();
        setIsAddDialogOpen(false);
      } else {
         toast({ title: 'Save Error', description: 'Failed to get new job opening data after insert.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({
        title: 'Error Adding Job Opening',
        description: error.message || 'Could not save the job opening. Check console for details.',
        variant: 'destructive',
      });
    }
  };

  const handleEditOpening = (opening: JobOpening) => {
    setEditingOpening(opening);
    setIsEditDialogOpen(true);
  };

  const handleUpdateJobOpening = async (formValues: EditJobOpeningFormValues, openingId: string) => {
     if (!currentUser || !openingId) {
      toast({ title: 'Error', description: 'Invalid operation.', variant: 'destructive'});
      return;
    }

    let companyIdToLink: string | null = formValues.company_id || null;
    let resolvedCompanyNameCache: string = formValues.companyName;

    if (!companyIdToLink && formValues.companyName) {
      const company = await handleAddNewCompanyToListSupabase(formValues.companyName);
      if (company?.id) {
        companyIdToLink = company.id;
        resolvedCompanyNameCache = company.name;
      } else {
        toast({ title: 'Company Issue', description: `Could not resolve company: ${formValues.companyName}. Update failed.`, variant: 'destructive' });
        return;
      }
    } else if (companyIdToLink) {
        const c = companies.find(comp => comp.id === companyIdToLink);
        if(c) resolvedCompanyNameCache = c.name;
    }

    const normalizedInitialEmailDateForDb = startOfDay(new Date(formValues.initialEmailDate)).toISOString();

    const jobOpeningToUpdate: TablesUpdate<'job_openings'> = {
      company_id: companyIdToLink,
      company_name_cache: resolvedCompanyNameCache,
      role_title: formValues.roleTitle,
      initial_email_date: normalizedInitialEmailDateForDb,
      status: formValues.status,
      job_description_url: formValues.jobDescriptionUrl || null,
      notes: formValues.notes || null,
    };

    try {
      const { data: updatedJobOpening, error: jobError } = await supabase
        .from('job_openings')
        .update(jobOpeningToUpdate)
        .eq('id', openingId)
        .eq('user_id', currentUser.id)
        .select()
        .single();

      if (jobError) throw jobError;

      if (updatedJobOpening) {
        const { error: deleteLinksError } = await supabase
          .from('job_opening_contacts')
          .delete()
          .eq('job_opening_id', openingId)
          .eq('user_id', currentUser.id);

        if (deleteLinksError) {
          console.error(`Error deleting old contact links for job opening ${openingId}:`, deleteLinksError);
          toast({ title: 'Contact Link Error', description: `Could not update contact associations (delete step). Error: ${JSON.stringify(deleteLinksError)}`, variant: 'destructive'});
          return;
        }

        for (const formContact of formValues.contacts) {
          let resolvedContactId: string | null = formContact.contact_id || null;
          if (!resolvedContactId && formContact.contactName && formContact.contactEmail) {
             const newContact = await handleAddNewContactToListSupabase(
              formContact.contactName,
              formContact.contactEmail,
              companyIdToLink || undefined,
              resolvedCompanyNameCache || undefined
            );
            if (newContact?.id) {
              resolvedContactId = newContact.id;
            } else {
              console.warn(`Could not resolve or create contact during update: ${formContact.contactName}. Skipping link.`);
              continue;
            }
          }
          if (resolvedContactId) {
            const { error: linkError } = await supabase
              .from('job_opening_contacts')
              .insert({
                job_opening_id: openingId,
                contact_id: resolvedContactId,
                user_id: currentUser.id,
              });
            if (linkError) {
              console.error(`Error re-linking contact ${resolvedContactId} to job opening ${openingId}:`, linkError);
              toast({ title: 'Contact Link Error', description: `Could not link contact ${formContact.contactName} during update. Error: ${JSON.stringify(linkError)}`, variant: 'destructive'});
            }
          }
        }

        const { error: deleteFollowUpsError } = await supabase
          .from('follow_ups')
          .delete()
          .eq('job_opening_id', openingId)
          .eq('user_id', currentUser.id);

        if (deleteFollowUpsError) throw deleteFollowUpsError;

        const followUpDetails = [
          formValues.followUp1,
          formValues.followUp2,
          formValues.followUp3,
        ];
        const initialDateForCadenceCalc = startOfDay(new Date(formValues.initialEmailDate));
        const currentCadence = (userSettings?.follow_up_cadence_days as [number, number, number]) || DEFAULT_FOLLOW_UP_CADENCE_DAYS;

        const followUpsToInsert: TablesInsert<'follow_ups'>[] = currentCadence
          .map((days, index) => ({
              job_opening_id: openingId,
              user_id: currentUser.id,
              follow_up_date: startOfDay(add(initialDateForCadenceCalc, {days})).toISOString(),
              original_due_date: startOfDay(add(initialDateForCadenceCalc, {days})).toISOString(),
              email_subject: followUpDetails[index]?.subject || null,
              email_body: followUpDetails[index]?.body || null,
              status: 'Pending' as FollowUp['status'],
            }));

        if (followUpsToInsert.length > 0) {
          const { error: followUpError } = await supabase.from('follow_ups').insert(followUpsToInsert);
          if (followUpError) {
             toast({ title: 'Follow-up Update Error', description: followUpError.message, variant: 'destructive'});
          }
        }
        toast({ title: "Job Opening Updated", description: `${updatedJobOpening.role_title} has been updated.`});
        await fetchPageData();
        setIsEditDialogOpen(false);
        setEditingOpening(null);
      }
    } catch (error: any) {
      toast({ title: 'Error Updating Job Opening', description: error.message, variant: 'destructive'});
    }
  };

  const handleLogFollowUp = async (followUpId: string, jobOpeningId: string) => {
    if (!currentUser || !followUpId || !jobOpeningId) {
        toast({title: 'Error', description: 'Invalid follow-up log attempt.', variant: 'destructive'});
        return;
    }
    try {
        const { data: loggedFollowUp, error: logError } = await supabase
            .from('follow_ups')
            .update({
                status: 'Sent',
                follow_up_date: startOfDay(new Date()).toISOString()
            })
            .eq('id', followUpId)
            .eq('job_opening_id', jobOpeningId)
            .eq('user_id', currentUser.id)
            .select()
            .single();

        if (logError) throw logError;

        if (loggedFollowUp) {
            toast({title: 'Follow-up Logged!', description: 'Status updated to Sent.'});

            const { data: jobOpeningData, error: fetchOpeningError } = await supabase
              .from('job_openings')
              .select('status')
              .eq('id', jobOpeningId)
              .eq('user_id', currentUser.id)
              .single();

            if (fetchOpeningError || !jobOpeningData) {
              console.error('Error fetching job opening to update status:', fetchOpeningError);
            } else {
              const newCalculatedStatus = await determineNewJobOpeningStatus(jobOpeningId, jobOpeningData.status as JobOpening['status'], currentUser.id);
              if (newCalculatedStatus && newCalculatedStatus !== jobOpeningData.status) {
                const { error: updateStatusError } = await supabase
                  .from('job_openings')
                  .update({ status: newCalculatedStatus })
                  .eq('id', jobOpeningId)
                  .eq('user_id', currentUser.id);
                if (updateStatusError) {
                  console.error('Error updating job opening status after logging follow-up:', updateStatusError);
                  toast({ title: 'Status Update Error', description: 'Follow-up logged, but status update failed.', variant: 'destructive'});
                }
              }
            }
            await fetchPageData();
        }
    } catch (error: any) {
        toast({title: 'Error Logging Follow-up', description: error.message, variant: 'destructive'});
        console.error("Error logging follow-up:", error);
    }
  };

 const handleUnlogFollowUp = useCallback(async (followUpIdToUnlog: string, jobOpeningId: string) => {
    if (!currentUser) {
      toast({ title: 'Authentication Error', description: 'Cannot unlog follow-up.', variant: 'destructive' });
      return;
    }
    console.log(`[Unlog Debug ${jobOpeningId}] handleUnlogFollowUp Initiated. FollowUpID: ${followUpIdToUnlog}`);

    try {
      const { data: followUpToUnlog, error: fetchFollowUpError } = await supabase
        .from('follow_ups')
        .select('original_due_date')
        .eq('id', followUpIdToUnlog)
        .eq('user_id', currentUser.id)
        .single();

      if (fetchFollowUpError || !followUpToUnlog) {
        toast({ title: 'Error Unlogging', description: 'Could not fetch follow-up details to unlog.', variant: 'destructive' });
        console.error(`[Unlog Debug ${jobOpeningId}] Unlog Error: Could not fetch follow-up to unlog. ID: ${followUpIdToUnlog}`, fetchFollowUpError);
        return;
      }

      if (!followUpToUnlog.original_due_date) {
        toast({ title: 'Error Unlogging', description: 'Original due date not found for this follow-up. Cannot revert.', variant: 'destructive' });
        console.error(`[Unlog Debug ${jobOpeningId}] Unlog Error: Original due date is missing for follow-up ID: ${followUpIdToUnlog}`);
        return;
      }

      const revertedDueDate = startOfDay(new Date(followUpToUnlog.original_due_date));
      if (!isValid(revertedDueDate)) {
          toast({ title: 'Error Unlogging', description: 'Invalid original due date stored. Cannot revert.', variant: 'destructive'});
          console.error(`[Unlog Debug ${jobOpeningId}] Unlog Error: Stored original_due_date is invalid for follow-up ID: ${followUpIdToUnlog}`, followUpToUnlog.original_due_date);
          return;
      }
      console.log(`[Unlog Debug ${jobOpeningId}] Calculated RevertedDueDate: ${revertedDueDate.toISOString()}`);

      const { error: updateError } = await supabase
        .from('follow_ups')
        .update({
            status: 'Pending',
            follow_up_date: revertedDueDate.toISOString()
        })
        .eq('id', followUpIdToUnlog)
        .eq('user_id', currentUser.id);

      if (updateError) {
        console.error(`[Unlog Debug ${jobOpeningId}] Unlog Error: Failed to update follow-up status/date.`, updateError);
        throw updateError;
      }
      toast({ title: 'Follow-up Unlogged', description: 'The follow-up has been reverted to pending.' });

      const { data: jobOpeningData, error: fetchJobOpeningErrorPage } = await supabase
        .from('job_openings')
        .select('status')
        .eq('id', jobOpeningId)
        .eq('user_id', currentUser.id)
        .single();

      if (fetchJobOpeningErrorPage || !jobOpeningData) {
         console.error(`[Unlog Debug ${jobOpeningId}] Error fetching job opening to update status post-unlog:`, fetchJobOpeningErrorPage);
      } else {
        const newCalculatedStatus = await determineNewJobOpeningStatus(jobOpeningId, jobOpeningData.status as JobOpening['status'], currentUser.id);
        console.log(`[Unlog Debug ${jobOpeningId}] NewCalculatedStatus for Job Opening: ${newCalculatedStatus}`);
        if (newCalculatedStatus && newCalculatedStatus !== jobOpeningData.status) {
          const { error: updateStatusError } = await supabase
            .from('job_openings')
            .update({ status: newCalculatedStatus })
            .eq('id', jobOpeningId)
            .eq('user_id', currentUser.id);
          if (updateStatusError) {
            console.error(`[Unlog Debug ${jobOpeningId}] Error updating job opening status after unlogging follow-up:`, updateStatusError);
            toast({ title: 'Status Update Error', description: 'Follow-up unlogged, but job opening status update failed.', variant: 'destructive'});
          }
        }
      }
      await fetchPageData();
    } catch (error: any) {
      toast({ title: 'Error Unlogging Follow-up', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
      console.error(`[Unlog Debug ${jobOpeningId}] Full error object in catch block:`, error);
    }
  }, [currentUser, toast, fetchPageData, userSettings]);


  const handleInitiateDeleteOpening = (opening: JobOpening) => {
    setOpeningToDelete(opening);
    setIsEditDialogOpen(false);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteOpening = async () => {
    if (!openingToDelete || !currentUser) return;
    try {
      const { error: contactsLinkError } = await supabase
        .from('job_opening_contacts')
        .delete()
        .eq('job_opening_id', openingToDelete.id)
        .eq('user_id', currentUser.id);

      if (contactsLinkError) {
        console.error("Error deleting job opening contact links:", contactsLinkError);
        toast({ title: 'Error Deleting Opening', description: `Could not delete contact associations: ${JSON.stringify(contactsLinkError)}`, variant: 'destructive'});
      }

      const { error: followUpsError } = await supabase
        .from('follow_ups')
        .delete()
        .eq('job_opening_id', openingToDelete.id)
        .eq('user_id', currentUser.id);

      if (followUpsError) throw followUpsError;

      const { error: jobOpeningError } = await supabase
        .from('job_openings')
        .delete()
        .eq('id', openingToDelete.id)
        .eq('user_id', currentUser.id);

      if (jobOpeningError) throw jobOpeningError;

      toast({ title: "Job Opening Deleted", description: `${openingToDelete.role_title} has been removed.`});
      await fetchPageData();
    } catch (error: any) {
      toast({ title: 'Error Deleting Opening', description: error.message, variant: 'destructive'});
    } finally {
      setOpeningToDelete(null);
      setIsDeleteConfirmOpen(false);
    }
  };

  const { actionRequiredOpenings, otherOpenings, allFilteredAndSortedOpenings } = useMemo(() => {
    let openings = [...jobOpenings];

    if (searchTerm) {
        openings = openings.filter(opening => {
        const term = searchTerm.toLowerCase();
        const companyMatch = opening.company_name_cache.toLowerCase().includes(term);
        const roleMatch = opening.role_title.toLowerCase().includes(term);
        const contactMatch = opening.associated_contacts?.some(ac =>
          ac.name.toLowerCase().includes(term) || ac.email.toLowerCase().includes(term)
        ) || false;
        const statusMatch = opening.status.toLowerCase().includes(term);
        const tagsMatch = opening.tags && (opening.tags as string[]).some(tag => tag.toLowerCase().includes(term));
        const notesMatch = searchInNotes && opening.notes && opening.notes.toLowerCase().includes(term);
        return companyMatch || roleMatch || contactMatch || statusMatch || tagsMatch || notesMatch;
        });
    }

    const getNextPendingFollowUpDate = (opening: JobOpening): Date | null => {
      if (!opening.followUps || opening.followUps.length === 0) return null;
      const pendingFollowUps = opening.followUps
        .filter(fu => fu.status === 'Pending' && isValid(fu.follow_up_date))
        .sort((fuA, fuB) => fuA.follow_up_date.getTime() - fuB.follow_up_date.getTime());
      return pendingFollowUps.length > 0 ? pendingFollowUps[0].follow_up_date : null;
    };

    switch (sortOption) {
      case 'initialEmailDate_desc':
        openings.sort((a, b) => new Date(b.initial_email_date).getTime() - new Date(a.initial_email_date).getTime());
        break;
      case 'initialEmailDate_asc':
        openings.sort((a, b) => new Date(a.initial_email_date).getTime() - new Date(b.initial_email_date).getTime());
        break;
      case 'nextFollowUpDate_asc':
        openings.sort((a, b) => {
          const nextFollowUpA = getNextPendingFollowUpDate(a);
          const nextFollowUpB = getNextPendingFollowUpDate(b);

          if (nextFollowUpA && !nextFollowUpB) return -1;
          if (!nextFollowUpA && nextFollowUpB) return 1;
          if (!nextFollowUpA && !nextFollowUpB) {
             return new Date(b.initial_email_date).getTime() - new Date(a.initial_email_date).getTime();
          }
          if (nextFollowUpA && nextFollowUpB) {
            return nextFollowUpA.getTime() - nextFollowUpB.getTime();
          }
          return 0;
        });
        break;
      default:
        openings.sort((a, b) => new Date(b.initial_email_date).getTime() - new Date(a.initial_email_date).getTime());
    }

    if (sortOption === 'nextFollowUpDate_asc') {
      const todayStart = startOfDay(new Date());
      const actionRequired: JobOpening[] = [];
      const others: JobOpening[] = [];

      openings.forEach(opening => {
        const nextFollowUpDate = getNextPendingFollowUpDate(opening);

        if (nextFollowUpDate && isValid(nextFollowUpDate)) {
          const followUpDayStart = startOfDay(nextFollowUpDate);
          if (isToday(followUpDayStart) || isBefore(followUpDayStart, todayStart)) {
            actionRequired.push(opening);
          } else {
            others.push(opening);
          }
        } else {
          others.push(opening);
        }
      });
      return { actionRequiredOpenings: actionRequired, otherOpenings: others, allFilteredAndSortedOpenings: [] };
    }

    return { actionRequiredOpenings: [], otherOpenings: [], allFilteredAndSortedOpenings: openings };
  }, [jobOpenings, searchTerm, searchInNotes, sortOption]);

  const clearSearch = () => setSearchTerm('');

  const noResultsAfterFiltering =
    (sortOption === 'nextFollowUpDate_asc' && actionRequiredOpenings.length === 0 && otherOpenings.length === 0) ||
    (sortOption !== 'nextFollowUpDate_asc' && allFilteredAndSortedOpenings.length === 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight font-headline">Job Openings</h2>
            <p className="text-muted-foreground">Manage your job applications and follow-ups.</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={!currentUser || isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Opening
          </Button>
        </div>

         <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex items-center w-full sm:max-w-md border border-input rounded-md shadow-sm bg-background">
            <SearchIcon className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search openings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-3 py-2 h-10 flex-grow border-none focus:ring-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={!currentUser || isLoading}
            />
            {searchTerm && (
              <Button variant="ghost" size="icon" className="absolute right-28 mr-1 h-7 w-7" onClick={clearSearch}>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            <div className="flex items-center space-x-2 pr-3 border-l border-input h-full pl-3">
              <Checkbox
                id="searchOpeningNotes"
                checked={searchInNotes}
                onCheckedChange={(checked) => setSearchInNotes(checked as boolean)}
                className="h-4 w-4"
                disabled={!currentUser || isLoading}
              />
              <Label htmlFor="searchOpeningNotes" className="text-xs text-muted-foreground whitespace-nowrap">Include Notes</Label>
            </div>
          </div>
          <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOptionValue)} disabled={!currentUser || isLoading}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-[240px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
        ) : !currentUser ? (
            <Card className="shadow-lg"><CardHeader><CardTitle className="font-headline flex items-center"><Briefcase className="mr-2 h-5 w-5 text-primary" />Please Sign In</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">You need to be signed in to manage job openings.</p></CardContent></Card>
        ) : noResultsAfterFiltering ? (
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="font-headline flex items-center"><Briefcase className="mr-2 h-5 w-5 text-primary" />{searchTerm ? 'No Matches' : 'No Job Openings Yet'}</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">{searchTerm ? 'Try a different search term.' : 'Click "Add New Opening" to get started.'}</p></CardContent>
          </Card>
        ) : (
          sortOption === 'nextFollowUpDate_asc' ? (
            <>
              {actionRequiredOpenings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-foreground/90 font-headline">Due Today / Overdue</h3>
                  <JobOpeningList
                    jobOpenings={actionRequiredOpenings}
                    onEditOpening={handleEditOpening}
                    onLogFollowUp={handleLogFollowUp}
                    onUnlogFollowUp={handleUnlogFollowUp}
                  />
                </div>
              )}
              {actionRequiredOpenings.length > 0 && otherOpenings.length > 0 && (
                <Separator className="my-6" />
              )}
              {otherOpenings.length > 0 && (
                 <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-foreground/90 font-headline">Upcoming Follow-ups</h3>
                  <JobOpeningList
                    jobOpenings={otherOpenings}
                    onEditOpening={handleEditOpening}
                    onLogFollowUp={handleLogFollowUp}
                    onUnlogFollowUp={handleUnlogFollowUp}
                  />
                </div>
              )}
            </>
          ) : (
            <JobOpeningList
              jobOpenings={allFilteredAndSortedOpenings}
              onEditOpening={handleEditOpening}
              onLogFollowUp={handleLogFollowUp}
              onUnlogFollowUp={handleUnlogFollowUp}
            />
          )
        )}

        <AddJobOpeningDialog
          isOpen={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onAddJobOpening={handleAddJobOpening}
          companies={companies}
          contacts={contacts}
          onAddNewCompany={handleAddNewCompanyToListSupabase}
          onAddNewContact={handleAddNewContactToListSupabase}
          defaultEmailTemplates={userSettings?.default_email_templates as DefaultFollowUpTemplates | undefined}
        />
        {editingOpening && (
          <EditJobOpeningDialog
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onUpdateJobOpening={handleUpdateJobOpening}
            openingToEdit={editingOpening}
            onInitiateDelete={handleInitiateDeleteOpening}
            companies={companies}
            contacts={contacts}
            onAddNewCompany={handleAddNewCompanyToListSupabase}
            onAddNewContact={handleAddNewContactToListSupabase}
          />
        )}
         <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the job opening:
                <span className="font-semibold"> {openingToDelete?.role_title} at {openingToDelete?.company_name_cache}</span>.
                 All associated follow-up records will also be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {setOpeningToDelete(null); setIsDeleteConfirmOpen(false);}}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteOpening} className="bg-destructive hover:bg-destructive/90">
                Delete Opening
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
