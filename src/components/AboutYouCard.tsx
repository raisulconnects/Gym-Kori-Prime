import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { saveBodyWeight } from '../data/body';
import { useLatestBodyWeight } from '../data/hooks';
import { formatWeight, parseBodyWeight, parseFeetInches, parseHeightCm, toFeetInches } from '../lib/units';
import { fromLocalDate } from '../lib/week';
import { type Gender, GENDERS } from '../preferences/preferences';
import { usePreferences } from '../preferences/PreferencesContext';
import { useFormat } from '../preferences/useFormat';
import { LiveNumberField } from './LiveNumberField';

type HeightUnit = 'feet' | 'cm';
type Message = { text: string; failed: boolean } | null;

const HEIGHT_UNITS: HeightUnit[] = ['feet', 'cm'];

function FormMessage({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p role={message.failed ? 'alert' : 'status'} className="m-0 text-[15px] font-semibold">
      {message.text}
    </p>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1.5 p-0 text-[15px] font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function GenderChoice() {
  const { t } = useTranslation();
  const { bodyDetails, updateBodyDetails } = useAuth();
  const [message, setMessage] = useState<Message>(null);

  async function choose(option: Gender) {
    setMessage(null);
    // Tapping the current choice clears it, since this is optional.
    const { error } = await updateBodyDetails({ gender: bodyDetails?.gender === option ? null : option });
    if (error) setMessage({ text: t(error), failed: true });
  }

  return (
    <Group title={t('settings.gender')}>
      <div className="grid grid-cols-2 gap-2">
        {GENDERS.map((option) => (
          <button
            key={option}
            type="button"
            disabled={!bodyDetails}
            aria-pressed={bodyDetails?.gender === option}
            onClick={() => void choose(option)}
            className={`choice disabled:opacity-50 ${option === 'prefer_not_to_say' ? 'col-span-2' : ''}`}
          >
            {t(`settings.genders.${option}`)}
          </button>
        ))}
      </div>
      <FormMessage message={message} />
    </Group>
  );
}

function HeightForm() {
  const { t } = useTranslation();
  const { bodyDetails, updateBodyDetails } = useAuth();
  const savedHeight = bodyDetails?.heightCm ?? null;
  const [unit, setUnit] = useState<HeightUnit>('feet');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [cm, setCm] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  const fillFrom = useCallback((heightCm: number) => {
    const parts = toFeetInches(heightCm);
    setFeet(String(parts.feet));
    setInches(String(parts.inches));
    setCm(String(heightCm));
  }, []);

  // The saved height can arrive after the screen opens.
  useEffect(() => {
    if (savedHeight !== null) fillFrom(savedHeight);
  }, [savedHeight, fillFrom]);

  function edit(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setMessage(null);
    };
  }

  const currentHeight = () => (unit === 'feet' ? parseFeetInches(feet, inches) : parseHeightCm(cm));

  /** Carries what's typed over to the other unit, so switching doesn't lose it. */
  function switchUnit(next: HeightUnit) {
    if (next === unit) return;
    const height = currentHeight();
    if (height !== null) fillFrom(height);
    setUnit(next);
    setMessage(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const blank = unit === 'feet' ? !feet && !inches : !cm;
    const heightCm = blank ? null : currentHeight();
    if (!blank && heightCm === null) return setMessage({ text: t('settings.errorHeight'), failed: true });
    setBusy(true);
    const { error } = await updateBodyDetails({ heightCm });
    setBusy(false);
    setMessage(error ? { text: t(error), failed: true } : { text: t('settings.heightSaved'), failed: false });
  }

  const disabled = !bodyDetails;
  const numberClass = 'field field-number min-w-0 flex-1';
  const suffixClass = 'text-[15px] font-semibold';

  return (
    <form noValidate onSubmit={save}>
      <Group title={t('settings.height')}>
        <fieldset aria-label={t('settings.heightUnit')} className="m-0 grid min-w-0 grid-cols-2 gap-2 border-0 p-0">
          {HEIGHT_UNITS.map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={unit === option}
              onClick={() => switchUnit(option)}
              className="choice disabled:opacity-50"
            >
              {t(`settings.heightUnits.${option}`)}
            </button>
          ))}
        </fieldset>
        <fieldset disabled={disabled} className="m-0 flex min-w-0 items-center gap-2 border-0 p-0 disabled:opacity-50">
          {unit === 'feet' ? (
            <>
              <LiveNumberField
                label={t('settings.feetLabel')}
                value={feet}
                maxLength={1}
                className={numberClass}
                onChange={edit(setFeet)}
              />
              <span className={suffixClass}>{t('settings.feet')}</span>
              <LiveNumberField
                label={t('settings.inchesLabel')}
                value={inches}
                maxLength={2}
                className={numberClass}
                onChange={edit(setInches)}
              />
              <span className={suffixClass}>{t('settings.inches')}</span>
            </>
          ) : (
            <>
              <LiveNumberField
                label={t('settings.cmLabel')}
                value={cm}
                decimal
                maxLength={5}
                className={numberClass}
                onChange={edit(setCm)}
              />
              <span className={suffixClass}>{t('settings.cmShort')}</span>
            </>
          )}
          <button type="submit" disabled={busy} className="small-action disabled:opacity-50">
            {t('common.save')}
          </button>
        </fieldset>
        <FormMessage message={message} />
      </Group>
    </form>
  );
}

function WeightForm() {
  const { t } = useTranslation();
  const format = useFormat();
  const { unit } = usePreferences();
  const latest = useLatestBodyWeight();
  const [weight, setWeight] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const unitName = t(`units.${unit}`);

  async function save(event: FormEvent) {
    event.preventDefault();
    const weightKg = parseBodyWeight(weight, unit);
    if (weightKg === null) return setMessage({ text: t('settings.errorWeight'), failed: true });
    // Saved on this device first, so it works with no signal and backs up later.
    await saveBodyWeight(weightKg, new Date());
    setWeight('');
    setMessage({ text: t('settings.weightSaved'), failed: false });
  }

  return (
    <form noValidate onSubmit={save}>
      <Group title={t('settings.weight')}>
        <div className="flex min-w-0 items-center gap-2">
          <LiveNumberField
            label={t('settings.weightLabel', { unit: unitName })}
            value={weight}
            decimal
            maxLength={6}
            className="field field-number min-w-0 flex-1"
            onChange={(value) => {
              setWeight(value);
              setMessage(null);
            }}
          />
          <span className="text-[15px] font-semibold">{unitName}</span>
          <button type="submit" className="small-action">
            {t('common.save')}
          </button>
        </div>
        <FormMessage message={message} />
        {latest && (
          <p className="m-0 text-[15px] leading-normal text-muted">
            {t('settings.weightLast', {
              weight: format.number(formatWeight(latest.weightKg, unit)),
              unit: unitName,
              date: format.dayMonth(fromLocalDate(latest.localDate)),
            })}
          </p>
        )}
      </Group>
    </form>
  );
}

/** Optional details about the person. Nothing else in the app depends on these being filled in. */
export function AboutYouCard() {
  const { t } = useTranslation();
  const { bodyDetails } = useAuth();
  return (
    <section className="card flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="section-label">{t('settings.aboutYou')}</h2>
        <p className="m-0 text-[15px] leading-normal text-muted">{t('settings.aboutYouHelp')}</p>
      </div>
      <GenderChoice />
      <HeightForm />
      {!bodyDetails && <p className="m-0 text-[15px] leading-normal text-muted">{t('settings.needsConnection')}</p>}
      <WeightForm />
    </section>
  );
}
