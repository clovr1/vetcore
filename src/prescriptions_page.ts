import { 
  seedDatabaseIfEmpty, 
  subscribePrescriptions, 
  subscribePatients, 
  getDoctorsList, 
  addPrescription, 
  updatePrescriptionStatus, 
  deletePrescription,
  escapeHtml,
  Prescription,
  PrescriptionItem,
  Patient
} from './firebase';
import { initSidebarProfile } from './auth';

let allPrescriptions: Prescription[] = [];
let allPatients: Patient[] = [];
let currentViewingRx: Prescription | null = null;

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarProfile();
  await seedDatabaseIfEmpty();

  // Load Lucide icons
  if ((window as any).lucide) {
    (window as any).lucide.createIcons();
  }

  // Subscribe to Patients to populate dropdown
  subscribePatients((patients) => {
    allPatients = patients;
    populatePatientDropdown(patients);
  });

  // Subscribe to Prescriptions
  subscribePrescriptions((prescriptions) => {
    allPrescriptions = prescriptions;
    renderStats(prescriptions);
    renderPrescriptions();
  });

  // Load Doctors list for modal select
  loadDoctorsSelect();

  // Search & Filter event listeners
  const searchInput = document.getElementById('searchPrescriptionInput') as HTMLInputElement | null;
  const filterSelect = document.getElementById('filterStatusSelect') as HTMLSelectElement | null;

  if (searchInput) {
    searchInput.addEventListener('input', () => renderPrescriptions());
  }
  if (filterSelect) {
    filterSelect.addEventListener('change', () => renderPrescriptions());
  }

  // Modal setup
  setupModalEvents();

  // Handle URL query param ?patient_id=... to auto open modal for specific patient
  const urlParams = new URLSearchParams(window.location.search);
  const targetPatientId = urlParams.get('patient_id');
  if (targetPatientId) {
    setTimeout(() => {
      openNewPrescriptionModal(targetPatientId);
    }, 500);
  }
});

function renderStats(prescriptions: Prescription[]) {
  const activeCount = prescriptions.filter(p => p.status === 'Active').length;
  const completedCount = prescriptions.filter(p => p.status === 'Selesai').length;
  const totalCount = prescriptions.length;

  const activeElem = document.getElementById('statActivePrescriptions');
  const completedElem = document.getElementById('statCompletedPrescriptions');
  const totalElem = document.getElementById('statTotalPrescriptions');

  if (activeElem) activeElem.textContent = String(activeCount);
  if (completedElem) completedElem.textContent = String(completedCount);
  if (totalElem) totalElem.textContent = String(totalCount);
}

