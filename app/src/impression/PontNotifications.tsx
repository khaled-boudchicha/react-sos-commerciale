import { useEffect } from 'react';
import { configurerReport } from '@softly/report/core';
import { useToast } from '../components/ui/Toast';

/** Route les notifications du paquet d'états vers les toasts de l'application (à monter sous <ToastProvider>). */
export default function PontNotifications() {
  const toast = useToast();
  useEffect(() => {
    configurerReport({ notifier: toast });
    return () => configurerReport({ notifier: undefined });
  }, [toast]);
  return null;
}
