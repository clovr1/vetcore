import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  collection, 
  doc, 
  setDoc,
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, dbId);

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface Patient {
  id?: string;
  code?: string;
  name: string;
  species: string;
  breed: string;
  gender: string;
  age: string;
  owner_name: string;
  phone: string;
  address: string;
  status: string; // 'Sehat' | 'Pemulihan' | 'Perlu Perhatian'
  weight: string;
  temperature: string;
  heart_rate: string;
  doctor_name: string;
  last_visit: string;
  avatar_idx?: number;
  created_at?: any;
}

export interface ClinicalNote {
  id?: string;
  patient_id: string;
  title: string;
  detail: string;
  note_date: string;
  created_at?: any;
}

export interface Medication {
  id?: string;
  patient_id: string;
  name: string;
  dose: string;
  created_at?: any;
}

export interface PrescriptionItem {
  med_name: string;
  dosage: string;
  instructions: string;
}

export interface Prescription {
  id?: string;
  patient_id: string;
  patient_name?: string;
  patient_code?: string;
  species?: string;
  owner_name?: string;
  doctor_name: string;
  prescription_number: string;
  date: string;
  duration: string;
  status: string; // 'Active' | 'Selesai' | 'Dibatalkan'
  notes?: string;
  items: PrescriptionItem[];
  created_at?: any;
}

export interface Vaccination {
  id?: string;
  patient_id: string;
  vaccine_name: string;
  vaccine_type: string;
  given_date: string;
  due_date: string;
  status: string; // 'Up to Date' | 'Sebentar Lagi' | 'Perlu Booster'
  notes?: string;
  created_at?: any;
}

export interface Doctor {
  id?: string;
  name: string;
  specialization: string;
}

export interface MedicalRecord {
  id?: string;
  patient_id?: string;
  mrn: string;
  patient_name?: string;
  date: string;
  time: string;
  subjective: string;
  objective: string;
  diagnosis: string[];
  treatments: string[];
  doctor_name: string;
  doctor_initials: string;
  notes: string;
  created_at?: any;
}

// Initial seed data if Firestore is empty
const INITIAL_DOCTORS: Doctor[] = [
  { name: 'Dr. Sarah Jenkins', specialization: 'General Practitioner' },
  { name: 'Dr. Michael Lee', specialization: 'Veterinary Surgeon' },
  { name: 'Dr. Amanda', specialization: 'Veterinary Dermatologist' },
  { name: 'Dr. Smith', specialization: 'Internal Medicine' },
];

const INITIAL_PATIENTS: Patient[] = [
  {
    code: '#VET-001',
    name: 'Buddy',
    species: 'Anjing',
    breed: 'Golden Retriever',
    gender: 'Jantan',
    age: '3 Tahun',
    owner_name: 'Ahmad Fauzi',
    phone: '0812-3456-7890',
    address: 'Jl. Merdeka No. 12, Bandung',
    status: 'Sehat',
    weight: '28.4 kg',
    temperature: '38.2 °C',
    heart_rate: '88 bpm',
    doctor_name: 'Dr. Sarah Jenkins',
    last_visit: '2025-07-13',
    avatar_idx: 0
  },
  {
    code: '#VET-002',
    name: 'Milo',
    species: 'Kucing',
    breed: 'Anggora',
    gender: 'Jantan',
    age: '2 Tahun',
    owner_name: 'Siti Rahayu',
    phone: '0813-2211-4455',
    address: 'Jl. Kenanga No. 5, Bandung',
    status: 'Sehat',
    weight: '4.1 kg',
    temperature: '38.5 °C',
    heart_rate: '140 bpm',
    doctor_name: 'Dr. Michael Lee',
    last_visit: '2025-06-20',
    avatar_idx: 1
  },
  {
    code: '#VET-003',
    name: 'Bella',
    species: 'Anjing',
    breed: 'Poodle',
    gender: 'Betina',
    age: '1 Tahun',
    owner_name: 'Budi Santoso',
    phone: '0857-1122-3344',
    address: 'Jl. Dago No. 88, Bandung',
    status: 'Pemulihan',
    weight: '6.8 kg',
    temperature: '38.9 °C',
    heart_rate: '110 bpm',
    doctor_name: 'Dr. Sarah Jenkins',
    last_visit: '2025-05-05',
    avatar_idx: 2
  },
  {
    code: '#VET-004',
    name: 'Luna',
    species: 'Kucing',
    breed: 'Persia',
    gender: 'Betina',
    age: '4 Tahun',
    owner_name: 'Rina Wati',
    phone: '0812-2233-9900',
    address: 'Jl. Cihampelas No. 21, Bandung',
    status: 'Perlu Perhatian',
    weight: '4.6 kg',
    temperature: '38.6 °C',
    heart_rate: '120 bpm',
    doctor_name: 'Dr. Amanda',
    last_visit: '2025-07-06',
    avatar_idx: 3
  }
];

