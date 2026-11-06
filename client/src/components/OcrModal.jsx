import React, { useState } from 'react';
import { Camera, FileText, CheckCircle2, AlertCircle, X, UploadCloud, RefreshCw } from 'lucide-react';

export default function OcrModal({ isOpen, onClose, onConfirmValues }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setExtractedData(null);
    }
  };

  const handleExtract = async () => {
    setExtracting(true);
    const token = localStorage.getItem('careroute_token');

    const formData = new FormData();
    if (file) {
      formData.append('reportImage', file);
    }

    try {
      const res = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      setExtractedData(data);
    } catch (err) {
      console.error('OCR Extraction error:', err);
    } finally {
      setExtracting(false);
    }
  };

  const handleFieldChange = (idx, newValue) => {
    if (!extractedData) return;
    const updated = { ...extractedData };
    updated.extractedFields[idx].extractedValue = Number(newValue) || newValue;
    setExtractedData(updated);
  };

  const handleSaveToRecord = () => {
    if (extractedData && onConfirmValues) {
      const valuesMap = {};
      extractedData.extractedFields.forEach(f => {
        valuesMap[f.type] = f.extractedValue;
      });
      onConfirmValues(valuesMap);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Lab Report & Paper Record OCR Intake
              </h3>
              <p className="text-xs text-slate-500">
                Blueprint M10: Confirm-before-save plausibility verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {!extractedData ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-emerald-500 transition-colors">
                <input
                  type="file"
                  id="ocrFileInput"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="ocrFileInput"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <UploadCloud className="w-12 h-12 text-slate-400 mb-2" />
                  <span className="text-sm font-semibold text-slate-700">
                    {file ? file.name : 'Upload Rural Health Lab Slip / Prescription Photo'}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    Supports JPG, PNG, PDF snapshots from mobile camera
                  </span>
                </label>
              </div>

              {previewUrl && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={previewUrl} alt="preview" className="w-14 h-14 object-cover rounded border" />
                    <div>
                      <div className="text-xs font-bold text-slate-700">{file?.name}</div>
                      <div className="text-[11px] text-slate-400">Ready for automated character extraction</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleExtract}
                disabled={extracting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
              >
                {extracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Document Text & OCR Plausibility...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Run OCR Extraction (Auto-Triage)</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">Extraction Successful — Confirm Before Save</div>
                  <div className="text-emerald-700 text-[11px] mt-0.5">
                    Medical Safety Protocol: Please inspect and confirm the extracted vital values against the paper record below.
                  </div>
                </div>
              </div>

              {/* Editable Fields Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="bg-slate-50 px-4 py-2 grid grid-cols-12 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="col-span-5">Clinical Field</span>
                  <span className="col-span-4">Extracted Value</span>
                  <span className="col-span-3 text-right">Confidence</span>
                </div>
                {extractedData.extractedFields.map((field, idx) => (
                  <div key={idx} className="p-3 grid grid-cols-12 items-center gap-2 text-xs">
                    <div className="col-span-5">
                      <div className="font-bold text-slate-800">{field.name}</div>
                      <div className="text-[10px] text-slate-400">Normal: {field.normalRange}</div>
                    </div>
                    <div className="col-span-4 flex items-center gap-1.5">
                      <input
                        type="number"
                        value={field.extractedValue}
                        onChange={(e) => handleFieldChange(idx, e.target.value)}
                        className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-800 text-sm focus:ring-1 focus:ring-emerald-500"
                      />
                      <span className="text-slate-500 font-medium">{field.unit}</span>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px]">
                        {Math.round(field.confidence * 100)}% match
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Raw text snippet */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Raw OCR Extract</span>
                <pre className="text-[11px] font-mono text-slate-600 mt-1 whitespace-pre-wrap">
                  {extractedData.ocrRawText}
                </pre>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setExtractedData(null)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Re-upload / Scan Another
                </button>
                <button
                  type="button"
                  onClick={handleSaveToRecord}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Populate Consultation Form</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
