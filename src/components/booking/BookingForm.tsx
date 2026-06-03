'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import DatePickerInput, { type DatePickerHandle } from '@/components/ui/DatePickerInput';
import { bookingSchema, type BookingInput } from '@/lib/validations';
import { calculateTotalDays } from '@/lib/utils';
import { getSeasonalPrice } from '@/lib/seasonal';
import { sendBookingEmail } from '@/lib/emailjs';
import type { Vehicle } from '@/types';
import { AvailabilityChecker } from './AvailabilityChecker';
import TurnstileWidget from '@/components/ui/Turnstile';

const BRANCHES = [
  { value: 'herzliya',  label: 'סניף הרצליה – רחוב רמת ים 122' },
  { value: 'telaviv',   label: 'סניף תל אביב – מאפו 2 פינת הירקון' },
  { value: 'jerusalem', label: 'סניף ירושלים – המלך דוד 8' },
  { value: 'airport',   label: 'נתב"ג – נמל התעופה בן גוריון' },
];

function getRentalMileageAllowance(days: number): number {
  if (days <= 7) return 250 * days;
  if (days <= 30) return 220 * days;
  return 4000 * Math.ceil(days / 30);
}

const BRANCHES_EN = [
  { value: 'herzliya',  label: 'Herzliya – 122 Ramat Yam St' },
  { value: 'telaviv',   label: 'Tel Aviv – 2 Mapu St' },
  { value: 'jerusalem', label: 'Jerusalem – 8 King David St' },
  { value: 'airport',   label: 'Ben Gurion Airport' },
];

const EXTRAS = [
  {
    id: 'insurance',
    name: 'ביטול השתתפות עצמית',
    nameEn: 'Damage Waiver',
    description: 'נסע בשקט — ללא תשלום במקרה נזק',
    descriptionEn: 'Drive worry-free — no payment in case of damage',
    price: 45,
    priceLabel: '₪45/יום',
    icon: '🛡️',
    popular: true,
  },
  {
    id: 'highway6',
    name: 'חבילת כביש 6',
    nameEn: 'Highway 6 Package',
    description: 'נסיעות ללא הגבלה בכביש 6 ובמנהרות',
    descriptionEn: 'Unlimited Highway 6 & tunnel crossings',
    price: 35,
    priceLabel: '₪35/יום',
    icon: '🛣️',
    popular: true,
  },
  {
    id: 'baby_seat',
    name: 'כיסא בטיחות לתינוק',
    nameEn: 'Baby / Child Seat',
    description: 'כיסא בטיחות מאושר לילדים',
    descriptionEn: 'Approved safety seat for children',
    price: 20,
    priceLabel: '₪20/יום',
    icon: '👶',
    popular: false,
  },
  {
    id: 'driver',
    name: 'נהג נוסף',
    nameEn: 'Additional Driver',
    description: 'הוסף נהג נוסף לחוזה',
    descriptionEn: 'Add another driver to the contract',
    price: 25,
    priceLabel: '₪25/יום',
    icon: '👤',
    popular: false,
  },
];

