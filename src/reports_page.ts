import {
  seedDatabaseIfEmpty,
  subscribePatients,
  subscribeMedicalRecords,
  addMedicalRecord,
  escapeHtml,
  Patient,
  MedicalRecord
} from './firebase';
import { initSidebarProfile, getCurrentUser } from './auth';

let allPatients: Patient[] = [];
let allMedicalRecords: MedicalRecord[] = [];
let selectedOwner: string = '';
let selectedPatientId: string = '';
let isDoctor: boolean = false;

interface OwnerGroup {
  owner_name: string;
  phone: string;
  address: string;
  pets: Patient[];
}

function getOwnerGroups(): OwnerGroup[] {
  const map = new Map<string, OwnerGroup>();
  for (const p of allPatients) {
    const key = (p.owner_name || '').toLowerCase().trim();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        owner_name: p.owner_name,
        phone: p.phone || '-',
        address: p.address || '-',
        pets: []
      });
    }
    map.get(key)!.pets.push(p);
  }
  return Array.from(map.values()).sort((a, b) => a.owner_name.localeCompare(b.owner_name));
}

function getSpeciesEmoji(species: string): string {
  const s = (species || '').toLowerCase();
  if (s.includes('canine') || s.includes('anjing') || s.includes('dog')) return 'Dog';
  if (s.includes('feline') || s.includes('kucing') || s.includes('cat')) return 'Cat';
  if (s.includes('rabbit') || s.includes('kelinci')) return 'Rabbit';
  return 'Pet';
}

function getSpeciesBadge(species: string): string {
  const s = (species || '').toLowerCase();
  if (s.includes('canine') || s.includes('anjing') || s.includes('dog')) return 'badge-blue';
  if (s.includes('feline') || s.includes('kucing') || s.includes('cat')) return 'badge-purple';
  if (s.includes('rabbit') || s.includes('kelinci')) return 'badge-amber';
  return 'badge-emerald';
}

function getInitials(name: string): string {
  if (!name) return 'DR';
  const parts = name.replace(/^Dr\.\s*/i, '').trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getStatusBadge(status: string): { cls: string; label: string } {
  const s = (status || '').toLowerCase();
  if (s.includes('sehat') || s.includes('sembuh')) return { cls: 'badge-emerald', label: 'Sehat' };
  if (s.includes('perawatan') || s.includes('pemulihan')) return { cls: 'badge-amber', label: 'Perawatan' };
  if (s.includes('menunggu')) return { cls: 'badge-blue', label: 'Menunggu' };
  return { cls: 'badge-slate', label: status || '-' };
}

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarProfile();
  const user = getCurrentUser();
  isDoctor = user.role === 'doctor';
  await seedDatabaseIfEmpty();

  subscribePatients((patients) => {
    allPatients = patients;
    renderOwnerList();
  });

  subscribeMedicalRecords((records) => {
    allMedicalRecords = records;
    renderOwnerList();
    if (selectedPatientId) renderPetRecord();
  });

  const searchInput = document.getElementById('ownerSearchInput') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener('input', () => renderOwnerList());
  }

  const addRecordForm = document.getElementById('addRecordForm') as HTMLFormElement | null;
  if (addRecordForm) {
    addRecordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveRecord();
    });
  }
});

