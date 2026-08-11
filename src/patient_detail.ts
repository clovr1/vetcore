import {
  seedDatabaseIfEmpty,
  getPatientById,
  subscribePatients,
  subscribeMedicalRecords,
  addMedicalRecord,
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
  Vaccination,
  MedicalRecord
} from './firebase';
import { initSidebarProfile, getCurrentUser } from './auth';

let currentPatientId: string = '';
let currentPatient: Patient | null = null;
let patientPrescriptions: Prescription[] = [];
let isDoctor: boolean = false;

function getInitials(name: string): string {
  if (!name) return 'DR';
  const parts = name.replace(/^Dr\.\s*/i, '').trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarProfile();
  const user = getCurrentUser();
  isDoctor = user.role === 'doctor';

  // Toggle views
  const doctorView = document.getElementById('doctorView');
  const foView = document.getElementById('foView');
  if (doctorView) doctorView.classList.toggle('hidden', !isDoctor);
  if (foView) foView.classList.toggle('hidden', isDoctor);

  await seedDatabaseIfEmpty();

  const urlParams = new URLSearchParams(window.location.search);
  let id = urlParams.get('id');

  subscribePatients(async (patients) => {
    if (patients.length === 0) return;
    if (!id || !patients.some(p => p.id === id)) {
      id = patients[0].id || '';
    }
    currentPatientId = id;
    await loadPatientDetails(currentPatientId);
    setupRealtimeSubscriptions(currentPatientId);
  });

  // Status select (Doctor view)
  const docStatusSelect = document.getElementById('docPatientStatusSelect') as HTMLSelectElement | null;
  if (docStatusSelect) {
    docStatusSelect.addEventListener('change', async () => {
      if (!currentPatientId) return;
      updateStatusSelectStyle(docStatusSelect, docStatusSelect.value);
      try {
        await updatePatientStatus(currentPatientId, docStatusSelect.value);
        showToastNotification('Status diperbarui');
      } catch (err) { console.error(err); }
    });
  }

  // Rx form
  const rxForm = document.getElementById('createPatientRxForm') as HTMLFormElement | null;
  if (rxForm) rxForm.addEventListener('submit', async (e) => { e.preventDefault(); await handleSavePatientRx(); });

  // Vaccine form
  const vacForm = document.getElementById('addVaccineForm') as HTMLFormElement | null;
  if (vacForm) vacForm.addEventListener('submit', async (e) => { e.preventDefault(); await handleSaveVaccine(); });

  // Revisit form
  const revisitForm = document.getElementById('revisitForm') as HTMLFormElement | null;
  if (revisitForm) revisitForm.addEventListener('submit', async (e) => { e.preventDefault(); await handleSaveRevisit(); });

  // Doctor: Save Vitals
  const saveVitalsBtn = document.getElementById('saveVitalsBtn');
  if (saveVitalsBtn) {
    saveVitalsBtn.addEventListener('click', async () => {
      if (!currentPatientId) return;
      const w = (document.getElementById('docVitalWeight') as HTMLInputElement)?.value || '';
      const t = (document.getElementById('docVitalTemp') as HTMLInputElement)?.value || '';
      const h = (document.getElementById('docVitalHeart') as HTMLInputElement)?.value || '';
      try {
        await updatePatientVitals(currentPatientId, {
          weight: w ? w + ' kg' : '',
          temperature: t ? t + ' °F' : '',
          heart_rate: h ? h + ' bpm' : ''
        });
        showToastNotification('Tanda vital disimpan!');
      } catch (err) { console.error(err); }
    });
  }

  // Doctor: Save Assessment
  const saveAssessmentBtn = document.getElementById('saveAssessmentBtn');
  if (saveAssessmentBtn) {
    saveAssessmentBtn.addEventListener('click', async () => {
      if (!currentPatientId) return;
      const assessment = (document.getElementById('doctorAssessment') as HTMLTextAreaElement)?.value || '';
      if (!assessment.trim()) { alert('Isi penilaian dokter.'); return; }
      try {
        const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        await addMedicalRecord({
          patient_id: currentPatientId,
          mrn: currentPatient?.code || '#VET-000',
          patient_name: currentPatient?.name || '',
          date: todayStr,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          subjective: assessment,
          objective: '',
          diagnosis: [],
          treatments: [],
          doctor_name: user.name,
          doctor_initials: getInitials(user.name),
          notes: ''
        });
        showToastNotification('Penilaian disimpan!');
        const lastUpdate = document.getElementById('assessmentLastUpdate');
        if (lastUpdate) lastUpdate.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      } catch (err) { console.error(err); }
    });
  }

  // Doctor: Cancel Visit
  const cancelVisitBtn = document.getElementById('cancelVisitBtn');
  if (cancelVisitBtn) {
    cancelVisitBtn.addEventListener('click', () => {
      if (confirm('Batalkan kunjungan ini?')) window.location.href = 'patients.html';
    });
  }

  // Doctor: Complete Visit
  const completeVisitBtn = document.getElementById('completeVisitBtn');
  if (completeVisitBtn) {
    completeVisitBtn.addEventListener('click', async () => {
      if (!currentPatientId) return;
      if (confirm('Selesaikan kunjungan ini?')) {
        try {
          await updatePatientStatus(currentPatientId, 'Sehat');
          showToastNotification('Kunjungan selesai!');
          setTimeout(() => { window.location.href = 'patients.html'; }, 1500);
        } catch (err) { console.error(err); }
      }
    });
  }
});

