'use client';

import Image from 'next/image';
import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, router, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-6 py-12">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="hidden flex-col justify-center gap-8 lg:flex">
          <div className="relative h-80 w-full overflow-hidden rounded-3xl bg-primary-600/10 shadow-xl">
            <Image
              src="/teacher-collaboration.svg"
              alt="Teacher planning lessons"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-slate-900">Smart Attender — Teacher Portal</h1>
            <p className="text-lg text-slate-600">
              Automate attendance, surface real-time insights, and guide your students with personalized tasks during
              free periods. Built for modern, learner-focused classrooms.
            </p>
            <ul className="space-y-3 text-slate-600">
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                  1
                </span>
                Launch attendance sessions tied to class, subject, and schedule with a tap.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                  2
                </span>
                Track who&apos;s present in real time and broadcast status securely to in-class displays.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                  3
                </span>
                Curate meaningful activities for learners during free periods, grounded in their paths and goals.
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-xl shadow-primary-100/50">
            <div className="mb-8 space-y-2 text-center">
              <h2 className="text-2xl font-semibold text-slate-900">Welcome back</h2>
              <p className="text-sm text-slate-500">Sign in with your institutional account to continue.</p>
            </div>
            <Suspense
              fallback={
                <div className="space-y-4">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
                  <div className="h-12 w-full animate-pulse rounded-lg bg-slate-200" />
                  <div className="h-12 w-full animate-pulse rounded-lg bg-slate-200" />
                  <div className="h-10 w-full animate-pulse rounded-lg bg-primary-200" />
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
