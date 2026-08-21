import { useEffect } from 'react';
import { BackHandler } from 'react-native';

// Intercept the Android hardware/gesture back button. `handler` returns true to
// consume the event (prevent default) or false to allow the default (e.g. exit).
export function useAndroidBack(handler: () => boolean) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [handler]);
}
