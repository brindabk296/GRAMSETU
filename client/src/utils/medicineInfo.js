// General patient-friendly information for common medicines. It is only a fallback:
// anything the doctor wrote for a prescription (purpose / directions) always wins.
const CATALOG = {
  amlodipine: {
    purpose: 'Lowers high blood pressure and helps protect the heart.',
    instructions: 'Take once a day at the same time, usually in the morning. Do not stop it suddenly even if you feel well. Tell your doctor about ankle swelling or dizziness.'
  },
  metformin: {
    purpose: 'Controls blood sugar in type 2 diabetes.',
    instructions: 'Take with or right after meals to avoid stomach upset. Do not skip meals. Tell your doctor if you have persistent vomiting or diarrhoea.'
  },
  glimepiride: {
    purpose: 'Helps the body release insulin to lower blood sugar in type 2 diabetes.',
    instructions: 'Take with or just before breakfast. Do not skip meals. Keep a sweet with you in case of shakiness, sweating or sudden weakness (low sugar).'
  },
  glibenclamide: {
    purpose: 'Lowers blood sugar in type 2 diabetes.',
    instructions: 'Take with or just before food. Do not skip meals. Keep a sweet with you in case of shakiness, sweating or sudden weakness (low sugar).'
  },
  atenolol: {
    purpose: 'Lowers blood pressure and slows the heart rate.',
    instructions: 'Take once a day at the same time. Do not stop it suddenly. Tell your doctor if you feel very tired, dizzy or your pulse is very slow.'
  },
  losartan: {
    purpose: 'Lowers high blood pressure and protects the kidneys in diabetes.',
    instructions: 'Take once a day at the same time. Tell your doctor if you feel faint, or before taking any new medicine.'
  },
  telmisartan: {
    purpose: 'Lowers high blood pressure.',
    instructions: 'Take once a day at the same time, with or without food. Tell your doctor if you feel faint or dizzy.'
  },
  enalapril: {
    purpose: 'Lowers high blood pressure and protects the heart.',
    instructions: 'Take once or twice a day as prescribed. Tell your doctor if you develop a dry cough or swelling of the face or lips.'
  },
  hydrochlorothiazide: {
    purpose: 'A water tablet that lowers blood pressure.',
    instructions: 'Take in the morning so you are not up at night passing urine. Drink water normally unless your doctor says otherwise.'
  },
  atorvastatin: {
    purpose: 'Lowers cholesterol to reduce the risk of heart attack and stroke.',
    instructions: 'Take once a day, usually in the evening. Tell your doctor about unexplained muscle pain.'
  },
  aspirin: {
    purpose: 'Helps prevent blood clots.',
    instructions: 'Take after food. Tell your doctor if you notice black stools or unusual bleeding.'
  },
  paracetamol: {
    purpose: 'Relieves mild pain and fever.',
    instructions: 'Take only as prescribed and do not exceed the daily limit your doctor gave you.'
  }
};

const normalise = (name) => String(name || '').toLowerCase().replace(/[^a-z]/g, ' ').trim();

export const getMedicineInfo = (name) => {
  const words = normalise(name).split(/\s+/);
  const key = Object.keys(CATALOG).find(medicine => words.includes(medicine));
  return key ? CATALOG[key] : null;
};

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Merge the patient's active medicine list with prescriptions from consultation visits
// (newest visit first) so every medicine shows its dose, schedule, purpose and directions.
export const buildMedicineList = (currentMedications = [], visits = []) => {
  const byName = new Map();
  const upsert = (entry) => {
    const name = text(entry.medicine);
    if (!name) return;
    const key = normalise(name);
    const existing = byName.get(key) || {};
    const merged = { ...existing };
    for (const field of ['medicine', 'dosage', 'frequency', 'purpose', 'instructions']) {
      if (!text(merged[field]) && text(entry[field])) merged[field] = text(entry[field]);
    }
    byName.set(key, merged);
  };

  const sortedVisits = [...visits].sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const visit of sortedVisits) {
    for (const prescription of visit.prescriptions || []) upsert(prescription);
  }
  for (const medicine of currentMedications) {
    upsert({
      medicine: medicine.name,
      dosage: medicine.dosage,
      frequency: medicine.frequency,
      purpose: medicine.purpose,
      instructions: medicine.instructions
    });
  }

  return Array.from(byName.values()).map(entry => {
    const info = getMedicineInfo(entry.medicine);
    return {
      ...entry,
      purpose: entry.purpose || info?.purpose || '',
      instructions: entry.instructions || info?.instructions || ''
    };
  });
};
