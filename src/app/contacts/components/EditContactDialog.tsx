
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Check, ChevronsUpDown, PlusCircle, Trash2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Contact, Company } from '@/lib/types';
import { cn } from '@/lib/utils';

// Schema matches the fields needed to update a contact
export const editContactFormSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  role: z.string().optional(),
  email: z.string().email("Must be a valid email address").min(1, "Email is required"),
  phone: z.string().optional(),
  company_id: z.string().optional(), // Stores the ID of the selected or new company
  company_name_input: z.string().optional(), // Used for typing/searching/creating new company
  linkedin_url: z.string().url("Must be a valid LinkedIn URL (e.g., https://linkedin.com/in/name)").optional().or(z.literal('')),
  notes: z.string().optional(),
});

export type EditContactFormValues = z.infer<typeof editContactFormSchema>;

interface EditContactDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onUpdateContactSubmit: (values: EditContactFormValues, contactId: string) => Promise<void>;
  contactToEdit: Contact | null;
  companies: Company[];
  onAttemptCreateCompany: (companyName: string) => Promise<Company | null>;
  onInitiateDelete: (contact: Contact) => void;
}

export function EditContactDialog({
    isOpen,
    onOpenChange,
    onUpdateContactSubmit,
    contactToEdit,
    companies,
    onAttemptCreateCompany,
    onInitiateDelete,
}: EditContactDialogProps) {
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const [companySearchInputForPopover, setCompanySearchInputForPopover] = useState('');

  const form = useForm<EditContactFormValues>({
    resolver: zodResolver(editContactFormSchema),
  });

  useEffect(() => {
    if (contactToEdit && isOpen) {
      form.reset({
        name: contactToEdit.name,
        role: contactToEdit.role || '',
        email: contactToEdit.email,
        phone: contactToEdit.phone || '',
        company_id: contactToEdit.company_id || '',
        company_name_input: contactToEdit.company_name_cache || '', // Use cache for initial display
        linkedin_url: contactToEdit.linkedin_url || '',
        notes: contactToEdit.notes || '',
      });
      setCompanySearchInputForPopover(contactToEdit.company_name_cache || '');
    }
  }, [contactToEdit, isOpen, form]);

  const onSubmit = async (values: EditContactFormValues) => {
    if (!contactToEdit) return;
    await onUpdateContactSubmit(values, contactToEdit.id);
    // Dialog closing and toast handled by parent
    if (isOpen) { // If dialog is still open (e.g. error in parent), re-evaluate reset.
      // Form will be reset by useEffect if contactToEdit or isOpen changes correctly.
      // If an error occurs and parent keeps it open, this might not be ideal.
      // Parent should close on success.
    }
  };

  const handleDeleteClick = () => {
    if (contactToEdit) {
      onInitiateDelete(contactToEdit);
      // Dialog will be closed by parent when delete confirmation opens
    }
  };
  
  const handleDialogValidClose = () => {
     if (contactToEdit) { // Reset to original values of contactToEdit if simply closed
        form.reset({
            name: contactToEdit.name,
            role: contactToEdit.role || '',
            email: contactToEdit.email,
            phone: contactToEdit.phone || '',
            company_id: contactToEdit.company_id || '',
            company_name_input: contactToEdit.company_name_cache || '',
            linkedin_url: contactToEdit.linkedin_url || '',
            notes: contactToEdit.notes || '',
        });
        setCompanySearchInputForPopover(contactToEdit.company_name_cache || '');
     }
     onOpenChange(false);
  }
  
  const handleDialogCancel = () => {
    // Reset form to reflect the state of contactToEdit when the dialog was opened
    if (contactToEdit) {
      form.reset({
        name: contactToEdit.name,
        role: contactToEdit.role || '',
        email: contactToEdit.email,
        phone: contactToEdit.phone || '',
        company_id: contactToEdit.company_id || '',
        company_name_input: contactToEdit.company_name_cache || '',
        linkedin_url: contactToEdit.linkedin_url || '',
        notes: contactToEdit.notes || '',
      });
      setCompanySearchInputForPopover(contactToEdit.company_name_cache || '');
    }
    onOpenChange(false);
  };


  if (!contactToEdit) return null;

  const filteredCompaniesForPopover = companies.filter(company =>
    company.name.toLowerCase().includes(companySearchInputForPopover.toLowerCase())
  );

  const currentCompanyNameInputValue = form.watch('company_name_input');


  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if(!open) {
            handleDialogCancel();
        } else {
            onOpenChange(open);
        }
    }}>
      <DialogContent className="sm:max-w-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit Contact Details</DialogTitle>
          <DialogDescription>
            Update the information for {contactToEdit.name}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="py-2 max-h-[70vh] overflow-y-auto px-2">
            <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 mb-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company_name_input"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Company Name (Optional)</FormLabel>
                    <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={companyPopoverOpen}
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground" // field.value here is company_name_input
                            )}
                          >
                            {field.value || "Select or type company"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput
                            placeholder="Search or create company..."
                            value={companySearchInputForPopover}
                            onValueChange={(currentSearchValue) => {
                              setCompanySearchInputForPopover(currentSearchValue);
                              field.onChange(currentSearchValue); // Update form value for company_name_input
                              form.setValue("company_id", '', {shouldValidate: false}); // Clear company_id if typing new name
                            }}
                          />
                          <CommandList>
                            {filteredCompaniesForPopover.length === 0 && companySearchInputForPopover && (
                              <CommandItem
                                onSelect={async () => {
                                  const newCompany = await onAttemptCreateCompany(companySearchInputForPopover);
                                  if (newCompany) {
                                    form.setValue("company_name_input", newCompany.name, { shouldValidate: true });
                                    form.setValue("company_id", newCompany.id, { shouldValidate: true });
                                  }
                                  setCompanyPopoverOpen(false);
                                  setCompanySearchInputForPopover('');
                                }}
                                className="text-sm cursor-pointer"
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create & select: "{companySearchInputForPopover}"
                              </CommandItem>
                            )}
                            <CommandGroup>
                              {filteredCompaniesForPopover.map((company) => (
                                <CommandItem
                                  value={company.name}
                                  key={company.id}
                                  onSelect={() => {
                                    form.setValue("company_name_input", company.name, { shouldValidate: true });
                                    form.setValue("company_id", company.id, { shouldValidate: true });
                                    setCompanyPopoverOpen(false);
                                    setCompanySearchInputForPopover(company.name); // Keep popover input synced
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                       form.getValues("company_id") === company.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {company.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            {filteredCompaniesForPopover.length > 0 && companySearchInputForPopover && !companies.find(c => c.name.toLowerCase() === companySearchInputForPopover.toLowerCase()) && (
                              <CommandItem
                                onSelect={async () => {
                                  const newCompany = await onAttemptCreateCompany(companySearchInputForPopover);
                                  if (newCompany) {
                                    form.setValue("company_name_input", newCompany.name, { shouldValidate: true });
                                    form.setValue("company_id", newCompany.id, { shouldValidate: true });
                                  }
                                  setCompanyPopoverOpen(false);
                                  setCompanySearchInputForPopover('');
                                }}
                                className="text-sm cursor-pointer"
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create & select: "{companySearchInputForPopover}"
                              </CommandItem>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="linkedin_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn Profile URL (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="justify-between pt-4">
              <Button type="button" variant="destructive" onClick={handleDeleteClick} className="mr-auto">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={handleDialogCancel}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