export async function clearAllDatabaseData() {
  const cols = ['patients', 'medical_records', 'clinical_notes', 'medications', 'prescriptions', 'doctors', 'vaccinations'];
  for (const colName of cols) {
    try {
      const snap = await getDocs(collection(db, colName));
      let batch = writeBatch(db);
      let count = 0;
      for (const docSnap of snap.docs) {
        batch.delete(doc(db, colName, docSnap.id));
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
    } catch (e) {
      console.error(`Error clearing collection ${colName}:`, e);
    }
  }
  try {
    localStorage.setItem('db_cleared_v1', 'true');
  } catch (e) {}
}

const OWNER_POOL = [
  { name: 'Budi Santoso', phone: '+62 812-3456-7890', address: 'Jl. Sudirman No. 12, Jakarta Selatan' },
  { name: 'Siti Rahmawati', phone: '+62 813-9876-5432', address: 'Jl. Malioboro No. 45, Yogyakarta' },
  { name: 'Sarah Jenkins', phone: '+62 812-1122-3344', address: 'Menteng Residence, Jakarta Pusat' },
  { name: 'Ahmad Hidayat', phone: '+62 856-1234-5678', address: 'Jl. Asia Afrika No. 88, Bandung' },
  { name: 'Emily Chen', phone: '+62 819-8765-4321', address: 'Pakubuwono Terrace, Jakarta Selatan' },
  { name: 'Mark Thompson', phone: '+62 811-2233-4455', address: 'BSD City Sector 7, Tangerang' },
  { name: 'Dewi Lestari', phone: '+62 813-4455-6677', address: 'Jl. Raya Darmo No. 10, Surabaya' },
  { name: 'David Miller', phone: '+62 812-9988-7766', address: 'Kemang Club Villas, Jakarta Selatan' },
  { name: 'Rian Hidayat', phone: '+62 878-5544-3322', address: 'Jl. Dago No. 120, Bandung' },
  { name: 'Jessica Alba', phone: '+62 813-1111-2222', address: 'Pondok Indah, Jakarta Selatan' },
  { name: 'Andi Wijaya', phone: '+62 852-3344-5566', address: 'Jl. Gajah Mada No. 5, Semarang' },
  { name: 'Tri Utami', phone: '+62 812-7788-9900', address: 'Jl. Slamet Riyadi No. 34, Solo' },
  { name: 'Eko Prasetyo', phone: '+62 813-6677-8899', address: 'Jl. Pemuda No. 8, Medan' },
  { name: 'Nita Anggraini', phone: '+62 818-4433-2211', address: 'Jl. Pajajaran No. 50, Bogor' },
  { name: 'Hendra Setiawan', phone: '+62 812-5566-7788', address: 'Serpong Garden, Tangerang' },
  { name: 'Rina Wati', phone: '+62 812-2233-9900', address: 'Jl. Cihampelas No. 21, Bandung' },
  { name: 'Lia Rosita', phone: '+62 857-8899-0011', address: 'Bintaro Jaya Sektor 9, Tangerang Selatan' },
  { name: 'Doni Kurniawan', phone: '+62 813-3344-5566', address: 'Jl. Magelang Km 5, Yogyakarta' },
  { name: 'Agus Supriyanto', phone: '+62 812-8877-6655', address: 'Jl. Diponegoro No. 15, Semarang' },
  { name: 'Maya Indah', phone: '+62 819-0011-2233', address: 'Kelapa Gading Villa, Jakarta Utara' },
  { name: 'Rizal Pratama', phone: '+62 813-7766-5544', address: 'Jl. Veteran No. 30, Malang' },
  { name: 'Bayu Firmansyah', phone: '+62 856-9900-1122', address: 'Cibubur Junction, Depok' },
  { name: 'Dian Sastro', phone: '+62 812-4455-1122', address: 'Kebayoran Baru, Jakarta Selatan' },
  { name: 'Gita Gutawa', phone: '+62 813-8899-2233', address: 'Senopati Suites, Jakarta Selatan' },
  { name: 'Indra Wijaya', phone: '+62 818-7766-3344', address: 'Taman Anggrek, Jakarta Barat' },
  { name: 'Mega Putri', phone: '+62 812-1133-5577', address: 'Puri Indah, Jakarta Barat' },
  { name: 'Nanda Pratama', phone: '+62 819-2244-6688', address: 'Harapan Indah, Bekasi' },
  { name: 'Oki Setiana', phone: '+62 813-5577-9911', address: 'Margonda Raya, Depok' },
  { name: 'Putri Marino', phone: '+62 812-6688-0022', address: 'Sanur Villa, Bali' },
  { name: 'Reza Rahadian', phone: '+62 811-3355-7799', address: 'Cilandak Town Square, Jakarta Selatan' },
  { name: 'Titi Kamal', phone: '+62 813-4422-1100', address: 'Kemang Raya, Jakarta Selatan' },
  { name: 'Utami Dewi', phone: '+62 857-1133-5599', address: 'Jl. Sunda No. 12, Bandung' },
  { name: 'Wawan Hermawan', phone: '+62 813-8877-9900', address: 'Jl. Setiabudi No. 40, Bandung' },
  { name: 'Yulia Rachman', phone: '+62 818-5533-1177', address: 'Tebet Green, Jakarta Selatan' },
  { name: 'Zainal Abidin', phone: '+62 812-3311-9955', address: 'Jl. Pemuda No. 88, Surabaya' },
  { name: 'Aris Munandar', phone: '+62 856-7788-9900', address: 'Jl. Gejayan No. 10, Yogyakarta' },
  { name: 'Cinta Laura', phone: '+62 813-5566-7788', address: 'Kuningan Place, Jakarta Selatan' },
  { name: 'Dedi Mulyadi', phone: '+62 818-1122-3344', address: 'Jl. Cipaganti No. 55, Bandung' },
  { name: 'Ersa Mayori', phone: '+62 812-4433-2211', address: 'BSD Green Office, Tangerang' },
  { name: 'Irfan Hakim', phone: '+62 818-3355-7799', address: 'Ciganjur Villa, Jakarta Selatan' },
  { name: 'Raffi Ahmad', phone: '+62 811-8888-9999', address: 'Andara Residence, Depok' }
];

const PET_NAMES = [
  'Luna', 'Milo', 'Oliver', 'Spike', 'Max', 'Bella', 'Kopi', 'Oyen', 'Blacky', 'Molly',
  'Bruno', 'Leo', 'Simba', 'Rocky', 'Charlie', 'Coco', 'Lucy', 'Daisy', 'Toby', 'Buster',
  'Chloe', 'Oscar', 'Felix', 'Mochi', 'Brownie', 'Caramel', 'Snowball', 'Tiger', 'Pumpkin', 'Peanut',
  'Nala', 'Teddy', 'Ziggy', 'Cookie', 'Shadow', 'Princess', 'Bandit', 'Rex', 'Dexter', 'Pepper',
  'Penny', 'Hazel', 'Gizmo', 'Lola', 'Sam', 'Rusty', 'Frank', 'Louie', 'Otis', 'Boba',
  'Choco', 'Whiskers', 'Fluffy', 'Mittens', 'Cleo', 'Oreo', 'Ciko', 'Comel', 'Manis', 'Bagus'
];

const SPECIES_CONFIG = [
  {
    species: 'Canine',
    breeds: ['Golden Retriever', 'German Shepherd', 'Beagle', 'Poodle', 'Labrador Retriever', 'Siberian Husky', 'Pomeranian', 'Shih Tzu', 'Bulldog', 'Chihuahua', 'French Bulldog', 'Rottweiler', 'Shiba Inu', 'Dachshund', 'Maltese'],
    weightRange: [3, 35],
    tempRange: [38.0, 39.2],
    hrRange: [80, 140]
  },
  {
    species: 'Feline',
    breeds: ['Domestic Shorthair', 'Persian Cat', 'Maine Coon', 'Siamese', 'Ragdoll', 'British Shorthair', 'Bengal', 'Sphynx', 'Domestic Longhair', 'Scottish Fold', 'Abyssinian', 'American Shorthair'],
    weightRange: [2.5, 6.5],
    tempRange: [38.0, 39.2],
    hrRange: [120, 180]
  },
  {
    species: 'Exotic',
    breeds: ['Bearded Dragon', 'Iguana', 'Sugar Glider', 'Tortoise', 'Hamster', 'Guinea Pig', 'Chinchilla', 'Hedgehog', 'Leopard Gecko'],
    weightRange: [0.1, 1.8],
    tempRange: [32.0, 36.5],
    hrRange: [60, 110]
  },
  {
    species: 'Rabbit',
    breeds: ['Kelinci Anggora', 'Holland Lop', 'Netherland Dwarf', 'Rex Rabbit', 'Lionhead', 'Flemish Giant'],
    weightRange: [1.0, 3.8],
    tempRange: [38.5, 40.0],
    hrRange: [180, 250]
  }
];

const DOCTORS = [
  'Dr. Sarah Jenkins',
  'Dr. Michael Lee',
  'Dr. Amanda',
  'Dr. Smith',
  'Dr. Budi Prasetyo',
  'Dr. Maya Indah',
  'Dr. Hendra Wijaya'
];

const STATUSES = ['Sehat', 'Sehat', 'Sehat', 'Sehat', 'Pemulihan', 'Perlu Perhatian', 'Kritis'];
const GENDERS = ['Jantan', 'Betina'];
const AGES = ['6 Bulan', '1 Tahun', '1.5 Tahun', '2 Tahun', '2.5 Tahun', '3 Tahun', '4 Tahun', '5 Tahun', '6 Tahun', '7 Tahun', '8 Tahun'];

const SAMPLE_COMPLAINTS = [
  {
    title: 'Gejala: Lemas & Tidak Mau Makan [Moderate]',
    detail: 'Daftar Gejala: Lemas, Anoreksia, Muntah Ringan\nPasien lesu sejak 2 hari lalu, menolak makanan kering maupun basah. Suhu tubuh 39.1°C, dehidrasi ringan 5%. Palpasi abdomen tidak menunjukkan adanya massa, namun respon nyeri saat palpasi lambung.'
  },
  {
    title: 'Gejala: Gatal Telinga & Sering Menggaruk [Mild]',
    detail: 'Daftar Gejala: Otitis Externa, Telinga Kemerahan, Sekret Coklat\nKemerahan pada pinna telinga kanan. Tampak sekret coklat tua berbau. Pemeriksaan otoskop menunjukkan inflamasi membran timpani intact. Terdiagnosa Otodectes cynotis.'
  },
  {
    title: 'Gejala: Batuk Kering & Bersin Berkala [Mild]',
    detail: 'Daftar Gejala: Batuk, Bersin, Nasal Discharge\nPasien mengalami batuk bersahutan terutama setelah aktivitas fisik. Suhu tubuh normal 38.5°C, auskultasi paru bersih, mukosa hidung agak basah.'
  },
  {
    title: 'Gejala: Kesulitan Mengunyah Makanan Keras [Moderate]',
    detail: 'Daftar Gejala: Tartar Gigi, Gingivitis, Bau Mulut\nPemeriksaan oral menunjukkan kalkulus gigi grade 2 pada molar atas dan gusi memerah. Pasien menolak makan kibble keras tetapi mau minum kaldu hangat.'
  },
  {
    title: 'Gejala: Diare Lunak Berlendir [Severe]',
    detail: 'Daftar Gejala: Diare, Dehidrasi, Perut Kembung\nDefekasi cair berlendir 4x dalam 24 jam terakhir. Turgor kulit sedikit melambat. Fecal smear menunjukkan overgrowth flora usus gram negatif.'
  },
  {
    title: 'Gejala: Kontrol Routine & Evaluasi Berat Badan [Mild]',
    detail: 'Daftar Gejala: Pemeriksaan Rutin, Evaluasi Kesehatan\nKunjungan berkala untuk check-up kesehatan. Kondisi fisik umum sangat baik, mata jernih, bulu bersih, berat badan stabil.'
  }
];

const SAMPLE_PRESCRIPTIONS_POOL = [
  {
    duration: '7 Hari',
    status: 'Active',
    notes: 'Berikan obat secara teratur sesuai jadwal. Habiskan antibiotik.',
    items: [
      { med_name: 'Amoxicillin Clavulanate 250mg', dosage: '2x1 tablet', instructions: 'Sesudah makan' },
      { med_name: 'Ondansetron Syrup 5ml', dosage: '2x1.5 ml', instructions: '30 menit sebelum makan' },
      { med_name: 'Suplemen Imun Vetoquinol', dosage: '1x1 tetes', instructions: 'Campur ke makanan' }
    ]
  },
  {
    duration: '14 Hari',
    status: 'Active',
    notes: 'Bersihkan telinga terlebih dahulu sebelum meneteskan obat.',
    items: [
      { med_name: 'Surolan Ear Drops 15ml', dosage: '2x sehari 3 tetes', instructions: 'Teteskan ke saluran telinga' },
      { med_name: 'Revolution Spot-On', dosage: '1x aplikasi', instructions: 'Teteskan pada kulit tengkuk' }
    ]
  },
  {
    duration: '5 Hari',
    status: 'Active',
    notes: 'Beri minum air putih secukupnya setelah minum obat.',
    items: [
      { med_name: 'Probiotik Synbiotic D-C', dosage: '1x1 kapsul', instructions: 'Taburkan pada makanan' },
      { med_name: 'Kaolin-Pectin Syrup', dosage: '3x2 ml', instructions: 'Saat diare masih berlangsung' }
    ]
  },
  {
    duration: '10 Hari',
    status: 'Active',
    notes: 'Kunjungan kontrol ulang disarankan jika keluhan berlanjut.',
    items: [
      { med_name: 'Cefadroxil 125mg', dosage: '2x1 kapsul', instructions: 'Sesudah makan' },
      { med_name: 'Meloxicam 0.1mg/kg', dosage: '1x1 ml', instructions: 'Untuk meredakan peradangan' }
    ]
  }
];

const SAMPLE_VACCINES_POOL = [
  [
    { vaccine_name: 'Vaksin Core Rabies', vaccine_type: 'Vaksin Rabies', given_date: '2025-01-10', due_date: '2026-01-10', status: 'Up to Date', notes: 'Booster tahunan' },
    { vaccine_name: 'Vaksin Tricat Trio (FVRCP)', vaccine_type: 'Vaksin Core', given_date: '2025-02-15', due_date: '2026-02-15', status: 'Up to Date', notes: 'Perlindungan virus feline' },
    { vaccine_name: 'Obat Cacing Drontal (Deworming)', vaccine_type: 'Deworming', given_date: '2025-06-01', due_date: '2025-09-01', status: 'Sebentar Lagi', notes: 'Rutin 3 bulan sekali' }
  ],
  [
    { vaccine_name: 'Vaksin Nobivac DHPPi + Lepto', vaccine_type: 'Vaksin Core', given_date: '2025-03-20', due_date: '2026-03-20', status: 'Up to Date', notes: 'Vaksinasi lengkap anjing' },
    { vaccine_name: 'Vaksin Core Rabies', vaccine_type: 'Vaksin Rabies', given_date: '2025-03-20', due_date: '2026-03-20', status: 'Up to Date', notes: 'Sertifikat Rabies Aktif' },
    { vaccine_name: 'Anti-Kutu Revolution Spot-on', vaccine_type: 'Anti-Parasit', given_date: '2025-07-10', due_date: '2025-08-10', status: 'Sebentar Lagi', notes: 'Aplikasi rutin bulanan' }
  ],
  [
    { vaccine_name: 'Vaksin Felocell 4', vaccine_type: 'Vaksin Core', given_date: '2025-01-05', due_date: '2026-01-05', status: 'Up to Date', notes: 'Panleukopenia, Rhinotracheitis, Calici, Chlamydia' },
    { vaccine_name: 'Obat Cacing Deworming Syrup', vaccine_type: 'Deworming', given_date: '2025-05-12', due_date: '2025-08-12', status: 'Up to Date', notes: 'Dosis disesuaikan berat badan' }
  ]
];

export async function seed1000Patients() {
  console.log('Seeding 1,000 realistic patient records into Firestore...');
  let batch = writeBatch(db);
  let batchCount = 0;

  async function checkCommit() {
    batchCount++;
    if (batchCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  const sampleSoaps = [
    {
      subjective: 'Pemilik mengeluhkan pasien lemas, kurang nafsu makan sejak 2 hari lalu dan muntah sekali.',
      objective: 'Suhu: 39.1°C, CRT < 2 detik, mukosa merah muda, palpasi abdomen agak tegang.',
      diagnosis: ['Gastritis Akut', 'Dehidrasi Ringan'],
      treatments: ['Injeksi Ondansetron 0.5mg/kg', 'Ringer Laktat 100ml IV', 'Pemberian Cimetidine syrup 2x1'],
      notes: 'Lakukan pemantauan asupan cairan. Jika muntah berlanjut >24 jam segera kontrol.'
    },
    {
      subjective: 'Kunjungan rutin vaksinasi tahunan dan pemeriksaan kesehatan berkala.',
      objective: 'Suhu 38.4°C, BB stabil, auskultasi jantung/paru normal, gusi bersih.',
      diagnosis: ['Kesehatan General Baik', 'Rencana Vaksinasi DHPPi'],
      treatments: ['Vaksin Nobivac DHPPi + Lepto', 'Pemberian obat cacing Drontal Plus 1 tab'],
      notes: 'Pasien aktif dan sehat. Jadwal booster berikutnya 1 tahun lagi.'
    },
    {
      subjective: 'Gatal-gatal di daerah telinga dan kemerahan di punggung, sering menggaruk.',
      objective: 'Eritema pada pinna telinga luar, sekret coklat kehitaman di mukosa telinga.',
      diagnosis: ['Otitis Externa', 'Otodectes cynotis (Kutu Telinga)'],
      treatments: ['Pembersihan telinga dengan Epi-Otic', 'Tetes telinga Surolan 2x sehari 3 tetes', 'Spot-on Revolution'],
      notes: 'Kontrol ulang dalam 7 hari untuk evaluasi kebersihan saluran telinga.'
    },
    {
      subjective: 'Tidak mau makan makanan keras, tampak kesakitan saat mengunyah.',
      objective: 'Gingivitis grade 2, karang gigi (tartar) pada molar atas kanan dan kiri.',
      diagnosis: ['Periodontitis Grade 2', 'Dental Calculus'],
      treatments: ['Scalling gigi bawah anestesi umum', 'Amoxicillin clavulanate 12.5mg/kg 2x1', 'Meloxicam 0.1mg/kg 1x1'],
      notes: 'Disarankan pemberian sikat gigi hewan dan makanan khusus dental care.'
    },
    {
      subjective: 'Diare lunak berlendir sejak kemarin sore, aktivitas masih cukup lincah.',
      objective: 'Suhu 38.6°C, turgor kulit baik, fecal smear menunjukkan flora bakteri usus overgrowth.',
      diagnosis: ['Enteritis Bakterial Ringan'],
      treatments: ['Probiotik Synbiotic D-C 1 kapsul/hari', 'Kaolin-Pectin syrup 3x2ml', 'Diet Royal Canin Gastrointestinal'],
      notes: 'Beri porsi makan sedikit tapi sering (4-5x sehari).'
    }
  ];

  for (let i = 0; i < 1000; i++) {
    const owner = OWNER_POOL[i % OWNER_POOL.length];
    const petName = PET_NAMES[i % PET_NAMES.length];
    const speciesCfg = SPECIES_CONFIG[i % SPECIES_CONFIG.length];
    const breed = speciesCfg.breeds[(i * 3) % speciesCfg.breeds.length];
    const gender = GENDERS[i % GENDERS.length];
    const age = AGES[(i * 7) % AGES.length];
    const doctor = DOCTORS[(i * 2) % DOCTORS.length];
    const status = STATUSES[(i * 5) % STATUSES.length];

    const minW = speciesCfg.weightRange[0];
    const maxW = speciesCfg.weightRange[1];
    const weightVal = (minW + ((i * 17) % 100) / 100 * (maxW - minW)).toFixed(1);

    const minT = speciesCfg.tempRange[0];
    const maxT = speciesCfg.tempRange[1];
    const tempVal = (minT + ((i * 13) % 100) / 100 * (maxT - minT)).toFixed(1);

    const minH = speciesCfg.hrRange[0];
    const maxH = speciesCfg.hrRange[1];
    const hrVal = Math.floor(minH + ((i * 11) % 100) / 100 * (maxH - minH));

    const codeNumber = i + 1;
    const code = `#PT-${String(codeNumber).padStart(4, '0')}`;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[i % 12];
    const day = (i % 28) + 1;
    const year = i % 5 === 0 ? '2026' : '2025';
    const lastVisitFormatted = `${month} ${day}, ${year}`;

    const patientRef = doc(collection(db, 'patients'));
    const patientId = patientRef.id;

    const patientData = {
      code,
      name: petName,
      species: speciesCfg.species,
      breed,
      gender,
      age,
      owner_name: owner.name,
      phone: owner.phone,
      address: owner.address,
      status,
      weight: `${weightVal} kg`,
      temperature: `${tempVal} °C`,
      heart_rate: `${hrVal} bpm`,
      doctor_name: doctor,
      last_visit: lastVisitFormatted,
      avatar_idx: i % 4,
      created_at: serverTimestamp()
    };

    batch.set(patientRef, patientData);
    await checkCommit();

    // 1. Clinical Note (Catatan Keluhan)
    const complaintObj = SAMPLE_COMPLAINTS[i % SAMPLE_COMPLAINTS.length];
    const noteRef = doc(collection(db, 'clinical_notes'));
    batch.set(noteRef, {
      patient_id: patientId,
      title: complaintObj.title,
      detail: complaintObj.detail,
      note_date: lastVisitFormatted,
      created_at: serverTimestamp()
    });
    await checkCommit();

    // 2. Prescription (E-Resep Obat)
    const rxObj = SAMPLE_PRESCRIPTIONS_POOL[i % SAMPLE_PRESCRIPTIONS_POOL.length];
    const rxRef = doc(collection(db, 'prescriptions'));
    const rxId = rxRef.id;
    batch.set(rxRef, {
      patient_id: patientId,
      patient_name: petName,
      patient_code: code,
      species: `${speciesCfg.species} (${breed})`,
      owner_name: owner.name,
      doctor_name: doctor,
      prescription_number: `RX-2025-${String(i + 1).padStart(4, '0')}`,
      date: lastVisitFormatted,
      duration: rxObj.duration,
      status: rxObj.status,
      notes: rxObj.notes,
      items: rxObj.items,
      created_at: serverTimestamp()
    });
    await checkCommit();

    // 3. Active Medications from Prescription
    for (const item of rxObj.items) {
      const medRef = doc(collection(db, 'medications'));
      batch.set(medRef, {
        patient_id: patientId,
        prescription_id: rxId,
        name: item.med_name,
        dose: item.dosage,
        created_at: serverTimestamp()
      });
      await checkCommit();
    }

    // 4. Vaccinations
    const vacSet = SAMPLE_VACCINES_POOL[i % SAMPLE_VACCINES_POOL.length];
    for (const v of vacSet) {
      const vacRef = doc(collection(db, 'vaccinations'));
      batch.set(vacRef, {
        patient_id: patientId,
        vaccine_name: v.vaccine_name,
        vaccine_type: v.vaccine_type,
        given_date: v.given_date,
        due_date: v.due_date,
        status: v.status,
        notes: v.notes,
        created_at: serverTimestamp()
      });
      await checkCommit();
    }

    // 5. Medical Records for Reports Page (every 5th)
    if (i % 5 === 0) {
      const soap = sampleSoaps[i % sampleSoaps.length];
      const recordRef = doc(collection(db, 'medical_records'));
      const initials = doctor.replace(/^Dr\.\s*/i, '').split(' ').map(n => n[0]).join('').toUpperCase();
      batch.set(recordRef, {
        mrn: code,
        patient_id: patientId,
        patient_name: petName,
        date: lastVisitFormatted,
        time: `${String(8 + (i % 9)).padStart(2, '0')}:30 AM`,
        subjective: soap.subjective,
        objective: soap.objective,
        diagnosis: soap.diagnosis,
        treatments: soap.treatments,
        doctor_name: doctor,
        doctor_initials: initials,
        notes: soap.notes,
        created_at: serverTimestamp()
      });
      await checkCommit();
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }
  console.log('Successfully seeded 1,000 patients with clinical notes, prescriptions, and vaccines into Firestore!');
}

export async function addOneSamplePatient() {
  try {
    const snap = await getDocs(collection(db, 'patients'));
    if (!snap.empty) return snap.docs[0].id;

    const patientRef = doc(collection(db, 'patients'));
    const patientId = patientRef.id;
    const todayStr = '10 Aug, 2026';

    const patientData = {
      code: '#VET-' + Math.floor(100 + Math.random() * 900),
      name: 'Milo',
      species: 'Kucing',
      breed: 'Persian Medium',
      gender: 'Jantan',
      age: '2 Tahun',
      weight: '3.8 kg',
      temperature: '38.6 °C',
      heart_rate: '110 bpm',
      owner_name: 'Budi Santoso',
      phone: '+62 812 3456 7890',
      address: 'Jl. Merdeka No. 12, Bandung',
      doctor_name: 'Dr. Sarah Jenkins',
      status: 'Sehat',
      last_visit: todayStr,
      created_at: serverTimestamp()
    };

    await setDoc(patientRef, patientData);

    // 1. Clinical note
    await addDoc(collection(db, 'clinical_notes'), {
      patient_id: patientId,
      title: 'Gejala: Kontrol Routine & Evaluasi Kesehatan [Mild]',
      detail: 'Daftar Gejala: Pemeriksaan Rutin, Evaluasi Kesehatan\nKunjungan berkala untuk check-up kesehatan. Kondisi fisik umum sangat baik, mata jernih, bulu bersih, berat badan stabil 3.8 kg.',
      note_date: todayStr,
      created_at: serverTimestamp()
    });

    // 2. Prescription
    const rxRef = doc(collection(db, 'prescriptions'));
    const rxId = rxRef.id;
    const rxItems = [
      { med_name: 'Obat Cacing Drontal Cat', dosage: '1 tablet', instructions: 'Sekali minum' },
      { med_name: 'Suplemen Imun Vetoquinol', dosage: '1x1 tetes', instructions: 'Campur ke makanan' }
    ];

    await setDoc(rxRef, {
      patient_id: patientId,
      patient_name: 'Milo',
      patient_code: patientData.code,
      species: 'Kucing (Persian Medium)',
      owner_name: 'Budi Santoso',
      doctor_name: 'Dr. Sarah Jenkins',
      prescription_number: 'RX-2026-0001',
      date: todayStr,
      duration: '7 Hari',
      status: 'Active',
      notes: 'Berikan obat cacing secara teratur. Campur suplemen ke makanan basah.',
      items: rxItems,
      created_at: serverTimestamp()
    });

    // 3. Active Medications
    for (const item of rxItems) {
      await addDoc(collection(db, 'medications'), {
        patient_id: patientId,
        prescription_id: rxId,
        name: item.med_name,
        dose: item.dosage,
        created_at: serverTimestamp()
      });
    }

    // 4. Vaccinations
    await addDoc(collection(db, 'vaccinations'), {
      patient_id: patientId,
      vaccine_name: 'Vaksin Core Rabies',
      vaccine_type: 'Vaksin Rabies',
      given_date: '2026-01-10',
      due_date: '2027-01-10',
      status: 'Up to Date',
      notes: 'Booster tahunan aktif',
      created_at: serverTimestamp()
    });

    await addDoc(collection(db, 'vaccinations'), {
      patient_id: patientId,
      vaccine_name: 'Vaksin Tricat Trio (FVRCP)',
      vaccine_type: 'Vaksin Core',
      given_date: '2026-02-15',
      due_date: '2027-02-15',
      status: 'Up to Date',
      notes: 'Perlindungan virus feline',
      created_at: serverTimestamp()
    });

    await addDoc(collection(db, 'vaccinations'), {
      patient_id: patientId,
      vaccine_name: 'Obat Cacing Drontal (Deworming)',
      vaccine_type: 'Deworming',
      given_date: '2026-06-01',
      due_date: '2026-09-01',
      status: 'Sebentar Lagi',
      notes: 'Rutin 3 bulan sekali',
      created_at: serverTimestamp()
    });

    console.log('Successfully added 1 sample patient record:', patientId);
    return patientId;
  } catch (err) {
    console.error('Error adding one sample patient:', err);
  }
}

export async function seedMultiPetOwnerIfMissing() {
  try {
    const snap = await getDocs(collection(db, 'patients'));
    const rinaPets = snap.docs.filter(d => (d.data().owner_name || '').toLowerCase() === 'rina wijaya');
    if (rinaPets.length >= 3) return;

    const todayStr = '10 Aug, 2026';
    const ownerName = 'Rina Wijaya';
    const phone = '+62 813 9876 5432';
    const address = 'Jl. Dago No. 45, Bandung';

    const petsData = [
      { name: 'Koko', species: 'Kucing', breed: 'British Shorthair', gender: 'Jantan', age: '1.5 Tahun', weight: '4.2 kg', temp: '38.5 °C', hr: '115 bpm', status: 'Sehat' },
      { name: 'Max', species: 'Anjing', breed: 'Golden Retriever', gender: 'Jantan', age: '3 Tahun', weight: '28.5 kg', temp: '38.8 °C', hr: '95 bpm', status: 'Perawatan' },
      { name: 'Mimi', species: 'Kelinci', breed: 'Holland Lop', gender: 'Betina', age: '1 Tahun', weight: '1.8 kg', temp: '39.1 °C', hr: '140 bpm', status: 'Sehat' }
    ];

    for (const pet of petsData) {
      const alreadyExists = rinaPets.some(d => (d.data().name || '').toLowerCase() === pet.name.toLowerCase());
      if (alreadyExists) continue;

      const pRef = doc(collection(db, 'patients'));
      const pId = pRef.id;

      await setDoc(pRef, {
        code: '#VET-' + Math.floor(100 + Math.random() * 900),
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        gender: pet.gender,
        age: pet.age,
        weight: pet.weight,
        temperature: pet.temp,
        heart_rate: pet.hr,
        owner_name: ownerName,
        phone: phone,
        address: address,
        doctor_name: 'Dr. Sarah Jenkins',
        status: pet.status,
        last_visit: todayStr,
        created_at: serverTimestamp()
      });

      await addDoc(collection(db, 'clinical_notes'), {
        patient_id: pId,
        title: `Pemeriksaan Rutin (${pet.name})`,
        detail: `Rekam medis awal untuk ${pet.name}. Kondisi fisik ${pet.status.toLowerCase()}, nafsu makan baik, vaksinasi teratur.`,
        note_date: todayStr,
        created_at: serverTimestamp()
      });
    }

    console.log('Successfully seeded 3 pets for Rina Wijaya!');
  } catch (err) {
    console.error('Error seeding multi-pet owner:', err);
  }
}

export async function seedDatabaseIfEmpty() {
  try {
    const snap = await getDocs(collection(db, 'patients'));
    if (snap.empty) {
      console.log('Database empty, adding 1 sample patient...');
      await addOneSamplePatient();
    }
    await seedMultiPetOwnerIfMissing();
  } catch (err) {
    console.error('Error during Firestore database check:', err);
  }
}

(window as any).clearAllDatabaseData = clearAllDatabaseData;

// Patient CRUD
export function subscribePatients(callback: (patients: Patient[]) => void) {
  return onSnapshot(collection(db, 'patients'), (snapshot) => {
    const list: Patient[] = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data() as Omit<Patient, 'id'>
    }));
    callback(list);
  }, (err) => {
    console.error('Failed to subscribe patients:', err);
    getDocs(collection(db, 'patients')).then(snap => {
      const list: Patient[] = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() as Omit<Patient, 'id'> }));
      callback(list);
    }).catch(e => console.error('Fallback getDocs error:', e));
  });
}

