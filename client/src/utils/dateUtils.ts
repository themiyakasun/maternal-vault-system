/**
 * Date Utility Functions for MaternalVault
 * Standard:
 * - Storage / Database / JSON payload: ISO `YYYY-MM-DD` (e.g. "2024-08-02", "2024-06-09")
 * - Display / User Interface: `DD MMM YYYY` (e.g. "02 Aug 2024", "09 Jun 2024")
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
};

/**
 * Format any date input to display format: "DD MMM YYYY" (e.g., "09 Jun 2024", "02 Aug 2024")
 */
export function formatDisplayDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';

  // If already a Date object
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '—';
    const day = String(dateInput.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[dateInput.getMonth()];
    const year = dateInput.getFullYear();
    return `${day} ${month} ${year}`;
  }

  const str = String(dateInput).trim();
  if (!str) return '—';

  // Match YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const monthIndex = parseInt(isoMatch[2], 10) - 1;
    const day = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${day} ${MONTH_NAMES[monthIndex]} ${year}`;
    }
  }

  // Match DD MMM YYYY or DD-MMM-YYYY (e.g., "09 Jun 2024", "9-Aug-2024")
  const displayMatch = str.match(/^(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d{4})/);
  if (displayMatch) {
    const day = String(parseInt(displayMatch[1], 10)).padStart(2, '0');
    const monthKey = displayMatch[2].toLowerCase();
    const monthNum = MONTH_MAP[monthKey];
    if (monthNum) {
      const monthIndex = parseInt(monthNum, 10) - 1;
      return `${day} ${MONTH_NAMES[monthIndex]} ${displayMatch[3]}`;
    }
    return `${day} ${displayMatch[2]} ${displayMatch[3]}`;
  }

  // Fallback to standard JS Date parsing
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = MONTH_NAMES[parsed.getMonth()];
      const year = parsed.getFullYear();
      return `${day} ${month} ${year}`;
    }
  } catch {
    // Return original string if unparseable
  }

  return str;
}

/**
 * Format any date input to database/storage format: "YYYY-MM-DD" (e.g., "2024-06-09", "2024-08-02")
 */
export function formatDbDate(dateInput?: string | Date | null): string {
  if (!dateInput) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // If already a Date object
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    return `${dateInput.getFullYear()}-${String(dateInput.getMonth() + 1).padStart(2, '0')}-${String(dateInput.getDate()).padStart(2, '0')}`;
  }

  const str = String(dateInput).trim();
  if (!str) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // If already in YYYY-MM-DD format
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Match DD MMM YYYY or DD-MMM-YYYY (e.g., "09 Jun 2024")
  const displayMatch = str.match(/^(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d{4})/);
  if (displayMatch) {
    const day = String(parseInt(displayMatch[1], 10)).padStart(2, '0');
    const monthKey = displayMatch[2].toLowerCase();
    const monthNum = MONTH_MAP[monthKey] || '01';
    const year = displayMatch[3];
    return `${year}-${monthNum}-${day}`;
  }

  // Fallback to Date parser
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  } catch {
    // Return original string if completely unparseable
  }

  return str;
}