function switchPatientTab(tab: 'medical' | 'prescriptions' | 'vaccinations') {
  const prefix = isDoctor ? '' : 'fo';
  const btnMed = document.getElementById(prefix + 'tabBtnMedicalHistory');
  const btnRx = document.getElementById(prefix + 'tabBtnPrescriptions');
  const btnVac = document.getElementById(prefix + 'tabBtnVaccinations');
  const paneMed = document.getElementById(prefix + 'tabContentMedicalHistory');
  const paneRx = document.getElementById(prefix + 'tabContentPrescriptions');
  const paneVac = document.getElementById(prefix + 'tabContentVaccinations');

  if (isDoctor) {
    const a = "px-4 py-2.5 text-vetgreen-800 border-b-2 border-vetgreen-800 font-bold transition-all flex items-center gap-1.5 whitespace-nowrap";
    const i = "px-4 py-2.5 text-slate-500 hover:text-slate-800 border-b-2 border-transparent font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap";
    if (btnMed) btnMed.className = tab === 'medical' ? a : i;
    if (btnRx) btnRx.className = tab === 'prescriptions' ? a : i;
    if (btnVac) btnVac.className = tab === 'vaccinations' ? a : i;
  } else {
    const a = "px-4 py-2 text-vetgreen-800 border-b-2 border-vetgreen-800 font-bold transition-all flex items-center gap-1.5 whitespace-nowrap";
    const i = "px-4 py-2 text-slate-500 hover:text-slate-800 border-b-2 border-transparent font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap";
    if (btnMed) btnMed.className = tab === 'medical' ? a : i;
    if (btnRx) btnRx.className = tab === 'prescriptions' ? a : i;
    if (btnVac) btnVac.className = tab === 'vaccinations' ? a : i;
  }

  if (paneMed) paneMed.classList.toggle('hidden', tab !== 'medical');
  if (paneRx) paneRx.classList.toggle('hidden', tab !== 'prescriptions');
  if (paneVac) paneVac.classList.toggle('hidden', tab !== 'vaccinations');
  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function updateStatusSelectStyle(selectElem: HTMLSelectElement, status: string) {
  const base = "appearance-none cursor-pointer pl-3 pr-7 py-1 rounded-full text-xs font-semibold focus:outline-none transition-all shadow-xs border ";
  const s = status.toLowerCase();
  if (s.includes('sehat') || s.includes('sembuh')) selectElem.className = base + "bg-emerald-100 text-emerald-800 border-emerald-200";
  else if (s.includes('pemulihan') || s.includes('perawatan') || s.includes('perlu perhatian')) selectElem.className = base + "bg-amber-100 text-amber-800 border-amber-200";
  else selectElem.className = base + "bg-rose-100 text-rose-800 border-rose-200";
}

function updateFoStatusBadge(badgeElem: HTMLElement, status: string) {
  const s = status.toLowerCase();
  if (s.includes('sehat') || s.includes('sembuh')) badgeElem.className = "px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200";
  else if (s.includes('pemulihan') || s.includes('perawatan') || s.includes('perlu perhatian')) badgeElem.className = "px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200";
  else badgeElem.className = "px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200";
  badgeElem.textContent = status;
}

async function loadPatientDetails(patientId: string) {
  await syncAndCleanupPatientMedications(patientId);
  const patient = await getPatientById(patientId);
  if (!patient) return;
  currentPatient = patient;
  await autoSeedPatientRecordsIfEmpty(patientId, patient);

  // Doctor view elements
  if (isDoctor) {
    const d = (id: string) => document.getElementById(id);
    if (d('docPatientName')) d('docPatientName')!.textContent = patient.name;
    if (d('docPatientAvatar')) d('docPatientAvatar')!.textContent = patient.name.substring(0, 2).toUpperCase();
    if (d('docConsultationSubtitle')) d('docConsultationSubtitle')!.textContent = patient.code + ' - ' + patient.species + ' / ' + (patient.breed || '-');
    if (d('docSpeciesBadge')) d('docSpeciesBadge')!.textContent = patient.species;
    if (d('docBreedBadge')) d('docBreedBadge')!.textContent = patient.breed || '-';
    if (d('docAgeBadge')) d('docAgeBadge')!.textContent = patient.age || '-';
    if (d('docMicrochip')) d('docMicrochip')!.textContent = patient.microchip || patient.code || '-';
    if (d('docOwnerName')) d('docOwnerName')!.textContent = patient.owner_name;
    if (d('docOwnerNameFull')) d('docOwnerNameFull')!.textContent = patient.owner_name;
    if (d('docOwnerPhone')) d('docOwnerPhone')!.textContent = patient.phone;
    if (d('docOwnerAddress')) d('docOwnerAddress')!.textContent = patient.address || '-';
    const wInput = d('docVitalWeight') as HTMLInputElement | null;
    if (wInput) wInput.value = (patient.weight || '').replace(' kg', '');
    const tInput = d('docVitalTemp') as HTMLInputElement | null;
    if (tInput) tInput.value = (patient.temperature || '').replace(' °C', '').replace(' °F', '');
    const hInput = d('docVitalHeart') as HTMLInputElement | null;
    if (hInput) hInput.value = (patient.heart_rate || '').replace(' bpm', '');
    const docStatusSelect = d('docPatientStatusSelect') as HTMLSelectElement | null;
    if (docStatusSelect) { docStatusSelect.value = patient.status; updateStatusSelectStyle(docStatusSelect, patient.status); }
  }

  // FO view elements
  if (!isDoctor) {
    const d = (id: string) => document.getElementById(id);
    if (d('foPatientName')) d('foPatientName')!.textContent = patient.name;
    if (d('foPatientAvatar')) d('foPatientAvatar')!.textContent = patient.name.substring(0, 2).toUpperCase();
    if (d('foPatientMeta')) d('foPatientMeta').innerHTML = `${escapeHtml(patient.species)} / ${escapeHtml(patient.breed || '-')} &middot; ${escapeHtml(patient.age)} &middot; ${escapeHtml(patient.gender)} &middot; <span class="font-mono text-slate-700">${escapeHtml(patient.code || '#VET-000')}</span>`;
    if (d('foAttendingDoctor')) d('foAttendingDoctor')!.textContent = patient.doctor_name || 'Dr. Sarah Jenkins';
    if (d('foVisitTimeRow') && d('foVisitTime')) {
      if (patient.visit_time) {
        d('foVisitTime')!.textContent = patient.visit_time;
        d('foVisitTimeRow')!.classList.remove('hidden');
      } else {
        d('foVisitTimeRow')!.classList.add('hidden');
      }
    }
    if (d('foOwnerHeaderName')) d('foOwnerHeaderName')!.textContent = patient.owner_name;
    if (d('foOwnerHeaderPhone')) d('foOwnerHeaderPhone')!.textContent = patient.phone;
    if (d('foOwnerName')) d('foOwnerName')!.textContent = patient.owner_name;
    if (d('foOwnerPhone')) d('foOwnerPhone')!.textContent = patient.phone;
    if (d('foOwnerAddress')) d('foOwnerAddress')!.textContent = patient.address || '-';
    if (d('foVitalWeight')) d('foVitalWeight')!.textContent = patient.weight || '-';
    if (d('foVitalTemp')) d('foVitalTemp')!.textContent = patient.temperature || '-';
    if (d('foVitalHeart')) d('foVitalHeart')!.textContent = patient.heart_rate || '-';
    const foStatusBadge = d('foPatientStatusBadge');
    if (foStatusBadge) { updateFoStatusBadge(foStatusBadge, patient.status); }

    const topAddBtn = d('foTopAddOtherPetBtn') as HTMLAnchorElement | null;
    if (topAddBtn) {
      const enc = (s: string) => encodeURIComponent(s || '');
      topAddBtn.href = `add_patient.html?existing_owner=1&owner_name=${enc(patient.owner_name)}&owner_phone=${enc(patient.phone)}&owner_address=${enc(patient.address)}`;
    }
    const addPetLink = d('foAddOtherPetLink') as HTMLAnchorElement | null;
    if (addPetLink) {
      const enc = (s: string) => encodeURIComponent(s || '');
      addPetLink.href = `add_patient.html?existing_owner=1&owner_name=${enc(patient.owner_name)}&owner_phone=${enc(patient.phone)}&owner_address=${enc(patient.address)}`;
    }
  }
}

function setupRealtimeSubscriptions(patientId: string) {
  // Medical records (SOAP)
  subscribeMedicalRecords((records) => {
    const patientRecords = records.filter(r => r.patient_id === patientId)
      .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));

    // Doctor: complaint section
    if (isDoctor) {
      const complaintSec = document.getElementById('docComplaintSection');
      const complaintText = document.getElementById('docComplaintText');
      const complaintMeta = document.getElementById('docComplaintMeta');
      if (patientRecords.length > 0 && complaintSec && complaintText) {
        const latest = patientRecords[0];
        complaintText.textContent = '"' + (latest.subjective || 'Tidak ada detail') + '"';
        if (complaintMeta) complaintMeta.textContent = 'Dicatat: ' + (latest.doctor_name || 'Front Desk') + ' (' + (latest.date || '') + ')';
        complaintSec.classList.remove('hidden');
      }
    }

    // Both views: notes container
    const renderNotesHtml = (recs: MedicalRecord[]) => {
      if (recs.length === 0) {
        return '<div class="p-4 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100 text-center">Belum ada rekam medis.</div>';
      }
      return recs.map(rec => {
        const diagList = (rec.diagnosis || []).map(d => '• ' + d).join('<br>');
        const treatList = (rec.treatments || []).map(t => '• ' + t).join('<br>');
        return '<div class="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 transition-all hover:bg-white hover:shadow-xs">' +
          '<div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2 flex-wrap"><span class="w-2 h-2 rounded-full bg-vetgreen-800 shrink-0"></span><h3 class="text-xs font-bold text-slate-900">Rekam Medis</h3></div><span class="text-[11px] text-slate-400 font-mono shrink-0">' + escapeHtml(rec.date || 'Hari ini') + '</span></div>' +
          '<div class="pl-4 border-l-2 border-slate-200 my-1 space-y-1">' +
            '<div class="text-xs text-slate-600"><b>S:</b> ' + escapeHtml(rec.subjective || '-') + '</div>' +
            (rec.objective ? '<div class="text-xs text-slate-600"><b>O:</b> ' + escapeHtml(rec.objective) + '</div>' : '') +
            '<div class="text-xs text-slate-600"><b>Diagnosa:</b> ' + (diagList || '-') + '</div>' +
            '<div class="text-xs text-slate-600"><b>Pengobatan:</b> ' + (treatList || '-') + '</div>' +
            (rec.notes ? '<div class="text-xs text-slate-600"><b>Catatan:</b> ' + escapeHtml(rec.notes) + '</div>' : '') +
          '</div>' +
          '<div class="flex items-center gap-2 mt-2">' +
            '<span class="w-5 h-5 rounded-full bg-[#044e3a] text-white flex items-center justify-center text-[9px] font-bold shrink-0">' + escapeHtml(rec.doctor_initials || 'DR') + '</span>' +
            '<span class="text-[11px] font-semibold text-slate-700">' + escapeHtml(rec.doctor_name || '-') + '</span>' +
          '</div>' +
          '</div>';
      }).join('');
    };
    const notesHtml = renderNotesHtml(patientRecords);
    const docNotes = document.getElementById('notesContainer');
    const foNotes = document.getElementById('foNotesContainer');
    if (docNotes) docNotes.innerHTML = notesHtml;
    if (foNotes) foNotes.innerHTML = notesHtml;
  });

  // Medications
  subscribeMedications(patientId, (meds) => {
    const html = meds.length === 0
      ? '<div class="text-xs text-slate-400 p-2">Tidak ada obat aktif.</div>'
      : meds.map(med => '<div class="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"><div class="font-bold text-slate-800">' + escapeHtml(med.name) + '</div><div class="text-[11px] text-slate-500 mt-0.5">' + escapeHtml(med.dose) + '</div></div>').join('');
    const docContainer = document.getElementById('medsContainer');
    const foContainer = document.getElementById('foMedsContainer');
    if (docContainer) docContainer.innerHTML = html;
    if (foContainer) foContainer.innerHTML = html;
  });

  // Prescriptions
  subscribePrescriptions((allRxs) => {
    const filtered = allRxs.filter(r => r.patient_id === patientId);
    patientPrescriptions = filtered;
    renderPatientPrescriptions(filtered);
  });

  // Vaccinations
  subscribeVaccinations(patientId, (vacs) => { renderPatientVaccinations(vacs); });
}

