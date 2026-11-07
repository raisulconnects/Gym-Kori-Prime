import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSyncStatus } from '../data/hooks';
import { type SyncStatus, syncNow } from '../data/sync';
import { useFormat } from '../preferences/useFormat';

function stateKey({ phase, pending }: SyncStatus) {
  if (phase === 'syncing') return 'syncing';
  if (phase === 'offline') return pending > 0 ? 'offline' : 'offlineClear';
  if (phase === 'error') return pending > 0 ? 'failed' : 'failedClear';
  return pending > 0 ? 'waiting' : 'synced';
}

/** Says plainly whether the user's data has left this device, and lets them try again. */
export function BackupCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const status = useSyncStatus();
  const { phase, pending, lastSyncedAt } = status;

  let Icon = Cloud;
  if (phase === 'syncing') Icon = RefreshCw;
  else if (phase === 'offline' || phase === 'error') Icon = CloudOff;

  return (
    <section className="card flex flex-col gap-2.5 p-4">
      <h2 className="section-label">{t('settings.backup')}</h2>
      <div role="status" className="flex flex-col gap-1">
        <p className="m-0 flex items-start gap-2 text-[15px] font-semibold leading-normal">
          <Icon aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
          {t(`settings.backupStates.${stateKey(status)}`, { count: pending, shown: format.number(pending) })}
        </p>
        {lastSyncedAt && (
          <p className="m-0 text-[15px] leading-normal text-muted">
            {t('settings.lastBackup', { time: format.dateTime(new Date(lastSyncedAt)) })}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={phase === 'syncing'}
        onClick={() => void syncNow()}
        className="outline-action disabled:opacity-50"
      >
        {t('settings.syncNow')}
      </button>
    </section>
  );
}
