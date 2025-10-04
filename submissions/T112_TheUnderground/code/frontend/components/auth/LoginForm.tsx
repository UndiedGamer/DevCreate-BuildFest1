'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';

interface LoginFormState {
  email: string;
  password: string;
}

const initialState: LoginFormState = {
  email: '',
  password: ''
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, requestPasswordReset, loading, error } = useAuth();

  const [formState, setFormState] = useState<LoginFormState>(initialState);
  const [isResetting, setIsResetting] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev: LoginFormState) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await signIn(formState.email, formState.password);
      toast.success('Signed in successfully');
      const returnTo = searchParams.get('redirectedFrom');
      router.push(returnTo ?? '/dashboard');
    } catch (err) {
      console.error(err);
      toast.error('Sign in failed. Check your email/password.');
    }
  };

  const handlePasswordReset = async () => {
    if (!formState.email) {
      toast.error('Enter your email to reset your password.');
      return;
    }

    try {
      setIsResetting(true);
      await requestPasswordReset(formState.email);
      toast.success('Password reset email sent!');
    } catch (err) {
      console.error(err);
      toast.error('Unable to send password reset email.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={formState.email}
          onChange={handleChange}
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          placeholder="teacher@school.edu"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={isResetting}
            className="text-sm font-medium text-primary-600 transition hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Forgot password?
          </button>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={formState.password}
          onChange={handleChange}
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          placeholder="••••••••"
        />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-primary-400"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