function renderPrescriptions() {
  const container = document.getElementById('prescriptionsContainer');
  if (!container) return;

  const searchVal = (document.getElementById('searchPrescriptionInput') as HTMLInputElement)?.value.toLowerCase().trim() || '';
  const filterVal = (document.getElementById('filterStatusSelect') as HTMLSelectElement)?.value || 'All';

  let filtered = allPrescriptions.filter(rx => {
    const matchesSearch = 
      (rx.patient_name || '').toLowerCase().includes(searchVal) ||
      (rx.patient_code || '').toLowerCase().includes(searchVal) ||
      (rx.prescription_number || '').toLowerCase().includes(searchVal) ||
      (rx.owner_name || '').toLowerCase().includes(searchVal) ||
      (rx.items || []).some(i => i.med_name.toLowerCase().includes(searchVal));

    const matchesStatus = filterVal === 'All' || rx.status === filterVal;

    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card p-12 text-center text-slate-400 space-y-2">
        <i data-lucide="pill" class="w-10 h-10 mx-auto text-slate-300"></i>
        <p class="font-bold text-slate-700 text-sm">Tidak ada resep obat ditemukan</p>
        <p class="text-xs">Coba sesuaikan kata kunci pencarian atau buat resep obat baru.</p>
      </div>
    `;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(rx => {
    const statusBadgeClass = 
      rx.status === 'Active' 
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
        : rx.status === 'Selesai'
        ? 'bg-slate-100 text-slate-700 border-slate-200'
        : 'bg-rose-100 text-rose-800 border-rose-200';

    const itemsHtml = (rx.items || []).map(i => `
      <div class="flex items-start justify-between py-1 text-xs border-b border-slate-100 last:border-0">
        <div>
          <span class="font-bold text-slate-800 block">${escapeHtml(i.med_name)}</span>
          <span class="text-[11px] text-slate-500">${escapeHtml(i.instructions || '')}</span>
        </div>
        <span class="font-semibold text-slate-700 text-right shrink-0 ml-2 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[11px]">${escapeHtml(i.dosage)}</span>
      </div>
    `).join('');

    return `
      <div class="card p-5 hover:border-slate-300 transition-all space-y-4 flex flex-col justify-between">
        <div>
          <!-- Card Top Bar -->
          <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-xs text-slate-900">${escapeHtml(rx.prescription_number || 'RX-000')}</span>
                <span class="text-[11px] text-slate-400">&middot; ${escapeHtml(rx.date || '')}</span>
              </div>
              <h3 class="serif-title font-bold text-base text-slate-900 mt-1">${escapeHtml(rx.patient_name || 'Pasien')}</h3>
              <p class="text-xs text-slate-500">${escapeHtml(rx.species || '')} &middot; Pemilik: ${escapeHtml(rx.owner_name || '-')}</p>
            </div>

            <!-- Status Dropdown / Badge -->
            <div class="relative inline-block">
              <select onchange="handleRxStatusChange('${escapeHtml(rx.id)}', this.value)" title="Ubah Status Resep" 
                      class="appearance-none cursor-pointer pl-3 pr-6 py-1 rounded-full text-xs font-semibold focus:outline-none transition-all shadow-xs border ${statusBadgeClass}">
                <option value="Active" ${rx.status === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Selesai" ${rx.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                <option value="Dibatalkan" ${rx.status === 'Dibatalkan' ? 'selected' : ''}>Dibatalkan</option>
              </select>
            </div>
          </div>

          <!-- Items list -->
          <div class="py-2 space-y-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Rincian Obat (${escapeHtml(rx.duration || '7 Hari')}):</span>
            <div class="bg-slate-50 border border-slate-100 rounded-xl p-3">
              ${itemsHtml || '<span class="text-xs text-slate-400">Tidak ada rincian item.</span>'}
            </div>
          </div>

          ${rx.notes ? `<p class="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100 mt-2">📌 ${escapeHtml(rx.notes)}</p>` : ''}
        </div>

        <!-- Card Footer Actions -->
        <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span class="text-[11px] text-slate-500">Dr: ${escapeHtml(rx.doctor_name || 'Dr. Sarah Jenkins')}</span>
          <div class="flex items-center gap-2">
            <button onclick="openRxPreviewModal('${escapeHtml(rx.id)}')" class="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1">
              👁️ Lihat / Cetak
            </button>
            <button onclick="handleDeleteRx('${escapeHtml(rx.id)}')" class="p-1.5 text-slate-400 hover:text-rose-600 transition-colors" title="Hapus Resep">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if ((window as any).lucide) (window as any).lucide.createIcons();
}

function populatePatientDropdown(patients: Patient[]) {
  const select = document.getElementById('rxPatientSelect') as HTMLSelectElement | null;
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="" disabled selected>-- Pilih sesuai dengan apa yang ingin Anda pilih --</option>` +
    patients.map(p => `
      <option value="${p.id}">${p.name} (${p.species} - ${p.breed}) - Pemilik: ${p.owner_name}</option>
    `).join('');

  if (currentVal) select.value = currentVal;
}

async function loadDoctorsSelect() {
  const docs = await getDoctorsList();
  const select = document.getElementById('rxDoctorSelect') as HTMLSelectElement | null;
  if (!select) return;

  if (docs.length > 0) {
    select.innerHTML = `<option value="" disabled selected>-- Pilih Dokter --</option>` +
      docs.map(d => `<option value="${d.name}">${d.name} (${d.specialization})</option>`).join('');
  }
}

function setupModalEvents() {
  const openBtn = document.getElementById('openNewPrescriptionBtn');
  const modal = document.getElementById('newPrescriptionModal');
  const closeX = document.getElementById('closeNewPrescriptionModalX');
  const cancelBtn = document.getElementById('cancelRxModalBtn');
  const form = document.getElementById('createPrescriptionForm') as HTMLFormElement | null;
  const addItemBtn = document.getElementById('addRxItemBtn');

  if (openBtn) openBtn.addEventListener('click', () => openNewPrescriptionModal());
  if (closeX) closeX.addEventListener('click', () => modal?.classList.add('hidden'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => modal?.classList.add('hidden'));

  // View modal close
  const viewModal = document.getElementById('viewRxModal');
  const closeViewX = document.getElementById('closeViewRxModalX');
  const printBtn = document.getElementById('printRxBtn');

  if (closeViewX) closeViewX.addEventListener('click', () => viewModal?.classList.add('hidden'));
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  // Add Item Row
  if (addItemBtn) {
    addItemBtn.addEventListener('click', () => addRxItemRow());
  }

  // Submit new prescription
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveNewPrescription();
    });
  }
}

function openNewPrescriptionModal(preselectedPatientId?: string) {
  const modal = document.getElementById('newPrescriptionModal');
  const patientSelect = document.getElementById('rxPatientSelect') as HTMLSelectElement | null;
  const rxNumInput = document.getElementById('rxNumberInput') as HTMLInputElement | null;

  if (patientSelect && preselectedPatientId) {
    patientSelect.value = preselectedPatientId;
  }

  // Auto generate prescription number
  if (rxNumInput) {
    const rxCount = allPrescriptions.length + 1;
    rxNumInput.value = `RX-2025-${String(rxCount).padStart(3, '0')}`;
  }

  // Reset items container with 1 default item row
  const itemsContainer = document.getElementById('rxItemsContainer');
  if (itemsContainer) {
    itemsContainer.innerHTML = '';
    addRxItemRow('Amoxicillin 250mg', '2x1 hari', 'Sesudah makan');
    addRxItemRow('Vitamin & Suplemen', '1x1 hari', 'Campur ke makanan');
  }

  modal?.classList.remove('hidden');
}

function addRxItemRow(defaultName = '', defaultDosage = '', defaultInstructions = '') {
  const container = document.getElementById('rxItemsContainer');
  if (!container) return;

  const rowId = `rx_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const div = document.createElement('div');
  div.id = rowId;
  div.className = "grid grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs";

  div.innerHTML = `
    <div class="col-span-5">
      <input type="text" placeholder="Nama Obat / Racikan *" required value="${defaultName}" 
             class="input-field rx-med-name">
    </div>
    <div class="col-span-3">
      <input type="text" placeholder="Dosis (e.g. 2x1)" required value="${defaultDosage}" 
             class="input-field rx-med-dosage">
    </div>
    <div class="col-span-3">
      <input type="text" placeholder="Aturan Pakai / Ket" value="${defaultInstructions}" 
             class="input-field rx-med-instructions">
    </div>
    <div class="col-span-1 text-right">
      <button type="button" onclick="removeRxItemRow('${rowId}')" class="text-slate-400 hover:text-rose-600 transition-colors" title="Hapus Baris">✕</button>
    </div>
  `;

  container.appendChild(div);
}

(window as any).removeRxItemRow = (rowId: string) => {
  const elem = document.getElementById(rowId);
  if (elem) elem.remove();
};

async function handleSaveNewPrescription() {
  const patientSelect = document.getElementById('rxPatientSelect') as HTMLSelectElement | null;
  const doctorSelect = document.getElementById('rxDoctorSelect') as HTMLSelectElement | null;
  const rxNumInput = document.getElementById('rxNumberInput') as HTMLInputElement | null;
  const durationSelect = document.getElementById('rxDurationSelect') as HTMLSelectElement | null;
  const notesInput = document.getElementById('rxNotesInput') as HTMLTextAreaElement | null;
  const saveBtn = document.getElementById('saveRxBtn') as HTMLButtonElement | null;

  if (!patientSelect || !patientSelect.value) {
    alert('Mohon pilih pasien terlebih dahulu.');
    return;
  }

  const patientId = patientSelect.value;
  const patient = allPatients.find(p => p.id === patientId);

  // Gather item rows
  const itemRows = document.querySelectorAll('#rxItemsContainer > div');
  const items: PrescriptionItem[] = [];

  itemRows.forEach(row => {
    const medName = (row.querySelector('.rx-med-name') as HTMLInputElement)?.value.trim();
    const dosage = (row.querySelector('.rx-med-dosage') as HTMLInputElement)?.value.trim();
    const instructions = (row.querySelector('.rx-med-instructions') as HTMLInputElement)?.value.trim() || '';

    if (medName && dosage) {
      items.push({ med_name: medName, dosage, instructions });
    }
  });

  if (items.length === 0) {
    alert('Mohon tambahkan minimal 1 jenis obat dalam resep.');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `⏳ Menyimpan...`;
  }

  try {
    const rxData = {
      patient_id: patientId,
      patient_name: patient?.name || 'Pasien',
      patient_code: patient?.code || '#VET-000',
      species: `${patient?.species || ''} (${patient?.breed || ''})`,
      owner_name: patient?.owner_name || '-',
      doctor_name: doctorSelect?.value || 'Dr. Sarah Jenkins',
      prescription_number: rxNumInput?.value.trim() || `RX-${Date.now()}`,
      date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
      duration: durationSelect?.value || '7 Hari',
      status: 'Active',
      notes: notesInput?.value.trim() || '',
      items: items
    };

    await addPrescription(rxData);

    showToastNotification('E-Resep berhasil diterbitkan & disinkronkan ke rekam medis pasien!');

    // Close modal & reset
    document.getElementById('newPrescriptionModal')?.classList.add('hidden');
    (document.getElementById('createPrescriptionForm') as HTMLFormElement)?.reset();
  } catch (err) {
    console.error('Failed to save prescription:', err);
    alert('Gagal menyimpan resep. Coba lagi.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Simpan & Terbitkan Resep`;
      if ((window as any).lucide) (window as any).lucide.createIcons();
    }
  }
}

(window as any).handleRxStatusChange = async (rxId: string, newStatus: string) => {
  try {
    await updatePrescriptionStatus(rxId, newStatus);
    showToastNotification(`Status resep diperbarui menjadi "${newStatus}"`);
  } catch (err) {
    console.error('Error updating prescription status:', err);
  }
};

(window as any).handleDeleteRx = async (rxId: string) => {
  if (confirm('Apakah Anda yakin ingin menghapus resep obat ini?')) {
    try {
      await deletePrescription(rxId);
      showToastNotification('Resep obat berhasil dihapus.');
    } catch (err) {
      console.error('Error deleting rx:', err);
    }
  }
};

(window as any).openRxPreviewModal = (rxId: string) => {
  const rx = allPrescriptions.find(p => p.id === rxId);
  if (!rx) return;

  currentViewingRx = rx;

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

function showToastNotification(msg: string) {
  const toast = document.getElementById('toastNotification');
  const msgElem = document.getElementById('toastMessage');
  if (toast && msgElem) {
    msgElem.textContent = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
  }
}
