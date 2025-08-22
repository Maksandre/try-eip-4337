import "server-only";

export interface RegisteredPasskey {
  id: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: string[];
}

interface FakeUserRecord {
  id: Uint8Array<ArrayBufferLike>;
  username: string;
  currentRegistrationChallenge?: string;
  currentAuthenticationChallenge?: string;
  registeredPasskeys: RegisteredPasskey[];
}

type DB = {
  user: FakeUserRecord;
};

declare global {
  // eslint-disable-next-line no-var
  var __FAKE_DB__: DB | undefined;
}

const db: DB = globalThis.__FAKE_DB__ ?? {
  user: {
    id: new TextEncoder().encode("1"),
    username: "demoUser",
    registeredPasskeys: [],
  },
};
globalThis.__FAKE_DB__ = db;

export function getUser() {
  return db.user;
}
export function setRegistrationChallenge(challenge: string) {
  db.user.currentRegistrationChallenge = challenge;
}
export function setAuthenticationChallenge(challenge: string) {
  db.user.currentAuthenticationChallenge = challenge;
}
export function addPasskey(passkey: RegisteredPasskey) {
  db.user.registeredPasskeys.push(passkey);
}
export function findPasskey(id: string): RegisteredPasskey | undefined {
  return db.user.registeredPasskeys.find((pk) => pk.id === id);
}
export function updatePasskeyCounter(id: string, newCounter: number) {
  const pk = findPasskey(id);
  if (pk) pk.counter = newCounter;
}
