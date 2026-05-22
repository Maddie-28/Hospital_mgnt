CREATE DATABASE IF NOT EXISTS smart_hospital;
USE smart_hospital;


CREATE TABLE HOSPITAL (
hospital_id INT PRIMARY KEY,
name VARCHAR(100) NOT NULL,
city VARCHAR(50) NOT NULL,
num_doctors INT CHECK (num_doctors > 0),
num_staff INT CHECK (num_staff > 0),
num_patients INT CHECK (num_patients >= 0)
);


CREATE TABLE STAFF (
staff_id INT PRIMARY KEY,
name VARCHAR(100) NOT NULL,
hospital_id INT NOT NULL,
occupation ENUM('Cleaning','Cooking','Logistics','Accounts','Paramedic'),
dob DATE NOT NULL,
age INT,
gender ENUM('Male','Female','Others'),
phone VARCHAR(15),
address VARCHAR(200),
CONSTRAINT staff_age_limit CHECK (age > 0 AND age <= 150),
FOREIGN KEY (hospital_id) REFERENCES HOSPITAL(hospital_id)
);


CREATE TABLE Patient (
patient_id INT AUTO_INCREMENT PRIMARY KEY,
hospital_id INT NOT NULL,
name VARCHAR(100) NOT NULL,
age INT,
dob DATE NOT NULL,
gender ENUM('Male','Female','Others'),
phone VARCHAR(15),
email VARCHAR(100),
address VARCHAR(200),
blood_group ENUM('A+','A-','B+','B-','O+','O-','AB+','AB-'),
aadhar_number VARCHAR(20),
aadhar_doc_url VARCHAR(500),
license_doc_url VARCHAR(500),
medical_history TEXT,
CONSTRAINT age_limit CHECK (age >= 0 AND age < 150),
FOREIGN KEY (hospital_id) REFERENCES HOSPITAL(hospital_id)
);


CREATE TABLE Doctor (
doctor_id INT PRIMARY KEY,
hospital_id INT NOT NULL,
name VARCHAR(100) NOT NULL,
dob DATE NOT NULL,
specialization ENUM('Cardiology','Cardiac Surgery','Neurology','Neurosurgery','Orthopaedics','Obstetrics','Gynaecology','Gastroenterology','Paediatrics','Pulmonology','Urology','Dermatology','ENT'),
phone VARCHAR(15),
email VARCHAR(100) UNIQUE,
experience_years INT,
schedule TEXT NOT NULL,
CONSTRAINT experience_years_limit CHECK (experience_years >= 0 AND experience_years < 60),
FOREIGN KEY (hospital_id) REFERENCES HOSPITAL(hospital_id)
);


CREATE TABLE Nurse (
nurse_id INT PRIMARY KEY,
name VARCHAR(100),
hospital_id INT NOT NULL,
dob DATE NOT NULL,
department ENUM('Medical-Surgical','Intensive Care','Emergency Room','Operating Room','Obstetrics','Oncology','Pediatrics','Geriatrics'),
phone VARCHAR(15),
email VARCHAR(100) UNIQUE,
shift ENUM('morning','Evening','Night'),
experience_years INT,
CONSTRAINT nurse_exp_years_limit CHECK (experience_years >= 0 AND experience_years < 60),
FOREIGN KEY (hospital_id) REFERENCES HOSPITAL(hospital_id)
);


CREATE TABLE Appointment (
appointment_id INT PRIMARY KEY,
appointment_date DATE,
appointment_time TIME,
status ENUM('Pending','Completed','Postponed','Due'),
illness_description TEXT,
patient_id INT NOT NULL,
doctor_id INT NOT NULL,
FOREIGN KEY (patient_id) REFERENCES Patient(patient_id),
FOREIGN KEY (doctor_id) REFERENCES Doctor(doctor_id)
);


CREATE TABLE Treatment (
treatment_id INT PRIMARY KEY,
diagnosis TEXT,
treatment_description TEXT,
prescription TEXT,
treatment_date DATE,
appointment_id INT UNIQUE,
FOREIGN KEY (appointment_id) REFERENCES Appointment(appointment_id)
);


