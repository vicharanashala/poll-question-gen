export const GUEST_COHOST_SESSION_KEY = 'guest-cohost-session';

export type GuestCohostSession = {
  cohostId: string;
  displayName: string;
  roomCode: string;
  token: string;
  joinedAt: number;
};

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getGuestCohostSession(): GuestCohostSession | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = sessionStorage.getItem(GUEST_COHOST_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as GuestCohostSession;
    if (!parsed?.cohostId || !parsed?.roomCode || !parsed?.token) {
      sessionStorage.removeItem(GUEST_COHOST_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(GUEST_COHOST_SESSION_KEY);
    return null;
  }
}

export function setGuestCohostSession(session: GuestCohostSession): void {
  if (!isBrowser()) {
    return;
  }
  sessionStorage.setItem(GUEST_COHOST_SESSION_KEY, JSON.stringify(session));
}

export function clearGuestCohostSession(): void {
  if (!isBrowser()) {
    return;
  }
  sessionStorage.removeItem(GUEST_COHOST_SESSION_KEY);
}
