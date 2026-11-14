export const state = {
  currentUserId: null,
  currentUser: null,
  theme: "qinglv",
};

export function setCurrentUser(user) {
  state.currentUser = user;
  state.currentUserId = user?.id || null;
}

export function clearCurrentUser() {
  state.currentUser = null;
  state.currentUserId = null;
}