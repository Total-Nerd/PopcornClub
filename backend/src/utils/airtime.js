// Helper to calculate airing datetime in UTC based on origin countries and standard airing times
function getAiringDateTime(airDateStr, originCountries = []) {
  if (!airDateStr) return null;
  const country = originCountries[0] || 'US';
  const date = new Date(airDateStr + 'T12:00:00Z'); // Use noon UTC to avoid date boundaries on transition days
  
  // Default local prime time for airtime: 9 PM (21:00)
  const localHour = 21; 
  let utcOffset = 0; // offset in hours from UTC
  
  const zones = {
    US: 'America/New_York',
    CA: 'America/New_York',
    GB: 'Europe/London',
    IE: 'Europe/London',
    FR: 'Europe/Paris',
    DE: 'Europe/Paris',
    ES: 'Europe/Paris',
    IT: 'Europe/Paris',
    NL: 'Europe/Paris',
    BE: 'Europe/Paris',
    CH: 'Europe/Paris',
    SE: 'Europe/Paris',
    NO: 'Europe/Paris',
    DK: 'Europe/Paris',
    PL: 'Europe/Paris',
    JP: 'Asia/Tokyo',
    KR: 'Asia/Tokyo',
    AU: 'Australia/Sydney',
    NZ: 'Pacific/Auckland'
  };

  const tz = zones[country] || 'UTC';
  
  if (tz !== 'UTC') {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'longOffset'
      });
      const parts = formatter.formatToParts(date);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      const tzValue = tzPart ? tzPart.value : null;
      if (tzValue) {
        if (['GMT', 'UTC', 'Z'].includes(tzValue)) {
          utcOffset = 0;
        } else {
          const match = tzValue.match(/(?:GMT|UTC)?([+-])(\d+)(?::(\d+))?/);
          if (match) {
            const sign = match[1] === '-' ? -1 : 1;
            const hours = parseInt(match[2], 10);
            const minutes = match[3] ? parseInt(match[3], 10) : 0;
            utcOffset = sign * (hours + minutes / 60);
          }
        }
      }
    } catch (e) {
      console.error(`Error calculating dynamic timezone offset for ${country}/${tz}:`, e);
      utcOffset = 0;
    }
  } else {
    utcOffset = 0;
  }
  
  const utcHour = localHour - utcOffset;
  const airingDate = new Date(new Date(airDateStr + 'T00:00:00Z').getTime() + utcHour * 60 * 60 * 1000);
  return airingDate.toISOString();
}

module.exports = {
  getAiringDateTime
};
