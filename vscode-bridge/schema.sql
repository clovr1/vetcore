-- ==========================================================
-- VetCore Systems — skema database
-- Jalankan file ini di MySQL/MariaDB sebelum membuka aplikasi
-- ==========================================================

CREATE DATABASE IF NOT EXISTS vetcore_db CHARACTER SET utf8mb4;
USE vetcore_db;

DROP TABLE IF EXISTS medications;
DROP TABLE IF EXISTS clinical_notes;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS doctors;

CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    species VARCHAR(50) NOT NULL DEFAULT 'Anjing',
    breed VARCHAR(100) DEFAULT '-',
    gender VARCHAR(20) DEFAULT 'Jantan',
    age VARCHAR(50) DEFAULT '-',
    owner_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50) DEFAULT '-',
    address TEXT,
    status VARCHAR(30) DEFAULT 'Sehat',
    weight VARCHAR(20) DEFAULT '-',
    temperature VARCHAR(20) DEFAULT '-',
    heart_rate VARCHAR(20) DEFAULT '-',
    allergies TEXT,
    avatar_idx INT DEFAULT 0,
    doctor_id INT,
    last_visit DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
);

CREATE TABLE clinical_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    detail TEXT,
    icon VARCHAR(30) DEFAULT 'checkup',
    note_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE medications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    dose VARCHAR(100) DEFAULT '-',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) DEFAULT 'General Practitioner'
);

-- ==========================================================
-- Data contoh
-- ==========================================================

-- Isi tabel dokter
INSERT INTO doctors (id, name, specialization) VALUES
(1, 'Dr. Sarah Jenkins', 'General Practitioner'),
(2, 'Dr. Michael Lee', 'Veterinary Surgeon'),
(3, 'Dr. Amanda', 'Veterinary Dermatologist'),
(4, 'Dr. Smith', 'Internal Medicine');

INSERT INTO patients
(name, species, breed, gender, age, owner_name, phone, address, status, weight, temperature, heart_rate, allergies, avatar_idx, last_visit, doctor_id)
VALUES
('Buddy', 'Anjing', 'Golden Retriever', 'Jantan', '3 Tahun', 'Ahmad Fauzi', '0812 3456 7890', 'Jl. Merdeka No. 12, Bandung', 'Sehat', '28.4 kg', '38.2°C', '88 bpm', 'Tidak ada alergi yang diketahui', 0, '2025-07-13', 1),
('Mila', 'Kucing', 'Anggora', 'Betina', '2 Tahun', 'Siti Rahayu', '0813 2211 4455', 'Jl. Kenanga No. 5, Bandung', 'Sehat', '4.1 kg', '38.5°C', '140 bpm', 'Sensitif terhadap ayam', 1, '2025-06-20', 2),
('Bella', 'Anjing', 'Poodle', 'Betina', '1 Tahun', 'Budi Santoso', '0857 1122 3344', 'Jl. Dago No. 88, Bandung', 'Pemulihan', '6.8 kg', '38.9°C', '110 bpm', 'Tidak ada alergi yang diketahui', 2, '2025-05-05', 1),
('Luna', 'Kucing', 'Persia', 'Betina', '4 Tahun', 'Rina Wati', '0812 2233 9900', 'Jl. Cihampelas No. 21, Bandung', 'Perlu Perhatian', '4.6 kg', '38.6°C', '120 bpm', 'Alergi debu rumah', 3, '2025-07-06', 3);

INSERT INTO clinical_notes (patient_id, title, detail, icon, note_date) VALUES
(1, 'Vaksinasi tahunan', 'Vaksin rabies dan DHPP diberikan, kondisi baik.', 'vaccine', '2025-07-13'),
(1, 'Pemeriksaan rutin', 'Berat badan stabil, tidak ada keluhan dari pemilik.', 'checkup', '2025-03-02'),
(2, 'Sterilisasi', 'Prosedur berjalan lancar, pemulihan normal.', 'treatment', '2025-06-20'),
(3, 'Perawatan luka kaki', 'Luka kecil dibersihkan dan diperban, kontrol 1 minggu lagi.', 'treatment', '2025-05-05'),
(4, 'Vaksinasi F3 & Rabies', 'Kondisi umum baik, disarankan kontrol 2-3 hari untuk observasi demam.', 'vaccine', '2025-07-06'),
(4, 'Pemberian obat cacing & kutu', 'Diberikan obat cacing spektrum luas, cek kembali dalam 30 hari.', 'treatment', '2025-04-22');

INSERT INTO medications (patient_id, name, dose) VALUES
(1, 'Vitamin Kulit & Bulu', '1x sehari, 5mg'),
(3, 'Antibiotik Amoxicillin', '2x sehari, 10mg'),
(4, 'Bravecto (Anti Kutu)', '1 tablet / 3 bulan'),
(4, 'Suplemen Vitamin Bulu', '1x sehari, ditaburi ke makanan');