export async function getPatientById(id: string): Promise<Patient | null> {
  try {
    const docSnap = await getDoc(doc(db, 'patients', id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() as Omit<Patient, 'id'> };
    }
    return null;
  } catch (err) {
    console.error('Error getting patient by ID:', err);
    return null;
  }
}

export async function createPatient(patientData: Omit<Patient, 'id' | 'created_at'>) {
  const code = '#VET-' + Math.floor(100 + Math.random() * 900);
  const docRef = await addDoc(collection(db, 'patients'), {
    ...patientData,
    code,
    created_at: serverTimestamp()
  });
  return docRef.id;
}

export async function recordRevisit(patientId: string, data: {
  visit_date: string;
  doctor_name: string;
  status: string;
  title: string;
  detail: string;
  weight?: string;
  temperature?: string;
  heart_rate?: string;
}) {
  await addDoc(collection(db, 'clinical_notes'), {
    patient_id: patientId,
    title: data.title || 'Kunjungan Ulang / Re-visit Check-In',
    detail: data.detail,
    note_date: data.visit_date,
    created_at: serverTimestamp()
  });

  const updateData: any = {
    last_visit: data.visit_date,
    status: data.status,
    doctor_name: data.doctor_name
  };
  if (data.weight) updateData.weight = data.weight;
  if (data.temperature) updateData.temperature = data.temperature;
  if (data.heart_rate) updateData.heart_rate = data.heart_rate;

  await updateDoc(doc(db, 'patients', patientId), updateData);
}

