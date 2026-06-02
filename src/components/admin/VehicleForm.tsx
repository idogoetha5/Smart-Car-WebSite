'use client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { vehicleSchema, type VehicleInput } from '@/lib/validations';
import type { Vehicle } from '@/types';

interface VehicleFormProps {
  vehicle?: Vehicle;
  onSubmit: (data: VehicleInput) => Promise<void>;
  isSubmitting?: boolean;
}

export default function VehicleForm({
  vehicle,
  onSubmit,
  isSubmitting,
}: VehicleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<any>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(vehicleSchema) as any,
    defaultValues: vehicle
      ? {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          category: vehicle.category,
          transmission: vehicle.transmission,
          fuelType: vehicle.fuelType,
          seats: vehicle.seats,
          doors: vehicle.doors,
          pricePerDay: vehicle.pricePerDay,
          pricePerMonth: vehicle.pricePerMonth,
          depositAmount: vehicle.depositAmount,
          isAvailable: vehicle.isAvailable,
          isFeatured: vehicle.isFeatured,
          totalUnits: vehicle.totalUnits,
        }
      : { isAvailable: true, isFeatured: false, totalUnits: 1 },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data as VehicleInput))}
      className="space-y-4"
    >
      <div className="grid grid-cols-3 gap-4">
        <Input label="Make" error={errors.make?.message as string} {...register('make')} />
        <Input label="Model" error={errors.model?.message as string} {...register('model')} />
        <Input
          label="Year"
          type="number"
          error={errors.year?.message as string}
          {...register('year', { valueAsNumber: true })}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Category</label>
          <select
            {...register('category')}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[
              'MINI',
              'ECONOMY',
              'COMPACT',
              'SEDAN',
              'CROSSOVER',
              'SUV',
              'LUXURY',
              'VAN',
              'COMMERCIAL',
              'ELECTRIC',
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Transmission</label>
          <select
            {...register('transmission')}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="AUTOMATIC">Automatic</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Fuel Type</label>
          <select
            {...register('fuelType')}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID'].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Input
          label="Seats"
          type="number"
          error={errors.seats?.message as string}
          {...register('seats', { valueAsNumber: true })}
        />
        <Input
          label="Doors"
          type="number"
          error={errors.doors?.message as string}
          {...register('doors', { valueAsNumber: true })}
        />
        <Input
          label="Price/Day (₪)"
          type="number"
          step="0.01"
          error={errors.pricePerDay?.message as string}
          {...register('pricePerDay', { valueAsNumber: true })}
        />
        <Input
          label="Price/Month (₪)"
          type="number"
          step="0.01"
          error={errors.pricePerMonth?.message as string}
          {...register('pricePerMonth', { valueAsNumber: true })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Deposit (₪)"
          type="number"
          step="0.01"
          error={errors.depositAmount?.message as string}
          {...register('depositAmount', { valueAsNumber: true })}
        />
        <Input
          label="Total Units"
          type="number"
          {...register('totalUnits', { valueAsNumber: true })}
        />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('isAvailable')} />
          Available
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('isFeatured')} />
          Featured
        </label>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? '...' : 'Save Vehicle'}
      </Button>
    </form>
  );
}
