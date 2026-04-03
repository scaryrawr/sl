/**
 * Returns the canonical cached shell path for known document routes.
 * Unknown routes return null so callers can decide whether to preserve the
 * original request or fall back to a default shell.
 */
export const getNavigationCachePath = (basePath: string, pathname: string) => {
  switch (pathname) {
    case basePath:
    case `${basePath}/`:
    case `${basePath}/index.html`:
      return `${basePath}/index.html`;
    case `${basePath}/embed`:
    case `${basePath}/embed.html`:
      return `${basePath}/embed.html`;
    default:
      return null;
  }
};

/**
 * Returns the canonical navigation URL to redirect to before serving a cached
 * document shell. Bare project base paths need a trailing slash so relative
 * assets resolve underneath the project path.
 */
export const getNavigationRedirectPath = (basePath: string, pathname: string) => {
  if (basePath && pathname === basePath) {
    return `${basePath}/`;
  }

  return null;
};

/**
 * Returns the best offline shell to serve for a document route.
 * Unknown routes intentionally fall back to the main index shell.
 */
export const getNavigationFallbackPath = (basePath: string, pathname: string) => {
  return getNavigationCachePath(basePath, pathname) ?? `${basePath}/index.html`;
};