function renderPatientVaccinations(vacs: Vaccination[]) {
  const html = vacs.length === 0
    ? '<tr><td colspan="' + (isDoctor ? 5 : 4) + '" class="p-6 text-center text-slate-400"><p class="font-bold text-slate-700 text-xs mb-1">Belum Ada Vaksinasi</p><p class="text-[11px]">' + (isDoctor ? 'Klik "Catat Vaksin" untuk menambahkan.' : 'Data vaksinasi akan muncul setelah dokter mencatat.') + '</p></td></tr>'
    : vacs.map(v => {
        let badgeClass = 'badge-emerald';
        if (v.status === 'Sebentar Lagi') badgeClass = 'badge-amber';
        else if (v.status === 'Perlu Booster') badgeClass = 'badge-rose';
        const deleteCell = isDoctor ? '<td class="p-3 text-right whitespace-nowrap"><button onclick="deletePatientVaccine(\'' + escapeHtml(v.id) + '\')" class="text-slate-400 hover:text-rose-600 transition-colors" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>' : '';
        return '<tr class="hover:bg-slate-50/80 transition-colors">' +
          '<td class="p-3"><span class="font-bold text-slate-900 block">' + escapeHtml(v.vaccine_name) + '</span><span class="text-[10px] text-slate-500">' + escapeHtml(v.vaccine_type || '') + '</span></td>' +
          '<td class="p-3 text-slate-700 whitespace-nowrap">' + escapeHtml(v.given_date || '-') + '</td>' +
          '<td class="p-3 font-semibold text-emerald-700 whitespace-nowrap">' + escapeHtml(v.due_date || '-') + '</td>' +
          '<td class="p-3 whitespace-nowrap"><span class="badge whitespace-nowrap ' + badgeClass + '">' + escapeHtml(v.status || 'Up to Date') + '</span></td>' +
          deleteCell + '</tr>';
      }).join('');

  const docTbody = document.getElementById('vaccinationsTableBody');
  const foTbody = document.getElementById('foVaccinationsTableBody');
  if (docTbody) docTbody.innerHTML = html;
  if (foTbody) foTbody.innerHTML = html;
  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function renderPatientPrescriptions(rxs: Prescription[]) {
  const renderPrescriptionsHtml = (rxs: Prescription[]) => {
    if (rxs.length === 0) {
      const msg = isDoctor ? 'Klik "Buat Resep" untuk menambahkan.' : 'Belum ada resep obat dari dokter.';
      return '<div class="p-8 text-center text-slate-400 bg-slate-50 border border-slate-100 rounded-xl"><p class="font-bold text-slate-700 text-xs mb-1">Belum Ada Resep</p><p class="text-[11px]">' + msg + '</p></div>';
    }
    return rxs.map(rx => {
      const itemsHtml = (rx.items || []).map(i => '<div class="flex items-center justify-between py-1 text-xs border-b border-slate-100 last:border-0"><div><span class="font-bold text-slate-800 block">' + escapeHtml(i.med_name) + '</span><span class="text-[11px] text-slate-500">' + escapeHtml(i.instructions || '') + '</span></div><span class="font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[11px]">' + escapeHtml(i.dosage) + '</span></div>').join('');
      const sc = rx.status === 'Active' ? 'badge-emerald' : rx.status === 'Selesai' ? 'badge-slate' : 'badge-rose';
      const deleteBtn = isDoctor ? '<button onclick="deletePatientRx(\'' + escapeHtml(rx.id) + '\')" class="px-2 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-[11px]"><i data-lucide="trash-2" class="w-4 h-4"></i></button>' : '';
      return '<div class="card p-4 space-y-3"><div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2"><div><div class="flex items-center gap-2"><span class="font-mono font-bold text-xs text-slate-900">' + escapeHtml(rx.prescription_number || 'RX-000') + '</span><span class="text-[11px] text-slate-400">&middot; ' + escapeHtml(rx.date || '') + '</span></div><span class="text-xs text-slate-500 block mt-0.5">Dr: ' + escapeHtml(rx.doctor_name || '-') + ' &middot; Durasi: ' + escapeHtml(rx.duration || '-') + '</span></div><span class="badge whitespace-nowrap ' + sc + '">' + escapeHtml(rx.status || 'Active') + '</span></div><div class="space-y-1"><span class="text-[10px] font-bold uppercase text-slate-400 block">Item Resep:</span><div class="bg-slate-50 border border-slate-100 rounded-lg p-2.5">' + (itemsHtml || '<span class="text-xs text-slate-400">Kosong</span>') + '</div></div>' + (rx.notes ? '<p class="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">' + escapeHtml(rx.notes) + '</p>' : '') + '<div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs"><div class="flex items-center gap-2"><button onclick="openPatientRxPreview(\'' + escapeHtml(rx.id) + '\')" class="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 text-[11px] transition-colors"><i data-lucide="eye" class="w-3.5 h-3.5"></i> Lihat</button>' + deleteBtn + '</div></div></div>';
    }).join('');
  };

  const html = renderPrescriptionsHtml(rxs);
  const docContainer = document.getElementById('patientPrescriptionsList');
  const foContainer = document.getElementById('foPatientPrescriptionsList');
  if (docContainer) docContainer.innerHTML = html;
  if (foContainer) foContainer.innerHTML = html;
  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function openRevisitModal() {
  const modal = document.getElementById('revisitModal');
  const dateInput = document.getElementById('revisitDateInput') as HTMLInputElement | null;
  const docSelect = document.getElementById('revisitDoctorSelect') as HTMLSelectElement | null;
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (docSelect && currentPatient) docSelect.value = currentPatient.doctor_name || 'Dr. Sarah Jenkins';
  modal?.classList.remove('hidden');
}
function closeRevisitModal() { document.getElementById('revisitModal')?.classList.add('hidden'); }

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

  const title = titleInput?.value.trim() || 'Kunjungan Ulang';
  const detail = detailInput?.value.trim() || '';
  if (!title || !detail) { alert('Isi judul dan detail.'); return; }

  try {
    await recordRevisit(currentPatientId, {
      visit_date: dateInput?.value || new Date().toISOString().split('T')[0],
      doctor_name: docSelect?.value || 'Dr. Sarah Jenkins',
      status: statusSelect?.value || 'Sehat',
      title, detail,
      weight: weightInput?.value.trim() ? weightInput.value.trim() + ' kg' : currentPatient.weight,
      temperature: tempInput?.value.trim() ? tempInput.value.trim() + ' °C' : currentPatient.temperature,
      heart_rate: hrInput?.value.trim() ? hrInput.value.trim() + ' bpm' : currentPatient.heart_rate
    });
    await loadPatientDetails(currentPatientId);
    showToastNotification('Kunjungan ulang disimpan!');
    closeRevisitModal();
    (document.getElementById('revisitForm') as HTMLFormElement)?.reset();
  } catch (err) { console.error(err); alert('Gagal menyimpan.'); }
}

function openAddVaccineModal() {
  const dateInput = document.getElementById('vacGivenDateInput') as HTMLInputElement | null;
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  document.getElementById('addVaccineModal')?.classList.remove('hidden');
}
function closeAddVaccineModal() { document.getElementById('addVaccineModal')?.classList.add('hidden'); }

async function handleSaveVaccine() {
  if (!currentPatientId) return;
  const typeSelect = document.getElementById('vacTypeSelect') as HTMLSelectElement | null;
  const dateInput = document.getElementById('vacGivenDateInput') as HTMLInputElement | null;
  const intervalSelect = document.getElementById('vacIntervalSelect') as HTMLSelectElement | null;
  const notesInput = document.getElementById('vacNotesInput') as HTMLInputElement | null;
  const vacName = typeSelect?.value;
  const givenDateStr = dateInput?.value;
  if (!vacName || !givenDateStr) { alert('Lengkapi data.'); return; }
  try {
    const givenDate = new Date(givenDateStr);
    const dueDate = new Date(givenDate);
    dueDate.setMonth(dueDate.getMonth() + parseInt(intervalSelect?.value || '12', 10));
    const now = new Date();
    let status = 'Up to Date';
    if (dueDate < now) status = 'Perlu Booster';
    else { const diff = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000); if (diff <= 30) status = 'Sebentar Lagi'; }
    let vacType = 'Vaksin Core';
    if (vacName.toLowerCase().includes('rabies')) vacType = 'Vaksin Rabies';
    else if (vacName.toLowerCase().includes('cacing')) vacType = 'Deworming';
    else if (vacName.toLowerCase().includes('kutu')) vacType = 'Anti-Parasit';
    await addVaccination({ patient_id: currentPatientId, vaccine_name: vacName, vaccine_type: vacType, given_date: givenDateStr, due_date: dueDate.toISOString().split('T')[0], status, notes: notesInput?.value.trim() || '' });
    showToastNotification('Vaksin tersimpan!');
    closeAddVaccineModal();
    (document.getElementById('addVaccineForm') as HTMLFormElement)?.reset();
  } catch (err) { console.error(err); alert('Gagal menyimpan.'); }
}