function renderOwnerList() {
  const container = document.getElementById('ownerListContainer');
  if (!container) return;

  const searchInput = document.getElementById('ownerSearchInput') as HTMLInputElement | null;
  const query = (searchInput?.value || '').toLowerCase();

  let groups = getOwnerGroups();

  if (!isDoctor) {
    const petIdsWithRecords = new Set(allMedicalRecords.map(r => r.patient_id));
    groups = groups.map(g => ({
      ...g,
      pets: g.pets.filter(p => petIdsWithRecords.has(p.id || ''))
    })).filter(g => g.pets.length > 0);
  }

  const filteredGroups = groups.filter(g => {
    if (!query) return true;
    return g.owner_name.toLowerCase().includes(query) ||
      g.pets.some(p => p.name.toLowerCase().includes(query));
  });

  if (filteredGroups.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center text-slate-400">
        <i data-lucide="users" class="w-10 h-10 mx-auto text-slate-300 mb-3"></i>
        <p class="text-sm font-semibold text-slate-600">${!isDoctor ? 'Belum ada rekam medis dari dokter' : 'Tidak ada pemilik ditemukan'}</p>
        <p class="text-xs text-slate-400 mt-1">${!isDoctor ? 'Rekam medis akan muncul setelah dokter mencatat kunjungan.' : 'Belum ada data pasien terdaftar.'}</p>
      </div>`;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  container.innerHTML = filteredGroups.map(g => {
    const petCount = g.pets.length;
    const petListStr = g.pets.map(p => p.name).join(', ');
    return `
      <div onclick="selectOwner('${escapeHtml(g.owner_name)}')" class="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer group">
        <div class="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <i data-lucide="user" class="w-5 h-5 text-emerald-700"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm text-slate-900 group-hover:text-vetgreen-800 transition-colors">${escapeHtml(g.owner_name)}</div>
          <div class="text-[11px] text-slate-500 mt-0.5 truncate">${escapeHtml(g.phone)} &bull; ${escapeHtml(g.address)}</div>
        </div>
        <div class="text-right shrink-0">
          <span class="badge badge-emerald">${petCount} Hewan</span>
          <div class="text-[10px] text-slate-400 mt-1 truncate max-w-[160px]">${escapeHtml(petListStr)}</div>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors"></i>
      </div>`;
  }).join('');

  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function renderPetList() {
  const container = document.getElementById('petListContainer');
  if (!container) return;

  let pets = allPatients.filter(p => (p.owner_name || '').toLowerCase().trim() === selectedOwner.toLowerCase().trim());

  if (!isDoctor) {
    const petIdsWithRecords = new Set(allMedicalRecords.map(r => r.patient_id));
    pets = pets.filter(p => petIdsWithRecords.has(p.id || ''));
  }

  if (pets.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-12 text-center text-slate-400">
        <i data-lucide="paw-print" class="w-10 h-10 mx-auto text-slate-300 mb-3"></i>
        <p class="text-sm font-semibold text-slate-600">Tidak ada hewan ditemukan</p>
      </div>`;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  container.innerHTML = pets.map(p => {
    const emoji = getSpeciesEmoji(p.species);
    const badge = getSpeciesBadge(p.species);
    const status = getStatusBadge(p.status);
    const code = p.code || '#VET-000';
    return `
      <div onclick="selectPet('${escapeHtml(p.id || '')}')" class="card p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group">
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-slate-100 border border-emerald-200 flex items-center justify-center shrink-0">
            <span class="text-xl font-bold text-emerald-700">${emoji.charAt(0)}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-bold text-base text-slate-900 group-hover:text-vetgreen-800 transition-colors">${escapeHtml(p.name)}</h3>
              <span class="badge ${badge} text-[10px]">${escapeHtml(p.species)}</span>
            </div>
            <p class="text-xs text-slate-500">${escapeHtml(p.breed || '-')} &bull; ${escapeHtml(p.age || '-')} &bull; ${escapeHtml(p.gender || '-')}</p>
            <p class="text-[11px] text-slate-400 mt-1 font-mono">${escapeHtml(code)}</p>
            <div class="flex items-center gap-2 mt-2">
              <span class="badge ${status.cls} text-[10px]">${status.label}</span>
              <span class="text-[11px] text-slate-400">Dr: ${escapeHtml(p.doctor_name || '-')}</span>
            </div>
          </div>
          <i data-lucide="chevron-right" class="w-5 h-5 text-slate-300 group-hover:text-slate-500 shrink-0 mt-1 transition-colors"></i>
        </div>
      </div>`;
  }).join('');

  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function renderPetRecord() {
  const tbody = document.getElementById('recordTableBody');
  const mrnLabel = document.getElementById('recordMrnLabel');
  if (!tbody) return;

  const patient = allPatients.find(p => p.id === selectedPatientId);
  if (!patient) return;

  const code = patient.code || '#VET-000';
  if (mrnLabel) mrnLabel.textContent = `MRN: ${code}`;

  const patientRecords = allMedicalRecords.filter(r => r.patient_id === selectedPatientId)
    .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));

  if (patientRecords.length === 0) {
    if (isDoctor) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-10 text-center text-slate-400 bg-slate-50/30">
            <i data-lucide="file-x" class="w-7 h-7 mx-auto text-slate-300 mb-1.5"></i>
            <p class="text-xs font-semibold text-slate-500">Belum ada rekam medis</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Klik "Tambah Rekam Medis" untuk mencatat kunjungan.</p>
          </td>
        </tr>`;
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-10 text-center text-slate-400 bg-slate-50/30">
            <i data-lucide="info" class="w-7 h-7 mx-auto text-slate-300 mb-1.5"></i>
            <p class="text-xs font-semibold text-slate-500">Belum ada rekam medis dari dokter</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Rekam medis akan muncul setelah dokter mencatat dan mengirim ke Front Office.</p>
          </td>
        </tr>`;
    }
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  tbody.innerHTML = patientRecords.map(rec => {
    const doctorInitials = getInitials(rec.doctor_name || '');
    const diagnosisList = (rec.diagnosis || []).map(d => `<span class="inline-block bg-red-50 text-red-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-md mr-1 mb-0.5">${escapeHtml(d)}</span>`).join('');
    const treatmentsList = (rec.treatments || []).map(t => `<div class="text-[11px] text-slate-700 leading-relaxed">• ${escapeHtml(t)}</div>`).join('');
    const anamnesaHtml = rec.objective
      ? `<div class="text-[11px] text-slate-700 leading-relaxed"><span class="font-bold text-slate-800">S:</span> ${escapeHtml(rec.subjective)}</div><div class="text-[11px] text-slate-700 leading-relaxed mt-0.5"><span class="font-bold text-slate-800">O:</span> ${escapeHtml(rec.objective)}</div>`
      : `<div class="text-[11px] text-slate-700 leading-relaxed">${escapeHtml(rec.subjective)}</div>`;

    return `
      <tr class="hover:bg-slate-50/50 transition-colors">
        <td class="px-4 py-3 align-top">
          <div class="text-xs font-bold text-slate-900">${escapeHtml(rec.date || '-')}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(rec.time || '')}</div>
        </td>
        <td class="px-4 py-3 align-top">
          ${anamnesaHtml}
        </td>
        <td class="px-4 py-3 align-top">
          ${diagnosisList || '<span class="text-[11px] text-slate-300">-</span>'}
        </td>
        <td class="px-4 py-3 align-top">
          ${treatmentsList || '<span class="text-[11px] text-slate-300">-</span>'}
        </td>
        <td class="px-4 py-3 align-top">
          <div class="flex items-center gap-1.5">
            <span class="w-5 h-5 rounded-full bg-[#044e3a] text-white flex items-center justify-center text-[9px] font-bold shrink-0">${escapeHtml(doctorInitials)}</span>
            <span class="text-[11px] font-semibold text-slate-700">${escapeHtml(rec.doctor_name || '-')}</span>
          </div>
          ${rec.notes ? `<div class="text-[10px] text-slate-500 mt-1 italic">${escapeHtml(rec.notes)}</div>` : ''}
        </td>
      </tr>`;
  }).join('');

  if ((window as any).lucide) (window as any).lucide.createIcons();
}

