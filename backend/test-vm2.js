const templateStr = "/tv/${title.includes(String(year)) ? title : `${title} (${year})`} (tmdb-${tmdbId})/Season ${String(season).padStart(2, '0')}/${title} - S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}, ${resolution}, ${videoCodec}";

const escapedTemplate = templateStr.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
const code = `\`${escapedTemplate}\``;
console.log("CODE IS:\n", code);
