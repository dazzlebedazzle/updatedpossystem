/**
 * Get today's date in IST (Indian Standard Time) timezone
 * Returns date string in YYYY-MM-DD format
 */
export function getTodayIST() {
  try {
    // Use Intl.DateTimeFormat for accurate timezone conversion
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    
    return `${year}-${month}-${day}`;
  } catch {
    // Fallback method if Intl.DateTimeFormat is not available
    const now = new Date();
    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const utcTime = now.getTime();
    const istTime = new Date(utcTime + istOffset);
    
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
}

/**
 * Check if a date is today in IST
 * @param {Date|string} date - The date to check
 * @returns {boolean} - True if the date is today in IST
 */
export function isTodayIST(date) {
  if (!date) return false;
  
  const todayIST = getTodayIST();
  
  try {
    // Use Intl.DateTimeFormat for accurate timezone conversion
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const checkDate = new Date(date);
    const parts = formatter.formatToParts(checkDate);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    
    const dateStr = `${year}-${month}-${day}`;
    return dateStr === todayIST;
  } catch {
    // Fallback method
    const checkDate = new Date(date);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const utcTime = checkDate.getTime();
    const istTime = new Date(utcTime + istOffset);
    
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    
    const dateStr = `${year}-${month}-${day}`;
    return dateStr === todayIST;
  }
}

/**
 * Get start and end of today in IST
 * @returns {Object} - Object with start and end Date objects for today in IST
 */
export function getTodayISTRange() {
  const todayIST = getTodayIST();
  const [year, month, day] = todayIST.split('-').map(Number);
  
  // Create date objects for start and end of day in IST
  // IST is UTC+5:30, so we need to subtract 5:30 from UTC to get IST
  const istOffset = 5.5 * 60 * 60 * 1000;
  
  // Start of day: YYYY-MM-DD 00:00:00 IST
  // Create UTC date that represents 00:00:00 IST
  const startUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const startIST = new Date(startUTC.getTime() - istOffset);
  
  // End of day: YYYY-MM-DD 23:59:59.999 IST
  const endUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  const endIST = new Date(endUTC.getTime() - istOffset);
  
  return {
    start: startIST,
    end: endIST
  };
}

