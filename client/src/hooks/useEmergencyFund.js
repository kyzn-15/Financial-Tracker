import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';

export function useEmergencyFund(activeTab) {
  const [summary, setSummary] = useState(null);
  const [settingsPayload, setSettingsPayload] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchEmergencyData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsData, summaryData] = await Promise.all([
        api.getEmergencySettings(),
        api.getEmergencySummary(),
      ]);
      setSettingsPayload(settingsData);
      setSummary(summaryData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'emergency' || activeTab === 'settings') fetchEmergencyData();
  }, [activeTab, fetchEmergencyData]);

  const saveSettings = async (data) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateEmergencySettings(data);
      const summaryData = await api.getEmergencySummary();
      setSettingsPayload(updated);
      setSummary(summaryData);
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const runSimulation = async (adjustments) => {
    const data = await api.getEmergencySimulation(adjustments);
    setSimulation(data);
    return data;
  };

  return {
    summary,
    settingsPayload,
    simulation,
    loading,
    saving,
    error,
    refresh: fetchEmergencyData,
    saveSettings,
    runSimulation,
  };
}
