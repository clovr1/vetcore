import {
  seedDatabaseIfEmpty,
  subscribePatients,
  subscribeMedicalRecords,
  db,
  escapeHtml
} from './firebase';
import { initSidebarProfile, getCurrentUser } from './auth';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';

document.addEventListener('DOMContentLoaded', async () => {
  const user = getCurrentUser();
  initSidebarProfile();
  await seedDatabaseIfEmpty();

  const isDoctor = user.role === 'doctor';

  // Show/hide sections based on role
  const doctorSections = [
    'doctorUpNextSection', 'doctorScheduleSection', 'doctorSoapSection',
    'doctorTasksSection', 'doctorNotesSection'
  ];
  const foSections = ['foRecentActivitySection', 'foStatsSection'];

  doctorSections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !isDoctor);
  });
  foSections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', isDoctor);
  });

  // Greeting
  const greetingEl = document.getElementById('dashboardGreeting');
  if (greetingEl) {
    if (isDoctor) {
      const hour = new Date().getHours();
      let greeting = 'Selamat Malam';
      if (hour >= 4 && hour < 12) greeting = 'Selamat Pagi';
      else if (hour >= 12 && hour < 17) greeting = 'Selamat Siang';
      else if (hour >= 17 && hour < 21) greeting = 'Selamat Sore';
      greetingEl.textContent = greeting + ', ' + user.name.split(',')[0];
    } else {
      greetingEl.textContent = 'Dashboard Overview';
    }
  }

  // Date
  const overviewDateElem = document.getElementById('overviewDate');
  if (overviewDateElem) {
    overviewDateElem.textContent = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Stats
  let patientsCount = 0;
  let recordsCount = 0;

  subscribePatients((patients) => {
    patientsCount = patients.length;
    const totalElem = document.getElementById('totalPatientsCount');
    if (totalElem) totalElem.textContent = patientsCount.toLocaleString('id-ID');

    const newThisMonthElem = document.getElementById('newPatientsThisMonth');
    if (newThisMonthElem) {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const newThisMonth = patients.filter(p => {
        if (!p.created_at?.seconds) return true;
        const d = new Date(p.created_at.seconds * 1000);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }).length;
      newThisMonthElem.textContent = newThisMonth.toString();
    }

    // Doctor-only features
    if (isDoctor) {
      renderUpNext(patients);
      renderDailySchedule(patients);
      renderPendingTasks(patients);
    }

    // Front Office stats
    if (!isDoctor) {
      const active = patients.filter(p => p.status === 'Sedang Ditangani' || p.status === 'Perawatan').length;
      const needAttention = patients.filter(p => p.status === 'Perawatan').length;
      const healthy = patients.filter(p => p.status === 'Sehat' || p.status === 'Selesai').length;

      const foActive = document.getElementById('foActivePatients');
      const foNeed = document.getElementById('foNeedAttention');
      const foHealthy = document.getElementById('foHealthy');
      if (foActive) foActive.textContent = String(active);
      if (foNeed) foNeed.textContent = String(needAttention);
      if (foHealthy) foHealthy.textContent = String(healthy);
    }
  });

  // Medical records
  subscribeMedicalRecords((records) => {
    recordsCount = records.length;
    const medRecElem = document.getElementById('totalMedicalRecords');
    if (medRecElem) medRecElem.textContent = recordsCount.toLocaleString('id-ID');
  });

  // Prescriptions count
  onSnapshot(collection(db, 'prescriptions'), (snap) => {
    const rxElem = document.getElementById('totalPrescriptions');
    if (rxElem) rxElem.textContent = snap.size.toLocaleString('id-ID');
  });

  // Recent activity (Front Office)
  const recentFeedContainer = document.getElementById('recentActivityFeed');
  if (recentFeedContainer) {
    const notesQuery = query(collection(db, 'clinical_notes'), orderBy('created_at', 'desc'), limit(6));
    onSnapshot(notesQuery, (snap) => {
      if (snap.empty) {
        recentFeedContainer.innerHTML = '<div class="text-xs text-slate-400 p-3">Belum ada aktivitas terbaru.</div>';
        return;
      }
      recentFeedContainer.innerHTML = snap.docs.map(docSnap => {
        const data = docSnap.data();
        const title = data.title || 'Catatan Klinis';
        const initials = title.substring(0, 2).toUpperCase();
        const dateStr = data.note_date || '';
        let dateFormatted = 'Hari ini';
        if (dateStr) {
          try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              dateFormatted = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            } else {
              dateFormatted = dateStr;
            }
          } catch { dateFormatted = dateStr; }
        }
        return '<div class="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">' +
          '<div class="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">' +
          '<span class="text-emerald-700 font-bold text-[11px]">' + escapeHtml(initials) + '</span></div>' +
          '<div class="flex-1 min-w-0">' +
          '<p class="text-xs font-bold text-slate-800 truncate">' + escapeHtml(title) + '</p>' +
          '<p class="text-[11px] text-slate-500 mt-0.5 truncate">' + escapeHtml(data.detail || '') + '</p></div>' +
          '<span class="text-[10px] text-slate-400 whitespace-nowrap shrink-0">' + escapeHtml(dateFormatted) + '</span></div>';
      }).join('');
    });
  }

  // Doctor: Recent Notes
  const notesContainer = document.getElementById('recentNotesFeed');
  if (notesContainer && isDoctor) {
    const notesQuery = query(collection(db, 'clinical_notes'), orderBy('created_at', 'desc'), limit(5));
    onSnapshot(notesQuery, (snap) => {
      if (snap.empty) {
        notesContainer.innerHTML = '<div class="text-[11px] text-slate-400 p-2">Belum ada catatan.</div>';
        return;
      }
      notesContainer.innerHTML = snap.docs.map(d => {
        const data = d.data();
        return '<div class="p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">' +
          '<div class="flex items-center justify-between mb-0.5">' +
          '<span class="text-xs font-semibold text-slate-700">' + escapeHtml(data.title || 'Pemeriksaan') + '</span>' +
          '<span class="text-[10px] text-slate-400">' + escapeHtml(data.note_date || '') + '</span></div>' +
          '<p class="text-[10px] text-slate-500 line-clamp-1">' + escapeHtml(data.detail || '-') + '</p></div>';
      }).join('');
    });
  }

  // Doctor: Up Next
  function renderUpNext(patients: any[]) {
    const container = document.getElementById('upNextContent');
    const timeEl = document.getElementById('upNextTime');
    if (!container) return;

    const activePatients = patients.filter(p => p.status === 'Sedang Ditangani' || p.status === 'Perawatan' || p.status === 'Menunggu Pemeriksaan');
    const nextPatient = activePatients[0];

    if (!nextPatient) {
      container.innerHTML = '<div class="text-center py-6"><div class="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3"><i data-lucide="check-circle-2" class="w-7 h-7 text-emerald-500"></i></div><p class="text-sm font-semibold text-slate-700">Semua pasien sudah ditangani</p><p class="text-xs text-slate-400 mt-1">Tidak ada dalam antrean</p></div>';
      if (timeEl) timeEl.textContent = '-';
      if ((window as any).lucide) (window as any).lucide.createIcons();
      return;
    }

    if (timeEl) timeEl.textContent = nextPatient.visit_time || 'Segera';
    const speciesEmoji = nextPatient.species === 'Canine' ? 'Dog' : nextPatient.species === 'Feline' ? 'Cat' : 'Pet';

    container.innerHTML = '<div class="flex flex-col sm:flex-row gap-4">' +
      '<div class="w-full sm:w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-slate-100 border border-emerald-200 flex items-center justify-center shrink-0">' +
      '<span class="text-2xl font-bold text-emerald-700">' + speciesEmoji.charAt(0) + '</span></div>' +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex items-center gap-2 mb-1"><h4 class="font-bold text-lg text-slate-900">' + escapeHtml(nextPatient.name) + '</h4><span class="badge badge-slate text-[10px]">' + escapeHtml(nextPatient.species) + '</span></div>' +
      '<p class="text-xs text-slate-500 mb-2">' + escapeHtml(nextPatient.owner_name) + ' &bull; ' + escapeHtml(nextPatient.code || '#PT-0000') + '</p>' +
      '<div class="p-3 bg-white/70 rounded-xl border border-slate-100"><p class="text-[11px] font-semibold text-slate-600 mb-1">KELUHAN UTAMA</p><p class="text-xs text-slate-700">' + escapeHtml(nextPatient.diagnosis || 'Belum ada catatan') + '</p></div>' +
      '<div class="flex items-center gap-2 mt-3">' +
      '<a href="patient.html?id=' + escapeHtml(nextPatient.id) + '" class="btn btn-primary text-xs py-2 px-4"><i data-lucide="stethoscope" class="w-3.5 h-3.5"></i> Mulai Periksa</a>' +
      '<a href="patient.html?id=' + escapeHtml(nextPatient.id) + '" class="btn btn-secondary text-xs py-2 px-4"><i data-lucide="history" class="w-3.5 h-3.5"></i> Riwayat</a></div></div></div>';
    if ((window as any).lucide) (window as any).lucide.createIcons();
  }

  // Doctor: Daily Schedule
  function renderDailySchedule(patients: any[]) {
    const container = document.getElementById('dailyScheduleList');
    if (!container) return;

    const schedulePatients = patients
      .filter(p => p.status !== 'Sehat' && p.status !== 'Selesai')
      .sort((a, b) => (a.visit_time || '99:99').localeCompare(b.visit_time || '99:99'))
      .slice(0, 6);
    if (schedulePatients.length === 0) {
      container.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs">Tidak ada jadwal hari ini.</div>';
      return;
    }

    const statusMap: Record<string, { label: string; cls: string }> = {
      'Menunggu Pemeriksaan': { label: 'Menunggu', cls: 'badge-amber' },
      'Perawatan': { label: 'Perawatan', cls: 'badge-amber' },
      'Sedang Ditangani': { label: 'Diperiksa', cls: 'badge-emerald' },
      'Sehat': { label: 'Selesai', cls: 'badge-slate' },
      'Selesai': { label: 'Selesai', cls: 'badge-slate' },
    };

    container.innerHTML = schedulePatients.map((p) => {
      const time = p.visit_time || '--:--';
      const status = statusMap[p.status] || { label: p.status, cls: 'badge-slate' };
      const speciesEmoji = p.species === 'Canine' ? 'Dog' : p.species === 'Feline' ? 'Cat' : 'Pet';
      return '<a href="patient.html?id=' + escapeHtml(p.id) + '" class="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">' +
        '<div class="text-center min-w-[50px]"><p class="schedule-time text-sm font-bold text-slate-800">' + time + '</p></div>' +
        '<div class="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">' +
        '<span class="text-xs font-bold text-slate-600">' + speciesEmoji.charAt(0) + '</span></div>' +
        '<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-slate-800 truncate">' + escapeHtml(p.name) + '</p>' +
        '<p class="text-[11px] text-slate-500 truncate">' + escapeHtml(p.diagnosis || p.species) + ' &bull; ' + escapeHtml(p.owner_name) + '</p></div>' +
        '<span class="badge ' + status.cls + ' text-[10px]">' + status.label + '</span>' +
        '<i data-lucide="chevron-right" class="w-4 h-4 text-slate-300 shrink-0"></i></a>';
    }).join('');
    if ((window as any).lucide) (window as any).lucide.createIcons();
  }

  // Doctor: Pending Tasks
  function renderPendingTasks(patients: any[]) {
    const container = document.getElementById('pendingTasksList');
    if (!container) return;

    const tasks: { icon: string; iconColor: string; iconBg: string; title: string; subtitle: string; urgent?: boolean }[] = [];

    const waitingExam = patients.filter(p => p.status === 'Menunggu Pemeriksaan');
    if (waitingExam.length > 0) {
      tasks.push({
        icon: 'clock', iconColor: 'text-blue-600', iconBg: 'bg-blue-50 border-blue-200',
        title: 'Periksa Pasien (' + waitingExam.length + ' menunggu)',
        subtitle: waitingExam.map(p => p.name + (p.visit_time ? ' (' + p.visit_time + ')' : '')).join(', ')
      });
    }

    const needingRx = patients.filter(p => p.status === 'Perawatan');
    if (needingRx.length > 0) {
      tasks.push({
        icon: 'pill', iconColor: 'text-red-600', iconBg: 'bg-red-50 border-red-200',
        title: 'Tulis Resep (' + needingRx.length + ' pasien)',
        subtitle: needingRx.map(p => p.name).join(', '), urgent: true
      });
    }

    const needCheckup = patients.filter(p => p.status === 'Sedang Ditangani');
    if (needCheckup.length > 0) {
      tasks.push({
        icon: 'clipboard-check', iconColor: 'text-amber-600', iconBg: 'bg-amber-50 border-amber-200',
        title: 'Periksa Ulang (' + needCheckup.length + ' pasien)',
        subtitle: 'Butuh evaluasi lanjutan'
      });
    }

    tasks.push({
      icon: 'file-signature', iconColor: 'text-blue-600', iconBg: 'bg-blue-50 border-blue-200',
      title: 'Verifikasi Catatan', subtitle: 'Tandai catatan sebagai final'
    });

    container.innerHTML = tasks.map(t =>
      '<div class="p-4 hover:bg-slate-50 transition-all cursor-pointer"><div class="flex items-start gap-3">' +
      '<div class="w-9 h-9 rounded-xl ' + t.iconBg + ' border flex items-center justify-center shrink-0">' +
      '<i data-lucide="' + t.icon + '" class="w-4 h-4 ' + t.iconColor + '"></i></div>' +
      '<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-slate-800">' + escapeHtml(t.title) + '</p>' +
      '<p class="text-[11px] text-slate-500 mt-0.5">' + escapeHtml(t.subtitle) + '</p></div>' +
      (t.urgent ? '<span class="badge badge-red text-[9px]">URGENT</span>' : '') +
      '<i data-lucide="chevron-right" class="w-4 h-4 text-slate-300 shrink-0 mt-1"></i></div></div>'
    ).join('');
    if ((window as any).lucide) (window as any).lucide.createIcons();
  }

  // Doctor: SOAP Form
  const patientSelect = document.getElementById('doctorPatientSelect') as HTMLSelectElement | null;
  if (isDoctor) {
    subscribePatients((patients) => {
      if (patientSelect) {
        patientSelect.innerHTML = '<option value="">-- Pilih Pasien --</option>';
        patients.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id!;
          opt.textContent = (p.code || '#VET') + ' - ' + p.name + ' (' + p.species + ') | ' + p.owner_name;
          opt.dataset.patientName = p.name;
          opt.dataset.patientCode = p.code || '';
          opt.dataset.ownerName = p.owner_name;
          opt.dataset.species = p.species;
          patientSelect.appendChild(opt);
        });
      }
    });

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

        if (!patientId) { alert('Pilih pasien hewan terlebih dahulu.'); return; }

        try {
          const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
          await addDoc(collection(db, 'clinical_notes'), {
            patient_id: patientId, title: titleInput || 'Catatan Diagnosis', detail: detailInput,
            note_date: todayStr, doctor_name: user.name, created_at: serverTimestamp()
          });

          if (medNameInput) {
            const selectedOpt = patientSelect?.options[patientSelect.selectedIndex];
            const rxRef = doc(collection(db, 'prescriptions'));
            await setDoc(rxRef, {
              patient_id: patientId, patient_name: selectedOpt?.dataset.patientName || 'Pasien',
              patient_code: selectedOpt?.dataset.patientCode || '#PT-0000',
              species: selectedOpt?.dataset.species || 'Hewan',
              owner_name: selectedOpt?.dataset.ownerName || 'Pemilik',
              doctor_name: user.name, prescription_number: 'RX-' + Math.floor(1000 + Math.random() * 9000),
              date: todayStr, duration: '5 Hari', status: 'Active',
              notes: detailInput || 'Diberikan oleh dokter.',
              items: [{ med_name: medNameInput, dosage: dosageInput || '1x sehari', instructions: 'Sesuai instruksi dokter' }],
              created_at: serverTimestamp()
            });
          }

          if (doctorAlert) {
            doctorAlert.textContent = 'Catatan medis berhasil disimpan!';
            doctorAlert.classList.remove('hidden');
            setTimeout(() => doctorAlert.classList.add('hidden'), 3000);
          }
          quickNoteForm.reset();
        } catch (err) {
          console.error('Error saving:', err);
          alert('Gagal menyimpan.');
        }
      });
    }
  }
});