CREATE TABLE Bill (
bill_id INT PRIMARY KEY,
total_amount DECIMAL(10,2),
payment_status ENUM('Paid','Pending'),
payment_mode ENUM('Cash','Card','UPI','Cheque','Net Banking','Bank Transfer'),
bill_date DATE,
patient_id INT,
treatment_id INT UNIQUE,
FOREIGN KEY (patient_id) REFERENCES Patient(patient_id),
FOREIGN KEY (treatment_id) REFERENCES Treatment(treatment_id)
);


CREATE TABLE Test_Report (
report_id INT PRIMARY KEY,
test_name ENUM('CBC','Lipid Profile','LFT','KFT','Thyroid','HbA1c','Glucose','Blood Group','Vitamin D','B12','X-ray','CT Scan','MRI','Ultrasound'),
result TEXT,
report_date DATE,
treatment_id INT NOT NULL,
FOREIGN KEY (treatment_id) REFERENCES Treatment(treatment_id)
);


CREATE TABLE Nurse_Treatment (
nurse_id INT,
treatment_id INT,
PRIMARY KEY (nurse_id,treatment_id),
FOREIGN KEY (nurse_id) REFERENCES Nurse(nurse_id),
FOREIGN KEY (treatment_id) REFERENCES Treatment(treatment_id)
);


CREATE TABLE Room (
room_id INT PRIMARY KEY,
room_number VARCHAR(10) NOT NULL UNIQUE,
room_type ENUM('General','Semi-Private','Private','ICU','NICU','Operation Theatre','Emergency'),
floor INT CHECK (floor >= 0),
status ENUM('Available','Occupied','Under Maintenance'),
daily_charge DECIMAL(8,2) CHECK (daily_charge >= 0),
hospital_id INT NOT NULL,
FOREIGN KEY (hospital_id) REFERENCES HOSPITAL(hospital_id)
);


CREATE TABLE Admission (
admission_id INT PRIMARY KEY,
admission_date DATE NOT NULL,
discharge_date DATE,
reason TEXT NOT NULL,
patient_id INT NOT NULL,
room_id INT NOT NULL,
doctor_id INT NOT NULL,
CONSTRAINT valid_discharge CHECK (discharge_date IS NULL OR discharge_date >= admission_date),
FOREIGN KEY (patient_id) REFERENCES Patient(patient_id),
FOREIGN KEY (room_id) REFERENCES Room(room_id),
FOREIGN KEY (doctor_id) REFERENCES Doctor(doctor_id)
);


CREATE TABLE Pharmacy (
medication_id INT PRIMARY KEY,
name VARCHAR(200) NOT NULL,
category ENUM('Antibiotic','Painkiller','Antiviral','Antifungal','Supplement','Vaccine','Steroid','Antacid','Antidiabetic','Antihypertensive','Other'),
unit ENUM('mg','ml','tablet','capsule','syrup','injection','drop','cream','ointment'),
stock_quantity INT CHECK (stock_quantity >= 0),
price_per_unit DECIMAL(8,2) CHECK (price_per_unit >= 0),
expiry_date DATE
);


CREATE TABLE Prescription_Detail (
prescription_id INT PRIMARY KEY,
treatment_id INT NOT NULL,
medicine_id INT NOT NULL,
dosage VARCHAR(50) NOT NULL,
frequency ENUM('Once a day','Twice a day','Thrice a day','Four times a day','As needed','Weekly','Monthly'),
duration_days INT CHECK (duration_days > 0),
quantity_prescribed INT NOT NULL DEFAULT 1 CHECK (quantity_prescribed > 0),
FOREIGN KEY (treatment_id) REFERENCES Treatment(treatment_id),
FOREIGN KEY (medicine_id) REFERENCES Pharmacy(medication_id)
);


CREATE TABLE Insurance (
insurance_id INT PRIMARY KEY,
provider_name VARCHAR(100) NOT NULL,
policy_number VARCHAR(50) UNIQUE NOT NULL,
coverage_amount DECIMAL(10,2) CHECK (coverage_amount > 0),
expiry_date DATE NOT NULL,
patient_id INT NOT NULL,
FOREIGN KEY (patient_id) REFERENCES Patient(patient_id)
);


CREATE TABLE Emergency_Contact (
contact_id INT PRIMARY KEY,
name VARCHAR(100) NOT NULL,
relationship ENUM('Spouse','Parent','Child','Sibling','Friend','Guardian','Other'),
phone VARCHAR(15) NOT NULL,
patient_id INT NOT NULL,
FOREIGN KEY (patient_id) REFERENCES Patient(patient_id)
);