export function subscribeOwnerPets(ownerName: string, currentPatientId: string, callback: (pets: Patient[]) => void) {
  if (!ownerName) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'patients'), where('owner_name', '==', ownerName));
  return onSnapshot(q, (snapshot) => {
    const list: Patient[] = snapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() as Omit<Patient, 'id'> }))
      .filter(p => p.id !== currentPatientId);
    callback(list);
  }, (err) => {
    console.error('Error subscribing owner pets:', err);
    callback([]);
  });
}

export async function getAllUniqueOwners(): Promise<{ owner_name: string; phone: string; address: string; pets: string[] }[]> {
  try {
    const snap = await getDocs(collection(db, 'patients'));
    const map = new Map<string, { owner_name: string; phone: string; address: string; pets: string[] }>();
    snap.docs.forEach(d => {
      const p = d.data() as Patient;
      if (p.owner_name) {
        const key = p.owner_name.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, {
            owner_name: p.owner_name,
            phone: p.phone || '',
            address: p.address || '',
            pets: p.name ? [p.name] : []
          });
        } else {
          const item = map.get(key)!;
          if (p.name && !item.pets.includes(p.name)) {
            item.pets.push(p.name);
          }
        }
      }
    });
    return Array.from(map.values());
  } catch (err) {
    console.error('Error fetching unique owners:', err);
    return [];
  }
}

