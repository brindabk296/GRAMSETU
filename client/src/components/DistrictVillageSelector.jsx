import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function DistrictVillageSelector({
  selectedDistrict,
  onDistrictChange,
  selectedVillage,
  onVillageChange,
  onVillageCodeChange,
  allowAll = false,
  allLabel = 'All Villages',
  disabled = false,
  preserveSavedVillage = false,
  className = ''
}) {
  const { t } = useLanguage();
  const [districts, setDistricts] = useState([]);
  const [allDistricts, setAllDistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [locationError, setLocationError] = useState('');
  // The district the form opened with; a saved village outside the census list is only kept for this district.
  const initialDistrict = useRef(selectedDistrict);

  // Load the bundled directory once so location selection also works offline.
  useEffect(() => {
    fetch('/locations/jharkhandCensus2011.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load the Jharkhand village directory.');
        return res.json();
      })
      .then(data => {
        const districtList = data.districts || [];
        setAllDistricts(districtList);
        setDistricts(districtList.map(district => ({
          id: district.districtId,
          name: district.districtName,
          villageCount: district.villages.length
        })));
        if (!selectedDistrict && districtList.length > 0 && !allowAll) {
          onDistrictChange(districtList[0].districtId);
        }
      })
      .catch(err => {
        console.error('Failed to load districts:', err);
        setLocationError(err.message);
      });
  }, []);

  // When the district changes, use the matching district's bundled villages.
  useEffect(() => {
    if (!selectedDistrict || selectedDistrict === 'all') {
      setVillages([]);
      if (selectedDistrict === 'all') onVillageCodeChange?.('');
      if (allowAll) {
        onVillageChange('all');
      }
      return;
    }

    if (allDistricts.length === 0) return;
    setLoadingVillages(true);
    const districtData = allDistricts.find(district =>
      district.districtId.toLowerCase() === String(selectedDistrict).toLowerCase() ||
      district.districtName.toLowerCase() === String(selectedDistrict).toLowerCase()
    );
    if (districtData && districtData.districtId !== selectedDistrict) {
      onDistrictChange(districtData.districtId);
    }
    const data = districtData?.villages || [];
    setVillages(data);
    setLoadingVillages(false);
    if (allowAll) {
      const exists = data.some(village => village.name.toLowerCase() === (selectedVillage || '').toLowerCase());
      if (!exists && selectedVillage !== 'all') onVillageChange('all');
      else if (selectedVillage !== 'all') {
        onVillageCodeChange?.(data.find(village => village.name.toLowerCase() === selectedVillage.toLowerCase())?.villageCode || '');
      }
    } else if (data.length > 0) {
      const exists = data.some(village => village.name.toLowerCase() === (selectedVillage || '').toLowerCase());
      if (!exists && preserveSavedVillage && selectedVillage && selectedDistrict === initialDistrict.current) {
        // Existing record whose village is not in the census list: keep it as-is.
        return;
      }
      if (!exists) {
        onVillageChange(data[0].name);
        onVillageCodeChange?.(data[0].villageCode);
      } else {
        onVillageCodeChange?.(data.find(village => village.name.toLowerCase() === selectedVillage.toLowerCase())?.villageCode || '');
      }
    }
  }, [selectedDistrict, allDistricts]);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${className}`}>
      {/* District Dropdown */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('selectDistrictLabel')}</span>
        </label>
        <select
          value={selectedDistrict || ''}
          onChange={(e) => onDistrictChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
        >
          {allowAll && <option value="all">All Districts</option>}
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.villageCount} Villages)
            </option>
          ))}
        </select>
      </div>

      {/* Village Dropdown (Cascaded automatically) */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('selectVillageLabel')}</span>
          {loadingVillages && <span className="text-[10px] text-emerald-600 animate-pulse ml-1">({t('loading')})</span>}
        </label>
        <select
          value={selectedVillage || ''}
          onChange={(e) => {
            const village = villages.find(item => item.name === e.target.value);
            onVillageChange(e.target.value);
            onVillageCodeChange?.(village?.villageCode || '');
          }}
          disabled={disabled || loadingVillages || (selectedDistrict === 'all' && !allowAll)}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm disabled:bg-slate-100 disabled:text-slate-400"
        >
          {allowAll && <option value="all">{allLabel}</option>}
          {preserveSavedVillage && selectedVillage && selectedVillage !== 'all' && villages.length > 0 &&
            !villages.some(v => v.name.toLowerCase() === selectedVillage.toLowerCase()) && (
            <option value={selectedVillage}>{selectedVillage} (saved village)</option>
          )}
          {villages.map((v) => (
            <option key={v.villageCode} value={v.name}>
              {v.name} ({v.villageCode}) — {v.subdistrictName}
            </option>
          ))}
          {villages.length === 0 && !allowAll && (
            <option disabled value="">{locationError || 'No villages available'}</option>
          )}
        </select>
      </div>
    </div>
  );
}
