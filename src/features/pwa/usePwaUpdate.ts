import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export interface PwaUpdateState {
  readonly needRefresh: boolean;
  readonly reloadForUpdate: () => Promise<void>;
  readonly dismissUpdate: () => void;
}

export function usePwaUpdate(): PwaUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisterError() {
        // Ignore service worker registration errors in unsupported/restricted contexts
      },
    });

    updateSwRef.current = updateSW;
  }, []);

  const reloadForUpdate = useCallback(async () => {
    if (updateSwRef.current) {
      await updateSwRef.current(true);
    } else {
      window.location.reload();
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  return {
    needRefresh,
    reloadForUpdate,
    dismissUpdate,
  };
}