export async function updatePatientVitals(patientId: string, vitals: { weight?: string; temperature?: string; heart_rate?: string }) {
  await updateDoc(doc(db, 'patients', patientId), vitals);
}

export async function updatePatientStatus(patientId: string, status: string) {
  await updateDoc(doc(db, 'patients', patientId), { status });
}

// Clinical Notes CRUD (Keluhan Baru & Riwayat Medis)
export function subscribeClinicalNotes(patientId: string, callback: (notes: ClinicalNote[]) => void) {
  const q = query(
    collection(db, 'clinical_notes'), 
    where('patient_id', '==', patientId)
  );
  return onSnapshot(q, (snapshot) => {
    const notes: ClinicalNote[] = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data() as Omit<ClinicalNote, 'id'>
    }));
    // sort locally by created_at or note_date
    notes.sort((a, b) => {
      const tA = a.created_at?.seconds || 0;
      const tB = b.created_at?.seconds || 0;
      return tB - tA;
    });
    callback(notes);
  }, (err) => {
    console.error('Error subscribing clinical notes:', err);
  });
}

export async function addClinicalNote(patientId: string, title: string, detail: string, note_date?: string) {
  const todayStr = note_date || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const docRef = await addDoc(collection(db, 'clinical_notes'), {
    patient_id: patientId,
    title,
    detail,
    note_date: todayStr,
    created_at: serverTimestamp()
  });
  
  // also update patient's last_visit date
  await updateDoc(doc(db, 'patients', patientId), {
    last_visit: new Date().toISOString().split('T')[0]
  });

  return docRef.id;
}

