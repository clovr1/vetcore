import { 
  seedDatabaseIfEmpty, 
  subscribePatients, 
  subscribeMedicalRecords, 
  addMedicalRecord, 
  deleteMedicalRecord,
  escapeHtml,
  MedicalRecord, 
  Patient 
} from './firebase';
import { initSidebarProfile } from './auth';

let allPatients: Patient[] = [];
let allRecords: MedicalRecord[] = [];
let selectedMrn: string = 'ALL';
let currentPage = 1;
const pageSize = 10;

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarProfile();
  await seedDatabaseIfEmpty();

  // Subscribe to patients strictly from Firebase
  subscribePatients((patients) => {
    // Sort patients consistently by code
    allPatients = patients.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    populatePatientDropdown(allPatients);
    renderPatientListTable();
    updateTotalRecordsStat();
  });

  // Subscribe to medical records strictly from Firebase
  subscribeMedicalRecords((records) => {
    allRecords = records;
    renderRecords();
    updateTotalRecordsStat();
  });

  // Search input on Patient List Table
  const patientListSearchInput = document.getElementById('patientListSearch') as HTMLInputElement | null;
  if (patientListSearchInput) {
    patientListSearchInput.addEventListener('input', () => {
      currentPage = 1;
      renderPatientListTable();
    });
  }

  // Filter listener on Detailed View
  const mrnSelect = document.getElementById('patientMrnSelect') as HTMLSelectElement | null;
  if (mrnSelect) {
    mrnSelect.addEventListener('change', () => {
      selectedMrn = mrnSelect.value;
      renderRecords();
    });
  }

  // Search input on Detailed Records View
  const searchInput = document.getElementById('recordSearchInput') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderRecords();
    });
  }

  // Handle Form Submit for New Record
  const newRecordForm = document.getElementById('newRecordForm') as HTMLFormElement | null;
  if (newRecordForm) {
    newRecordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveRecord();
    });
  }

  // Check URL query params for direct patient record viewing
  const urlParams = new URLSearchParams(window.location.search);
  const patientCodeParam = urlParams.get('patient') || urlParams.get('mrn');
  if (patientCodeParam) {
    viewPatientMedicalRecord(patientCodeParam);
  }
});

function getSpeciesBadge(species: string) {
  const s = (species || '').toLowerCase();
  if (s.includes('canine') || s.includes('anjing') || s.includes('dog')) {
    return {
      pillClass: 'bg-blue-100 text-blue-700 font-semibold',
      iconBg: 'bg-teal-50 text-teal-800 border border-teal-200/80',
      label: 'Canine'
    };
  } else if (s.includes('feline') || s.includes('kucing') || s.includes('cat')) {
    return {
      pillClass: 'bg-purple-100 text-purple-700 font-semibold',
      iconBg: 'bg-purple-50 text-purple-800 border border-purple-200/80',
      label: 'Feline'
    };
  } else if (s.includes('rabbit') || s.includes('kelinci')) {
    return {
      pillClass: 'bg-amber-100 text-amber-700 font-semibold',
      iconBg: 'bg-amber-50 text-amber-800 border border-amber-200/80',
      label: 'Rabbit'
    };
  } else {
    return {
      pillClass: 'bg-emerald-100 text-emerald-700 font-semibold',
      iconBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
      label: species || 'Exotic'
    };
  }
}

