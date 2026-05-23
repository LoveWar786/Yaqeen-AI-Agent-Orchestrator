/**
 * Yaqeen High-Fidelity Time Parsing Utilities
 */

/**
 * Parses a relative bilingual (English & Urdu/Roman Urdu) time expression 
 * and calculates the absolute Date object and formatted day/date representation.
 * 
 * Supports:
 * - English: today, tomorrow, day after tomorrow, X days later/after, tonight,
 *            morning (10:00 AM), afternoon (2:00 PM), evening (6:00 PM), night (9:00 PM).
 * - Urdu/Roman Urdu: kal, parso, parson, tarso, tarson, aaj, aaj raat,
 *                    subah, dopahar, shaam, raat.
 * - Clock times: 11:00 AM, 3pm, 14:00, 11 baje, 5 baji.
 */
export const parseRelativeTimeToDate = (timeText, baseDate = null) => {
  try {
    if (!timeText || !timeText.trim()) {
      const defaultToday = new Date(baseDate || Date.now());
      const formattedToday = defaultToday.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      return {
        time: `${formattedToday} at 5:00 PM`,
        clockTime: "5:00 PM",
        dateObj: defaultToday
      };
    }

    const today = new Date(baseDate || Date.now());
    // Convert baseDate safely to a baseline
    let targetDate = new Date(today);
    let dayName = "today";
    const lower = timeText.toLowerCase().trim();

    // 1. Resolve Day Offsets (Bilingual: English, Urdu & Roman Urdu)
    if (lower.includes("day after tomorrow") || lower.includes("parso") || lower.includes("parson") || lower.includes("پرسوں")) {
      targetDate.setDate(today.getDate() + 2);
      dayName = "day after tomorrow";
    } else if (lower.includes("tomorrow") || lower.includes("kal") || lower.includes("next day") || lower.includes("کل")) {
      targetDate.setDate(today.getDate() + 1);
      dayName = "tomorrow";
    } else if (lower.includes("tarso") || lower.includes("tarson") || lower.includes("3 days later") || lower.includes("in 3 days")) {
      targetDate.setDate(today.getDate() + 3);
      dayName = "3 days later";
    } else if (lower.includes("2 days later") || lower.includes("in 2 days")) {
      targetDate.setDate(today.getDate() + 2);
      dayName = "2 days later";
    } else if (lower.includes("4 days later") || lower.includes("in 4 days")) {
      targetDate.setDate(today.getDate() + 4);
      dayName = "4 days later";
    } else if (lower.includes("5 days later") || lower.includes("in 5 days")) {
      targetDate.setDate(today.getDate() + 5);
      dayName = "5 days later";
    } else if (lower.includes("today") || lower.includes("aaj") || lower.includes("now") || lower.includes("urgent") || lower.includes("آج")) {
      targetDate.setDate(today.getDate());
      dayName = "today";
    }

    const formattedDate = targetDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // 2. Resolve Clock Time (Digital formats, hour formats, and Urdu "baje")
    let clockTime = "";
    
    const digitalMatch = lower.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
    if (digitalMatch) {
      const hours = digitalMatch[1];
      const minutes = digitalMatch[2];
      const ampm = digitalMatch[3] ? digitalMatch[3].toUpperCase() : "";
      clockTime = `${hours}:${minutes} ${ampm}`.trim();
    } else {
      const hourMatch = lower.match(/(\d{1,2})\s*(am|pm)/);
      if (hourMatch) {
        clockTime = `${hourMatch[1]}:00 ${hourMatch[2].toUpperCase()}`;
      } else {
        // Roman Urdu / Urdu matching like "11 baje", "3 baje", "8 bjy", "5 bje", "بجے", "بجی"
        const bajeMatch = lower.match(/(\d{1,2})\s*(baje|baji|bjy|bje|بجے|بجی)/);
        if (bajeMatch) {
          const hr = parseInt(bajeMatch[1], 10);
          let ampm = "AM";
          if (lower.includes("shaam") || lower.includes("raat") || lower.includes("dopahar") || lower.includes("evening") || lower.includes("night") || lower.includes("afternoon") || lower.includes("شام") || lower.includes("رات") || lower.includes("دوپہر")) {
            ampm = "PM";
          } else if (hr < 8) {
            // Default early numbers (1 to 7) to PM if unspecified (e.g. 3 baje -> 3:00 PM)
            ampm = "PM";
          }
          clockTime = `${hr}:00 ${ampm}`;
        }
      }
    }

    if (!clockTime) {
      const daypartMatch = lower.match(/\b(morning|subah|afternoon|dopahar|evening|shaam|night|raat|aaj|kal|tomorrow|today|صبح|دوپہر|شام|رات|کل|آج)\s*(\d{1,2})\b/) ||
                           lower.match(/\b(\d{1,2})\s*(morning|subah|afternoon|dopahar|evening|shaam|night|raat|aaj|kal|tomorrow|today|صبح|دوپہر|شام|رات|کل|آج)\b/);
      if (daypartMatch) {
        const isNumberFirst = !isNaN(parseInt(daypartMatch[1], 10));
        const hrVal = isNumberFirst ? parseInt(daypartMatch[1], 10) : parseInt(daypartMatch[2], 10);
        const word = isNumberFirst ? daypartMatch[2] : daypartMatch[1];
        
        if (hrVal >= 1 && hrVal <= 12) {
          let ampm = "AM";
          if (word.includes("shaam") || word.includes("raat") || word.includes("dopahar") || 
              word.includes("evening") || word.includes("night") || word.includes("afternoon") ||
              word.includes("شام") || word.includes("رات") || word.includes("دوپہر")) {
            ampm = "PM";
          } else if (word.includes("morning") || word.includes("subah") || word.includes("صبح")) {
            ampm = "AM";
          } else if (hrVal < 8) {
            ampm = "PM";
          }
          clockTime = `${hrVal}:00 ${ampm}`;
        }
      }
    }

    if (!clockTime) {
      if (lower.includes("morning") || lower.includes("subah") || lower.includes("صبح")) clockTime = "10:00 AM";
      else if (lower.includes("afternoon") || lower.includes("dopahar") || lower.includes("دوپہر")) clockTime = "2:00 PM";
      else if (lower.includes("evening") || lower.includes("shaam") || lower.includes("شام")) clockTime = "6:00 PM";
      else if (lower.includes("night") || lower.includes("tonight") || lower.includes("raat") || lower.includes("رات")) clockTime = "9:00 PM";
      else {
        // Default to baseline + 2 hours
        const defaultTime = new Date(today);
        defaultTime.setHours(defaultTime.getHours() + 2);
        let h = defaultTime.getHours();
        const m = defaultTime.getMinutes() < 10 ? '0' + defaultTime.getMinutes() : defaultTime.getMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        clockTime = `${h}:${m} ${ampm}`;
      }
    }

    // Adjust targetDate's hour and minute components safely
    try {
      const timeParts = clockTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (timeParts) {
        let hr = parseInt(timeParts[1], 10);
        const min = parseInt(timeParts[2], 10);
        const ampm = timeParts[3] ? timeParts[3].toUpperCase() : "";
        if (ampm === "PM" && hr < 12) hr += 12;
        if (ampm === "AM" && hr === 12) hr = 0;
        targetDate.setHours(hr, min, 0, 0);
      }
    } catch (e) {
      console.warn("[parseRelativeTimeToDate] Error setting targetDate components:", e.message);
    }

    const finalTimeStr = `${formattedDate} at ${clockTime}`;
    return {
      time: finalTimeStr,
      clockTime: clockTime,
      dateObj: targetDate
    };
  } catch (err) {
    console.warn("Failed in parseRelativeTimeToDate:", err);
    return {
      time: "today",
      clockTime: "5:00 PM",
      dateObj: new Date(baseDate || Date.now())
    };
  }
};