// Medications CRUD
export function subscribeMedications(patientId: string, callback: (meds: Medication[]) => void) {
  const q = query(collection(db, 'medications'), where('patient_id', '==', patientId));
  return onSnapshot(q, (snapshot) => {
    const meds: Medication[] = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data() as Omit<Medication, 'id'>
    }));
    callback(meds);
  });
}

export async function addMedication(patientId: string, name: string, dose: string) {
  const docRef = await addDoc(collection(db, 'medications'), {
    patient_id: patientId,
    name,
    dose,
    created_at: serverTimestamp()
  });
  return docRef.id;
}

export async function removeMedication(medId: string) {
  await deleteDoc(doc(db, 'medications', medId));
}

// Doctors
export async function getDoctorsList(): Promise<Doctor[]> {
  const snap = await getDocs(collection(db, 'doctors'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() as Omit<Doctor, 'id'> }));
}

// Prescriptions CRUD
export function subscribePrescriptions(callback: (prescriptions: Prescription[]) => void) {
  return onSnapshot(collection(db, 'prescriptions'), (snapshot) => {
    const list: Prescription[] = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data() as Omit<Prescription, 'id'>
    }));
    // sort by created_at or date desc
    list.sort((a, b) => {
      const tA = a.created_at?.seconds || 0;
      const tB = b.created_at?.seconds || 0;
      if (tA !== tB) return tB - tA;
      return (b.date || '').localeCompare(a.date || '');
    });
    callback(list);
  }, (err) => {
    console.error('Error subscribing prescriptions:', err);
  });
}