(window as any).selectOwner = (ownerName: string) => {
  selectedOwner = ownerName;
  document.getElementById('ownerListView')?.classList.add('hidden');
  document.getElementById('petListView')?.classList.remove('hidden');
  document.getElementById('recordView')?.classList.add('hidden');

  const titleEl = document.getElementById('petListOwnerTitle');
  const subtitleEl = document.getElementById('petListOwnerSubtitle');
  if (titleEl) titleEl.textContent = `Hewan milik ${ownerName}`;
  const pets = allPatients.filter(p => (p.owner_name || '').toLowerCase().trim() === ownerName.toLowerCase().trim());
  if (subtitleEl) subtitleEl.textContent = `${pets.length} hewan terdaftar atas nama ${ownerName}`;

  renderPetList();
};

(window as any).selectPet = (patientId: string) => {
  selectedPatientId = patientId;
  document.getElementById('ownerListView')?.classList.add('hidden');
  document.getElementById('petListView')?.classList.add('hidden');
  document.getElementById('recordView')?.classList.remove('hidden');

  const addBtn = document.getElementById('addRecordBtn');
  if (addBtn) addBtn.classList.toggle('hidden', !isDoctor);

  const sendBtn = document.getElementById('sendToFOBtn');
  if (sendBtn) sendBtn.classList.toggle('hidden', !isDoctor);

  const patient = allPatients.find(p => p.id === patientId);
  const titleEl = document.getElementById('recordPetTitle');
  const subtitleEl = document.getElementById('recordPetSubtitle');
  if (patient) {
    if (titleEl) titleEl.textContent = `Rekam Medis: ${patient.name}`;
    if (subtitleEl) subtitleEl.textContent = `${patient.species} / ${patient.breed || '-'} &bull; Pemilik: ${patient.owner_name}`;
  }

  renderPetRecord();
};

