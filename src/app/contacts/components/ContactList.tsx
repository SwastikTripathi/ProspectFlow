
'use client';

import type { Contact } from '@/lib/types';
import { ContactCard } from './ContactCard';

interface ContactListProps {
  contacts: Contact[];
  onEditContact: (contact: Contact) => void;
}

export function ContactList({ contacts, onEditContact }: ContactListProps) {
  // The main page now handles the empty/search result message directly
  // if (contacts.length === 0) {
  //   return (
  //     <div className="text-center py-10">
  //       <p className="text-xl text-muted-foreground font-semibold">No contacts found.</p>
  //       <p className="text-sm text-muted-foreground">This might be because none exist, or none match your current search/filters.</p>
  //     </div>
  //   );
  // }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {contacts.map((contact) => (
        <ContactCard key={contact.id} contact={contact} onEdit={onEditContact} />
      ))}
    </div>
  );
}