export async function addPrescription(prescription: Omit<Prescription, 'id' | 'created_at'>) {
  const docRef = await addDoc(collection(db, 'prescriptions'), {
    ...prescription,
    created_at: serverTimestamp()
  });

  // Also sync items to patient active medications
  if (prescription.patient_id && prescription.items && prescription.items.length > 0) {
    for (const item of prescription.items) {
      await addDoc(collection(db, 'medications'), {
        patient_id: prescription.patient_id,
        prescription_id: docRef.id,
        name: item.med_name,
        dose: item.dosage,
        created_at: serverTimestamp()
      });
    }
  }

  return docRef.id;
}

export async function updatePrescriptionStatus(id: string, status: string) {
  await updateDoc(doc(db, 'prescriptions', id), { status });
}

export async function syncAndCleanupPatientMedications(patientId: string) {
  try {
    const rxQuery = query(collection(db, 'prescriptions'), where('patient_id', '==', patientId));
    const rxSnap = await getDocs(rxQuery);
    
    const activePrescriptions = rxSnap.docs
      .map(d => ({ id: d.id, ...d.data() as Prescription }))
      .filter(p => p.status === 'Active');

    const activeRxIds = new Set(activePrescriptions.map(p => p.id));
    const activeMedNames = new Set<string>();
    activePrescriptions.forEach(p => {
      (p.items || []).forEach(i => activeMedNames.add(i.med_name.trim().toLowerCase()));
    });

    const medsQuery = query(collection(db, 'medications'), where('patient_id', '==', patientId));
    const medsSnap = await getDocs(medsQuery);

    for (const mDoc of medsSnap.docs) {
      const mData = mDoc.data() as Medication;
      const mName = (mData.name || '').trim().toLowerCase();

      let shouldDelete = false;
      if (mData.prescription_id) {
        if (!activeRxIds.has(mData.prescription_id)) {
          shouldDelete = true;
        }
      } else {
        if (!activeMedNames.has(mName)) {
          shouldDelete = true;
        }
      }

      if (shouldDelete) {
        await deleteDoc(doc(db, 'medications', mDoc.id));
      }
    }
  } catch (err) {
    console.error('Error syncing/cleaning up patient medications:', err);
  }
}

