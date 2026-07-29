const firebaseProjectIdPattern = /^[a-z0-9][a-z0-9-]{2,62}$/u;

export function firebaseAuthHelperRewrites(projectId: string | undefined) {
  if (projectId === undefined || !firebaseProjectIdPattern.test(projectId)) return [];

  return [{
    source: "/__/auth/:path*",
    destination: `https://${projectId}.firebaseapp.com/__/auth/:path*`,
  }];
}