CREATE TABLE Feedback (
feedback_id INT PRIMARY KEY,
rating INT CHECK (rating BETWEEN 0 AND 10),
comments TEXT,
feedback_date DATE NOT NULL,
patient_id INT NOT NULL,
doctor_id INT,
hospital_id INT,
FOREIGN KEY (patient_id) REFERENCES Patient(patient_id),
FOREIGN KEY (doctor_id) REFERENCES Doctor(doctor_id),
FOREIGN KEY (hospital_id) REFERENCES HOSPITAL(hospital_id)
);


CREATE TABLE Users (
id INT PRIMARY KEY,
username VARCHAR(100) NOT NULL UNIQUE,
password VARCHAR(1000) NOT NULL,
role ENUM('admin','patient','doctor','nurse','staff')
);


CREATE INDEX idx_patient_phone          ON Patient(phone);
CREATE INDEX idx_patient_name           ON Patient(name);
CREATE INDEX idx_doctor_phone           ON Doctor(phone);
CREATE INDEX idx_doctor_specialization  ON Doctor(specialization);
CREATE INDEX idx_doctor_name            ON Doctor(name);
CREATE INDEX idx_appointment_date       ON Appointment(appointment_date);
CREATE INDEX idx_bill_status            ON Bill(payment_status);
CREATE INDEX idx_bill_date              ON Bill(bill_date);
CREATE INDEX idx_test_name              ON Test_Report(test_name);




-- ── HOSPITAL ──────────────────────────────────
INSERT INTO HOSPITAL VALUES
(1, 'Apollo Hospitals',         'Delhi',     120, 400, 850),
(2, 'Fortis Healthcare',        'Mumbai',    95,  300, 600),
(3, 'AIIMS',                    'Delhi',     200, 700, 1500),
(4, 'Manipal Hospital',         'Bangalore', 80,  250, 500),
(5, 'Max Super Speciality',     'Delhi',     110, 350, 780);
 
-- ── DOCTOR ────────────────────────────────────
INSERT INTO Doctor VALUES
(1,  1, 'Dr. Anil Sharma',    '1970-03-15', 'Cardiology',       '9810001111', 'anil.sharma@apollo.com',   22, 'Mon-Fri 9AM-5PM'),
(2,  1, 'Dr. Priya Mehta',    '1975-06-20', 'Neurology',        '9810002222', 'priya.mehta@apollo.com',   17, 'Mon-Sat 10AM-4PM'),
(3,  2, 'Dr. Rajesh Kumar',   '1968-11-10', 'Orthopaedics',     '9820003333', 'rajesh.kumar@fortis.com',  28, 'Tue-Sat 8AM-3PM'),
(4,  2, 'Dr. Sunita Verma',   '1972-09-05', 'Gynaecology',      '9820004444', 'sunita.verma@fortis.com',  20, 'Mon-Fri 11AM-6PM'),
(5,  3, 'Dr. Vikram Singh',   '1965-01-25', 'Gynaecology', '9830005555', 'vikram.singh@aiims.com',   32, 'Mon-Fri 8AM-2PM'),
(6,  3, 'Dr. Neha Gupta',     '1978-07-14', 'Paediatrics',      '9830006666', 'neha.gupta@aiims.com',     14, 'Mon-Sat 9AM-5PM'),
(7,  4, 'Dr. Arjun Nair',     '1980-04-30', 'Dermatology',      '9840007777', 'arjun.nair@manipal.com',   12, 'Wed-Sun 10AM-5PM'),
(8,  4, 'Dr. Kavitha Iyer',   '1973-12-18', 'Gastroenterology', '9840008888', 'kavitha.iyer@manipal.com', 19, 'Mon-Fri 9AM-4PM'),
(9,  5, 'Dr. Mohit Kapoor',   '1969-08-22', 'Pulmonology',      '9850009999', 'mohit.kapoor@max.com',     23, 'Mon-Sat 8AM-1PM'),
(10, 5, 'Dr. Ritu Bhatia',    '1977-02-28', 'ENT',              '9850010000', 'ritu.bhatia@max.com',      15, 'Tue-Sat 11AM-6PM');
 
