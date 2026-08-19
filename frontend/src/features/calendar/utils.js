export const pad = (num) => String(num).padStart(2, '0');

export const groupDayEvents = (events) => {
  const grouped = [];
  const tvGroups = {}; // key: tmdbId-seasonNumber

  events.forEach(ev => {
    if (ev.type === 'movie') {
      grouped.push(ev);
    } else {
      const key = `${ev.tmdbId}-${ev.seasonNumber}`;
      if (!tvGroups[key]) {
        tvGroups[key] = [];
      }
      tvGroups[key].push(ev);
    }
  });

  Object.values(tvGroups).forEach(group => {
    if (group.length === 1) {
      grouped.push(group[0]);
    } else {
      // Sort episodes by episode number ascending
      group.sort((a, b) => a.episodeNumber - b.episodeNumber);

      const first = group[0];
      const last = group[group.length - 1];

      // Determine overall states for the group
      const isAllWatched = group.every(e => e.isWatched);
      const isAllCollected = group.every(e => e.isCollected);

      // Create a stacked event object
      grouped.push({
        ...first,
        isStacked: true,
        originalEpisodes: group,
        isWatched: isAllWatched,
        isCollected: isAllCollected,
        // S01E01-04 format
        episodeRangeText: `S${pad(first.seasonNumber)}E${pad(first.episodeNumber)}-${pad(last.episodeNumber)}`
      });
    }
  });

  return grouped;
};

export const getSortableTitle = (title) => {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/^(?:a|an|the)\s+/i, '')
    .trim();
};

export const sortEvents = (eventList) => {
  return [...eventList].sort((a, b) => {
    const timeA = a.airDateTime ? new Date(a.airDateTime).getTime() : new Date(a.airDate + 'T00:00:00Z').getTime();
    const timeB = b.airDateTime ? new Date(b.airDateTime).getTime() : new Date(b.airDate + 'T00:00:00Z').getTime();

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    const titleA = getSortableTitle(a.type === 'tv' ? a.showTitle : a.title);
    const titleB = getSortableTitle(b.type === 'tv' ? b.showTitle : b.title);
    return titleA.localeCompare(titleB);
  });
};