function openPatientRxModal() {
  const pNameSpan = document.getElementById('rxModalPatientName');
  const rxNumInput = document.getElementById('patientRxNumberInput') as HTMLInputElement | null;
  if (pNameSpan && currentPatient) pNameSpan.textContent = currentPatient.name;
  if (rxNumInput) rxNumInput.value = 'RX-2025-' + String(patientPrescriptions.length + 1).padStart(3, '0');
  const itemsContainer = document.getElementById('patientRxItemsContainer');
  if (itemsContainer) { itemsContainer.innerHTML = ''; addPatientRxItemRow('Amoxicillin 250mg', '2x1 hari', 'Sesudah makan'); }
  document.getElementById('newPatientRxModal')?.classList.remove('hidden');
}
function closePatientRxModal() { document.getElementById('newPatientRxModal')?.classList.add('hidden'); }

function addPatientRxItemRow(defaultName = '', defaultDosage = '', defaultInstructions = '') {
  const container = document.getElementById('patientRxItemsContainer');
  if (!container) return;
  const rowId = 'prx_item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const div = document.createElement('div');
  div.id = rowId;
  div.className = "grid grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs";
  div.innerHTML = '<div class="col-span-5"><input type="text" placeholder="Nama Obat *" required value="' + defaultName + '" class="input-field prx-med-name"></div><div class="col-span-3"><input type="text" placeholder="Dosis" required value="' + defaultDosage + '" class="input-field prx-med-dosage"></div><div class="col-span-3"><input type="text" placeholder="Instruksi" value="' + defaultInstructions + '" class="input-field prx-med-instructions"></div><div class="col-span-1 text-right"><button type="button" onclick="removePatientRxRow(\'' + rowId + '\')" class="text-slate-400 hover:text-rose-600">✕</button></div>';
  container.appendChild(div);
}
(window as any).removePatientRxRow = (rowId: string) => { document.getElementById(rowId)?.remove(); };