-- ── NURSE ─────────────────────────────────────
INSERT INTO Nurse VALUES
(1,'Anjali Rao',1,'1992-04-10','Oncology','9711001111','anjali.rao@apollo.com','morning',5),
(2,'Sunita Das',1,'1988-09-22','Emergency Room','9711002222','sunita.das@apollo.com','Evening',9),
(3,'Meena Pillai',2,'1995-01-15','Medical-Surgical','9721003333','meena.pillai@fortis.com','Night',3),
(4,'Rina Shah',2,'1990-06-30','Operating Room','9721004444','rina.shah@fortis.com','morning',7),
(5,'Pooja Saxena',3,'1993-11-05','Oncology','9731005555','pooja.saxena@aiims.com','Evening',4),
(6,'Kaveri Nair',3,'1986-03-18','Pediatrics','9731006666','kaveri.nair@aiims.com','Night',11),
(7,'Divya Menon',4,'1991-07-25','Geriatrics','9741007777','divya.menon@manipal.com','morning',6),
(8,'Lakshmi Reddy',4,'1989-12-12','Intensive Care','9741008888','lakshmi.reddy@manipal.com','Evening',8),
(9,'Parvati Tiwari',5,'1994-05-08','Obstetrics','9751009999','parvati.tiwari@max.com','Night',4),
(10,'Rashmi Joshi',5,'1987-10-20','Emergency Room','9751010000','rashmi.joshi@max.com','morning',10);
 
-- ── STAFF ─────────────────────────────────────
INSERT INTO STAFF VALUES
(1,  'Ramu Lal',        1, 'Cleaning',   '1985-06-10', 38, 'Male',   '9611001111', '12 Lajpat Nagar, Delhi'),
(2,  'Kamla Devi',      1, 'Cooking',    '1979-03-22', 44, 'Female', '9611002222', '45 Saket, Delhi'),
(3,  'Suresh Yadav',    2, 'Logistics',  '1990-09-15', 33, 'Male',   '9621003333', '7 Andheri, Mumbai'),
(4,  'Geeta Singh',     2, 'Accounts',   '1982-12-05', 41, 'Female', '9621004444', '33 Bandra, Mumbai'),
(5,  'Mahesh Tiwari',   3, 'Paramedic',  '1993-07-20', 30, 'Male',   '9631005555', '89 Rohini, Delhi'),
(6,  'Sita Patel',      3, 'Cleaning',   '1975-02-14', 49, 'Female', '9631006666', '22 Dwarka, Delhi'),
(7,  'Ranjit Kumar',    4, 'Cooking',    '1988-11-30', 35, 'Male',   '9641007777', '15 Indiranagar, Bangalore'),
(8,  'Anita Sharma',    4, 'Logistics',  '1986-04-18', 37, 'Female', '9641008888', '66 Whitefield, Bangalore'),
(9,  'Deepak Mishra',   5, 'Accounts',   '1991-08-25', 32, 'Male',   '9651009999', '10 Vasant Kunj, Delhi'),
(10, 'Preethi Nair',    5, 'Paramedic',  '1984-01-09', 40, 'Female', '9651010000', '54 Pitampura, Delhi');
 