export async function deletePrescription(id: string) {
  let patientId = '';
  try {
    const rxSnap = await getDoc(doc(db, 'prescriptions', id));
    if (rxSnap.exists()) {
      const rxData = rxSnap.data() as Prescription;
      patientId = rxData.patient_id || '';
      const deletedIds = new Set<string>();

      // 1. Delete medications explicitly linked via prescription_id
      const q1 = query(collection(db, 'medications'), where('prescription_id', '==', id));
      const medsSnap1 = await getDocs(q1);
      for (const mDoc of medsSnap1.docs) {
        await deleteDoc(doc(db, 'medications', mDoc.id));
        deletedIds.add(mDoc.id);
      }

      // 2. Delete medications by patient_id and item name
      if (rxData.patient_id && rxData.items && rxData.items.length > 0) {
        const q2 = query(collection(db, 'medications'), where('patient_id', '==', rxData.patient_id));
        const medsSnap2 = await getDocs(q2);
        for (const item of rxData.items) {
          for (const mDoc of medsSnap2.docs) {
            if (deletedIds.has(mDoc.id)) continue;
            const mData = mDoc.data();
            if (mData.name === item.med_name) {
              await deleteDoc(doc(db, 'medications', mDoc.id));
              deletedIds.add(mDoc.id);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error deleting associated medications for prescription:', err);
  }

  await deleteDoc(doc(db, 'prescriptions', id));

  if (patientId) {
    await syncAndCleanupPatientMedications(patientId);
  }
}

// Medical Records CRUD
export function subscribeMedicalRecords(callback: (records: MedicalRecord[]) => void) {
  return onSnapshot(collection(db, 'medical_records'), (snapshot) => {
    const records: MedicalRecord[] = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data() as Omit<MedicalRecord, 'id'>
    }));

    // Sort desc by date/time
    records.sort((a, b) => {
      const tA = a.created_at?.seconds || 0;
      const tB = b.created_at?.seconds || 0;
      if (tA !== tB) return tB - tA;
      return (b.date || '').localeCompare(a.date || '');
    });

    callback(records);
  }, (err) => {
    console.error('Error subscribing medical records:', err);
  });
}

export async function addMedicalRecord(rec: Omit<MedicalRecord, 'id' | 'created_at'>) {
  const docRef = await addDoc(collection(db, 'medical_records'), {
    ...rec,
    created_at: serverTimestamp()
  });
  return docRef.id;
}

export async function deleteMedicalRecord(id: string) {
  await deleteDoc(doc(db, 'medical_records', id));
}

// Vaccinations CRUD
export function subscribeVaccinations(patientId: string, callback: (vacs: Vaccination[]) => void) {
  const q = query(collection(db, 'vaccinations'), where('patient_id', '==', patientId));
  return onSnapshot(q, (snapshot) => {
    const vacs: Vaccination[] = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data() as Omit<Vaccination, 'id'>
    }));
    vacs.sort((a, b) => (b.given_date || '').localeCompare(a.given_date || ''));
    callback(vacs);
  }, (err) => {
    console.error('Error subscribing vaccinations:', err);
  });
}

export async function addVaccination(vac: Omit<Vaccination, 'id' | 'created_at'>) {
  const docRef = await addDoc(collection(db, 'vaccinations'), {
    ...vac,
    created_at: serverTimestamp()
  });
  return docRef.id;
}

export async function deleteVaccination(id: string) {
  await deleteDoc(doc(db, 'vaccinations', id));
}

// Auto seed specific patient records if missing
export async function autoSeedPatientRecordsIfEmpty(patientId: string, patient: Patient) {
  if (localStorage.getItem('db_cleared_v1') === 'true') {
    return;
  }
  try {
    const notesSnap = await getDocs(query(collection(db, 'clinical_notes'), where('patient_id', '==', patientId)));
    if (notesSnap.empty) {
      const idx = Math.abs(patientId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
      const complaintObj = SAMPLE_COMPLAINTS[idx % SAMPLE_COMPLAINTS.length];
      await addDoc(collection(db, 'clinical_notes'), {
        patient_id: patientId,
        title: complaintObj.title,
        detail: complaintObj.detail,
        note_date: patient.last_visit || 'Hari ini',
        created_at: serverTimestamp()
      });
    }

    const rxSnap = await getDocs(query(collection(db, 'prescriptions'), where('patient_id', '==', patientId)));
    if (rxSnap.empty) {
      const idx = Math.abs(patientId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
      const rxObj = SAMPLE_PRESCRIPTIONS_POOL[idx % SAMPLE_PRESCRIPTIONS_POOL.length];
      const docRef = await addDoc(collection(db, 'prescriptions'), {
        patient_id: patientId,
        patient_name: patient.name,
        patient_code: patient.code || '#VET-000',
        species: `${patient.species} (${patient.breed || ''})`,
        owner_name: patient.owner_name,
        doctor_name: patient.doctor_name || 'Dr. Sarah Jenkins',
        prescription_number: `RX-2025-${String(Math.floor(Math.random() * 900) + 100).padStart(4, '0')}`,
        date: patient.last_visit || 'Hari ini',
        duration: rxObj.duration,
        status: rxObj.status,
        notes: rxObj.notes,
        items: rxObj.items,
        created_at: serverTimestamp()
      });

      for (const item of rxObj.items) {
        await addDoc(collection(db, 'medications'), {
          patient_id: patientId,
          prescription_id: docRef.id,
          name: item.med_name,
          dose: item.dosage,
          created_at: serverTimestamp()
        });
      }
    }

    const vacSnap = await getDocs(query(collection(db, 'vaccinations'), where('patient_id', '==', patientId)));
    if (vacSnap.empty) {
      const idx = Math.abs(patientId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
      const vacSet = SAMPLE_VACCINES_POOL[idx % SAMPLE_VACCINES_POOL.length];
      for (const v of vacSet) {
        await addDoc(collection(db, 'vaccinations'), {
          patient_id: patientId,
          vaccine_name: v.vaccine_name,
          vaccine_type: v.vaccine_type,
          given_date: v.given_date,
          due_date: v.due_date,
          status: v.status,
          notes: v.notes,
          created_at: serverTimestamp()
        });
      }
    }
  } catch (err) {
    console.error('Error auto seeding patient records:', err);
  }
}