function renderPatientListTable() {
  const tbody = document.getElementById('patientListTableBody');
  if (!tbody) return;

  const searchInput = document.getElementById('patientListSearch') as HTMLInputElement | null;
  const query = (searchInput?.value || '').toLowerCase();

  const filtered = allPatients.filter(p => {
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      (p.code || '').toLowerCase().includes(query) ||
      (p.species || '').toLowerCase().includes(query) ||
      (p.breed || '').toLowerCase().includes(query) ||
      (p.owner_name || '').toLowerCase().includes(query)
    );
  });

  const totalFiltered = filtered.length;
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalFiltered);
  const pageItems = filtered.slice(startIdx, endIdx);

  const showingText = document.getElementById('patientListShowingText');
  if (showingText) {
    if (totalFiltered === 0) {
      showingText.textContent = `Showing 0 to 0 of 0 entries`;
    } else {
      showingText.textContent = `Showing ${(startIdx + 1).toLocaleString()} to ${endIdx.toLocaleString()} of ${totalFiltered.toLocaleString()} entries`;
    }
  }

  // Render Pagination Controls
  const paginationControls = document.getElementById('patientListPaginationControls');
  if (paginationControls) {
    if (totalFiltered === 0) {
      paginationControls.innerHTML = '';
    } else {
      let pageBtnsHtml = '';

      // Prev Button
      pageBtnsHtml += `
        <button 
          ${currentPage === 1 ? 'disabled' : ''} 
          onclick="changeReportPage(${currentPage - 1})"
          class="bg-white border border-slate-200 text-slate-600 font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors">
          Prev
        </button>
      `;

      // Page numbers (smart range around currentPage)
      const maxButtons = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
      let endPage = Math.min(totalPages, startPage + maxButtons - 1);
      if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
      }

      if (startPage > 1) {
        pageBtnsHtml += `<button onclick="changeReportPage(1)" class="bg-white border border-slate-200 text-slate-600 font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50">1</button>`;
        if (startPage > 2) {
          pageBtnsHtml += `<span class="px-1 text-slate-400 text-xs font-bold">...</span>`;
        }
      }

      for (let p = startPage; p <= endPage; p++) {
        if (p === currentPage) {
          pageBtnsHtml += `<button class="bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-2xs">${p}</button>`;
        } else {
          pageBtnsHtml += `<button onclick="changeReportPage(${p})" class="bg-white border border-slate-200 text-slate-600 font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50 transition-colors">${p}</button>`;
        }
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pageBtnsHtml += `<span class="px-1 text-slate-400 text-xs font-bold">...</span>`;
        }
        pageBtnsHtml += `<button onclick="changeReportPage(${totalPages})" class="bg-white border border-slate-200 text-slate-600 font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50">${totalPages}</button>`;
      }

      // Next Button
      pageBtnsHtml += `
        <button 
          ${currentPage === totalPages ? 'disabled' : ''} 
          onclick="changeReportPage(${currentPage + 1})"
          class="bg-white border border-slate-200 text-slate-600 font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors">
          Next
        </button>
      `;

      paginationControls.innerHTML = pageBtnsHtml;
    }
  }

  if (totalFiltered === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-12 text-center text-slate-400">
          <i data-lucide="folder-open" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
          <p class="text-xs font-semibold text-slate-600">Tidak ada pasien ditemukan</p>
          <p class="text-[11px] text-slate-400 mt-1">Coba kata kunci pencarian yang berbeda.</p>
        </td>
      </tr>
    `;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  const rowsHtml = pageItems.map(p => {
    const badge = getSpeciesBadge(p.species);
    const codeDisplay = p.code || `#PT-${p.id || '1000'}`;

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <!-- PATIENT -->
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl ${badge.iconBg} flex items-center justify-center shrink-0">
              <i data-lucide="paw-print" class="w-4 h-4"></i>
            </div>
            <div>
              <div class="font-bold text-xs text-slate-900">${escapeHtml(p.name)}</div>
              <div class="text-[11px] font-mono text-slate-400 mt-0.5">${escapeHtml(codeDisplay)}</div>
            </div>
          </div>
        </td>

        <!-- SPECIES / BREED -->
        <td class="px-6 py-4">
          <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] ${badge.pillClass}">
            ${badge.label}
          </span>
          <div class="text-xs text-slate-500 mt-1">${escapeHtml(p.breed || '-')}</div>
        </td>

        <!-- OWNER -->
        <td class="px-6 py-4 text-xs font-semibold text-slate-700">
          ${escapeHtml(p.owner_name)}
        </td>

        <!-- LAST VISIT -->
        <td class="px-6 py-4 text-xs text-slate-600 font-medium">
          ${escapeHtml(p.last_visit || 'Hari ini')}
        </td>

        <!-- ACTION -->
        <td class="px-6 py-4 text-right">
          <button onclick="viewPatientMedicalRecord('${escapeHtml(codeDisplay)}')" class="text-xs font-bold text-slate-800 hover:text-vetgreen-800 transition-colors inline-flex items-center justify-end gap-1 ml-auto group">
            <span>View Record</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function viewPatientMedicalRecord(patientCode: string) {
  selectedMrn = patientCode;

  const listView = document.getElementById('patientListView');
  const detailView = document.getElementById('detailRecordView');

  listView?.classList.add('hidden');
  detailView?.classList.remove('hidden');

  // Update MRN dropdown selection
  const mrnSelect = document.getElementById('patientMrnSelect') as HTMLSelectElement | null;
  if (mrnSelect) {
    mrnSelect.value = patientCode;
  }

  // Update Patient Title in Header
  const targetPatient = allPatients.find(p => (p.code || `#PT-${p.id}`) === patientCode || p.id === patientCode);
  const titleEl = document.getElementById('selectedPatientTitle');
  const subtitleEl = document.getElementById('selectedPatientSubtitle');

  if (targetPatient) {
    if (titleEl) titleEl.textContent = `Rekam Medis: ${targetPatient.name} (${patientCode})`;
    if (subtitleEl) subtitleEl.textContent = `${targetPatient.species} - ${targetPatient.breed} | Pemilik: ${targetPatient.owner_name}`;
  } else {
    if (titleEl) titleEl.textContent = `Rekam Medis: ${patientCode}`;
    if (subtitleEl) subtitleEl.textContent = `Catatan riwayat pemeriksaan klinis, diagnosa, dan pengobatan pasien.`;
  }

  renderRecords();
}

