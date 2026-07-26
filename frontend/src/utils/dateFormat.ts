const AR_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric', month: 'short', day: 'numeric',
};

const AR_FULL: Intl.DateTimeFormatOptions = {
  year: 'numeric', month: 'long', day: 'numeric',
};

export const formatDate = (date: string | Date | null | undefined, full = false): string => {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('ar-JO', full ? AR_FULL : AR_OPTIONS);
  } catch {
    return '—';
  }
};

export const formatDateISO = (date: string | Date | null | undefined): string => {
  if (!date) return '';
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('ar-JO', {
      ...AR_OPTIONS, hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};