function IsraelAddressInput({
  value,
  onChange,
  locale = 'he',
}: {
  value: string;
  onChange: (address: string, isValid: boolean) => void;
  locale?: string;
}) {
  const isHe = locale === 'he';
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const searchAddress = async (query: string) => {
    if (query.length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=il&format=json&addressdetails=1&limit=6`,
        { headers: { 'Accept-Language': isHe ? 'he' : 'en' } }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any[] = await res.json();
      setSuggestions(data.map(item => item.display_name));
      setShowDropdown(true);
    } catch {
      setSuggestions([]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsValid(false);
    onChange(val, false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(val), 400);
  };

  const handleSelect = (address: string) => {
    setInputValue(address);
    setIsValid(true);
    setShowDropdown(false);
    setSuggestions([]);
    onChange(address, true);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder={isHe ? 'הקלד רחוב ועיר...' : 'Type street and city...'}
        autoComplete="off"
        aria-label={isHe ? 'כתובת' : 'Address'}
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        className={`w-full h-10 rounded-lg border-2 px-3 pe-9 text-sm outline-none transition-colors ${
          isValid ? 'border-green-500 bg-green-50' : 'border-[#E8743B] focus:border-[#2D5F5F]'
        }`}
      />
      <span className="absolute end-3 top-2 text-base pointer-events-none" aria-hidden="true">
        {isValid ? '✅' : '📍'}
      </span>

      {showDropdown && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto"
        >
          {suggestions.map((addr, i) => (
            <li
              key={i}
              role="option"
              aria-selected={false}
              onMouseDown={() => handleSelect(addr)}
              className="p-3 text-start text-xs hover:bg-orange-50 cursor-pointer border-b border-gray-100 last:border-0"
            >
              📍 {addr}
            </li>
          ))}
        </ul>
      )}

      {isValid && (
        <p className="text-green-600 text-xs mt-1">
          {isHe ? '✓ כתובת אומתה' : '✓ Address verified'}
        </p>
      )}
      {!isValid && inputValue.length > 2 && (
        <p className="text-gray-400 text-xs mt-1">
          {isHe ? 'בחר כתובת מהרשימה' : 'Select an address from the list'}
        </p>
      )}
      <p className="text-gray-300 text-xs mt-0.5">
        {isHe
          ? 'חיפוש כתובות: © OpenStreetMap contributors'
          : 'Address search: © OpenStreetMap contributors'}
      </p>
    </div>
  );
}

function LocationSelector({
  label,
  value,
  onChange,
  locale,
  error,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  locale: string;
  error?: string;
}) {
  const isHe = locale === 'he';
  const branches = isHe ? BRANCHES : BRANCHES_EN;
  const isCustom = value !== '' && !branches.some(b => b.value === value);
  const [showCustom, setShowCustom] = useState(isCustom);
  const [customValid, setCustomValid] = useState(isCustom);

  useEffect(() => {
    const isCust = value !== '' && !branches.some(b => b.value === value);
    setShowCustom(isCust);
    setCustomValid(isCust);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleSelect = (val: string) => {
    if (val === 'custom') {
      setShowCustom(true);
      setCustomValid(false);
      onChange('');
    } else {
      setShowCustom(false);
      onChange(val);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={showCustom ? 'custom' : value}
        onChange={(e) => handleSelect(e.target.value)}
        className={`w-full h-10 rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] ${error ? 'border-red-400' : 'border-gray-200'}`}
      >
        <option value="">{isHe ? '-- בחר מיקום --' : '-- Select location --'}</option>
        {branches.map(b => (
          <option key={b.value} value={b.value}>{b.label}</option>
        ))}
        <option value="custom">{isHe ? '📍 כתובת אחרת בישראל...' : '📍 Other address in Israel...'}</option>
      </select>

      {showCustom && (
        <IsraelAddressInput
          value={isCustom ? value : ''}
          locale={locale}
          onChange={(addr, valid) => {
            setCustomValid(valid);
            onChange(valid ? addr : '');
          }}
        />
      )}
      {showCustom && !customValid && value === '' && (
        <p className="text-xs text-amber-600">{isHe ? 'יש לבחור כתובת מהרשימה' : 'Please select an address from suggestions'}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface BookingFormProps {
  vehicle: Vehicle;
  initialPickupDate?: string;
  initialReturnDate?: string;
  initialLocation?: string;
  initialReturnLocation?: string;
}

const DRAFT_KEY = (vehicleId: string, locale: string) => `booking_draft_${vehicleId}_${locale}`;

export default function BookingForm({ vehicle, initialPickupDate = '', initialReturnDate = '', initialLocation = '', initialReturnLocation = '' }: BookingFormProps) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const router = useRouter();
  const isHe = locale === 'he';
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [pickupTime, setPickupTime] = useState('09:00');
  const [returnTime, setReturnTime] = useState('09:00');
  const returnPickerRef = useRef<DatePickerHandle>(null);
  const submittingRef = useRef(false);
  const today = new Date().toISOString().split('T')[0];
  const [draftSaved, setDraftSaved] = useState(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileFailed, setTurnstileFailed] = useState(false);

  const [additionalDriverName, setAdditionalDriverName] = useState('');
  const [additionalDriverId, setAdditionalDriverId] = useState('');

  const [couponCode, setCouponCode] = useState('');
  const [couponState, setCouponState] = useState<{
    status: 'idle' | 'loading' | 'valid' | 'invalid';
    type?: 'percent' | 'fixed';
    value?: number;
    labelHe?: string;
    labelEn?: string;
  }>({ status: 'idle' });

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponState({ status: 'loading' });
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      if (data.valid) {
        setCouponState({ status: 'valid', type: data.type, value: data.value, labelHe: data.labelHe, labelEn: data.labelEn });
      } else {
        setCouponState({ status: 'invalid' });
      }
    } catch {
      setCouponState({ status: 'invalid' });
    }
  };

  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, '0');
    const minutes = i % 2 === 0 ? '00' : '30';
    return `${hours}:${minutes}`;
  });

  const toggleExtra = (id: string) => {
    setSelectedExtras(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const savedDraft = typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY(vehicle.id, locale)) ?? 'null'); } catch { return null; } })()
    : null;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      vehicleId:        vehicle.id,
      pickupDate:       savedDraft?.pickupDate ?? initialPickupDate,
      dropoffDate:      savedDraft?.dropoffDate ?? initialReturnDate,
      pickupLocation:   savedDraft?.pickupLocation ?? initialLocation,
      dropoffLocation:  savedDraft?.dropoffLocation ?? initialReturnLocation,
      customerName:     savedDraft?.customerName ?? '',
      customerEmail:    savedDraft?.customerEmail ?? '',
      customerPhone:    savedDraft?.customerPhone ?? '',
      customerIdNumber: savedDraft?.customerIdNumber ?? '',
      notes:            savedDraft?.notes ?? '',
    },
  });

  // Restore non-form state from draft
  useEffect(() => {
    if (!savedDraft) return;
    if (savedDraft.pickupTime) setPickupTime(savedDraft.pickupTime);
    if (savedDraft.returnTime) setReturnTime(savedDraft.returnTime);
    if (savedDraft.selectedExtras) setSelectedExtras(savedDraft.selectedExtras);
    if (savedDraft.additionalDriverName) setAdditionalDriverName(savedDraft.additionalDriverName);
    if (savedDraft.additionalDriverId) setAdditionalDriverId(savedDraft.additionalDriverId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allValues = watch();

  // Auto-save draft on every change (debounced 800ms)
  useEffect(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { agreeTerms: _a, marketingConsent: _m, ...draftValues } = allValues;
        localStorage.setItem(DRAFT_KEY(vehicle.id, locale), JSON.stringify({
          ...draftValues,
          pickupTime,
          returnTime,
          selectedExtras,
          additionalDriverName,
          additionalDriverId,
          savedAt: new Date().toISOString(),
        }));
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 2000);
      } catch { /* storage full or private mode */ }
    }, 800);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allValues, pickupTime, returnTime, selectedExtras, additionalDriverName, additionalDriverId]);

  const pickupDate      = watch('pickupDate');
  const dropoffDate     = watch('dropoffDate');
  const pickupLocation  = watch('pickupLocation');
  const dropoffLocation = watch('dropoffLocation');

  const totalDays =
    pickupDate && dropoffDate
      ? calculateTotalDays(new Date(pickupDate), new Date(dropoffDate))
      : 0;

  const pricePerDay = getSeasonalPrice(vehicle, pickupDate ? new Date(pickupDate) : undefined);
  const discountPct = totalDays >= 60 ? 15 : totalDays >= 30 ? 10 : totalDays >= 14 ? 7 : 0;
  const subtotal = pricePerDay * totalDays;
  const discount = Math.round(subtotal * discountPct / 100);
  const vehicleTotal = subtotal - discount;

  const extrasTotal = selectedExtras.reduce((sum, id) => {
    const extra = EXTRAS.find(e => e.id === id);
    if (!extra) return sum;
    return sum + ((extra as { fixed?: boolean }).fixed ? extra.price : extra.price * totalDays);
  }, 0);

  const preDiscountTotal = vehicleTotal + extrasTotal;
  const couponDiscount = couponState.status === 'valid' && couponState.value
    ? couponState.type === 'percent'
      ? Math.round(preDiscountTotal * couponState.value / 100)
      : Math.min(couponState.value, preDiscountTotal)
    : 0;
  const grandTotal = preDiscountTotal - couponDiscount;

  const onSubmit = async (data: BookingInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          totalPrice: grandTotal || totalDays * pricePerDay,
          pricePerDay,
          extras: selectedExtras,
          couponCode: couponState.status === 'valid' ? couponCode : undefined,
          couponDiscount: couponDiscount || undefined,
          pickup_time: pickupTime,
          return_time: returnTime,
          additionalDriverName: selectedExtras.includes('driver') ? additionalDriverName : undefined,
          additionalDriverId: selectedExtras.includes('driver') ? additionalDriverId : undefined,
          turnstileToken,
        }),
      });

      if (res.status === 409) {
        setToast({ message: t('unavailable_message'), type: 'error' });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Booking failed');
      }

      const result = await res.json();
      const bookingId = result.data?.id ?? result.id ?? '';

      try {
        await sendBookingEmail({
          customerName:    data.customerName,
          customerEmail:   data.customerEmail,
          customerPhone:   data.customerPhone,
          vehicleName:     `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          startDate:       pickupDate,
          endDate:         dropoffDate,
          pickupLocation:  data.pickupLocation,
          returnLocation:  data.dropoffLocation,
          bookingType:     'השכרה',
          totalPrice:      grandTotal || totalDays * pricePerDay,
          bookingId,
          pickupTime,
          returnTime,
        });
      } catch {
        // EmailJS failure is non-critical — booking already saved
      }

      localStorage.removeItem(DRAFT_KEY(vehicle.id, locale));
      router.push(
        `/${locale}/booking-confirmation?id=${bookingId}&vehicle=${encodeURIComponent(vehicle.make + ' ' + vehicle.model)}&start=${pickupDate}&end=${dropoffDate}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setToast({
        message: msg.includes('not available')
          ? t('unavailable_message')
          : (isHe ? 'אירעה שגיאה, נסה שוב' : 'Something went wrong, please try again'),
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY(vehicle.id, locale));
    window.location.reload();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <input type="hidden" {...register('vehicleId')} />
      {/* Honeypot — hidden from real users, bots fill it */}
      <input type="text" name="_website" tabIndex={-1} autoComplete="off" style={{ display: 'none' }} aria-hidden="true" />

      {/* Draft indicator */}
      <div className="flex items-center justify-between text-xs text-gray-400 h-4">
        <span className={`transition-opacity duration-500 ${draftSaved ? 'opacity-100' : 'opacity-0'}`}>
          {isHe ? '✓ טיוטה נשמרה' : '✓ Draft saved'}
        </span>
        {savedDraft && (
          <button type="button" onClick={clearDraft} className="text-gray-400 hover:text-red-400 transition-colors underline">
            {isHe ? 'נקה טיוטה' : 'Clear draft'}
          </button>
        )}
      </div>
      {savedDraft?.savedAt && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          {isHe
            ? `📋 טיוטה שמורה מ-${new Date(savedDraft.savedAt).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
            : `📋 Draft from ${new Date(savedDraft.savedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
        </div>
      )}

      {(!pickupDate || !dropoffDate) ? (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 text-center animate-pulse">
          <p className="text-red-500 font-bold">
            {isHe ? '⚠️ יש לבחור תאריכים לצפייה במחיר הסופי' : '⚠️ Select dates to see final price'}
          </p>
        </div>
      ) : (
        <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 text-center">
          <p className="text-green-600 font-bold">
            {isHe ? '✓ תאריכים נבחרו - צפה במחיר למטה' : '✓ Dates selected — see price below'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Pickup date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('pickup_date')}</label>
          <div className={`h-10 rounded-lg border-2 px-3 flex items-center ${errors.pickupDate ? 'border-red-400' : 'border-gray-200'}`}>
            <DatePickerInput
              value={pickupDate}
              onChange={(date) => {
                setValue('pickupDate', date, { shouldValidate: true });
                if (dropoffDate && dropoffDate <= date) {
                  setValue('dropoffDate', '', { shouldValidate: false });
                }
                setTimeout(() => returnPickerRef.current?.openPicker(), 50);
              }}
              minDate={today}
              placeholder={isHe ? 'בחר תאריך' : 'Select date'}
              isHe={isHe}
              className="w-full"
            />
          </div>
          {errors.pickupDate && <p className="text-xs text-red-500 mt-1">{errors.pickupDate.message}</p>}
        </div>
        {/* Return date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('dropoff_date')}</label>
          <div className={`h-10 rounded-lg border-2 px-3 flex items-center ${errors.dropoffDate ? 'border-red-400' : 'border-gray-200'}`}>
            <DatePickerInput
              ref={returnPickerRef}
              value={dropoffDate}
              onChange={(date) => setValue('dropoffDate', date, { shouldValidate: true })}
              minDate={pickupDate || today}
              placeholder={isHe ? 'בחר תאריך' : 'Select date'}
              isHe={isHe}
              className="w-full"
            />
          </div>
          {errors.dropoffDate && <p className="text-xs text-red-500 mt-1">{errors.dropoffDate.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pickup-time" className="block text-sm font-medium text-gray-700 mb-1">
            {isHe ? 'שעת איסוף' : 'Pickup time'}
          </label>
          <select
            id="pickup-time"
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
          >
            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="return-time" className="block text-sm font-medium text-gray-700 mb-1">
            {isHe ? 'שעת החזרה' : 'Return time'}
          </label>
          <select
            id="return-time"
            value={returnTime}
            onChange={(e) => setReturnTime(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
          >
            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LocationSelector
          label={t('pickup_location')}
          value={pickupLocation}
          onChange={(val) => setValue('pickupLocation', val, { shouldValidate: true })}
          locale={locale}
          error={errors.pickupLocation?.message}
        />
        <LocationSelector
          label={t('dropoff_location')}
          value={dropoffLocation}
          onChange={(val) => setValue('dropoffLocation', val, { shouldValidate: true })}
          locale={locale}
          error={errors.dropoffLocation?.message}
        />
      </div>

      {pickupDate && dropoffDate && totalDays > 0 && (
        <AvailabilityChecker
          vehicleId={vehicle.id}
          pickupDate={pickupDate}
          dropoffDate={dropoffDate}
        />
      )}

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {isHe ? 'פרטי לקוח' : 'Customer Details'}
        </h3>
        <div className="space-y-3">
          <Input
            label={t('customer_name')}
            placeholder="John Doe"
            error={errors.customerName?.message}
            {...register('customerName')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t('customer_email')}
              type="email"
              placeholder="john@example.com"
              error={errors.customerEmail?.message}
              {...register('customerEmail')}
            />
            <Input
              label={t('customer_phone')}
              type="tel"
              placeholder={isHe ? '+972-50-0000000' : '+1-555-0000'}
              error={errors.customerPhone?.message}
              {...register('customerPhone')}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label htmlFor="customer-id-number" className="text-sm font-medium text-gray-700">{t('id_number')}</label>
              <span className="text-xs text-gray-400" title={isHe ? 'לתיירים — מספר דרכון' : 'Tourists — passport number'}>
                {isHe ? '(לתיירים: מספר דרכון)' : '(Tourists: passport number)'}
              </span>
            </div>
            <input
              id="customer-id-number"
              type="text"
              inputMode="numeric"
              placeholder={isHe ? 'עד 9 ספרות' : 'Up to 9 digits'}
              maxLength={9}
              className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] ${errors.customerIdNumber ? 'border-red-400' : 'border-gray-200'}`}
              {...register('customerIdNumber')}
            />
            {errors.customerIdNumber && <p className="text-xs text-red-500 mt-1">{errors.customerIdNumber.message}</p>}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('notes')}
        </label>
        <textarea
          {...register('notes')}
          rows={3}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Extras upsell */}
      {totalDays > 0 && (
        <div className="border-2 border-[#2D5F5F] rounded-2xl p-5 text-start">
          <h3 className="font-bold text-lg mb-3">🎁 {isHe ? 'שדרג את הנסיעה שלך' : 'Upgrade your ride'}</h3>
          <div className="grid grid-cols-1 gap-2.5">
            {EXTRAS.map(extra => (
              <label
                key={extra.id}
                className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedExtras.includes(extra.id)
                    ? 'border-[#E8743B] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedExtras.includes(extra.id)}
                  onChange={() => toggleExtra(extra.id)}
                  className="hidden"
                />
                <span className="font-bold text-[#E8743B] shrink-0">{extra.priceLabel}</span>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    {extra.popular && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{isHe ? 'פופולרי' : 'Popular'}</span>
                    )}
                    <span className="font-semibold">{extra.icon} {isHe ? extra.name : (extra as { nameEn?: string }).nameEn ?? extra.name}</span>
                  </div>
                  <p className="text-xs text-gray-500">{isHe ? extra.description : (extra as { descriptionEn?: string }).descriptionEn ?? extra.description}</p>
                </div>
              </label>
            ))}
          </div>

          <a
            href={`/${locale}/insurance`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-[#2D5F5F] hover:text-[#E8743B] underline transition-colors"
          >
            {isHe ? 'מה כלול בביטוח שלנו? ←' : 'What does our insurance cover? →'}
          </a>

          {/* Additional driver fields */}
          {selectedExtras.includes('driver') && (
            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-gray-700">
                {isHe ? '👤 פרטי הנהג הנוסף' : '👤 Additional Driver Details'}
              </p>
              <input
                type="text"
                value={additionalDriverName}
                onChange={e => setAdditionalDriverName(e.target.value)}
                placeholder={isHe ? 'שם מלא של הנהג הנוסף' : 'Full name of additional driver'}
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
              />
              <input
                type="text"
                value={additionalDriverId}
                onChange={e => setAdditionalDriverId(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder={isHe ? 'תעודת זהות / דרכון (עד 9 ספרות)' : 'ID / Passport number (up to 9 digits)'}
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                maxLength={9}
                inputMode="numeric"
              />
            </div>
          )}
        </div>
      )}

      {/* Coupon code */}
      {totalDays > 0 && (
        <div className="text-start">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {isHe ? 'קוד קופון בלעדי — מועדון הלקוחות של SmartCar' : 'SmartCar Members-Only Coupon Code'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                if (couponState.status !== 'idle') setCouponState({ status: 'idle' });
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), validateCoupon())}
              placeholder={isHe ? 'הכנס קוד בלעדי...' : 'Enter members-only code...'}
              className={`flex-1 h-10 rounded-lg border-2 px-3 text-sm uppercase tracking-widest outline-none transition-colors ${
                couponState.status === 'valid'   ? 'border-green-500 bg-green-50 text-green-700' :
                couponState.status === 'invalid' ? 'border-red-400 bg-red-50'                    :
                'border-gray-200 focus:border-[#2D5F5F]'
              }`}
            />
            <button
              type="button"
              onClick={validateCoupon}
              disabled={couponState.status === 'loading' || !couponCode.trim()}
              className="px-4 h-10 rounded-lg bg-[#2D5F5F] text-white text-sm font-bold hover:bg-[#1A3A3A] disabled:opacity-40 transition-colors"
            >
              {couponState.status === 'loading' ? '...' : (isHe ? 'אשר' : 'Apply')}
            </button>
          </div>
          {couponState.status === 'valid' && (
            <p className="text-green-600 text-xs mt-1">
              ✓ {isHe ? couponState.labelHe : couponState.labelEn} {isHe ? 'הוחלה בהצלחה' : 'applied'}
            </p>
          )}
          {couponState.status === 'invalid' && (
            <p className="text-red-500 text-xs mt-1">{isHe ? 'קוד קופון לא תקין' : 'Invalid coupon code'}</p>
          )}
        </div>
      )}

      {/* Price breakdown */}
      {totalDays > 0 && (
        <div className="bg-[#eef6f6] rounded-xl p-4 border border-[#B8D8D8] space-y-2 text-start">
          <div className="flex justify-between text-sm text-gray-600">
            <span className="font-medium">₪{pricePerDay} × {totalDays} {isHe ? 'ימים' : 'days'}</span>
            <span>{isHe ? 'מחיר בסיס' : 'Base price'}</span>
          </div>
          {discountPct > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span className="font-medium">-₪{discount}</span>
              <span>{isHe ? `הנחה ${discountPct}%` : `${discountPct}% discount`}</span>
            </div>
          )}
          {selectedExtras.map(id => {
            const extra = EXTRAS.find(e => e.id === id);
            if (!extra) return null;
            const isFixed = (extra as { fixed?: boolean }).fixed;
            const lineTotal = isFixed ? extra.price : extra.price * totalDays;
            return (
              <div key={id} className="flex justify-between text-sm text-gray-600">
                <span className="font-medium">₪{lineTotal}</span>
                <span>{extra.icon} {isHe ? extra.name : (extra as { nameEn?: string }).nameEn ?? extra.name}</span>
              </div>
            );
          })}
          {couponDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span className="font-medium">-₪{couponDiscount}</span>
              <span>🎟️ {isHe ? couponState.labelHe : couponState.labelEn}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg border-t border-[#B8D8D8] pt-2">
            <span className="text-[#E8743B]">₪{grandTotal.toLocaleString()}</span>
            <span>{isHe ? 'סה"כ לתשלום' : 'Total'}</span>
          </div>
          <p className="text-xs text-gray-400 text-center pt-1">
            {isHe
              ? `כולל מע"מ 18% • עד ${getRentalMileageAllowance(totalDays).toLocaleString()} ק"מ • דלק מלא`
              : `Incl. 18% VAT • Up to ${getRentalMileageAllowance(totalDays).toLocaleString()} km • Full tank`}
          </p>
          <p className="text-xs text-gray-300 text-center">
            {isHe
              ? 'המחיר אינדיקטיבי — מאושר סופית על ידי נציג לאחר אישור ההזמנה'
              : 'Indicative price — confirmed by a SmartCar agent after booking approval'}
          </p>
        </div>
      )}

      {/* ── Turnstile anti-bot ─────────────────────────── */}
      <div className="flex justify-center">
        <TurnstileWidget
          onSuccess={(token) => { setTurnstileToken(token); setTurnstileFailed(false); }}
          onError={() => { setTurnstileToken(null); setTurnstileFailed(true); }}
          onExpire={() => setTurnstileToken(null)}
        />
      </div>

      {/* ── Consent checkboxes ─────────────────────────── */}
      <div className="space-y-3 pt-2">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            {...register('agreeTerms')}
            className="mt-0.5 w-4 h-4 accent-[#2D5F5F] shrink-0"
          />
          <span className="text-xs text-gray-600 leading-relaxed">
            {isHe ? (
              <>
                קראתי ואני מסכים/ה ל
                <a href={`/${locale}/terms`} target="_blank" rel="noopener noreferrer" className="text-[#2D5F5F] underline font-medium">תנאי השימוש</a>
                {' '}ול
                <a href={`/${locale}/privacy`} target="_blank" rel="noopener noreferrer" className="text-[#2D5F5F] underline font-medium">מדיניות הפרטיות</a>
                {' '}של SmartCar. <span className="text-red-500">*</span>
              </>
            ) : (
              <>
                I have read and agree to SmartCar&apos;s{' '}
                <a href={`/${locale}/terms`} target="_blank" rel="noopener noreferrer" className="text-[#2D5F5F] underline font-medium">Terms of Service</a>
                {' '}and{' '}
                <a href={`/${locale}/privacy`} target="_blank" rel="noopener noreferrer" className="text-[#2D5F5F] underline font-medium">Privacy Policy</a>.{' '}
                <span className="text-red-500">*</span>
              </>
            )}
          </span>
        </label>
        {errors.agreeTerms && (
          <p className="text-xs text-red-500 me-7">{errors.agreeTerms.message}</p>
        )}

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            {...register('marketingConsent')}
            className="mt-0.5 w-4 h-4 accent-[#2D5F5F] shrink-0"
          />
          <span className="text-xs text-gray-500 leading-relaxed">
            {isHe
              ? 'אני מעוניין/ת לקבל עדכונים ומבצעים מ-SmartCar בדוא"ל (ניתן לביטול בכל עת)'
              : 'I would like to receive updates and deals from SmartCar by email (unsubscribe anytime)'}
          </span>
        </label>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting || totalDays <= 0 || (!turnstileToken && !turnstileFailed)}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            {isHe ? 'שולח...' : 'Sending...'}
          </span>
        ) : t('submit')}
      </Button>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </form>
  );
}
