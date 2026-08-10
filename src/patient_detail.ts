import { 
  seedDatabaseIfEmpty, 
  getPatientById, 
  subscribePatients,
  subscribeClinicalNotes, 
  addClinicalNote, 
  subscribeMedications, 
  addMedication, 
  removeMedication,
  updatePatientVitals,
  updatePatientStatus,
  subscribePrescriptions,
  addPrescription,
  updatePrescriptionStatus,
  deletePrescription,
  subscribeVaccinations,
  addVaccination,
  deleteVaccination,
  autoSeedPatientRecordsIfEmpty,
  syncAndCleanupPatientMedications,
  recordRevisit,
  subscribeOwnerPets,
  escapeHtml,
  Patient,
  Prescription,
  PrescriptionItem,
  Vaccination
} from './firebase';
import { initSidebarProfile } from './auth';

let currentPatientId: string = '';
let currentPatient: Patient | null = null;
let patientPrescriptions: Prescription[] = [];

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarProfile();
  await seedDatabaseIfEmpty();

  const urlParams = new URLSearchParams(window.location.search);
  let id = urlParams.get('id');

  // If no ID provided, get first patient ID from subscribePatients
  subscribePatients(async (patients) => {
    if (patients.length === 0) return;
    
    if (!id || !patients.some(p => p.id === id)) {
      id = patients[0].id || '';
    }
    
    currentPatientId = id;
    const rxLink = document.getElementById('patientRxLink') as HTMLAnchorElement | null;
    if (rxLink) {
      rxLink.href = `prescriptions.html?patient_id=${currentPatientId}`;
    }
    await loadPatientDetails(currentPatientId);
    setupRealtimeSubscriptions(currentPatientId);
  });

  // Handle patient status select change
  const statusSelect = document.getElementById('patientStatusSelect') as HTMLSelectElement | null;
  if (statusSelect) {
    statusSelect.addEventListener('change', async () => {
      if (!currentPatientId) return;
      const newStatus = statusSelect.value;
      updateStatusBadgeStyle(statusSelect, newStatus);
      try {
        await updatePatientStatus(currentPatientId, newStatus);
        showToastNotification(`Status pasien diperbarui menjadi "${newStatus}"`);
      } catch (err) {
        console.error('Failed to update status:', err);
      }
    });
  }

  // Handle Form Submit for New Patient Prescription
  const rxForm = document.getElementById('createPatientRxForm') as HTMLFormElement | null;
  if (rxForm) {
    rxForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSavePatientRx();
    });
  }

  // Handle Form Submit for New Vaccine Record
  const vacForm = document.getElementById('addVaccineForm') as HTMLFormElement | null;
  if (vacForm) {
    vacForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveVaccine();
    });
  }

  // Handle Form Submit for Re-visit Check-In
  const revisitForm = document.getElementById('revisitForm') as HTMLFormElement | null;
  if (revisitForm) {
    revisitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveRevisit();
    });
  }
});

