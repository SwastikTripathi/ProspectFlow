
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Building2, Search as SearchIcon, Trash2, XCircle, Loader2 } from 'lucide-react';
import type { Company } from '@/lib/types';
import { AddCompanyDialog } from './components/AddCompanyDialog';
import { EditCompanyDialog } from './components/EditCompanyDialog';
import { CompanyList } from './components/CompanyList';
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

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInNotes, setSearchInNotes] = useState(true);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
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
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
        setCurrentUser(user);
    });

    return () => {
      authListener.subscription?.unsubscribe();
    };
  }, []);

  const fetchCompanies = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      setCompanies([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }
      setCompanies(data || []);
    } catch (error: any) {
      toast({
        title: 'Error Fetching Companies',
        description: error.message || 'Could not retrieve companies from the database.',
        variant: 'destructive',
      });
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);


  useEffect(() => {
    if (searchParams?.get('new') === 'true') {
      setIsAddDialogOpen(true);
      if (typeof window !== "undefined") {
        window.history.replaceState({}, '', '/companies');
      }
    }
  }, [searchParams]);

  const handleAddCompany = async (companyData: Omit<Company, 'id' | 'user_id' | 'created_at'>) => {
    if (!currentUser) {
        toast({ title: 'Authentication Error', description: 'You must be logged in to add a company.', variant: 'destructive'});
        return;
    }
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([{ ...companyData, user_id: currentUser.id }])
        .select()
        .single(); // Assuming you want the inserted record back

      if (error) throw error;

      if (data) {
        // Optimistically update or refetch
        // setCompanies(prev => [data, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
        fetchCompanies(); // Refetch to ensure consistency
        toast({
          title: "Company Added",
          description: `${data.name} has been added.`,
        });
        setIsAddDialogOpen(false); // Close dialog from here
      }
    } catch (error: any) {
      toast({
        title: 'Error Adding Company',
        description: error.message || 'Could not save the company.',
        variant: 'destructive',
      });
    }
  };


  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setIsEditDialogOpen(true);
  };

  const handleUpdateCompany = async (updatedCompanyData: Company) => {
     if (!currentUser || !updatedCompanyData.id) {
        toast({ title: 'Error', description: 'Invalid operation.', variant: 'destructive'});
        return;
    }
    // Supabase expects only the fields to update, not the full object with id/user_id/created_at for the update payload
    const { id, user_id, created_at, ...updatePayload } = updatedCompanyData;

    try {
      const { data, error } = await supabase
        .from('companies')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', currentUser.id) // Ensure user owns the record
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // setCompanies(prev => prev.map(c => c.id === data.id ? data : c).sort((a, b) => a.name.localeCompare(b.name)));
        fetchCompanies(); // Refetch
         toast({
          title: "Company Updated",
          description: `${data.name} has been updated.`,
        });
        setIsEditDialogOpen(false); // Close dialog from here
        setEditingCompany(null);
      }
    } catch (error: any) {
       toast({
        title: 'Error Updating Company',
        description: error.message || 'Could not update the company.',
        variant: 'destructive',
      });
    }
  };

  const handleInitiateDeleteCompany = (company: Company) => {
    setCompanyToDelete(company);
    setIsEditDialogOpen(false);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteCompany = async () => {
    if (!companyToDelete || !currentUser) return;
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyToDelete.id)
        .eq('user_id', currentUser.id); // Ensure user owns the record

      if (error) throw error;

      // setCompanies(prev => prev.filter(c => c.id !== companyToDelete.id));
      fetchCompanies(); // Refetch
      toast({
        title: "Company Deleted",
        description: `${companyToDelete.name} has been removed.`,
      });
    } catch (error: any) {
       toast({
        title: 'Error Deleting Company',
        description: error.message || 'Could not delete the company.',
        variant: 'destructive',
      });
    } finally {
        setCompanyToDelete(null);
        setIsDeleteConfirmOpen(false);
    }
  };

  const filteredCompanies = companies.filter(company => {
    const term = searchTerm.toLowerCase();
    const nameMatch = company.name.toLowerCase().includes(term);
    const websiteMatch = company.website && company.website.toLowerCase().includes(term);
    const notesMatch = searchInNotes && company.notes && company.notes.toLowerCase().includes(term);
    return nameMatch || websiteMatch || notesMatch;
  }).sort((a, b) => a.name.localeCompare(b.name));
  
  const clearSearch = () => {
    setSearchTerm('');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight font-headline">Companies</h2>
            <p className="text-muted-foreground">Manage your company directory.</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={!currentUser || isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Company
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex items-center w-full sm:max-w-md border border-input rounded-md shadow-sm bg-background">
            <SearchIcon className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search companies..."
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
                id="searchCompanyNotes" 
                checked={searchInNotes} 
                onCheckedChange={(checked) => setSearchInNotes(checked as boolean)}
                className="h-4 w-4"
                disabled={!currentUser || isLoading}
              />
              <Label htmlFor="searchCompanyNotes" className="text-xs text-muted-foreground whitespace-nowrap">Include Notes</Label>
            </div>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : !currentUser ? (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <Building2 className="mr-2 h-5 w-5 text-primary" />
                Please Sign In
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                You need to be signed in to view and manage companies.
              </p>
            </CardContent>
          </Card>
        ) : filteredCompanies.length > 0 ? (
          <CompanyList companies={filteredCompanies} onEditCompany={handleEditCompany} />
        ) : (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <Building2 className="mr-2 h-5 w-5 text-primary" />
                {searchTerm ? 'No Companies Match Your Search' : 'Company Directory is Empty'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? 'Try adjusting your search term or add a new company.' 
                  : 'No companies have been added yet. Click "Add New Company" to start building your directory.'
                }
              </p>
            </CardContent>
          </Card>
        )}

        <AddCompanyDialog
          isOpen={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onAddCompanySubmit={handleAddCompany} // Changed prop name
        />
        {editingCompany && (
          <EditCompanyDialog
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onUpdateCompany={handleUpdateCompany}
            companyToEdit={editingCompany}
            onInitiateDelete={handleInitiateDeleteCompany}
          />
        )}
         <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the company
                <span className="font-semibold"> {companyToDelete?.name}</span>.
                Associated contacts and job openings will have their company link removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {setCompanyToDelete(null); setIsDeleteConfirmOpen(false);}}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteCompany} className="bg-destructive hover:bg-destructive/90">
                Delete Company
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