function backToPatientList() {
  selectedMrn = 'ALL';
  const listView = document.getElementById('patientListView');
  const detailView = document.getElementById('detailRecordView');

  detailView?.classList.add('hidden');
  listView?.classList.remove('hidden');

  renderPatientListTable();
}

function updateTotalRecordsStat() {
  const statTotal = document.getElementById('statTotalRecords');
  const statPending = document.getElementById('statPendingReview');
  const statLabs = document.getElementById('statRecentLabs');

  if (statTotal) {
    statTotal.textContent = allRecords.length.toLocaleString();
  }
  if (statPending) {
    statPending.textContent = '0';
  }
  if (statLabs) {
    statLabs.textContent = '0';
  }
}

function populatePatientDropdown(patients: Patient[]) {
  const select = document.getElementById('patientMrnSelect') as HTMLSelectElement | null;
  const modalSelect = document.getElementById('modalPatientSelect') as HTMLSelectElement | null;

  if (select) {
    const currentVal = select.value;
    select.innerHTML = `
      <option value="ALL">Semua Pasien / MRN</option>
      ${patients.map(p => {
        const code = p.code || `#PT-${p.id}`;
        return `<option value="${escapeHtml(code)}">MRN: ${escapeHtml(code)} (${escapeHtml(p.name)})</option>`;
      }).join('')}
    `;
    select.value = currentVal || selectedMrn || 'ALL';
  }

  if (modalSelect) {
    if (patients.length === 0) {
      modalSelect.innerHTML = `
        <option value="" disabled selected>-- Pilih Pasien --</option>
        <option value="VET-2026-001" data-name="Umum / Pasien Baru">Pasien Umum / Baru (MRN: VET-2026-001)</option>
      `;
    } else {
      modalSelect.innerHTML = `
        <option value="" disabled selected>-- Pilih Pasien --</option>
        ${patients.map(p => {
          const code = p.code || `#PT-${p.id}`;
          return `
            <option value="${escapeHtml(code)}" data-name="${escapeHtml(p.name)}" data-id="${escapeHtml(p.id || '')}">
              ${escapeHtml(p.name)} (${escapeHtml(code)}) - ${escapeHtml(p.species)}
            </option>
          `;
        }).join('')}
      `;
    }
  }
}

function renderRecords() {
  const container = document.getElementById('recordsTableBody');
  if (!container) return;

  const searchInput = document.getElementById('recordSearchInput') as HTMLInputElement | null;
  const query = (searchInput?.value || '').toLowerCase();

  let filtered = allRecords.filter(rec => {
    const mrnMatch = selectedMrn === 'ALL' || rec.mrn === selectedMrn || (rec.mrn || '').includes(selectedMrn);
    const queryMatch = !query || 
      rec.subjective.toLowerCase().includes(query) || 
      rec.objective.toLowerCase().includes(query) || 
      rec.diagnosis.some(d => d.toLowerCase().includes(query)) ||
      rec.treatments.some(t => t.toLowerCase().includes(query)) ||
      rec.doctor_name.toLowerCase().includes(query) ||
      rec.notes.toLowerCase().includes(query);

    return mrnMatch && queryMatch;
  });

  // Update header MRN display label
  const mrnHeaderLabel = document.getElementById('currentMrnDisplay');
  if (mrnHeaderLabel) {
    if (selectedMrn !== 'ALL') {
      mrnHeaderLabel.textContent = `MRN: ${selectedMrn}`;
    } else {
      mrnHeaderLabel.textContent = `SEMUA PASIEN`;
    }
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="py-12 text-center text-slate-400 bg-slate-50/50">
          <div class="space-y-2">
            <i data-lucide="file-x" class="w-8 h-8 mx-auto text-slate-300"></i>
            <p class="text-xs font-semibold text-slate-600">Tidak ada rekam medis ditemukan</p>
            <p class="text-[11px] text-slate-400">Silakan klik "+ Rekam Medis" di atas untuk menambah rekam medis baru.</p>
          </div>
        </td>
      </tr>
    `;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  const rowsHtml = filtered.map(rec => {
    // Diagnosis pill badges
    const diagnosisBadges = (rec.diagnosis || []).map(d => `
      <span class="inline-block bg-slate-100 text-slate-700 border border-slate-200/80 px-2.5 py-1 rounded-md text-[11px] font-medium leading-tight">
        ${escapeHtml(d)}
      </span>
    `).join(' ');

    // Treatment bullet list
    const treatmentsList = (rec.treatments || []).map(t => `
      <li class="flex items-start gap-1.5 text-xs text-slate-700 leading-snug">
        <span class="text-slate-400 text-base leading-none select-none">•</span>
        <span>${escapeHtml(t)}</span>
      </li>
    `).join('');

    // Doctor Initials avatar
    const doctorInitials = rec.doctor_initials || getInitials(rec.doctor_name);

    return `
      <tr class="hover:bg-slate-50/70 transition-colors group">
        <!-- Tanggal Berobat (Date) -->
        <td class="px-5 py-4 align-top border-r border-slate-200/70 w-32 shrink-0">
          <div class="font-bold text-xs text-slate-900 leading-tight">${escapeHtml(rec.date)}</div>
          <div class="text-[11px] text-slate-400 font-mono mt-1">${escapeHtml(rec.time || '')}</div>
        </td>

        <!-- Anamnesa (Findings) -->
        <td class="px-5 py-4 align-top border-r border-slate-200/70 space-y-2">
          ${rec.subjective ? `
            <div class="text-xs text-slate-800 leading-relaxed">
              <strong class="font-bold text-slate-900">S:</strong> ${escapeHtml(rec.subjective)}
            </div>
          ` : ''}
          ${rec.objective ? `
            <div class="text-xs text-slate-800 leading-relaxed">
              <strong class="font-bold text-slate-900">O:</strong> ${escapeHtml(rec.objective)}
            </div>
          ` : ''}
        </td>

        <!-- Diagnosa (Diagnosis) -->
        <td class="px-5 py-4 align-top border-r border-slate-200/70 w-44 shrink-0 space-y-1.5">
          ${diagnosisBadges || '<span class="text-xs text-slate-400">-</span>'}
        </td>

        <!-- Pengobatan (Treatment) -->
        <td class="px-5 py-4 align-top border-r border-slate-200/70">
          <ul class="space-y-1.5">
            ${treatmentsList || '<span class="text-xs text-slate-400">-</span>'}
          </ul>
        </td>

        <!-- Catatan (Notes) -->
        <td class="px-5 py-4 align-top space-y-2 relative">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-[#044e3a] text-white flex items-center justify-center text-[10px] font-bold shrink-0 shadow-2xs">
              ${escapeHtml(doctorInitials)}
            </span>
            <span class="text-xs font-semibold text-slate-800 truncate">${escapeHtml(rec.doctor_name)}</span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(rec.notes || '-')}</p>

          <div class="pt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 text-[11px]">
            <button onclick="deleteRecordItem('${escapeHtml(rec.id)}')" class="text-slate-400 hover:text-rose-600 p-1 transition-colors" title="Hapus Rekam Medis">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = rowsHtml;
  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function getInitials(name: string): string {
  if (!name) return 'DR';
  const parts = name.replace(/^Dr\.\s*/i, '').trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function openNewRecordModal() {
  const modal = document.getElementById('newRecordModal');
  modal?.classList.remove('hidden');
}

function closeNewRecordModal() {
  const modal = document.getElementById('newRecordModal');
  modal?.classList.add('hidden');
}

async function handleSaveRecord() {
  const modalSelect = document.getElementById('modalPatientSelect') as HTMLSelectElement | null;
  const dateInput = document.getElementById('recordDateInput') as HTMLInputElement | null;
  const timeInput = document.getElementById('recordTimeInput') as HTMLInputElement | null;
  const subjInput = document.getElementById('recordSubjInput') as HTMLTextAreaElement | null;
  const objInput = document.getElementById('recordObjInput') as HTMLTextAreaElement | null;
  const diagInput = document.getElementById('recordDiagInput') as HTMLInputElement | null;
  const treatInput = document.getElementById('recordTreatInput') as HTMLTextAreaElement | null;
  const docSelect = document.getElementById('recordDoctorSelect') as HTMLSelectElement | null;
  const notesInput = document.getElementById('recordNotesInput') as HTMLTextAreaElement | null;
  const submitBtn = document.getElementById('saveRecordBtn') as HTMLButtonElement | null;

  if (!modalSelect || !subjInput || !diagInput) return;

  const selectedOpt = modalSelect.options[modalSelect.selectedIndex];
  const mrnCode = modalSelect.value || 'VET-2023-8842';
  const patientName = selectedOpt?.getAttribute('data-name') || 'Buddy';

  // Format date e.g. "24 Oct 2023"
  const rawDate = dateInput?.value;
  let formattedDate = 'Hari ini';
  if (rawDate) {
    const d = new Date(rawDate);
    formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Format time e.g. "09:15 AM"
  let formattedTime = timeInput?.value || '09:00 AM';

  // Parse diagnoses comma-separated
  const rawDiag = diagInput.value.trim();
  const diagnosisList = rawDiag ? rawDiag.split(',').map(s => s.trim()).filter(Boolean) : ['Unspecified'];

  // Parse treatments line by line or comma
  const rawTreat = treatInput?.value.trim() || '';
  const treatmentsList = rawTreat ? rawTreat.split('\n').map(s => s.trim()).filter(Boolean) : [];

  const doctorName = docSelect?.value || 'Dr. Smith';
  const doctorInitials = getInitials(doctorName);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `⏳ Menyimpan...`;
  }

  try {
    await addMedicalRecord({
      mrn: mrnCode,
      patient_name: patientName,
      date: formattedDate,
      time: formattedTime,
      subjective: subjInput.value.trim(),
      objective: objInput?.value.trim() || '',
      diagnosis: diagnosisList,
      treatments: treatmentsList,
      doctor_name: doctorName,
      doctor_initials: doctorInitials,
      notes: notesInput?.value.trim() || ''
    });

    closeNewRecordModal();
    (document.getElementById('newRecordForm') as HTMLFormElement)?.reset();
  } catch (err) {
    console.error('Failed to save medical record:', err);
    alert('Gagal menyimpan rekam medis.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Simpan Rekam Medis`;
      if ((window as any).lucide) (window as any).lucide.createIcons();
    }
  }
}

(window as any).openNewRecordModal = openNewRecordModal;
(window as any).closeNewRecordModal = closeNewRecordModal;
(window as any).viewPatientMedicalRecord = viewPatientMedicalRecord;
(window as any).backToPatientList = backToPatientList;
(window as any).changeReportPage = (page: number) => {
  currentPage = page;
  renderPatientListTable();
};
(window as any).deleteRecordItem = async (id: string) => {
  if (confirm('Apakah Anda yakin ingin menghapus rekam medis ini?')) {
    try {
      await deleteMedicalRecord(id);
    } catch (err) {
      console.error('Failed to delete medical record:', err);
    }
  }
};
