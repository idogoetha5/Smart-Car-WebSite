'use client';

import { useMemo } from 'react';
import type { CountryCode } from 'libphonenumber-js';
import { dialOptions, flagEmoji } from '@/lib/phone-prefix';

type Props = {
  id: string;
  locale: 'he' | 'en';
  country: CountryCode;
  national: string;
  onCountryChange: (country: CountryCode) => void;
  onNationalChange: (national: string) => void;
  inputClass: string;
  labelClass: string;
};

/** Country calling-code picker followed by the rest of the number. */
export default function PhoneWithCountryInput({
  id,
  locale,
  country,
  national,
  onCountryChange,
  onNationalChange,
  inputClass,
  labelClass,
}: Props) {
  const isHe = locale === 'he';
  const options = useMemo(() => dialOptions(locale), [locale]);
  const hintId = `${id}-hint`;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>{isHe ? 'מספר טלפון' : 'Phone number'}</label>
      <div className="grid min-w-0 grid-cols-[7.5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]" dir="ltr">
        <select
          value={country}
          onChange={(event) => onCountryChange(event.target.value as CountryCode)}
          className={`${inputClass} min-w-0 max-w-full px-2 text-sm sm:px-3 sm:text-base`}
          aria-label={isHe ? 'קידומת מדינה' : 'Country code'}
          aria-describedby={hintId}
        >
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {`${flagEmoji(option.code)} ${option.dial}  ${option.name}`}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          value={national}
          onChange={(event) => onNationalChange(event.target.value)}
          className={`${inputClass} min-w-0 max-w-full`}
          autoComplete="tel-national"
          inputMode="tel"
          required
          maxLength={24}
          placeholder={isHe ? 'המשך המספר' : 'Number'}
          aria-describedby={hintId}
        />
      </div>
      <p id={hintId} className="mt-2 text-xs leading-5 text-gray-500">
        {isHe ? 'בחרו קידומת מדינה ואז הקלידו את המשך המספר.' : 'Choose your country code, then type the rest of the number.'}
      </p>
    </div>
  );
}