/**
 * Standardizes and robustly parses absolute date strings (e.g. "May 21, 2026 6 PM")
 * across different JS engines (Hermes, JSC, V8) and formats.
 */
export const parseAbsoluteDateString = (str) => {
  if (!str) return null;
  
  // Clean up day of week (e.g. "Thursday, May 21, 2026")
  let cleanStr = str.replace(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday),?\s+/i, '');
  
  // Replace "at" with space
  cleanStr = cleanStr.replace(/\s+at\s+/i, ' ');
  
  // Pre-format hours without minutes: e.g. "6 PM" -> "6:00 PM"
  // Look for standalone numbers followed by am/pm
  cleanStr = cleanStr.replace(/(^|[^:])\b(\d{1,2})\s*(am|pm)\b/gi, (match, prefix, num, ampm) => {
    return prefix + num + ":00 " + ampm;
  });
  
  // Try native Date.parse first after cleaning
  const nativeParsed = Date.parse(cleanStr);
  if (!isNaN(nativeParsed)) {
    return new Date(nativeParsed);
  }
  
  // Custom manual regex fallback
  // e.g. "May 21, 2026 6:00 PM" or "May 21, 2026 18:00"
  const regex = /([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?/i;
  const match = cleanStr.match(regex);
  if (match) {
    const monthStr = match[1].toLowerCase();
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    let hr = parseInt(match[4], 10);
    const min = match[5] ? parseInt(match[5], 10) : 0;
    const sec = match[6] ? parseInt(match[6], 10) : 0;
    const ampm = match[7] ? match[7].toLowerCase() : '';
    
    const months = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
      may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
      oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
    };
    
    if (months[monthStr] !== undefined) {
      const month = months[monthStr];
      if (ampm === 'pm' && hr < 12) hr += 12;
      if (ampm === 'am' && hr === 12) hr = 0;
      
      const d = new Date(year, month, day, hr, min, sec, 0);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  }
  
  return null;
};

/**
 * Parses a human-readable or timestamp booking time string into a Date object.
 */
export const parseBookingTime = (timeStr, createdAt) => {
  try {
    if (!timeStr) return new Date(createdAt || Date.now());
    if (/^\d+$/.test(timeStr)) {
      return new Date(Number(timeStr));
    }

    // Try high-fidelity absolute date parser first
    const absParsed = parseAbsoluteDateString(timeStr);
    if (absParsed) {
      return absParsed;
    }

    const parsed = Date.parse(timeStr);
    if (!isNaN(parsed)) {
      return new Date(parsed);
    }
    
    // Leverage our comprehensive bilingually-rich relative parser
    const result = parseRelativeTimeToDate(timeStr, createdAt);
    return result.dateObj;
  } catch (err) {
    console.warn('Failed to parse booking time:', err);
    return new Date(createdAt || Date.now());
  }
};

/**
 * Returns a human-readable string indicating how far away or overdue a booking time is.
 */
export const getTimeRemainingString = (bookingTime) => {
  const diffMs = bookingTime.getTime() - Date.now();
  const isOverdue = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);

  const diffMins = Math.floor(absDiffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (isOverdue) {
    if (diffDays > 0) return `Overdue by ${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `Overdue by ${diffHours}h ${diffMins % 60}m`;
    if (diffMins > 0) return `Overdue by ${diffMins}m`;
    return `Overdue now`;
  } else {
    if (diffDays > 0) return `Starts in ${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `Starts in ${diffHours}h ${diffMins % 60}m`;
    if (diffMins > 0) return `Starts in ${diffMins}m`;
    return `Starts now`;
  }
};
