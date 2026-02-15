import { useState, useEffect, useRef } from 'react';
import { NotificationSettings } from '../types';

interface UseNotificationsReturn {
  notificationSettings: NotificationSettings;
  setNotificationSettings: (settings: NotificationSettings) => void;
  isLoading: boolean;
  saveError: string | null;
}

const getDefaultSettings = (): NotificationSettings => ({
  enabled: true,
  accountSettings: {},
  categorySettings: {},
});

export const useNotifications = (): UseNotificationsReturn => {
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(getDefaultSettings());
  const [isInitialized, setIsInitialized] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const userModifiedDuringLoad = useRef(false);

  // Load settings from IPC on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.electron) {
          const savedSettings = await window.electron.loadNotificationSettings();
          // Only apply loaded settings if user hasn't modified them during loading
          if (savedSettings && !userModifiedDuringLoad.current) {
            setNotificationSettings(savedSettings);
          }
        }
      } catch (error) {
        console.error('Failed to load notification settings', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadSettings();
  }, []);

  // Persist notification settings whenever they change (after initialization)
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const saveSettings = async () => {
      try {
        if (window.electron) {
          await window.electron.saveNotificationSettings(notificationSettings);
          setSaveError(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save notification settings';
        console.error('Failed to save notification settings', error);
        setSaveError(message);
      }
    };

    saveSettings();
  }, [notificationSettings, isInitialized]);

  // Wrapper for setNotificationSettings that tracks user modifications during load
  const handleSetNotificationSettings = (settings: NotificationSettings) => {
    if (!isInitialized) {
      userModifiedDuringLoad.current = true;
    }
    setNotificationSettings(settings);
  };

  return {
    notificationSettings,
    setNotificationSettings: handleSetNotificationSettings,
    isLoading: !isInitialized,
    saveError,
  };
};
