import { getCurrentUser, initSidebarProfile, logout } from './auth';
import { db, subscribePatients, subscribeMedicalRecords, escapeHtml } from './firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, doc, setDoc } from 'firebase/firestore';

document.addEventListener('DOMContentLoaded', async () => {
  const user = getCurrentUser();
  
  // Guard: if user is not doctor, allow them to view or provide banner to switch
  initSidebarProfile();

  // Populate Doctor Profile Banner
  const docNameElem = document.getElementById('doctorPortalName');
  const docSipElem = document.getElementById('doctorPortalSip');
  const docSpecElem = document.getElementById('doctorPortalSpec');

  if (docNameElem) docNameElem.textContent = user.name;
  if (docSipElem) docSipElem.textContent = user.nip_sip;
  if (docSpecElem) docSpecElem.textContent = user.specialization || 'Dokter Hewan Praktik';

  // Load patients list into select dropdown
  const patientSelect = document.getElementById('doctorPatientSelect') as HTMLSelectElement | null;
  subscribePatients((patients) => {
    if (patientSelect) {
      patientSelect.innerHTML = '<option value="">-- Pilih Pasien Hewan --</option>';
      patients.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.code || '#VET'} - ${p.name} (${p.species}) | Pemilik: ${p.owner_name}`;
        opt.dataset.patientName = p.name;
        opt.dataset.patientCode = p.code || '';
        opt.dataset.ownerName = p.owner_name;
        opt.dataset.species = p.species;
        patientSelect.appendChild(opt);
      });
    }

    // Populate Queue Table
    const queueTbody = document.getElementById('doctorQueueTbody');
    if (queueTbody) {
      const activePatients = patients.filter(p => p.status !== 'Sehat').slice(0, 5);
      if (activePatients.length === 0) {
        queueTbody.innerHTML = '<tr><td colspan="6" class="px-5 py-6 text-center text-xs text-slate-400">Semua pasien hewan dalam kondisi sehat / tidak ada antrean darurat.</td></tr>';
      } else {
        queueTbody.innerHTML = activePatients.map(p => `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-5 py-3.5 font-mono text-xs text-slate-500">${escapeHtml(p.code || '#PT-0000')}</td>
            <td class="px-5 py-3.5 font-bold text-sm text-slate-900">${escapeHtml(p.name)} <span class="text-xs text-slate-500 font-normal">(${escapeHtml(p.species)})</span></td>
            <td class="px-5 py-3.5 text-xs text-slate-700">${escapeHtml(p.owner_name)}</td>
            <td class="px-5 py-3.5 text-xs">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                ${escapeHtml(p.status)}
              </span>
            </td>
            <td class="px-5 py-3.5 text-xs text-slate-600">${escapeHtml(p.last_visit || 'Hari ini')}</td>
            <td class="px-5 py-3.5 text-right">
              <a href="patient.html?id=${escapeHtml(p.id)}" class="inline-flex items-center gap-1 text-xs font-bold text-vetgreen-800 hover:underline">
                Periksa <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
              </a>
            </td>
          </tr>
        `).join('');
      }
    }
  });

  // Handle Quick Clinical Soap Form Submit
  const quickNoteForm = document.getElementById('doctorQuickNoteForm') as HTMLFormElement | null;
  const doctorAlert = document.getElementById('doctorActionAlert');

  if (quickNoteForm) {
    quickNoteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const patientId = patientSelect?.value;
      const titleInput = (document.getElementById('doctorNoteTitle') as HTMLInputElement)?.value;
      const detailInput = (document.getElementById('doctorNoteDetail') as HTMLTextAreaElement)?.value;
      const medNameInput = (document.getElementById('doctorMedName') as HTMLInputElement)?.value;
      const dosageInput = (document.getElementById('doctorMedDosage') as HTMLInputElement)?.value;

      if (!patientId) {
        alert('Harap pilih pasien hewan terlebih dahulu.');
        return;
      }

      try {
        const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        
        // Add Clinical note
        await addDoc(collection(db, 'clinical_notes'), {
          patient_id: patientId,
          title: titleInput || 'Catatan Diagnosis Dokter',
          detail: detailInput,
          note_date: todayStr,
          doctor_name: user.name,
          created_at: serverTimestamp()
        });

        // Add Prescription if medication added
        if (medNameInput) {
          const selectedOpt = patientSelect?.options[patientSelect.selectedIndex];
          const pName = selectedOpt?.dataset.patientName || 'Pasien';
          const pCode = selectedOpt?.dataset.patientCode || '#PT-0000';
          const pSpecies = selectedOpt?.dataset.species || 'Hewan';
          const pOwner = selectedOpt?.dataset.ownerName || 'Pemilik';

          const rxRef = doc(collection(db, 'prescriptions'));
          await setDoc(rxRef, {
            patient_id: patientId,
            patient_name: pName,
            patient_code: pCode,
            species: pSpecies,
            owner_name: pOwner,
            doctor_name: user.name,
            prescription_number: 'RX-' + Math.floor(1000 + Math.random() * 9000),
            date: todayStr,
            duration: '5 Hari',
            status: 'Active',
            notes: detailInput || 'Diberikan langsung oleh dokter.',
            items: [
              { med_name: medNameInput, dosage: dosageInput || '1x sehari', instructions: 'Sesuai instruksi dokter' }
            ],
            created_at: serverTimestamp()
          });
        }

        if (doctorAlert) {
          doctorAlert.textContent = '✓ Catatan Medis & E-Prescription Berhasil Disimpan!';
          doctorAlert.classList.remove('hidden');
          setTimeout(() => doctorAlert.classList.add('hidden'), 4000);
        }

        quickNoteForm.reset();
      } catch (err) {
        console.error('Error saving doctor notes:', err);
        alert('Gagal menyimpan rekam medis.');
      }
    });
  }

  // Subscribe to Recent Doctor Clinical Notes
  const notesContainer = document.getElementById('doctorRecentNotesFeed');
  if (notesContainer) {
    const q = query(collection(db, 'clinical_notes'), orderBy('created_at', 'desc'), limit(6));
    onSnapshot(q, (snap) => {
      if (snap.empty) {
        notesContainer.innerHTML = '<div class="text-xs text-slate-400">Belum ada catatan medis terbaru.</div>';
        return;
      }

      notesContainer.innerHTML = snap.docs.map(d => {
        const data = d.data();
        return `
          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-900">${escapeHtml(data.title || 'Pemeriksaan Klinis')}</span>
              <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(data.note_date || 'Hari ini')}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-2">${escapeHtml(data.detail || '-')}</p>
            <div class="text-[10px] text-emerald-800 font-medium pt-1">Dokter: ${escapeHtml(data.doctor_name || user.name)}</div>
          </div>
        `;
      }).join('');
    });
  }

  if ((window as any).lucide) {
    (window as any).lucide.createIcons();
  }
});
