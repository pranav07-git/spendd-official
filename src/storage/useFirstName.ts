import { useEffect, useState } from 'react';
import { firstName, getProfile } from './appState';

/** The user's first name for greetings: '' when there is none, null while loading. */
export function useFirstName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    getProfile()
      .then(profile => setName(firstName(profile.name)))
      .catch(() => setName(''));
  }, []);
  return name;
}
