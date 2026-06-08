let activeSession = null;

module.exports = {
  getActiveSession: () => activeSession,
  setActiveSession: (session) => {
    activeSession = session;
  },
  clearActiveSession: () => {
    activeSession = null;
  }
};
