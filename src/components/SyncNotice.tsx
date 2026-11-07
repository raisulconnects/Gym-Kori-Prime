import { CloudOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSyncStatus } from '../data/hooks';
import { useFormat } from '../preferences/useFormat';

/** Stays out of the way until there's something worth knowing about the user's data. */
export function SyncNotice() {
  const { t } = useTranslation();
  const format = useFormat();
  const { phase, pending, lastSyncedAt } = useSyncStatus();

  const stuck = pending > 0 && (phase === 'offline' || phase === 'error');
  const firstSync = phase === 'syncing' && lastSyncedAt === null;
  const Icon = stuck ? CloudOff : RefreshCw;

  return (
    <div role="status">
      {(stuck || firstSync) && (
        <p className="m-0 flex items-start gap-2 text-[15px] font-semibold leading-normal text-muted">
          <Icon aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
          {stuck ? t('sync.notBackedUp', { count: pending, shown: format.number(pending) }) : t('sync.gettingData')}
        </p>
      )}
    </div>
  );
}