-- ── PATIENT ───────────────────────────────────
INSERT INTO Patient VALUES
(1,  1, 'Rakesh Agarwal',  45, '1979-05-12', 'Male',   '9910001111', 'rakesh.agarwal@email.com', '3 Nehru Place, Delhi',      'B+',  'AADHAR001', 'docs/aadhar_001.pdf', 'docs/license_001.pdf', 'Hypertension, Diabetes Type 2'),
(2,  1, 'Nisha Jain',      32, '1992-08-24', 'Female', '9910002222', 'nisha.jain@email.com', '8 Connaught Place, Delhi',  'A+',  'AADHAR002', 'docs/aadhar_002.pdf', 'docs/license_002.pdf', NULL),
(3,  2, 'Sunil Patil',     60, '1964-03-10', 'Male',   '9920003333', 'sunil.patil@email.com', '17 Marine Drive, Mumbai',   'O+',  'AADHAR003', 'docs/aadhar_003.pdf', 'docs/license_003.pdf', 'Chronic kidney disease'),
(4,  2, 'Anjana Desai',    28, '1996-11-02', 'Female', '9920004444', 'anjana.desai@email.com', '5 Juhu, Mumbai',             'AB+', 'AADHAR004', 'docs/aadhar_004.pdf', 'docs/license_004.pdf', NULL),
(5,  3, 'Harish Gupta',    55, '1969-07-19', 'Male',   '9930005555', 'harish.gupta@email.com', '90 Karol Bagh, Delhi',      'B-',  'AADHAR005', 'docs/aadhar_005.pdf', 'docs/license_005.pdf', 'Coronary artery disease'),
(6,  3, 'Meena Chopra',    40, '1984-01-30', 'Female', '9930006666', 'meena.chopra@email.com', '14 Laxmi Nagar, Delhi',     'A-',  'AADHAR006', 'docs/aadhar_006.pdf', 'docs/license_006.pdf', 'Asthma'),
(7,  4, 'Arjun Pillai',    22, '2002-09-07', 'Male',   '9940007777', 'arjun.pillai@email.com', '29 Koramangala, Bangalore', 'O-',  'AADHAR007', 'docs/aadhar_007.pdf', 'docs/license_007.pdf', NULL),
(8,  4, 'Sudha Krishnan',  70, '1954-06-15', 'Female', '9940008888', 'sudha.krishnan@email.com', '11 JP Nagar, Bangalore',    'AB-', 'AADHAR008', 'docs/aadhar_008.pdf', 'docs/license_008.pdf', 'Osteoarthritis'),
(9,  5, 'Vinod Srivastava',48, '1976-04-21', 'Male',   '9950009999', 'vinod.srivastava@email.com', '6 Rohini, Delhi',           'B+',  'AADHAR009', 'docs/aadhar_009.pdf', 'docs/license_009.pdf', 'COPD'),
(10, 5, 'Pooja Sharma',    35, '1989-12-03', 'Female', '9950010000', 'pooja.sharma@email.com', '22 Vasant Vihar, Delhi',    'A+',  'AADHAR010', 'docs/aadhar_010.pdf', 'docs/license_010.pdf', NULL);
 
-- ── APPOINTMENT ───────────────────────────────
INSERT INTO Appointment VALUES
(1,  '2025-06-01', '10:00:00', 'Completed', 'High fever and headache', 1,  1),
(2,  '2025-06-02', '11:30:00', 'Completed', 'Chronic migraine', 2,  2),
(3,  '2025-06-03', '09:00:00', 'Completed', 'Kidney function checkup', 3,  3),
(4,  '2025-06-04', '14:00:00', 'Completed', 'Routine prenatal', 4,  4),
(5,  '2025-06-05', '10:30:00', 'Completed', 'Chest pain and shortness of breath', 5,  5),
(6,  '2025-06-06', '12:00:00', 'Completed', 'Breathing difficulty', 6,  6),
(7,  '2025-06-07', '09:30:00', 'Completed', 'Facial acne and skin issues', 7,  7),
(8,  '2025-06-08', '11:00:00', 'Completed', 'Acid reflux and stomach pain', 8,  8),
(9,  '2025-06-09', '15:00:00', 'Completed', 'Severe cough and breathlessness', 9,  9),
(10, '2025-06-10', '10:00:00', 'Completed', 'Nasal congestion and sinus pain', 10, 10),
(11, '2026-04-01', '09:00:00', 'Pending', 'General checkup and consultation', 1,  2),
(12, '2026-04-02', '10:30:00', 'Due', 'Follow-up for previous treatment', 3,  4);
 
-- ── TREATMENT ─────────────────────────────────
INSERT INTO Treatment VALUES
(1,  'Hypertension Stage 2',         'Lifestyle modification + medication', 'Amlodipine 5mg',       '2025-06-01', 1),
(2,  'Migraine',                     'Pain management, rest',               'Sumatriptan 50mg',     '2025-06-02', 2),
(3,  'Chronic Kidney Disease Stage 3','Dialysis planning, diet control',    'Furosemide 40mg',      '2025-06-03', 3),
(4,  'Prenatal Check-up',            'Routine monitoring',                  'Folic Acid 5mg',       '2025-06-04', 4),
(5,  'Coronary Artery Disease',      'Angioplasty recommended',             'Aspirin 75mg',         '2025-06-05', 5),
(6,  'Asthma Exacerbation',          'Nebulisation + steroids',             'Salbutamol Inhaler',   '2025-06-06', 6),
(7,  'Acne Vulgaris',                'Topical retinoids + antibiotics',     'Clindamycin gel',      '2025-06-07', 7),
(8,  'GERD',                         'Antacids + diet advice',              'Pantoprazole 40mg',    '2025-06-08', 8),
(9,  'COPD Exacerbation',            'Bronchodilators + oxygen therapy',    'Ipratropium Inhaler',  '2025-06-09', 9),
(10, 'Sinusitis',                    'Nasal saline wash + decongestant',    'Xylometazoline Spray', '2025-06-10', 10);
 
