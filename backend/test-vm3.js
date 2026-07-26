const vm = require('vm');
function evaluateTemplate(templateStr, context) {
  const sandbox = { ...context, String, Number, Math, Boolean, Date };
  vm.createContext(sandbox);

  // REMOVE backtick escape
  const escapedTemplate = templateStr.replace(/\\/g, '\\\\');
  const code = `\`${escapedTemplate}\``;
  
  return vm.runInContext(code, sandbox);
}

const template = "/tv/${title.includes(String(year)) ? title : `${title} (${year})`} (tmdb-${tmdbId})/Season ${String(season).padStart(2, '0')}/${title} - S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}, ${resolution}, ${videoCodec}";

const context = {
    title: 'Legends',
    year: 2026,
    season: 1,
    episode: 4,
    tmdbId: 262280,
    type: 'tv',
    resolution: '1080p',
    videoCodec: 'HEVC',
    genre: 'Unknown',
    episodeTitle: 'Unknown'
};

try {
  console.log(evaluateTemplate(template, context));
} catch(e) {
  console.error("Error:", e.message);
}
