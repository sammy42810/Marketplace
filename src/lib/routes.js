export const ROUTES = {
  home: '/',
  search: '/search',
  sell: '/listings/new',
  inbox: '/inbox',
  watchlist: '/watchlist',
  notifications: '/notifications',
  profile: (uid) => `/users/${uid}`,
  login: '/login',
  signup: '/signup'
};
