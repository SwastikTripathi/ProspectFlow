
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Users, Search as SearchIcon, Trash2, XCircle, Loader2 } from 'lucide-react';
import type { Contact, Company } from '@/lib/types';
import { AddContactDialog, type AddContactFormValues } from './components/AddContactDialog';
import { EditContactDialog, type EditContactFormValues } from './components/EditContactDialog';
import { ContactList } from './components/ContactList';
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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInNotes, setSearchInNotes] = useState(true);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setCurrentUser(session?.user ?? null);
      }
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
        setCurrentUser(user);
    });

    return () => {
      authListener.subscription?.unsubscribe();
    };
  }, []);

  const fetchContactsAndCompanies = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      setContacts([]);
      setCompanies([]);
      return;
    }
    setIsLoading(true);
    try {
      const [contactsResponse, companiesResponse] = await Promise.all([
        supabase.from('contacts').select('*').eq('user_id', currentUser.id).order('name', { ascending: true }),
        supabase.from('companies').select('*').eq('user_id', currentUser.id).order('name', { ascending: true }),
      ]);

      if (contactsResponse.error) throw contactsResponse.error;
      setContacts(contactsResponse.data || []);

      if (companiesResponse.error) throw companiesResponse.error;
      setCompanies(companiesResponse.data || []);

    } catch (error: any) {
      toast({
        title: 'Error Fetching Data',
        description: error.message || 'Could not retrieve data from the database.',
        variant: 'destructive',
      });
      setContacts([]);
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    fetchContactsAndCompanies();
  }, [fetchContactsAndCompanies]);

  useEffect(() => {
    if (searchParams?.get('new') === 'true') {
      setIsAddDialogOpen(true);
      if (typeof window !== "undefined") {
        window.history.replaceState({}, '', '/contacts');
      }
    }
  }, [searchParams]);

  const handleAttemptCreateCompany = async (companyName: string): Promise<Company | null> => {
    if (!currentUser) {
      toast({ title: 'Authentication Error', description: 'You must be logged in.', variant: 'destructive' });
      return null;
    }
    if (!companyName.trim()) {
        toast({ title: 'Validation Error', description: 'Company name cannot be empty.', variant: 'destructive'});
        return null;
    }

    // Check if company already exists (case-insensitive)
    const existingCompany = companies.find(c => c.name.toLowerCase() === companyName.trim().toLowerCase());
    if (existingCompany) {
        toast({ title: 'Company Exists', description: `${companyName} already exists. Selecting it.`, variant: 'default' });
        return existingCompany;
    }

    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([{ name: companyName, user_id: currentUser.id }])
        .select()
        .single();
      if (error) throw error;
      if (data) {
        toast({ title: "Company Added", description: `${data.name} has been added.` });
        await fetchContactsAndCompanies(); // Re-fetch companies to update list
        return data;
      }
      return null;
    } catch (error: any) {
      toast({ title: 'Error Adding Company', description: error.message || 'Could not save company.', variant: 'destructive' });
      return null;
    }
  };

  const handleAddContactSubmit = async (values: AddContactFormValues) => {
    if (!currentUser) {
      toast({ title: 'Authentication Error', description: 'You must be logged in.', variant: 'destructive' });
      return;
    }

    let companyIdToLink: string | null = values.company_id || null;
    let companyNameCache: string | null = values.company_name_input || null;

    // If company_id is not set but company_name_input is, try to find or create company
    if (!companyIdToLink && values.company_name_input) {
        const company = await handleAttemptCreateCompany(values.company_name_input);
        if (company) {
            companyIdToLink = company.id;
            companyNameCache = company.name; // Use the potentially case-corrected name
        } else {
            // Failed to create/find company, user was already toasted.
            // Optionally, clear company_name_input or prevent contact save
            return; // Prevent contact save if company creation failed
        }
    } else if (companyIdToLink && values.company_name_input) {
      // If an ID is selected, ensure company_name_cache matches the selected company's name
      const selectedCompany = companies.find(c => c.id === companyIdToLink);
      companyNameCache = selectedCompany ? selectedCompany.name : values.company_name_input;
    }


    const contactDataToInsert = {
      user_id: currentUser.id,
      name: values.name,
      email: values.email,
      role: values.role || null,
      phone: values.phone || null,
      linkedin_url: values.linkedin_url || null,
      notes: values.notes || null,
      company_id: companyIdToLink,
      company_name_cache: companyNameCache,
      tags: [], // Default to empty array
    };

    try {
      const { data, error } = await supabase
        .from('contacts')
        .insert([contactDataToInsert])
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        toast({ title: "Contact Added", description: `${data.name} has been added.` });
        fetchContactsAndCompanies(); // Re-fetch contacts
        setIsAddDialogOpen(false);
      }
    } catch (error: any) {
      toast({ title: 'Error Adding Contact', description: error.message || 'Could not save contact.', variant: 'destructive' });
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setIsEditDialogOpen(true);
  };

  const handleUpdateContactSubmit = async (values: EditContactFormValues, contactId: string) => {
    if (!currentUser) {
      toast({ title: 'Authentication Error', description: 'You must be logged in.', variant: 'destructive' });
      return;
    }

    let companyIdToLink: string | null = values.company_id || null;
    let companyNameCache: string | null = values.company_name_input || null;

    if (!companyIdToLink && values.company_name_input) {
        const company = await handleAttemptCreateCompany(values.company_name_input);
        if (company) {
            companyIdToLink = company.id;
            companyNameCache = company.name;
        } else {
            return; 
        }
    } else if (companyIdToLink && values.company_name_input) {
        const selectedCompany = companies.find(c => c.id === companyIdToLink);
        companyNameCache = selectedCompany ? selectedCompany.name : values.company_name_input;
    } else if (!values.company_name_input) { // User cleared company name
        companyIdToLink = null;
        companyNameCache = null;
    }


    const contactDataToUpdate = {
      name: values.name,
      email: values.email,
      role: values.role || null,
      phone: values.phone || null,
      linkedin_url: values.linkedin_url || null,
      notes: values.notes || null,
      company_id: companyIdToLink,
      company_name_cache: companyNameCache,
      // tags are not editable in this form yet, so keep existing if any
    };

    try {
      const { data, error } = await supabase
        .from('contacts')
        .update(contactDataToUpdate)
        .eq('id', contactId)
        .eq('user_id', currentUser.id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        toast({ title: "Contact Updated", description: `${data.name} has been updated.` });
        fetchContactsAndCompanies(); // Re-fetch
        setIsEditDialogOpen(false);
        setEditingContact(null);
      }
    } catch (error: any) {
      toast({ title: 'Error Updating Contact', description: error.message || 'Could not update contact.', variant: 'destructive' });
    }
  };

  const handleInitiateDeleteContact = (contact: Contact) => {
    setContactToDelete(contact);
    setIsEditDialogOpen(false); // Close edit dialog if open
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteContact = async () => {
    if (!contactToDelete || !currentUser) return;
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactToDelete.id)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      toast({ title: "Contact Deleted", description: `${contactToDelete.name} has been removed.` });
      fetchContactsAndCompanies(); // Re-fetch
    } catch (error: any) {
      toast({ title: 'Error Deleting Contact', description: error.message || 'Could not delete contact.', variant: 'destructive' });
    } finally {
      setContactToDelete(null);
      setIsDeleteConfirmOpen(false);
    }
  };
  
  const filteredContacts = contacts.filter(contact => {
    const term = searchTerm.toLowerCase();
    const nameMatch = contact.name.toLowerCase().includes(term);
    const emailMatch = contact.email.toLowerCase().includes(term);
    const roleMatch = contact.role && contact.role.toLowerCase().includes(term);
    const companyMatch = contact.company_name_cache && contact.company_name_cache.toLowerCase().includes(term);
    const notesMatch = searchInNotes && contact.notes && contact.notes.toLowerCase().includes(term);
    return nameMatch || emailMatch || roleMatch || companyMatch || notesMatch;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const clearSearch = () => {
    setSearchTerm('');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight font-headline">Contacts</h2>
            <p className="text-muted-foreground">Manage your professional contacts.</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={!currentUser || isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Contact
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
           <div className="relative flex items-center w-full sm:max-w-md border border-input rounded-md shadow-sm bg-background">
            <SearchIcon className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search contacts..."
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
                id="searchContactNotes"
                checked={searchInNotes}
                onCheckedChange={(checked) => setSearchInNotes(checked as boolean)}
                className="h-4 w-4"
                disabled={!currentUser || isLoading}
              />
              <Label htmlFor="searchContactNotes" className="text-xs text-muted-foreground whitespace-nowrap">Include Notes</Label>
            </div>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : !currentUser ? (
           <Card className="shadow-lg">
            <CardHeader><CardTitle className="font-headline flex items-center"><Users className="mr-2 h-5 w-5 text-primary" />Please Sign In</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">You need to be signed in to view and manage contacts.</p></CardContent>
          </Card>
        ) : filteredContacts.length > 0 ? (
          <ContactList contacts={filteredContacts} onEditContact={handleEditContact} />
        ) : (
           <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <Users className="mr-2 h-5 w-5 text-primary" />
                {searchTerm ? 'No Contacts Match Your Search' : 'Contact Directory is Empty'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {searchTerm
                  ? 'Try adjusting your search term or add a new contact.'
                  : 'No contacts have been added yet. Click "Add New Contact" to start building your directory.'
                }
              </p>
            </CardContent>
          </Card>
        )}

        <AddContactDialog
          isOpen={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onAddContactSubmit={handleAddContactSubmit}
          companies={companies}
          onAttemptCreateCompany={handleAttemptCreateCompany}
        />
        {editingContact && (
          <EditContactDialog
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onUpdateContactSubmit={handleUpdateContactSubmit}
            contactToEdit={editingContact}
            companies={companies}
            onAttemptCreateCompany={handleAttemptCreateCompany}
            onInitiateDelete={handleInitiateDeleteContact}
          />
        )}
        <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the contact
                <span className="font-semibold"> {contactToDelete?.name}</span>.
                Associated job openings will have their contact link removed (contact name/email will be cached).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {setContactToDelete(null); setIsDeleteConfirmOpen(false);}}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteContact} className="bg-destructive hover:bg-destructive/90">
                Delete Contact
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