async function handleSavePatientRx() {
  if (!currentPatient || !currentPatientId) return;
  const doctorSelect = document.getElementById('patientRxDoctorSelect') as HTMLSelectElement | null;
  const numInput = document.getElementById('patientRxNumberInput') as HTMLInputElement | null;
  const durationSelect = document.getElementById('patientRxDurationSelect') as HTMLSelectElement | null;
  const notesInput = document.getElementById('patientRxNotesInput') as HTMLTextAreaElement | null;
  const itemRows = document.querySelectorAll('#patientRxItemsContainer > div');
  const items: PrescriptionItem[] = [];
  itemRows.forEach(row => {
    const medName = (row.querySelector('.prx-med-name') as HTMLInputElement)?.value.trim();
    const dosage = (row.querySelector('.prx-med-dosage') as HTMLInputElement)?.value.trim();
    const instructions = (row.querySelector('.prx-med-instructions') as HTMLInputElement)?.value.trim() || '';
    if (medName && dosage) items.push({ med_name: medName, dosage, instructions });
  });
  if (items.length === 0) { alert('Masukkan minimal 1 obat.'); return; }
  try {
    await addPrescription({
      patient_id: currentPatientId, patient_name: currentPatient.name, patient_code: currentPatient.code || '#VET-000',
      species: currentPatient.species + ' (' + (currentPatient.breed || '') + ')', owner_name: currentPatient.owner_name,
      doctor_name: doctorSelect?.value || 'Dr. Sarah Jenkins', prescription_number: numInput?.value.trim() || 'RX-' + Date.now(),
      date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
      duration: durationSelect?.value || '7 Hari', status: 'Active', notes: notesInput?.value.trim() || '', items
    });
    showToastNotification('Resep berhasil dibuat!');
    closePatientRxModal();
    (document.getElementById('createPatientRxForm') as HTMLFormElement)?.reset();
  } catch (err) { console.error(err); alert('Gagal membuat resep.'); }
}