-- ── NURSE_TREATMENT ───────────────────────────
INSERT INTO Nurse_Treatment VALUES
(1,1),(2,1),
(3,2),
(4,3),(5,3),
(6,4),
(7,5),
(8,6),
(9,7),
(10,8),
(1,9),
(2,10);
 
-- ── BILL ─────────────────────────────────────
INSERT INTO Bill VALUES
(1,  5200.00,  'Paid',    'UPI',          '2025-06-01', 1,  1),
(2,  1800.00,  'Paid',    'Cash',         '2025-06-02', 2,  2),
(3,  12000.00, 'Pending', 'Net Banking',  '2025-06-03', 3,  3),
(4,  2500.00,  'Paid',    'Card',         '2025-06-04', 4,  4),
(5,  45000.00, 'Paid',    'Bank Transfer','2025-06-05', 5,  5),
(6,  3800.00,  'Paid',    'UPI',          '2025-06-06', 6,  6),
(7,  1500.00,  'Paid',    'Cash',         '2025-06-07', 7,  7),
(8,  2200.00,  'Pending', 'Cheque',       '2025-06-08', 8,  8),
(9,  6500.00,  'Paid',    'Card',         '2025-06-09', 9,  9),
(10, 1200.00,  'Paid',    'UPI',          '2025-06-10', 10, 10);
 
-- ── TEST_REPORT ───────────────────────────────
INSERT INTO Test_Report VALUES
(1,'CBC','Normal','2025-06-01',1),
(2,'MRI','Normal','2025-06-02',2),
(3,'KFT','Creatinine high','2025-06-03',3),
(4,'Ultrasound','Normal','2025-06-04',4),
(5,'Lipid Profile','High LDL','2025-06-05',5),
(6,'X-ray','Asthma signs','2025-06-06',6),
(7,'CBC','Normal','2025-06-07',7),
(8,'LFT','Slightly high ALT','2025-06-08',8),
(9,'X-ray','COPD signs','2025-06-09',9),
(10,'CT Scan','Sinus issue','2025-06-10',10); 
-- ── ROOM ─────────────────────────────────────
INSERT INTO Room VALUES
(1,'101','General',1,'Occupied',1200.00,1),
(2,'102','Semi-Private',1,'Available',2500.00,1),
(3,'201','Private',2,'Available',5000.00,1),
(4,'301','ICU',3,'Occupied',12000.00,2),
(5,'202','General',2,'Available',1200.00,2),
(6,'401','NICU',4,'Occupied',15000.00,3),
(7,'103','Operation Theatre',1,'Under Maintenance',8000.00,3),
(8,'G01','Emergency',0,'Occupied',2000.00,4),
(9,'302','Private',3,'Available',5500.00,4),
(10,'501','ICU',5,'Available',12500.00,5);
-- ── ADMISSION ─────────────────────────────────
INSERT INTO Admission VALUES
(1,  '2025-06-01', '2025-06-05', 'Hypertension management',          1,  1,  1),
(2,  '2025-06-02', NULL,         'Kidney disease monitoring',         3,  4,  3),
(3,  '2025-06-03', '2025-06-07', 'Post-angioplasty recovery',        5,  4,  5),
(4,  '2025-06-05', NULL,         'COPD exacerbation',                 9,  8,  9),
(5,  '2025-06-06', '2025-06-10', 'Asthma acute attack',              6,  6,  6),
(6,  '2025-06-07', NULL,         'Newborn intensive care',            4,  6,  4),
(7,  '2025-06-08', '2025-06-09', 'Emergency abdominal pain',         8,  8,  8),
(8,  '2025-06-09', '2025-06-12', 'Post-operative care',              2,  2,  2),
(9,  '2025-06-10', NULL,         'Chronic sinusitis observation',     10, 9, 10),
(10, '2025-06-11', '2025-06-15', 'Dermatology inpatient assessment',  7,  2,  7);
 