function switchPatientTab(tab: 'medical' | 'prescriptions' | 'vaccinations') {
  const btnMed = document.getElementById('tabBtnMedicalHistory');
  const btnRx = document.getElementById('tabBtnPrescriptions');
  const btnVac = document.getElementById('tabBtnVaccinations');

  const paneMed = document.getElementById('tabContentMedicalHistory');
  const paneRx = document.getElementById('tabContentPrescriptions');
  const paneVac = document.getElementById('tabContentVaccinations');

  const activeBtnClass = "px-4 py-2 text-vetgreen-800 border-b-2 border-vetgreen-800 font-bold transition-all flex items-center gap-1.5 whitespace-nowrap";
  const inactiveBtnClass = "px-4 py-2 text-slate-500 hover:text-slate-800 border-b-2 border-transparent font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap";

  if (btnMed) btnMed.className = tab === 'medical' ? activeBtnClass : inactiveBtnClass;
  if (btnRx) btnRx.className = tab === 'prescriptions' ? activeBtnClass : inactiveBtnClass;
  if (btnVac) btnVac.className = tab === 'vaccinations' ? activeBtnClass : inactiveBtnClass;

  if (paneMed) paneMed.classList.toggle('hidden', tab !== 'medical');
  if (paneRx) paneRx.classList.toggle('hidden', tab !== 'prescriptions');
  if (paneVac) paneVac.classList.toggle('hidden', tab !== 'vaccinations');

  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function updateStatusBadgeStyle(selectElem: HTMLSelectElement, status: string) {
  const baseClass = "appearance-none cursor-pointer pl-3 pr-7 py-1 rounded-full text-xs font-semibold focus:outline-none transition-all shadow-xs border ";
  const s = status.toLowerCase();
  if (s.includes('sehat') || s.includes('sembuh')) {
    selectElem.className = baseClass + "bg-emerald-100 text-emerald-800 border-emerald-200";
  } else if (s.includes('pemulihan') || s.includes('perawatan') || s.includes('perlu perhatian')) {
    selectElem.className = baseClass + "bg-amber-100 text-amber-800 border-amber-200";
  } else {
    selectElem.className = baseClass + "bg-rose-100 text-rose-800 border-rose-200";
  }
}

async function loadPatientDetails(patientId: string) {
  await syncAndCleanupPatientMedications(patientId);
  const patient = await getPatientById(patientId);
  if (!patient) return;
  currentPatient = patient;

  // Ensure patient has clinical notes, prescriptions, and vaccines seeded
  await autoSeedPatientRecordsIfEmpty(patientId, patient);

  const nameElem = document.getElementById('patientName');
  if (nameElem) nameElem.textContent = patient.name;

  const avatarElem = document.getElementById('patientAvatar');
  if (avatarElem) avatarElem.textContent = patient.name.substring(0, 2).toUpperCase();

  const metaElem = document.getElementById('patientMeta');
  if (metaElem) {
    metaElem.innerHTML = `${escapeHtml(patient.species)} / ${escapeHtml(patient.breed || '-')} &middot; ${escapeHtml(patient.age)} &middot; ${escapeHtml(patient.gender)} &middot; <span class="font-mono text-slate-700">${escapeHtml(patient.code || '#VET-000')}</span>`;
  }

  const doctorElem = document.getElementById('attendingDoctorName');
  if (doctorElem) doctorElem.textContent = patient.doctor_name || 'Dr. Sarah Jenkins';

  const ownerNameElem = document.getElementById('ownerName');
  if (ownerNameElem) ownerNameElem.textContent = patient.owner_name;

  const ownerPhoneElem = document.getElementById('ownerPhone');
  if (ownerPhoneElem) ownerPhoneElem.textContent = patient.phone;

  const ownerAddressElem = document.getElementById('ownerAddress');
  if (ownerAddressElem) ownerAddressElem.textContent = patient.address || '-';

  // Top Owner Header Bar
  const ownerHeaderNameElem = document.getElementById('ownerHeaderName');
  if (ownerHeaderNameElem) ownerHeaderNameElem.textContent = patient.owner_name;

  const ownerHeaderPhoneElem = document.getElementById('ownerHeaderPhone');
  if (ownerHeaderPhoneElem) ownerHeaderPhoneElem.textContent = patient.phone;

  const topAddBtn = document.getElementById('topAddOtherPetBtn') as HTMLAnchorElement | null;
  if (topAddBtn) {
    const encOwner = encodeURIComponent(patient.owner_name || '');
    const encPhone = encodeURIComponent(patient.phone || '');
    const encAddr = encodeURIComponent(patient.address || '');
    topAddBtn.href = `add_patient.html?existing_owner=1&owner_name=${encOwner}&owner_phone=${encPhone}&owner_address=${encAddr}`;
  }

  // Link for adding another pet for this same owner
  const addPetLink = document.getElementById('addOtherPetLink') as HTMLAnchorElement | null;
  if (addPetLink) {
    const encOwner = encodeURIComponent(patient.owner_name || '');
    const encPhone = encodeURIComponent(patient.phone || '');
    const encAddr = encodeURIComponent(patient.address || '');
    addPetLink.href = `add_patient.html?existing_owner=1&owner_name=${encOwner}&owner_phone=${encPhone}&owner_address=${encAddr}`;
  }

  // Subscribe to other pets owned by this owner
  subscribeOwnerPets(patient.owner_name, patientId, (otherPets) => {
    renderOwnerOtherPets(otherPets, patient.owner_name);
  });

  const weightElem = document.getElementById('vitalWeight');
  if (weightElem) weightElem.textContent = patient.weight || '-';

  const tempElem = document.getElementById('vitalTemp');
  if (tempElem) tempElem.textContent = patient.temperature || '-';

  const heartElem = document.getElementById('vitalHeart');
  if (heartElem) heartElem.textContent = patient.heart_rate || '-';

  const statusSelect = document.getElementById('patientStatusSelect') as HTMLSelectElement | null;
  if (statusSelect) {
    statusSelect.value = patient.status;
    updateStatusBadgeStyle(statusSelect, patient.status);
  }
}

function setupRealtimeSubscriptions(patientId: string) {
  // Subscribe to clinical notes
  subscribeClinicalNotes(patientId, (notes) => {
    const container = document.getElementById('notesContainer');
    if (!container) return;

    if (notes.length === 0) {
      container.innerHTML = `<div class="p-4 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100 text-center">Belum ada rekam keluhan/catatan klinis.</div>`;
      return;
    }

    container.innerHTML = notes.map(note => {
      let titleText = note.title || 'Keluhan / Catatan Medis';
      const dateStr = note.note_date || 'Hari ini';

      // Severity badge parsing
      let severityBadge = '';
      const sevMatch = titleText.match(/\[(Mild|Moderate|Severe)\]/i);
      if (sevMatch) {
        const sev = sevMatch[1];
        titleText = titleText.replace(/\[(Mild|Moderate|Severe)\]/i, '').trim();
        if (sev.toLowerCase() === 'mild') {
          severityBadge = `<span class="badge badge-emerald">Mild</span>`;
        } else if (sev.toLowerCase() === 'moderate') {
          severityBadge = `<span class="badge badge-amber">Moderate</span>`;
        } else {
          severityBadge = `<span class="badge badge-rose">Severe</span>`;
        }
      }

      // Symptoms chip parsing
      let symptomItems: string[] = [];
      if (titleText.startsWith('Gejala: ')) {
        const rawSym = titleText.replace('Gejala: ', '').trim();
        symptomItems = rawSym.split(',').map(s => s.trim()).filter(Boolean);
      }

      const detailText = note.detail || '';
      const gejalaMatch = detailText.match(/Daftar Gejala:\s*([^\n]+)/);
      if (gejalaMatch && symptomItems.length === 0) {
        symptomItems = gejalaMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      }

      let symptomsChipsHtml = '';
      if (symptomItems.length > 0) {
        symptomsChipsHtml = `
          <div class="flex flex-wrap items-center gap-1.5 pt-1 pl-4">
            <span class="text-[11px] font-bold text-slate-500">Gejala Pasien:</span>
            ${symptomItems.map(s => `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">${escapeHtml(s)}</span>`).join('')}
          </div>
        `;
      }

      return `
        <div class="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 transition-all hover:bg-white hover:shadow-xs">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="w-2 h-2 rounded-full bg-vetgreen-800 shrink-0"></span>
              <h3 class="text-xs font-bold text-slate-900">
                ${escapeHtml(titleText)}
              </h3>
              ${severityBadge}
            </div>
            <span class="text-[11px] text-slate-400 font-mono shrink-0">${escapeHtml(dateStr)}</span>
          </div>
          ${symptomsChipsHtml}
          <div class="text-xs text-slate-600 leading-relaxed whitespace-pre-line pl-4 border-l-2 border-slate-200 my-1">${escapeHtml(detailText)}</div>
        </div>
      `;
    }).join('');
  });

  // Subscribe to medications
  subscribeMedications(patientId, (meds) => {
    const container = document.getElementById('medsContainer');
    if (!container) return;

    if (meds.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-400 p-2">Tidak ada obat aktif saat ini.</div>`;
      return;
    }

    container.innerHTML = meds.map(med => `
      <div class="med-item p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
        <div class="font-bold text-slate-800">${escapeHtml(med.name)}</div>
        <div class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(med.dose)}</div>
      </div>
    `).join('');

    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  });

  // Subscribe to prescriptions for this patient
  subscribePrescriptions((allRxs) => {
    const filteredRxs = allRxs.filter(r => r.patient_id === patientId);
    patientPrescriptions = filteredRxs;
    renderPatientPrescriptions(filteredRxs);
  });

  // Subscribe to vaccinations for this patient
  subscribeVaccinations(patientId, (vacs) => {
    renderPatientVaccinations(vacs);
  });
}

function renderOwnerOtherPets(pets: Patient[], ownerName: string) {
  // Update top owner pets count badge
  const badgeElem = document.getElementById('ownerPetsCountBadge');
  const totalPets = 1 + pets.length;
  if (badgeElem) {
    badgeElem.textContent = `${totalPets} Hewan Terdaftar`;
  }

  // Update top switcher tabs
  const topSwitcher = document.getElementById('topOwnerPetsSwitcher');
  if (topSwitcher && currentPatient) {
    const getIcon = (sp: string) => {
      const s = (sp || '').toLowerCase();
      if (s.includes('kucing') || s.includes('cat')) return '🐱';
      if (s.includes('anjing') || s.includes('dog')) return '🐶';
      if (s.includes('kelinci') || s.includes('rabbit')) return '🐰';
      if (s.includes('burung') || s.includes('bird')) return '🦜';
      return '🐾';
    };

    let switcherHtml = `
      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-slate-900 rounded-xl font-bold text-xs shadow-xs border border-emerald-400 shrink-0">
        <span>${getIcon(currentPatient.species)}</span>
        <span>${escapeHtml(currentPatient.name)}</span>
        <span class="text-[10px] bg-slate-900/20 px-1.5 py-0.2 rounded font-semibold text-white">Sedang Dilihat</span>
      </span>
    `;

    pets.forEach(p => {
      switcherHtml += `
        <a href="patient.html?id=${escapeHtml(p.id)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-semibold text-xs border border-slate-700 transition-all shrink-0">
          <span>${getIcon(p.species)}</span>
          <span>${escapeHtml(p.name)}</span>
          <span class="text-[10px] text-slate-400 font-normal">(${escapeHtml(p.species)})</span>
        </a>
      `;
    });

    topSwitcher.innerHTML = switcherHtml;
  }

  const container = document.getElementById('ownerOtherPetsList');
  if (!container) return;

  if (pets.length === 0) {
    container.innerHTML = `
      <div class="flex items-center justify-between w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500 text-xs">
        <span>Belum ada hewan peliharaan lain terdaftar untuk <strong>${escapeHtml(ownerName)}</strong>.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = pets.map(p => {
    let icon = '🐾';
    const speciesLower = (p.species || '').toLowerCase();
    if (speciesLower.includes('kucing') || speciesLower.includes('cat')) icon = '🐱';
    else if (speciesLower.includes('anjing') || speciesLower.includes('dog')) icon = '🐶';
    else if (speciesLower.includes('kelinci') || speciesLower.includes('rabbit')) icon = '🐰';
    else if (speciesLower.includes('burung') || speciesLower.includes('bird')) icon = '🦜';

    return `
      <a href="patient.html?id=${escapeHtml(p.id)}" class="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-vetgreen-50 hover:border-vetgreen-300 text-slate-800 rounded-xl border border-slate-200 transition-all text-xs font-semibold group">
        <span>${icon}</span>
        <span>${escapeHtml(p.name)}</span>
        <span class="text-[10px] text-slate-500 font-normal">(${escapeHtml(p.species)})</span>
        <i data-lucide="chevron-right" class="w-3 h-3 text-slate-400 group-hover:text-vetgreen-800"></i>
      </a>
    `;
  }).join('');

  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function openRevisitModal() {
  const modal = document.getElementById('revisitModal');
  const dateInput = document.getElementById('revisitDateInput') as HTMLInputElement | null;
  const docSelect = document.getElementById('revisitDoctorSelect') as HTMLSelectElement | null;
  const statusSelect = document.getElementById('revisitStatusSelect') as HTMLSelectElement | null;
  const weightInput = document.getElementById('revisitWeightInput') as HTMLInputElement | null;
  const tempInput = document.getElementById('revisitTempInput') as HTMLInputElement | null;
  const hrInput = document.getElementById('revisitHrInput') as HTMLInputElement | null;

  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  if (docSelect && currentPatient) {
    docSelect.value = currentPatient.doctor_name || 'Dr. Sarah Jenkins';
  }
  if (statusSelect && currentPatient) {
    statusSelect.value = currentPatient.status || 'Sehat';
  }
  if (weightInput && currentPatient) {
    weightInput.value = (currentPatient.weight || '').replace(' kg', '');
  }
  if (tempInput && currentPatient) {
    tempInput.value = (currentPatient.temperature || '').replace(' °C', '');
  }
  if (hrInput && currentPatient) {
    hrInput.value = (currentPatient.heart_rate || '').replace(' bpm', '');
  }

  modal?.classList.remove('hidden');
}

function closeRevisitModal() {
  const modal = document.getElementById('revisitModal');
  modal?.classList.add('hidden');
}

async function handleSaveRevisit() {
  if (!currentPatientId || !currentPatient) return;

  const dateInput = document.getElementById('revisitDateInput') as HTMLInputElement | null;
  const docSelect = document.getElementById('revisitDoctorSelect') as HTMLSelectElement | null;
  const titleInput = document.getElementById('revisitTitleInput') as HTMLInputElement | null;
  const detailInput = document.getElementById('revisitDetailInput') as HTMLTextAreaElement | null;
  const statusSelect = document.getElementById('revisitStatusSelect') as HTMLSelectElement | null;
  const weightInput = document.getElementById('revisitWeightInput') as HTMLInputElement | null;
  const tempInput = document.getElementById('revisitTempInput') as HTMLInputElement | null;
  const hrInput = document.getElementById('revisitHrInput') as HTMLInputElement | null;
  const saveBtn = document.getElementById('saveRevisitBtn') as HTMLButtonElement | null;

  const visitDate = dateInput?.value || new Date().toISOString().split('T')[0];
  const doctorName = docSelect?.value || 'Dr. Sarah Jenkins';
  const title = titleInput?.value.trim() || 'Kunjungan Ulang Kontrol';
  const detail = detailInput?.value.trim() || '';
  const status = statusSelect?.value || currentPatient.status || 'Sehat';

  if (!title || !detail) {
    alert('Mohon isi judul dan detail keluhan kunjungan.');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `⏳ Menyimpan...`;
  }

  try {
    const rawW = weightInput?.value.trim();
    const rawT = tempInput?.value.trim();
    const rawH = hrInput?.value.trim();

    await recordRevisit(currentPatientId, {
      visit_date: visitDate,
      doctor_name: doctorName,
      status: status,
      title: title,
      detail: detail,
      weight: rawW ? `${rawW} kg` : currentPatient.weight,
      temperature: rawT ? `${rawT} °C` : currentPatient.temperature,
      heart_rate: rawH ? `${rawH} bpm` : currentPatient.heart_rate
    });

    // Reload local patient details
    await loadPatientDetails(currentPatientId);

    showToastNotification('Catatan kunjungan ulang berhasil disimpan!');
    closeRevisitModal();
    (document.getElementById('revisitForm') as HTMLFormElement)?.reset();
  } catch (err) {
    console.error('Failed to record revisit:', err);
    alert('Gagal menyimpan rekam kunjungan ulang.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Simpan Kunjungan Ulang`;
      if ((window as any).lucide) (window as any).lucide.createIcons();
    }
  }
}

function renderPatientVaccinations(vacs: Vaccination[]) {
  const tbody = document.getElementById('vaccinationsTableBody');
  if (!tbody) return;

  if (vacs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-6 text-center text-slate-400">
          <p class="font-bold text-slate-700 text-xs mb-1">Belum Ada Riwayat Vaksinasi</p>
          <p class="text-[11px]">Klik "Catat Vaksin" untuk menambahkan data vaksinasi atau obat cacing.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = vacs.map(v => {
    let badgeClass = 'badge-emerald';
    if (v.status === 'Sebentar Lagi') {
      badgeClass = 'badge-amber';
    } else if (v.status === 'Perlu Booster') {
      badgeClass = 'badge-rose';
    }

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="p-3">
          <span class="font-bold text-slate-900 block">${escapeHtml(v.vaccine_name)}</span>
          <span class="text-[10px] text-slate-500">${escapeHtml(v.vaccine_type || 'Vaksin Rutin')} ${v.notes ? '&middot; ' + escapeHtml(v.notes) : ''}</span>
        </td>
        <td class="p-3 text-slate-700 whitespace-nowrap">${escapeHtml(v.given_date || '-')}</td>
        <td class="p-3 font-semibold text-emerald-700 whitespace-nowrap">${escapeHtml(v.due_date || '-')}</td>
        <td class="p-3 whitespace-nowrap">
          <span class="badge whitespace-nowrap ${badgeClass}">
            ${escapeHtml(v.status || 'Up to Date')}
          </span>
        </td>
        <td class="p-3 text-right whitespace-nowrap">
          <button onclick="deletePatientVaccine('${escapeHtml(v.id)}')" class="text-slate-400 hover:text-rose-600 transition-colors" title="Hapus Data Vaksin">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function openAddVaccineModal() {
  const modal = document.getElementById('addVaccineModal');
  const dateInput = document.getElementById('vacGivenDateInput') as HTMLInputElement | null;
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  modal?.classList.remove('hidden');
}

function closeAddVaccineModal() {
  const modal = document.getElementById('addVaccineModal');
  modal?.classList.add('hidden');
}

async function handleSaveVaccine() {
  if (!currentPatientId) return;

  const typeSelect = document.getElementById('vacTypeSelect') as HTMLSelectElement | null;
  const dateInput = document.getElementById('vacGivenDateInput') as HTMLInputElement | null;
  const intervalSelect = document.getElementById('vacIntervalSelect') as HTMLSelectElement | null;
  const notesInput = document.getElementById('vacNotesInput') as HTMLInputElement | null;
  const saveBtn = document.getElementById('saveVaccineBtn') as HTMLButtonElement | null;

  const vacName = typeSelect?.value;
  const givenDateStr = dateInput?.value;
  const intervalMonths = parseInt(intervalSelect?.value || '12', 10);

  if (!vacName || !givenDateStr) {
    alert('Mohon lengkapi jenis vaksin dan tanggal.');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `⏳ Menyimpan...`;
  }

  try {
    const givenDate = new Date(givenDateStr);
    const dueDate = new Date(givenDate);
    dueDate.setMonth(dueDate.getMonth() + intervalMonths);

    const dueDateStr = dueDate.toISOString().split('T')[0];

    const now = new Date();
    let status = 'Up to Date';
    if (dueDate < now) {
      status = 'Perlu Booster';
    } else {
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
      if (diffDays <= 30) {
        status = 'Sebentar Lagi';
      }
    }

    let vacType = 'Vaksin Core';
    if (vacName.toLowerCase().includes('rabies')) vacType = 'Vaksin Rabies';
    else if (vacName.toLowerCase().includes('cacing') || vacName.toLowerCase().includes('deworming')) vacType = 'Deworming';
    else if (vacName.toLowerCase().includes('kutu') || vacName.toLowerCase().includes('parasit') || vacName.toLowerCase().includes('spot-on')) vacType = 'Anti-Parasit';

    await addVaccination({
      patient_id: currentPatientId,
      vaccine_name: vacName,
      vaccine_type: vacType,
      given_date: givenDateStr,
      due_date: dueDateStr,
      status: status,
      notes: notesInput?.value.trim() || ''
    });

    showToastNotification('Data vaksinasi berhasil ditambahkan!');
    closeAddVaccineModal();
    (document.getElementById('addVaccineForm') as HTMLFormElement)?.reset();
  } catch (err) {
    console.error('Failed to save vaccination:', err);
    alert('Gagal menyimpan data vaksin.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Simpan Record Vaksin`;
      if ((window as any).lucide) (window as any).lucide.createIcons();
    }
  }
}

function renderPatientPrescriptions(rxs: Prescription[]) {
  const container = document.getElementById('patientPrescriptionsList');
  if (!container) return;

  if (rxs.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-400 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
        <i data-lucide="pill" class="w-8 h-8 mx-auto text-slate-300"></i>
        <p class="font-bold text-slate-700 text-xs">Belum Ada E-Resep Obat</p>
        <p class="text-[11px]">Klik tombol "Buat Resep Obat" di atas untuk meracik resep digital.</p>
      </div>
    `;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  container.innerHTML = rxs.map(rx => {
    const itemsHtml = (rx.items || []).map(i => `
      <div class="flex items-start justify-between py-1 text-xs border-b border-slate-100 last:border-0">
        <div>
          <span class="font-bold text-slate-800 block">${escapeHtml(i.med_name)}</span>
          <span class="text-[11px] text-slate-500">${escapeHtml(i.instructions || '')}</span>
        </div>
        <span class="font-semibold text-slate-700 text-right shrink-0 ml-2 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[11px]">${escapeHtml(i.dosage)}</span>
      </div>
    `).join('');

    const statusBadgeClass = 
      rx.status === 'Active' 
        ? 'badge-emerald' 
        : rx.status === 'Selesai'
        ? 'badge-slate'
        : 'badge-rose';

    return `
      <div class="card p-4 space-y-3">
        <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-mono font-bold text-xs text-slate-900">${escapeHtml(rx.prescription_number || 'RX-000')}</span>
              <span class="text-[11px] text-slate-400">&middot; ${escapeHtml(rx.date || '')}</span>
            </div>
            <span class="text-xs text-slate-500 block mt-0.5">Dokter: ${escapeHtml(rx.doctor_name || 'Dr. Sarah Jenkins')} &middot; Durasi: ${escapeHtml(rx.duration || '7 Hari')}</span>
          </div>
          <span class="badge whitespace-nowrap ${statusBadgeClass}">
            ${escapeHtml(rx.status || 'Active')}
          </span>
        </div>

        <div class="space-y-1">
          <span class="text-[10px] font-bold uppercase text-slate-400 block">Item Resep Obat:</span>
          <div class="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
            ${itemsHtml || '<span class="text-xs text-slate-400">Tidak ada rincian item.</span>'}
          </div>
        </div>

        ${rx.notes ? `<p class="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">📌 ${escapeHtml(rx.notes)}</p>` : ''}

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span class="text-[11px] text-slate-400">VetCore Clinical Portal</span>
          <div class="flex items-center gap-2">
            <button onclick="openPatientRxPreview('${escapeHtml(rx.id)}')" class="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 text-[11px] transition-colors">
              <i data-lucide="eye" class="w-3.5 h-3.5 text-slate-500"></i> Lihat / Cetak Resep
            </button>
            <button onclick="deletePatientRx('${escapeHtml(rx.id)}')" class="px-2 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-[11px]" title="Hapus Resep">
              <i data-lucide="trash-2" class="w-4 h-4"></i> Hapus
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function openPatientRxModal() {
  const modal = document.getElementById('newPatientRxModal');
  const rxNumInput = document.getElementById('patientRxNumberInput') as HTMLInputElement | null;
  const pNameSpan = document.getElementById('rxModalPatientName');

  if (pNameSpan && currentPatient) {
    pNameSpan.textContent = currentPatient.name;
  }

  if (rxNumInput) {
    rxNumInput.value = `RX-2025-${String(patientPrescriptions.length + 1).padStart(3, '0')}`;
  }

  const itemsContainer = document.getElementById('patientRxItemsContainer');
  if (itemsContainer) {
    itemsContainer.innerHTML = '';
    addPatientRxItemRow('Amoxicillin 250mg', '2x1 hari', 'Sesudah makan');
    addPatientRxItemRow('Vitamin & Suplemen', '1x1 hari', 'Campur ke makanan');
  }

  modal?.classList.remove('hidden');
}

function closePatientRxModal() {
  const modal = document.getElementById('newPatientRxModal');
  modal?.classList.add('hidden');
}

function addPatientRxItemRow(defaultName = '', defaultDosage = '', defaultInstructions = '') {
  const container = document.getElementById('patientRxItemsContainer');
  if (!container) return;

  const rowId = `prx_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const div = document.createElement('div');
  div.id = rowId;
  div.className = "grid grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs";

  div.innerHTML = `
    <div class="col-span-5">
      <input type="text" placeholder="Nama Obat *" required value="${defaultName}" 
             class="input-field prx-med-name">
    </div>
    <div class="col-span-3">
      <input type="text" placeholder="Dosis" required value="${defaultDosage}" 
             class="input-field prx-med-dosage">
    </div>
    <div class="col-span-3">
      <input type="text" placeholder="Instruksi" value="${defaultInstructions}" 
             class="input-field prx-med-instructions">
    </div>
    <div class="col-span-1 text-right">
      <button type="button" onclick="removePatientRxRow('${rowId}')" class="text-slate-400 hover:text-rose-600">✕</button>
    </div>
  `;

  container.appendChild(div);
}

(window as any).removePatientRxRow = (rowId: string) => {
  document.getElementById(rowId)?.remove();
};

async function handleSavePatientRx() {
  if (!currentPatient || !currentPatientId) return;

  const doctorSelect = document.getElementById('patientRxDoctorSelect') as HTMLSelectElement | null;
  const numInput = document.getElementById('patientRxNumberInput') as HTMLInputElement | null;
  const durationSelect = document.getElementById('patientRxDurationSelect') as HTMLSelectElement | null;
  const notesInput = document.getElementById('patientRxNotesInput') as HTMLTextAreaElement | null;
  const saveBtn = document.getElementById('savePatientRxBtn') as HTMLButtonElement | null;

  const itemRows = document.querySelectorAll('#patientRxItemsContainer > div');
  const items: PrescriptionItem[] = [];

  itemRows.forEach(row => {
    const medName = (row.querySelector('.prx-med-name') as HTMLInputElement)?.value.trim();
    const dosage = (row.querySelector('.prx-med-dosage') as HTMLInputElement)?.value.trim();
    const instructions = (row.querySelector('.prx-med-instructions') as HTMLInputElement)?.value.trim() || '';

    if (medName && dosage) {
      items.push({ med_name: medName, dosage, instructions });
    }
  });

  if (items.length === 0) {
    alert('Mohon masukkan minimal 1 obat.');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `⏳ Menyimpan...`;
  }

  try {
    const rxData = {
      patient_id: currentPatientId,
      patient_name: currentPatient.name,
      patient_code: currentPatient.code || '#VET-000',
      species: `${currentPatient.species} (${currentPatient.breed || ''})`,
      owner_name: currentPatient.owner_name,
      doctor_name: doctorSelect?.value || 'Dr. Sarah Jenkins',
      prescription_number: numInput?.value.trim() || `RX-${Date.now()}`,
      date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
      duration: durationSelect?.value || '7 Hari',
      status: 'Active',
      notes: notesInput?.value.trim() || '',
      items: items
    };

    await addPrescription(rxData);
    showToastNotification('E-Resep berhasil dibuat!');
    closePatientRxModal();
    (document.getElementById('createPatientRxForm') as HTMLFormElement)?.reset();
  } catch (err) {
    console.error('Failed to create prescription:', err);
    alert('Gagal membuat resep.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Simpan & Terbitkan Resep`;
      if ((window as any).lucide) (window as any).lucide.createIcons();
    }
  }
}

(window as any).openPatientRxPreview = (rxId: string) => {
  const rx = patientPrescriptions.find(r => r.id === rxId);
  if (!rx) return;

  const modal = document.getElementById('viewRxModal');
  const numElem = document.getElementById('previewRxNumber');
  const dateElem = document.getElementById('previewRxDate');
  const pNameElem = document.getElementById('previewPatientName');
  const pCodeElem = document.getElementById('previewPatientCode');
  const ownerElem = document.getElementById('previewOwnerName');
  const docElem = document.getElementById('previewDoctorName');
  const itemsBody = document.getElementById('previewRxItemsBody');
  const notesElem = document.getElementById('previewRxNotes');
  const docSignElem = document.getElementById('previewDoctorSign');

  if (numElem) numElem.textContent = rx.prescription_number || 'RX-001';
  if (dateElem) dateElem.textContent = rx.date || '';
  if (pNameElem) pNameElem.textContent = `${rx.patient_name || 'Pasien'} (${rx.species || ''})`;
  if (pCodeElem) pCodeElem.textContent = `ID: ${rx.patient_code || '-'}`;
  if (ownerElem) ownerElem.textContent = rx.owner_name || '-';
  if (docElem) docElem.textContent = `Dokter: ${rx.doctor_name || 'Dr. Sarah Jenkins'}`;
  if (docSignElem) docSignElem.textContent = rx.doctor_name || 'Dr. Sarah Jenkins';

  if (notesElem) {
    notesElem.textContent = `Durasi Pengobatan: ${rx.duration || '7 Hari'}. ${rx.notes ? 'Catatan: ' + rx.notes : ''}`;
  }

  if (itemsBody) {
    itemsBody.innerHTML = (rx.items || []).map((item, idx) => `
      <tr>
        <td class="p-2 font-bold text-slate-500">${idx + 1}</td>
        <td class="p-2 font-bold text-slate-900">${escapeHtml(item.med_name)}</td>
        <td class="p-2 font-semibold text-slate-700 bg-slate-50">${escapeHtml(item.dosage)}</td>
        <td class="p-2 text-slate-600">${escapeHtml(item.instructions || '-')}</td>
      </tr>
    `).join('');
  }

  modal?.classList.remove('hidden');
};

(window as any).deletePatientRx = async (rxId: string) => {
  try {
    await deletePrescription(rxId);
    showToastNotification('E-Resep berhasil dihapus.');
  } catch (err) {
    console.error('Failed to delete rx:', err);
    showToastNotification('Gagal menghapus resep.');
  }
};

function toggleMedForm(show?: boolean) {
  const form = document.getElementById('medForm');
  if (form) {
    if (typeof show === 'boolean') {
      if (show) form.classList.remove('hidden');
      else form.classList.add('hidden');
    } else {
      form.classList.toggle('hidden');
    }
  }
}

function showToastNotification(msg: string) {
  const toast = document.getElementById('toastNotification');
  const toastText = document.getElementById('toastText');
  if (toast && toastText) {
    toastText.textContent = msg;
    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }, 3000);
  }
}

// Global window functions for inline HTML events
(window as any).switchPatientTab = switchPatientTab;
(window as any).openRevisitModal = openRevisitModal;
(window as any).closeRevisitModal = closeRevisitModal;
(window as any).openPatientRxModal = openPatientRxModal;
(window as any).closePatientRxModal = closePatientRxModal;
(window as any).addPatientRxItemRow = addPatientRxItemRow;
(window as any).openAddVaccineModal = openAddVaccineModal;
(window as any).closeAddVaccineModal = closeAddVaccineModal;
(window as any).deletePatientVaccine = async (id: string) => {
  if (confirm('Hapus data rekam vaksinasi ini?')) {
    try {
      await deleteVaccination(id);
      showToastNotification('Data vaksinasi berhasil dihapus.');
    } catch (err) {
      console.error('Failed to delete vaccine:', err);
      showToastNotification('Gagal menghapus data vaksin.');
    }
  }
};
(window as any).toggleMedForm = toggleMedForm;
(window as any).openVitalsModal = () => {
  const modal = document.getElementById('vitalsModal');
  if (modal) modal.classList.remove('hidden');
};
(window as any).closeVitalsModal = () => {
  const modal = document.getElementById('vitalsModal');
  if (modal) modal.classList.add('hidden');
};