function openPatientRxPreview(rxId: string) {
  const rx = patientPrescriptions.find(r => r.id === rxId);
  if (!rx) return;
  const d = (id: string) => document.getElementById(id);
  if (d('previewRxNumber')) d('previewRxNumber')!.textContent = rx.prescription_number || 'RX-000';
  if (d('previewRxDate')) d('previewRxDate')!.textContent = rx.date || '-';
  if (d('previewPatientName')) d('previewPatientName')!.textContent = rx.patient_name || '-';
  if (d('previewPatientCode')) d('previewPatientCode')!.textContent = rx.patient_code || '-';
  if (d('previewOwnerName')) d('previewOwnerName')!.textContent = rx.owner_name || '-';
  if (d('previewDoctorName')) d('previewDoctorName')!.textContent = 'Dr: ' + (rx.doctor_name || '-');
  if (d('previewDoctorSign')) d('previewDoctorSign')!.textContent = rx.doctor_name || 'Dr. Sarah Jenkins';
  if (d('previewRxNotes')) d('previewRxNotes')!.textContent = rx.notes || '-';
  const tbody = d('previewRxItemsBody');
  if (tbody) {
    tbody.innerHTML = (rx.items || []).map((item, idx) => '<tr class="border-b border-slate-100"><td class="p-2 font-bold">' + (idx + 1) + '</td><td class="p-2 font-semibold">' + escapeHtml(item.med_name) + '</td><td class="p-2">' + escapeHtml(item.dosage) + '</td><td class="p-2 text-slate-500">' + escapeHtml(item.instructions || '-') + '</td></tr>').join('');
  }
  document.getElementById('viewRxModal')?.classList.remove('hidden');
  if ((window as any).lucide) (window as any).lucide.createIcons();
}