(window as any).sendToFO = () => {
  const toast = document.getElementById('toastNotification');
  const toastText = document.getElementById('toastText');
  if (toast && toastText) {
    toastText.textContent = 'Rekam medis berhasil dikirim ke Front Office!';
    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none'); }, 2500);
  }
  setTimeout(() => { window.location.href = 'reports.html'; }, 1500);
};

(window as any).backToOwners = () => {
  selectedOwner = '';
  selectedPatientId = '';
  document.getElementById('ownerListView')?.classList.remove('hidden');
  document.getElementById('petListView')?.classList.add('hidden');
  document.getElementById('recordView')?.classList.add('hidden');
  renderOwnerList();
};

(window as any).backToPets = () => {
  selectedPatientId = '';
  document.getElementById('petListView')?.classList.remove('hidden');
  document.getElementById('recordView')?.classList.add('hidden');
  renderPetList();
};

(window as any).openAddRecordModal = () => {
  document.getElementById('addRecordModal')?.classList.remove('hidden');
  const dateInput = document.getElementById('recDate') as HTMLInputElement | null;
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
};

(window as any).closeAddRecordModal = () => {
  document.getElementById('addRecordModal')?.classList.add('hidden');
  (document.getElementById('addRecordForm') as HTMLFormElement)?.reset();
};

async function handleSaveRecord() {
  if (!selectedPatientId) return;
  const user = getCurrentUser();
  const patient = allPatients.find(p => p.id === selectedPatientId);
  if (!patient) return;

  const dateInput = document.getElementById('recDate') as HTMLInputElement | null;
  const doctorSelect = document.getElementById('recDoctor') as HTMLSelectElement | null;
  const subjInput = document.getElementById('recSubjective') as HTMLTextAreaElement | null;
  const objInput = document.getElementById('recObjective') as HTMLTextAreaElement | null;
  const diagInput = document.getElementById('recDiagnosis') as HTMLInputElement | null;
  const treatInput = document.getElementById('recTreatments') as HTMLTextAreaElement | null;
  const notesInput = document.getElementById('recNotes') as HTMLTextAreaElement | null;
  const saveBtn = document.getElementById('saveRecBtn') as HTMLButtonElement | null;

  if (!subjInput || !diagInput || !subjInput.value.trim() || !diagInput.value.trim()) {
    alert('Anamnesa (S) dan Diagnosa wajib diisi.');
    return;
  }

  if (dateInput?.value && new Date(dateInput.value) > new Date()) {
    alert('Tanggal pemeriksaan tidak boleh masa depan.');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Menyimpan...';
  }

  try {
    const rawDate = dateInput?.value;
    let formattedDate = 'Hari ini';
    if (rawDate) {
      const d = new Date(rawDate);
      formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    const diagnosisList = diagInput.value.trim().split(',').map(s => s.trim()).filter(Boolean);
    const treatmentsList = treatInput?.value.trim() ? treatInput.value.split('\n').map(s => s.trim()).filter(Boolean) : [];
    const doctorName = doctorSelect?.value || user.name;

    const getInitials = (name: string): string => {
      if (!name) return 'DR';
      const parts = name.replace(/^Dr\.\s*/i, '').trim().split(' ');
      if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
      return (parts[0][0] + parts[1][0]).toUpperCase();
    };

    await addMedicalRecord({
      mrn: patient.code || '#VET-000',
      patient_name: patient.name,
      patient_id: selectedPatientId,
      date: formattedDate,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      subjective: subjInput.value.trim(),
      objective: objInput?.value.trim() || '',
      diagnosis: diagnosisList,
      treatments: treatmentsList,
      doctor_name: doctorName,
      doctor_initials: getInitials(doctorName),
      notes: notesInput?.value.trim() || ''
    });

    (window as any).closeAddRecordModal();
  } catch (err) {
    console.error('Failed to save record:', err);
    alert('Gagal menyimpan rekam medis.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Simpan';
      if ((window as any).lucide) (window as any).lucide.createIcons();
    }
  }
}
