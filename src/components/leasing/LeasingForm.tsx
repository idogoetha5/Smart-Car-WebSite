'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import TurnstileWidget from '@/components/ui/Turnstile';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { leasingSchema, type LeasingInput } from '@/lib/validations';
import type { Vehicle } from '@/types';

interface LeasingFormProps {
  vehicle: Vehicle;
  durationMonths: number;
  downPayment: number;
  mileagePackage: number;
  estimatedMonthly: number;
}

export default function LeasingForm({
  vehicle,
  durationMonths,
  downPayment,
  mileagePackage,
  estimatedMonthly,
}: LeasingFormProps) {
  const t = useTranslations('leasing');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<LeasingInput>({
    resolver: zodResolver(leasingSchema),
    defaultValues: {
      vehicleId: vehicle.id,
      durationMonths,
      downPayment,
      mileagePackage,
    },
  });

  const onSubmit = async (data: LeasingInput) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/leasing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, estimatedMonthly, turnstileToken }),
      });
      if (!res.ok) throw new Error();
      setToast({ message: t('success'), type: 'success' });
    } catch {
      setToast({ message: t('error' as never) ?? 'שגיאה בשליחת הבקשה, נסה שנית', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        value={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        readOnly
        className="bg-gray-50"
      />
      <Input
        label={t('customer_name' as never) ?? 'Full Name'}
        error={errors.customerName?.message}
        {...register('customerName')}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Email"
          type="email"
          error={errors.customerEmail?.message}
          {...register('customerEmail')}
        />
        <Input
          label="Phone"
          type="tel"
          error={errors.customerPhone?.message}
          {...register('customerPhone')}
        />
      </div>
      <Input
        label={t('company_name')}
        {...register('companyName')}
      />
      <div className="flex justify-center">
        <TurnstileWidget
          onSuccess={setTurnstileToken}
          onError={() => setTurnstileToken(null)}
          onExpire={() => setTurnstileToken(null)}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !turnstileToken}>
        {isSubmitting ? '...' : t('request_quote')}
      </Button>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </form>
  );
}