async function deletePatientRx(rxId: string) {
  if (!confirm('Hapus resep ini?')) return;
  try { await deletePrescription(rxId); showToastNotification('Resep dihapus.'); } catch (err) { console.error(err); }
}

function toggleMedForm() {
  const form = document.getElementById('medFormContainer');
  if (form) form.classList.toggle('hidden');
}

function showToastNotification(msg: string) {
  const toast = document.getElementById('toastNotification');
  const toastText = document.getElementById('toastText');
  if (toast && toastText) {
    toastText.textContent = msg;
    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none'); }, 3000);
  }
}

// Global window functions
(window as any).switchPatientTab = switchPatientTab;
(window as any).openRevisitModal = openRevisitModal;
(window as any).closeRevisitModal = closeRevisitModal;
(window as any).openPatientRxModal = openPatientRxModal;
(window as any).closePatientRxModal = closePatientRxModal;
(window as any).addPatientRxItemRow = addPatientRxItemRow;
(window as any).openAddVaccineModal = openAddVaccineModal;
(window as any).closeAddVaccineModal = closeAddVaccineModal;
(window as any).deletePatientVaccine = async (id: string) => {
  if (confirm('Hapus data vaksinasi?')) {
    try { await deleteVaccination(id); showToastNotification('Vaksin dihapus.'); } catch (err) { console.error(err); }
  }
};
(window as any).openPatientRxPreview = openPatientRxPreview;
(window as any).deletePatientRx = deletePatientRx;
(window as any).toggleMedForm = toggleMedForm;

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