-- ── PHARMACY ─────────────────────────────────
INSERT INTO Pharmacy VALUES
(1,  'Amlodipine 5mg',         'Other',      'tablet',    200, 3.50,  '2027-12-31'),
(2,  'Sumatriptan 50mg',       'Painkiller', 'tablet',    150, 45.00, '2026-08-30'),
(3,  'Furosemide 40mg',        'Other',      'tablet',    300, 5.00,  '2027-06-15'),
(4,  'Folic Acid 5mg',         'Supplement', 'tablet',    500, 1.50,  '2028-01-31'),
(5,  'Aspirin 75mg',           'Painkiller', 'tablet',    400, 2.00,  '2027-09-30'),
(6,  'Salbutamol Inhaler',     'Other',      'ml',        100, 120.00,'2026-11-30'),
(7,  'Clindamycin gel 1%',     'Antibiotic', 'mg',         80, 85.00, '2026-07-31'),
(8,  'Pantoprazole 40mg',      'Other',      'tablet',    250, 8.00,  '2027-03-31'),
(9,  'Ipratropium Inhaler',    'Other',      'ml',         40, 135.00,'2026-10-31'),
(10, 'Xylometazoline Spray',   'Other',      'ml',        120, 60.00, '2026-12-31'),
(11, 'Amoxicillin 500mg',      'Antibiotic', 'capsule',   350, 12.00, '2027-05-31'),
(12, 'Metformin 500mg',        'Other',      'tablet',    600, 4.00,  '2028-02-28'),
(13, 'Azithromycin 250mg',     'Antibiotic', 'tablet',     30, 25.00, '2026-09-30'),
(14, 'Dexamethasone 4mg',      'Steroid',    'injection',  45, 55.00, '2026-06-30'),
(15, 'Paracetamol 500mg',      'Painkiller', 'tablet',    800, 2.50,  '2028-06-30');
 
-- ── PRESCRIPTION_DETAIL ───────────────────────
INSERT INTO Prescription_Detail VALUES
(1,  1,  1,  '5mg once daily',           'Once a day',   30, 30),
(2,  2,  2,  '50mg at onset of migraine','As needed',    10, 10),
(3,  3,  3,  '40mg morning',             'Once a day',   30, 30),
(4,  4,  4,  '5mg daily',                'Once a day',   90, 90),
(5,  5,  5,  '75mg after breakfast',     'Once a day',   60, 60),
(6,  6,  6,  '2 puffs every 4-6 hours',  'As needed',    14, 14),
(7,  7,  7,  'Thin layer twice daily',   'Twice a day',  60, 60),
(8,  8,  8,  '40mg before meals',        'Once a day',   30, 30),
(9,  9,  9,  '2 puffs 4 times a day',    'As needed',    30, 30),
(10, 10, 10, '2 sprays each nostril BD', 'Twice a day',   7, 7);
 
-- ── INSURANCE ─────────────────────────────────
INSERT INTO Insurance VALUES
(1,  'Star Health Insurance',  'STAR2024001', 300000.00, '2027-03-31', 1),
(2,  'HDFC ERGO Health',       'HDFC2024002', 500000.00, '2028-01-31', 3),
(3,  'Bajaj Allianz',          'BAJA2024003', 200000.00, '2026-06-30', 5),
(4,  'ICICI Lombard',          'ICIC2024004', 750000.00, '2027-12-31', 6),
(5,  'National Insurance',     'NATI2024005', 150000.00, '2026-09-30', 8),
(6,  'New India Assurance',    'NEWI2024006', 1000000.00,'2028-06-30', 2),
(7,  'Religare Health',        'RELI2024007', 400000.00, '2027-08-31', 9),
(8,  'Max Bupa',               'MAXB2024008', 600000.00, '2027-05-31', 4),
(9,  'Aditya Birla Health',    'ADIT2024009', 250000.00, '2026-11-30', 7),
(10, 'Tata AIG Health',        'TATA2024010', 350000.00, '2027-10-31', 10);
 
