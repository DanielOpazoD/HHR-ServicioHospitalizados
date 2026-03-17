import { formatCensusMonthName } from '@/shared/census/censusPresentation';

export const COPY_PREVIOUS_DAY_UNLOCK_HOUR = 8;

export interface CreateDayCopyAvailability {
  isCopyLocked: boolean;
  unlockAt: Date | null;
  remainingMs: number;
  countdownLabel: string | null;
  isTargetToday: boolean;
}

const buildLocalIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatCopyUnlockCountdown = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
};

export const resolveCreateDayCopyAvailability = (
  currentDateString: string,
  now: Date = new Date()
): CreateDayCopyAvailability => {
  const todayString = buildLocalIsoDate(now);

  if (currentDateString < todayString) {
    return {
      isCopyLocked: false,
      unlockAt: null,
      remainingMs: 0,
      countdownLabel: null,
      isTargetToday: false,
    };
  }

  const [year, month, day] = currentDateString.split('-').map(Number);
  const unlockAt = new Date(year, month - 1, day, COPY_PREVIOUS_DAY_UNLOCK_HOUR, 0, 0, 0);
  const remainingMs = Math.max(0, unlockAt.getTime() - now.getTime());
  const isCopyLocked = remainingMs > 0;

  return {
    isCopyLocked,
    unlockAt,
    remainingMs,
    countdownLabel: isCopyLocked ? formatCopyUnlockCountdown(remainingMs) : null,
    isTargetToday: currentDateString === todayString,
  };
};

export const buildCopyUnlockDescription = (
  currentDateString: string,
  now: Date = new Date()
): string => {
  const availability = resolveCreateDayCopyAvailability(currentDateString, now);
  const [, , day] = currentDateString.split('-');
  const capitalizedMonthName = formatCensusMonthName(currentDateString);
  const formattedDate = `${parseInt(day, 10)} de ${capitalizedMonthName}`;

  return availability.isTargetToday
    ? `Disponible hoy desde las ${COPY_PREVIOUS_DAY_UNLOCK_HOUR}:00 hrs.`
    : `Disponible desde el ${formattedDate} a las ${COPY_PREVIOUS_DAY_UNLOCK_HOUR}:00 hrs.`;
};
