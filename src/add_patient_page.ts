import { seedDatabaseIfEmpty, createPatient, addClinicalNote, getAllUniqueOwners } from './firebase';
import { initSidebarProfile } from './auth';

const BREEDS: Record<string, string[]> = {
  'Anjing': [
    'Golden Retriever', 'Labrador Retriever', 'German Shepherd', 'Bulldog', 'Poodle',
    'Beagle', 'Rottweiler', 'Dachshund', 'German Shorthaired Pointer', 'Pembroke Welsh Corgi',
    'Australian Shepherd', 'Yorkshire Terrier', 'Cavalier King Charles Spaniel', 'Boxer',
    'French Bulldog', 'Siberian Husky', 'Shih Tzu', 'Boston Terrier', 'Pomeranian',
    'Havanese', 'English Springer Spaniel', 'Cocker Spaniel', 'Miniature Schnauzer',
    'Border Collie', 'Chihuahua', 'Maltese', 'Great Dane', 'Doberman Pinscher',
    'Bernese Mountain Dog', 'Saint Bernard', 'Akita', 'Alaskan Malamute', 'Samoyed',
    'Shiba Inu', 'Bichon Frise', 'Chinese Shar-Pei', 'Collie', 'Dalmatian',
    'Jack Russell Terrier', 'West Highland White Terrier', 'Scottish Terrier',
    'Greyhound', 'Whippet', 'Basenji', 'Bloodhound', 'Basset Hound',
    'Chow Chow', 'Lhasa Apso', 'Pekingese', 'Mixed / Campuran', 'Lainnya'
  ],
  'Kucing': [
    'Persian', 'Maine Coon', 'Siamese', 'Ragdoll', 'British Shorthair',
    'Bengal', 'Abyssinian', 'Scottish Fold', 'Sphynx', 'Russian Blue',
    'Birman', 'Burmese', 'Oriental Shorthair', 'Somali', 'Tonkinese',
    'Russian White', 'Exotic Shorthair', 'Himalayan', 'American Shorthair',
    'Norwegian Forest Cat', 'Turkish Angora', 'Chartreux', 'Japanese Bobtail',
    'Manx', 'Cornish Rex', 'Devon Rex', 'Selkirk Rex', 'LaPerm',
    'Singapura', 'Munchkin', 'Bombay', 'Tuxedo', 'Calico',
    'Tabby', 'Tortoiseshell', 'Mixed / Kampung', 'Lainnya'
  ],
  'Kelinci (Rabbit)': [
    'Holland Lop', 'Netherland Dwarf', 'Mini Rex', 'Lionhead', 'English Angora',
    'Flemish Giant', 'Dutch', 'Mini Lop', 'American Fuzzy Lop', 'Polish',
    'Damascus', 'French Lop', 'Hotot', 'Rex', 'Satin', 'Mixed / Campuran', 'Lainnya'
  ],
  'Burung (Bird)': [
    'Lovebird', 'Nuri / Cockatiel', 'Kenari / Canary', 'Murai Batu', 'Kacer',
    'Cucak Ijo', 'Lovebird Agapornis', 'Burung Kakaktua', 'Nuri Bayan',
    'Pleci', 'Pleci Dakun', 'Ciblek', 'Perkutut', 'Merpati', 'Mixed / Campuran', 'Lainnya'
  ],
  'Other': ['Mixed / Campuran', 'Lainnya']
};

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarProfile();
  await seedDatabaseIfEmpty();

  const ownerNameInput = document.getElementById('ownerName') as HTMLInputElement | null;
  const ownerPhoneInput = document.getElementById('ownerPhone') as HTMLInputElement | null;
  const ownerAddressInput = document.getElementById('ownerAddress') as HTMLTextAreaElement | null;
  const existingOwnerSelect = document.getElementById('existingOwnerSelect') as HTMLSelectElement | null;
  const existingOwnerBadge = document.getElementById('existingOwnerBadge');
  const speciesSelect = document.getElementById('species') as HTMLSelectElement | null;
  const breedSelect = document.getElementById('breed') as HTMLSelectElement | null;

  // Dynamic breed based on species
  if (speciesSelect && breedSelect) {
    speciesSelect.addEventListener('change', () => {
      const species = speciesSelect.value;
      const breeds = BREEDS[species] || [];
      breedSelect.innerHTML = '<option value="">-- Pilih Breed --</option>';
      breeds.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        breedSelect.appendChild(opt);
      });
    });
  }

  // Load unique existing owners for selection
  const uniqueOwners = await getAllUniqueOwners();
  if (existingOwnerSelect && uniqueOwners.length > 0) {
    uniqueOwners.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.owner_name;
      const petListStr = o.pets.length > 0 ? o.pets.join(', ') : 'Belum ada hewan';
      opt.textContent = `${o.owner_name} - ${petListStr} (${o.phone || 'No phone'})`;
      opt.dataset.phone = o.phone || '';
      opt.dataset.address = o.address || '';
      opt.dataset.pets = petListStr;
      existingOwnerSelect.appendChild(opt);
    });

    existingOwnerSelect.addEventListener('change', () => {
      const selectedOpt = existingOwnerSelect.selectedOptions[0];
      if (selectedOpt && selectedOpt.value) {
        if (ownerNameInput) ownerNameInput.value = selectedOpt.value;
        if (ownerPhoneInput) {
          let rawP = selectedOpt.dataset.phone || '';
          rawP = rawP.replace('+62', '').replace(/\s+/g, '').trim();
          ownerPhoneInput.value = rawP;
        }
        if (ownerAddressInput) ownerAddressInput.value = selectedOpt.dataset.address || '';
        if (existingOwnerBadge) {
          existingOwnerBadge.textContent = `✓ Pemilik Terdaftar (${selectedOpt.dataset.pets || 'Hewan'})`;
          existingOwnerBadge.classList.remove('hidden');
        }
      } else {
        existingOwnerBadge?.classList.add('hidden');
      }
    });
  }

  // Parse URL query parameters if coming from "Hewan Baru Pemilik Ini" link
  const urlParams = new URLSearchParams(window.location.search);
  const paramOwner = urlParams.get('owner_name');
  const paramPhone = urlParams.get('owner_phone');
  const paramAddr = urlParams.get('owner_address');

  if (paramOwner) {
    if (ownerNameInput) ownerNameInput.value = paramOwner;
    if (ownerPhoneInput && paramPhone) {
      let cleanP = paramPhone.replace('+62', '').replace(/\s+/g, '').trim();
      ownerPhoneInput.value = cleanP;
    }
    if (ownerAddressInput && paramAddr) ownerAddressInput.value = paramAddr;
    if (existingOwnerSelect) existingOwnerSelect.value = paramOwner;
    existingOwnerBadge?.classList.remove('hidden');
  }

  const phoneInput = document.getElementById('ownerPhone') as HTMLInputElement | null;
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      let val = phoneInput.value.replace(/\D/g, '');
      if (val.startsWith('62')) {
        val = val.slice(2);
      }
      if (val.startsWith('0')) {
        val = val.slice(1);
      }
      phoneInput.value = val.slice(0, 12);
    });
  }

  const form = document.getElementById('addPatientForm') as HTMLFormElement | null;
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Menyimpan...`;
      }

      const getVal = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement)?.value?.trim() || '';

      const name = getVal('patientName');
      const species = getVal('species');
      const breed = getVal('breed') || '-';
      const gender = getVal('gender') || 'Jantan';
      const age = getVal('age') || '1 Tahun';
      const owner_name = getVal('ownerName');
      const rawPhone = getVal('ownerPhone');
      const phone = rawPhone ? `+62 ${rawPhone}` : '-';
      const address = getVal('ownerAddress') || '-';
      const doctor_name = getVal('doctorName') || 'Dr. Sarah Jenkins';
      const status = 'Menunggu Pemeriksaan';
      const weight = getVal('weight') ? `${getVal('weight')} kg` : '3.5 kg';
      const temperature = getVal('temperature') ? `${getVal('temperature')} °C` : '38.5 °C';
      const heart_rate = getVal('heartRate') ? `${getVal('heartRate')} bpm` : '110 bpm';
      const visit_time = getVal('visitTime') || new Date().toTimeString().slice(0, 5);
      const initialComplaint = getVal('initialComplaint');

      if (!name || !species || !owner_name) {
        alert('Mohon isi nama hewan, jenis hewan, dan nama pemilik.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Daftarkan Pasien';
        }
        return;
      }

      try {
        const newId = await createPatient({
          name,
          species,
          breed,
          gender,
          age,
          owner_name,
          phone,
          address,
          status,
          doctor_name,
          weight,
          temperature,
          heart_rate,
          visit_time,
          last_visit: new Date().toISOString().split('T')[0]
        });

        if (initialComplaint) {
          await addClinicalNote(newId, 'Pendaftaran & Keluhan Awal', initialComplaint);
        }

        window.location.href = `patient.html?id=${newId}`;
      } catch (err) {
        console.error('Error creating patient:', err);
        alert('Gagal mendaftarkan pasien ke database.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Daftarkan Pasien';
        }
      }
    });
  }
});