-- ── EMERGENCY_CONTACT ─────────────────────────
INSERT INTO Emergency_Contact VALUES
(1,  'Suman Agarwal',   'Spouse',   '9810111001', 1),
(2,  'Rohan Jain',      'Spouse',   '9810111002', 2),
(3,  'Anita Patil',     'Spouse',   '9820111003', 3),
(4,  'Deepak Desai',    'Spouse',   '9820111004', 4),
(5,  'Rekha Gupta',     'Spouse',   '9830111005', 5),
(6,  'Arun Chopra',     'Spouse',   '9830111006', 6),
(7,  'Lakshmi Pillai',  'Parent',   '9840111007', 7),
(8,  'Suresh Krishnan', 'Child',    '9840111008', 8),
(9,  'Lata Srivastava', 'Spouse',   '9850111009', 9),
(10, 'Amit Sharma',     'Spouse',   '9850111010', 10);
 
-- ── FEEDBACK ─────────────────────────────────
INSERT INTO Feedback VALUES
(1,  9, 'Excellent treatment and care',          '2025-06-05', 1,  1,  1),
(2,  8, 'Doctor was very attentive',             '2025-06-06', 2,  2,  1),
(3,  7, 'Good facilities, average waiting time', '2025-06-07', 3,  3,  2),
(4,  10,'Best hospital experience ever',         '2025-06-08', 4,  4,  2),
(5,  6, 'Needs improvement in ward hygiene',     '2025-06-09', 5,  5,  3),
(6,  9, 'Very professional nursing staff',       '2025-06-10', 6,  6,  3),
(7,  8, 'Clean rooms, helpful doctors',          '2025-06-11', 7,  7,  4),
(8,  5, 'Long wait times in OPD',               '2025-06-12', 8,  8,  4),
(9,  9, 'Quick and efficient care',             '2025-06-13', 9,  9,  5),
(10, 7, 'Good overall, but pricey',             '2025-06-14', 10, 10, 5);
 
-- ── USER ─────────────────────────────────────
INSERT INTO Users VALUES
(9999,'admin','admin123','admin'),
(1,'rakesh.agarwal','pass1','patient'),
(2,'nisha.jain','pass2','patient'),
(3,'anil.sharma','pass3','doctor'),
(4,'priya.mehta','pass4','doctor'),
(5,'anjali.rao','pass5','nurse'),
(6,'sunita.das','pass6','nurse'),
(7,'ramu.lal','pass7','staff'),
(8,'kamla.devi','pass8','staff'),
(9,'rajesh.kumar','pass9','doctor'),
(10,'vinod.srivastava','pass10','patient');
 
 
DROP TRIGGER IF EXISTS before_patient_insert;
DROP TRIGGER IF EXISTS after_patient_insert;
DROP TRIGGER IF EXISTS after_patient_delete;
DROP TRIGGER IF EXISTS before_bill_update;






DELIMITER $$


CREATE TRIGGER before_patient_insert
     BEFORE INSERT ON Patient FOR EACH ROW
     BEGIN
       IF NEW.dob > CURDATE() THEN
         SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Date of birth cannot be in the future';
       END IF;
       IF NEW.age IS NULL THEN
         SET NEW.age = TIMESTAMPDIFF(YEAR, NEW.dob, CURDATE());
       END IF;
 END$$


DELIMITER ;


DELIMITER $$


CREATE TRIGGER after_patient_insert
     AFTER INSERT ON Patient FOR EACH ROW
     BEGIN
       UPDATE HOSPITAL
       SET num_patients = num_patients + 1
       WHERE hospital_id = NEW.hospital_id;
 END$$


DELIMITER ;


DELIMITER $$


CREATE TRIGGER after_patient_delete
     AFTER DELETE ON Patient FOR EACH ROW
     BEGIN
       UPDATE HOSPITAL
       SET num_patients = GREATEST(num_patients - 1, 0)
       WHERE hospital_id = OLD.hospital_id;
 END$$


DELIMITER ;






DELIMITER $$


CREATE TRIGGER before_bill_update
BEFORE UPDATE ON Bill
FOR EACH ROW
BEGIN
  IF NEW.payment_status = 'Paid' AND OLD.payment_status = 'Pending' THEN
    SET NEW.bill_date = CURDATE();
  END IF;
END$$


DELIMITER ;


-- Check that triggers were created
SHOW TRIGGERS;
