import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';
import type { AppTab, EmergencyFundStore, EmergencySettingsInput, EmergencySettingsPayload, EmergencySimulation, EmergencySummary, SimulationAdjustmentInput } from '../types';
import { getErrorMessage } from '../utils/errors';

export function useEmergencyFund(activeTab: AppTab): EmergencyFundStore {
  const [summary, setSummary] = useState<EmergencySummary | null>(null);
  const [settingsPayload, setSettingsPayload] = useState<EmergencySettingsPayload | null>(null);
  const [simulation, setSimulation] = useState<EmergencySimulation | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(getErrorMessage(err, 'Could not load emergency fund data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'emergency' || activeTab === 'settings') fetchEmergencyData();
  }, [activeTab, fetchEmergencyData]);

  const saveSettings = async (data: EmergencySettingsInput): Promise<EmergencySettingsPayload> => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateEmergencySettings(data);
      const summaryData = await api.getEmergencySummary();
      setSettingsPayload(updated);
      setSummary(summaryData);
      return updated;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save emergency fund settings.'));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const runSimulation = async (adjustments: { adjustments: SimulationAdjustmentInput[] }): Promise<EmergencySimulation> => {
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
