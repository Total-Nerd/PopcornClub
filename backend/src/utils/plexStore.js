const sessions = {};

module.exports = {
  getActiveSession: (userId) => sessions[userId] || null,
  setActiveSession: (userId, session) => {
    sessions[userId] = session;
  },
  clearActiveSession: (userId) => {
    delete sessions[userId];
  }
};
