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

export const getNavigationFallbackPath = (basePath: string, pathname: string) => {
  return getNavigationCachePath(basePath, pathname) ?? `${basePath}/index.html`;
};
