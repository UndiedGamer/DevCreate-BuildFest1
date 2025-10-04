'use client';

import { LogOut } from 'lucide-react';
import { useTransition } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';

export function SignOutButton() {
  const { signOut } = useAuth();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      try {
        await signOut();
        toast.success('Signed out');
      } catch (err) {
        console.error(err);
        toast.error('Failed to sign out.');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <LogOut className="h-4 w-4" />
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
