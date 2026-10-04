import { useCallback, useEffect, useState, useRef } from 'react';
import type { SpeedUnit } from '@gps/core';
import { UnitSelector } from './UnitSelector';
import { clearAllTrips, estimateStorageUsage, listTrips, getTrip, saveTrip } from '../storage/tripStore';
import { ConfirmDialog } from './ConfirmDialog';
import { Toast } from './Toast';
import { downloadTripJSON, parseTripJSON } from '../utils/tripExport';

interface SettingsPageProps {
  unit: SpeedUnit;
  onUnitChange: (unit: SpeedUnit) => void;
  onTripsCleared: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function SettingsPage({ unit, onUnitChange, onTripsCleared }: SettingsPageProps) {
  const [showClear, setShowClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    estimateStorageUsage().then(setStorageUsage);
  }, []);

  const handleClear = useCallback(async () => {
    await clearAllTrips();
    setShowClear(false);
    onTripsCleared();
    setToast('All trips deleted');
    estimateStorageUsage().then(setStorageUsage);
  }, [onTripsCleared]);

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const metas = await listTrips();
      if (metas.length === 0) {
        setToast('No trips to export');
        return;
      }
      for (const meta of metas) {
        const trip = await getTrip(meta.id);
        if (trip) downloadTripJSON(trip);
      }
      setToast(`Exported ${metas.length} trips`);
    } catch (e) {
      setToast('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsImporting(true);
    let successCount = 0;
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const text = await file.text();
        const trip = parseTripJSON(text);
        await saveTrip(trip);
        successCount++;
      }
      setToast(`Successfully imported ${successCount} trip(s)`);
      onTripsCleared(); // Refresh history
      estimateStorageUsage().then(setStorageUsage);
    } catch (err: any) {
      setToast(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="page page--settings">
      <header className="page__header">
        <h1 className="page__title">SETTINGS</h1>
      </header>

      <section className="settings-section">
        <h2 className="settings-section__title">SPEED UNIT</h2>
        <UnitSelector unit={unit} onChange={onUnitChange} />
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">DATA MANAGEMENT</h2>
        <div className="settings-list">
          <button type="button" className="settings-list__item" onClick={handleExportAll} disabled={isExporting}>
            <span className="settings-list__label">{isExporting ? 'Exporting...' : 'Export All Trips (JSON)'}</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          
          <button type="button" className="settings-list__item" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <span className="settings-list__label">{isImporting ? 'Importing...' : 'Import Trips (JSON)'}</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept=".json" 
            multiple 
            onChange={handleFileChange} 
          />
          
          <button type="button" className="settings-list__item settings-list__item--danger" onClick={() => setShowClear(true)}>
            <span className="settings-list__label">Clear All Trips</span>
          </button>
          
          {storageUsage !== null && (
            <div className="settings-list__info">
              Storage Used: ~{formatBytes(storageUsage)}
            </div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">ABOUT</h2>
        <div className="settings-about">
          <p>
            <strong>Privacy:</strong> Your trip data is stored locally on this device. 
            No coordinates are ever sent to a server.
          </p>
          <p>
            <strong>GPS Disclaimer:</strong> GPS speed is an estimate — its quality depends on signal accuracy.
            Background tracking is limited by mobile browsers.
          </p>
          <p className="muted" style={{ marginTop: 12 }}>Version 2.0.0</p>
        </div>
      </section>

      {showClear && (
        <ConfirmDialog
          title="Delete all recorded trips?"
          message="This will permanently remove all locally stored GPS data."
          confirmLabel="DELETE ALL"
          variant="danger"
          onConfirm={handleClear}
          onCancel={() => setShowClear(false)}
        />
      )}
      
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
