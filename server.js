const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',  
  password: 'singham',    
  database: 'smart_hospital',
  multipleStatements: true
});
const dbp = db.promise();

var MEDICINE_NAMES = [
  'Paracetamol 500mg',
  'Ibuprofen 400mg',
  'Amoxicillin 500mg',
  'Azithromycin 500mg',
  'Cetirizine 10mg',
  'Pantoprazole 40mg',
  'Metformin 500mg',
  'Amlodipine 5mg',
  'ORS',
  'Vitamin C',
  'Insulin',
  'Furosemide 40mg',
  'Folic Acid 5mg',
  'Aspirin 75mg',
  'Salbutamol Inhaler',
  'Clindamycin gel 1%',
  'Ipratropium Inhaler',
  'Xylometazoline Spray',
  'Other'
];
var PHARMACY_CATEGORIES = [
  'Antibiotic',
  'Painkiller',
  'Antiviral',
  'Antifungal',
  'Supplement',
  'Vaccine',
  'Steroid',
  'Antacid',
  'Antidiabetic',
  'Antihypertensive',
  'Other'
];
var PHARMACY_UNITS = [
  'mg',
  'ml',
  'tablet',
  'capsule',
  'syrup',
  'injection',
  'drop',
  'cream',
  'ointment'
];
var PRESCRIPTION_FREQUENCIES = [
  'Once a day',
  'Twice a day',
  'Thrice a day',
  'Four times a day',
  'As needed',
  'Weekly',
  'Monthly'
];

db.connect(function (err) {
  if (err) { console.log('DB connection failed:', err.message); return; }
  console.log('Connected to MySQL!');
  setupSchemaSupport();
  setupTriggers();
  setupAuthData();
});

function setupSchemaSupport() {
  db.query('ALTER TABLE Patient MODIFY patient_id INT NOT NULL AUTO_INCREMENT', function (err) {
    if (err) console.log('Patient auto increment alter skipped:', err.message);
  });
  db.query('ALTER TABLE Users MODIFY username VARCHAR(100) NOT NULL UNIQUE', function (err) {
    if (err) console.log('Users username unique alter skipped:', err.message);
  });
  db.query("ALTER TABLE Pharmacy MODIFY category ENUM('Antibiotic','Painkiller','Antiviral','Antifungal','Supplement','Vaccine','Steroid','Antacid','Antidiabetic','Antihypertensive','Other')", function (err) {
    if (err) console.log('Pharmacy category alter skipped:', err.message);
  });
  db.query("ALTER TABLE Pharmacy MODIFY unit ENUM('mg','ml','tablet','capsule','syrup','injection','drop','cream','ointment')", function (err) {
    if (err) console.log('Pharmacy unit alter skipped:', err.message);
  });
  db.query("ALTER TABLE Prescription_Detail MODIFY frequency ENUM('Once a day','Twice a day','Thrice a day','Four times a day','As needed','Weekly','Monthly')", function (err) {
    if (err) console.log('Prescription frequency alter skipped:', err.message);
  });
  db.query('ALTER TABLE Prescription_Detail ADD COLUMN quantity_prescribed INT NOT NULL DEFAULT 1 AFTER duration_days', function (err) {
    if (err) console.log('Prescription quantity alter skipped:', err.message);
  });
}


// TRIGGERS

function setupTriggers() {
  db.query('DROP TRIGGER IF EXISTS before_patient_insert', () => {
    db.query(`
      CREATE TRIGGER before_patient_insert
      BEFORE INSERT ON Patient FOR EACH ROW
      BEGIN
        IF NEW.dob > CURDATE() THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Date of birth cannot be in the future';
        END IF;
        IF NEW.age IS NULL THEN
          SET NEW.age = TIMESTAMPDIFF(YEAR, NEW.dob, CURDATE());
        END IF;
      END`, err => { if (err) console.log('Trigger 1 err:', err.message); else console.log('Trigger 1 ready'); });
  });
  db.query('DROP TRIGGER IF EXISTS after_patient_insert', () => {
    db.query(`
      CREATE TRIGGER after_patient_insert
      AFTER INSERT ON Patient FOR EACH ROW
      BEGIN
        UPDATE HOSPITAL
        SET num_patients = num_patients + 1
        WHERE hospital_id = NEW.hospital_id;
      END`, err => { if (err) console.log('Trigger 1b err:', err.message); else console.log('Trigger 1b ready'); });
  });
  db.query('DROP TRIGGER IF EXISTS after_patient_delete', () => {
    db.query(`
      CREATE TRIGGER after_patient_delete
      AFTER DELETE ON Patient FOR EACH ROW
      BEGIN
        UPDATE HOSPITAL
        SET num_patients = GREATEST(num_patients - 1, 0)
        WHERE hospital_id = OLD.hospital_id;
      END`, err => { if (err) console.log('Trigger 1c err:', err.message); else console.log('Trigger 1c ready'); });
  });
  db.query('DROP TRIGGER IF EXISTS before_bill_update', () => {
    db.query(`
      CREATE TRIGGER before_bill_update
      BEFORE UPDATE ON Bill FOR EACH ROW
      BEGIN
        IF NEW.payment_status = 'Paid' AND OLD.payment_status = 'Pending' THEN
          SET NEW.bill_date = CURDATE();
        END IF;
      END`, err => { if (err) console.log('Trigger 2 err:', err.message); else console.log('Trigger 2 ready'); });
  });
}


// VALIDATION

function badPhone(p) { return p && !/^\d{10}$/.test(p); }
function badEmail(e) { return e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function futureDOB(d) { return d && new Date(d) > new Date(); }
function forbidden(res, msg) { return res.status(403).json({ error: msg || 'Forbidden for your role' }); }
function oneOf(val, list) { return list.indexOf(val) >= 0; }

function setupAuthData() {
  db.query("ALTER TABLE Users MODIFY role ENUM('admin','patient','doctor','nurse','staff') NOT NULL", function (err) {
    if (err) console.log('Users enum alter skipped:', err.message);
  });
  db.query(
    "INSERT IGNORE INTO Users(id, username, password, role) VALUES (9999,'admin','admin123','admin')",
    function (err) {
      if (err) console.log('Admin seed skipped:', err.message);
    }
  );
}

// helper: get next auto-like id from a table/column
function nextId(table, col, cb) {
  db.query(`SELECT COALESCE(MAX(${col}),0)+1 AS nextId FROM ${table}`, function (err, rows) {
    if (err) return cb(err);
    cb(null, rows && rows[0] ? rows[0].nextId : 1);
  });
}

function nextAutoId(table, cb) {
  db.query(
    'SELECT COALESCE(AUTO_INCREMENT, 1) AS nextId FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table],
    function (err, rows) {
      if (err) return cb(err);
      if (rows && rows[0] && rows[0].nextId) return cb(null, rows[0].nextId);
      nextId(table, table.toLowerCase() + '_id', cb);
    }
  );
}

function ensureHospitalExists(hospitalId, cb) {
  db.query('SELECT hospital_id, name, city FROM HOSPITAL WHERE hospital_id=? LIMIT 1', [hospitalId], function (err, rows) {
    if (err) return cb(err);
    if (!rows || !rows.length) return cb({ status: 400, message: 'Selected hospital does not exist' });
    cb(null, rows[0]);
  });
}

function buildNextIdMap(cb) {
  var targets = [
    { key: 'hospital_id', table: 'HOSPITAL', col: 'hospital_id' },
    { key: 'patient_id', table: 'Patient', col: 'patient_id', auto: true },
    { key: 'doctor_id', table: 'Doctor', col: 'doctor_id' },
    { key: 'nurse_id', table: 'Nurse', col: 'nurse_id' },
    { key: 'staff_id', table: 'STAFF', col: 'staff_id' },
    { key: 'appointment_id', table: 'Appointment', col: 'appointment_id' },
    { key: 'treatment_id', table: 'Treatment', col: 'treatment_id' },
    { key: 'bill_id', table: 'Bill', col: 'bill_id' },
    { key: 'room_id', table: 'Room', col: 'room_id' },
    { key: 'admission_id', table: 'Admission', col: 'admission_id' },
    { key: 'medication_id', table: 'Pharmacy', col: 'medication_id' },
    { key: 'report_id', table: 'Test_Report', col: 'report_id' },
    { key: 'prescription_id', table: 'Prescription_Detail', col: 'prescription_id' },
    { key: 'insurance_id', table: 'Insurance', col: 'insurance_id' },
    { key: 'contact_id', table: 'Emergency_Contact', col: 'contact_id' },
    { key: 'feedback_id', table: 'Feedback', col: 'feedback_id' }
  ];
  var out = {};
  var pending = targets.length;
  var failed = false;

  targets.forEach(function (target) {
    var done = function (err, nextVal) {
      if (failed) return;
      if (err) {
        failed = true;
        return cb(err);
      }
      out[target.key] = nextVal;
      pending -= 1;
      if (!pending) cb(null, out);
    };

    if (target.auto) return nextAutoId(target.table, done);
    nextId(target.table, target.col, done);
  });
}

function usernameAvailable(username, expectedId, cb) {
  db.query('SELECT id FROM Users WHERE username=? LIMIT 1', [username], function (err, rows) {
    if (err) return cb(err);
    if (rows && rows.length && Number(rows[0].id) !== Number(expectedId)) {
      return cb({ status: 409, message: 'Username already exists' });
    }
    cb();
  });
}

function resolveSessionEntityId(user, cb) {
  if (!user || !user.role) return cb(null, null);
  if (user.role === 'admin') return cb(null, user.id);

  var table = null;
  var idCol = null;
  var nameExpr = null;

  if (user.role === 'doctor') {
    table = 'Doctor';
    idCol = 'doctor_id';
    nameExpr = "LOWER(REPLACE(REPLACE(REPLACE(name, 'Dr. ', ''), 'Dr ', ''), ' ', '.'))";
  } else if (user.role === 'patient') {
    table = 'Patient';
    idCol = 'patient_id';
    nameExpr = "LOWER(REPLACE(name, ' ', '.'))";
  } else {
    return cb(null, user.id);
  }

  db.query(`SELECT ${idCol} AS entity_id FROM ${table} WHERE ${nameExpr}=? LIMIT 1`,
    [String(user.username || '').toLowerCase()],
    function (nameErr, nameRows) {
      if (nameErr) return cb(nameErr);
      if (nameRows && nameRows.length) return cb(null, nameRows[0].entity_id);

      db.query(`SELECT ${idCol} AS entity_id FROM ${table} WHERE ${idCol}=? LIMIT 1`, [user.id], function (idErr, idRows) {
        if (idErr) return cb(idErr);
        if (idRows && idRows.length) return cb(null, idRows[0].entity_id);
        cb(null, user.id);
      });
  });
}

function routeKey(path) {
  var keys = [
    '/stats', '/hospitals', '/patients', '/doctors', '/nurses', '/staff',
    '/appointments', '/treatments', '/bills', '/rooms', '/admissions', '/pharmacy',
    '/reports', '/insurance', '/emergency-contacts', '/feedback', '/prescriptions', '/nurse-treatments',
    '/patient-profile', '/patient-dashboard', '/doctor/pending-appointments', '/admitted-patients', 
    '/pharmacy-purchase', '/discharge-patient', '/patient-completed-doctors', '/prescriptions/bulk'
  ];
  for (var i = 0; i < keys.length; i++) {
    if (path === keys[i] || path.indexOf(keys[i] + '/') === 0) return keys[i];
  }
  return path;
}

var ACCESS = {
  admin: { GET: ['*'], POST: ['*'], PUT: ['*'], DELETE: ['*'] },
  doctor: {
    GET: ['/stats', '/patients', '/doctors', '/appointments', '/treatments', '/reports', '/prescriptions', '/admissions', '/emergency-contacts', '/doctor/pending-appointments', '/admitted-patients', '/medicine-options'],
    POST: ['/appointments', '/treatments', '/reports', '/prescriptions', '/prescriptions/bulk', '/discharge-patient'],
    PUT: ['/appointments', '/treatments', '/reports', '/prescriptions'],
    DELETE: []
  },
  patient: {
    GET: ['/stats', '/hospitals', '/doctors', '/appointments', '/treatments', '/reports', '/prescriptions', '/nurse-treatments', '/bills', '/rooms', '/admissions', '/pharmacy', '/insurance', '/emergency-contacts', '/feedback', '/patient-profile', '/patient-dashboard', '/patient-completed-doctors'],
    POST: ['/appointments', '/admissions', '/feedback', '/emergency-contacts', '/pharmacy-purchase'],
    PUT: ['/appointments', '/rooms', '/feedback', '/emergency-contacts', '/patient-profile'],
    DELETE: ['/appointments', '/feedback', '/emergency-contacts']
  },
  staff: {
    GET: ['/stats', '/hospitals', '/nurses', '/staff', '/nurse-treatments', '/admissions', '/emergency-contacts'],
    POST: [],
    PUT: ['/staff'],
    DELETE: []
  }
};

function allowed(role, method, path) {
  var rule = ACCESS[role];
  if (!rule || !rule[method]) return false;
  if (rule[method].indexOf('*') >= 0) return true;
  return rule[method].indexOf(routeKey(path)) >= 0;
}

app.post('/login', function (req, res) {
  var b = req.body || {};
  if (!b.username || !b.password || !b.role) return res.status(400).json({ error: 'username, password and role are required' });
  var role = String(b.role).toLowerCase();
  if (['admin', 'patient', 'doctor'].indexOf(role) < 0) return res.status(400).json({ error: 'Invalid role (staff login disabled)' });

  db.query('SELECT id, username, role FROM Users WHERE username=? AND password=? AND role=? LIMIT 1',
    [b.username, b.password, role],
    function (err, rows) {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || !rows.length) return res.status(401).json({ error: 'Invalid credentials' });
      var u = rows[0];
      resolveSessionEntityId(u, function (resolveErr, entityId) {
        if (resolveErr) return res.status(500).json({ error: resolveErr.message });
        res.json({ message: 'Login successful', user: { id: entityId, username: u.username, role: u.role } });
      });
    });
});

app.get('/public/hospitals', function (req, res) {
  db.query('SELECT hospital_id, name, city FROM HOSPITAL ORDER BY hospital_id', function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/meta/next-ids', function (req, res) {
  buildNextIdMap(function (err, ids) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(ids);
  });
});

app.use(function (req, res, next) {
  if (req.path === '/login' || req.path === '/register' || req.path === '/public/hospitals' || req.method === 'OPTIONS') return next();
  var role = String(req.headers['x-user-role'] || '').toLowerCase();
  var userId = Number(req.headers['x-user-id']);
  if (!role || ['admin', 'doctor', 'patient', 'staff'].indexOf(role) < 0) {
    return res.status(401).json({ error: 'Unauthorized: login required' });
  }
  if (!allowed(role, req.method, req.path)) {
    return forbidden(res);
  }
  req.user = { role: role, id: isNaN(userId) ? null : userId };
  next();
});

//id increamentor---
function getNextId(table, col, cb) {
  db.query(
    `SELECT COALESCE(MAX(${col}), 0) + 1 AS nextId FROM ${table}`,
    (err, rows) => {
      if (err) return cb(err);
      cb(null, rows[0].nextId);
    }
  );
}


// STATS

app.get('/stats', function (req, res) {
  var s = {}, done = 0, total = 6;
  function fin() { if (++done === total) res.json(s); }
  db.query('SELECT COUNT(*) n FROM Patient', (e, r) => { s.patients = r ? r[0].n : 0; fin(); });
  db.query('SELECT COUNT(*) n FROM Doctor', (e, r) => { s.doctors = r ? r[0].n : 0; fin(); });
  db.query("SELECT COUNT(*) n FROM Appointment WHERE status IN('Pending','Due')", (e, r) => { s.appointments = r ? r[0].n : 0; fin(); });
  db.query("SELECT COUNT(*) n FROM Room WHERE status='Available'", (e, r) => { s.rooms = r ? r[0].n : 0; fin(); });
  db.query("SELECT COALESCE(SUM(total_amount),0) n FROM Bill WHERE payment_status='Paid'", (e, r) => { s.revenue = r ? r[0].n : 0; fin(); });
  db.query("SELECT COUNT(*) n FROM Bill WHERE payment_status='Pending'", (e, r) => { s.pending_bills = r ? r[0].n : 0; fin(); });
});


// HOSPITALS
app.get('/hospitals', function (req, res) {
  db.query('SELECT * FROM HOSPITAL ORDER BY hospital_id', function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/hospitals', function (req, res) {
  var b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.city || !b.city.trim()) return res.status(400).json({ error: 'City required' });
  if (!b.num_doctors || b.num_doctors <= 0) return res.status(400).json({ error: 'Number of doctors must be > 0' });
  if (!b.num_staff || b.num_staff <= 0) return res.status(400).json({ error: 'Number of staff must be > 0' });
  if (b.num_patients < 0) return res.status(400).json({ error: 'Number of patients cannot be negative' });

  nextId('HOSPITAL', 'hospital_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO HOSPITAL VALUES (?,?,?,?,?,?)',
      [newId, b.name.trim(), b.city.trim(), b.num_doctors, b.num_staff, b.num_patients || 0],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Hospital added!', hospital_id: newId });
      });
  });
});

app.put('/hospitals/:id', function (req, res) {
  var b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.city || !b.city.trim()) return res.status(400).json({ error: 'City required' });

  db.query('UPDATE HOSPITAL SET name=?, city=?, num_doctors=?, num_staff=?, num_patients=? WHERE hospital_id=?',
    [b.name.trim(), b.city.trim(), b.num_doctors, b.num_staff, b.num_patients, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Hospital updated!' });
    });
});

app.delete('/hospitals/:id', function (req, res) {
  db.query('DELETE FROM HOSPITAL WHERE hospital_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Hospital deleted!' });
  });
});


// PATIENTS
app.get('/patients', function (req, res) {
  var sql = 'SELECT * FROM Patient';
  var args = [];
  if (req.user.role === 'patient') {
    sql += ' WHERE patient_id=?';
    args.push(req.user.id);
  } else if (req.user.role === 'doctor') {
    sql = `SELECT DISTINCT p.* FROM Patient p
      JOIN Appointment a ON a.patient_id = p.patient_id
      WHERE a.doctor_id=?
      ORDER BY p.patient_id`;
    args.push(req.user.id);
  } else {
    sql += ' ORDER BY patient_id';
  }
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/patients/next-id', function (req, res) {
  nextAutoId('Patient', function (err, nextPatientId) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ next_patient_id: nextPatientId });
  });
});

app.post('/patients', function (req, res) {
  var b = req.body;
  if (!b.hospital_id) return res.status(400).json({ error: 'Hospital ID required' });
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.dob) return res.status(400).json({ error: 'DOB required' });
  if (!b.gender) return res.status(400).json({ error: 'Gender required' });
  if (!b.blood_group) return res.status(400).json({ error: 'Blood group required' });
  if (futureDOB(b.dob)) return res.status(400).json({ error: 'DOB cannot be in the future' });
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  if (badEmail(b.email)) return res.status(400).json({ error: 'Invalid email format' });
  if (b.age !== null && b.age !== '' && (isNaN(b.age) || b.age < 0 || b.age > 149))
    return res.status(400).json({ error: 'Age must be 0–149' });

  ensureHospitalExists(Number(b.hospital_id), function (hospitalErr) {
    if (hospitalErr) {
      if (hospitalErr.status) return res.status(hospitalErr.status).json({ error: hospitalErr.message });
      return res.status(500).json({ error: hospitalErr.message });
    }

    db.query('INSERT INTO Patient(hospital_id, name, age, dob, gender, phone, email, address, blood_group, medical_history) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [b.hospital_id, b.name.trim(), b.age || null, b.dob, b.gender,
      b.phone || null, b.email || null, b.address || null, b.blood_group, b.medical_history || null],
      function (err, result) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Patient added!', patient_id: result.insertId });
      });
  });
});

app.put('/patients/:id', function (req, res) {
  var b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.gender) return res.status(400).json({ error: 'Gender required' });
  if (!b.blood_group) return res.status(400).json({ error: 'Blood group required' });
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  if (badEmail(b.email)) return res.status(400).json({ error: 'Invalid email format' });

  db.query('UPDATE Patient SET name=?, gender=?, phone=?, email=?, address=?, blood_group=?, aadhar_number=?, aadhar_doc_url=?, license_doc_url=?, medical_history=? WHERE patient_id=?',
    [b.name.trim(), b.gender, b.phone || null, b.email || null, b.address || null, b.blood_group, 
     b.aadhar_number || null, b.aadhar_doc_url || null, b.license_doc_url || null, 
     b.medical_history || null, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Patient updated!' });
    });
});

app.delete('/patients/:id', function (req, res) {
  db.query('DELETE FROM Patient WHERE patient_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Patient deleted!' });
  });
});


// DOCTORS
app.get('/doctors', function (req, res) {
  var sql = 'SELECT * FROM Doctor ORDER BY doctor_id';
  var args = [];
  // Doctors can see all doctors (for referral purposes)
  // but retrieve all doctors regardless of role
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/patient-completed-doctors', function (req, res) {
  if (req.user.role !== 'patient') return forbidden(res, 'Patient only');
  var sql = `
    SELECT DISTINCT d.doctor_id, d.name, d.specialization
    FROM Doctor d
    JOIN Appointment a ON a.doctor_id = d.doctor_id
    WHERE a.patient_id = ? AND a.status = 'Completed'
    ORDER BY d.doctor_id
  `;
  db.query(sql, [req.user.id], function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/doctors', function (req, res) {
  var b = req.body;
  if (!b.hospital_id) return res.status(400).json({ error: 'Hospital ID required' });
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.dob) return res.status(400).json({ error: 'DOB required' });
  if (!b.specialization) return res.status(400).json({ error: 'Specialization required' });
  if (!b.schedule || !b.schedule.trim()) return res.status(400).json({ error: 'Schedule required' });
  if (futureDOB(b.dob)) return res.status(400).json({ error: 'DOB cannot be in the future' });
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  if (badEmail(b.email)) return res.status(400).json({ error: 'Invalid email format' });

  nextId('Doctor', 'doctor_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO Doctor VALUES (?,?,?,?,?,?,?,?,?)',
      [newId, b.hospital_id, b.name.trim(), b.dob, b.specialization,
      b.phone || null, b.email || null, b.experience_years || null, b.schedule.trim()],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Doctor added!', doctor_id: newId });
      });
  });
});

app.put('/doctors/:id', function (req, res) {
  var b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.specialization) return res.status(400).json({ error: 'Specialization required' });
  if (!b.schedule || !b.schedule.trim()) return res.status(400).json({ error: 'Schedule required' });
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  if (badEmail(b.email)) return res.status(400).json({ error: 'Invalid email format' });

  db.query('UPDATE Doctor SET name=?, specialization=?, phone=?, email=?, experience_years=?, schedule=? WHERE doctor_id=?',
    [b.name.trim(), b.specialization, b.phone || null, b.email || null, b.experience_years || null, b.schedule.trim(), req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Doctor updated!' });
    });
});

app.delete('/doctors/:id', function (req, res) {
  db.query('DELETE FROM Doctor WHERE doctor_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Doctor deleted!' });
  });
});


// NURSES
app.get('/nurses', function (req, res) {
  var sql = 'SELECT * FROM Nurse ORDER BY nurse_id';
  var args = [];
  if (req.user.role === 'staff') {
    sql = `SELECT n.* FROM Nurse n
      JOIN STAFF s ON s.hospital_id=n.hospital_id
      WHERE s.staff_id=?
      ORDER BY n.nurse_id`;
    args = [req.user.id];
  }
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/nurses', function (req, res) {
  var b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.hospital_id) return res.status(400).json({ error: 'Hospital ID required' });
  if (!b.dob) return res.status(400).json({ error: 'DOB required' });
  if (!b.department) return res.status(400).json({ error: 'Department required' });
  if (!b.shift) return res.status(400).json({ error: 'Shift required' });
  if (futureDOB(b.dob)) return res.status(400).json({ error: 'DOB cannot be in the future' });
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  if (badEmail(b.email)) return res.status(400).json({ error: 'Invalid email format' });

  nextId('Nurse', 'nurse_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO Nurse VALUES (?,?,?,?,?,?,?,?,?)',
      [newId, b.name.trim(), b.hospital_id, b.dob, b.department,
      b.phone || null, b.email || null, b.shift, b.experience_years || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Nurse added!', nurse_id: newId });
      });
  });
});

app.put('/nurses/:id', function (req, res) {
  var b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.department) return res.status(400).json({ error: 'Department required' });
  if (!b.shift) return res.status(400).json({ error: 'Shift required' });
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  if (badEmail(b.email)) return res.status(400).json({ error: 'Invalid email format' });

  db.query('UPDATE Nurse SET name=?, department=?, phone=?, email=?, shift=?, experience_years=? WHERE nurse_id=?',
    [b.name.trim(), b.department, b.phone || null, b.email || null, b.shift, b.experience_years || null, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Nurse updated!' });
    });
});

app.delete('/nurses/:id', function (req, res) {
  db.query('DELETE FROM Nurse WHERE nurse_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Nurse deleted!' });
  });
});


// STAFF
app.get('/staff', function (req, res) {
  var sql = 'SELECT * FROM STAFF ORDER BY staff_id';
  var args = [];
  if (req.user.role === 'staff') {
    sql = 'SELECT * FROM STAFF WHERE staff_id=?';
    args = [req.user.id];
  }
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/staff', function (req, res) {
  var b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.hospital_id) return res.status(400).json({ error: 'Hospital ID required' });
  if (!b.occupation) return res.status(400).json({ error: 'Occupation required' });
  if (!b.dob) return res.status(400).json({ error: 'DOB required' });
  if (!b.gender) return res.status(400).json({ error: 'Gender required' });
  if (futureDOB(b.dob)) return res.status(400).json({ error: 'DOB cannot be in the future' });
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });

  nextId('STAFF', 'staff_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO STAFF VALUES (?,?,?,?,?,?,?,?,?)',
      [newId, b.name.trim(), b.hospital_id, b.occupation,
      b.dob, b.age || null, b.gender, b.phone || null, b.address || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Staff added!', staff_id: newId });
      });
  });
});

app.put('/staff/:id', function (req, res) {
  var b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.occupation) return res.status(400).json({ error: 'Occupation required' });
  if (!b.gender) return res.status(400).json({ error: 'Gender required' });
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  if (req.user.role === 'staff' && Number(req.params.id) !== Number(req.user.id)) return forbidden(res, 'Staff can only update own record');

  db.query('UPDATE STAFF SET name=?, occupation=?, gender=?, phone=?, address=?, age=? WHERE staff_id=?',
    [b.name.trim(), b.occupation, b.gender, b.phone || null, b.address || null, b.age || null, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Staff updated!' });
    });
});

app.delete('/staff/:id', function (req, res) {
  db.query('DELETE FROM STAFF WHERE staff_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Staff deleted!' });
  });
});


// APPOINTMENTS
app.get('/appointments', function (req, res) {
  var sql = `SELECT a.*, p.name patient_name, d.name doctor_name
    FROM Appointment a
    JOIN Patient p ON a.patient_id = p.patient_id
    JOIN Doctor  d ON a.doctor_id  = d.doctor_id
    `;
  var args = [];
  if (req.user.role === 'doctor') { sql += ' WHERE a.doctor_id=?'; args.push(req.user.id); }
  if (req.user.role === 'patient') { sql += ' WHERE a.patient_id=?'; args.push(req.user.id); }
  sql += ' ORDER BY a.appointment_date DESC';
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/appointments', function (req, res) {
  var b = req.body;
  var patientId = b.patient_id;
  if (req.user.role === 'patient') patientId = req.user.id; // always bind to logged-in patient
  var doctorId = b.doctor_id;
  var status = b.status || 'Pending';
  if (!patientId) return res.status(400).json({ error: 'Patient ID required' });
  if (!doctorId) return res.status(400).json({ error: 'Doctor ID required' });
  if (!b.appointment_date) return res.status(400).json({ error: 'Date required' });
  if (!b.appointment_time) return res.status(400).json({ error: 'Time required' });
  
  // Validate appointment date is not in the past
  var appointmentDate = new Date(b.appointment_date);
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  if (appointmentDate < today) return res.status(400).json({ error: 'Appointment date cannot be in the past' });

  function insertAppointment(nextId) {
    db.query('INSERT INTO Appointment VALUES (?,?,?,?,?,?,?)',
      [nextId, b.appointment_date, b.appointment_time, status, b.illness_description || null, patientId, doctorId],
      function (err) {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Duplicate appointment ID, please retry' });
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Appointment booked!', appointment_id: nextId });
      });
  }

  function getNextIdAndInsert(cb) {
    db.query('SELECT COALESCE(MAX(appointment_id),0)+1 AS next FROM Appointment', function (e, r) {
      if (e) return res.status(500).json({ error: e.message });
      var nextId = (r && r[0] && r[0].next) ? r[0].next : 1;
      cb(nextId);
    });
  }
  
  // Doctor can refer patients (but only patients they have appointments with, and to OTHER doctors)
  if (req.user.role === 'doctor') {
    if (doctorId == req.user.id) {
      return res.status(400).json({ error: 'Doctor cannot create appointments for themselves. Only referrals to other doctors allowed.' });
    }
    // Verify patient has appointment with this doctor
    db.query('SELECT 1 FROM Appointment WHERE patient_id=? AND doctor_id=?', [patientId, req.user.id], function (e, r) {
      if (e) return res.status(500).json({ error: e.message });
      if (!r || !r.length) return res.status(403).json({ error: 'You can only refer patients you have appointments with' });
      // Proceed with creating referral appointment with fresh ID
      getNextIdAndInsert(function (nextId) {
        insertAppointment(nextId);
      });
    });
    return;
  }

  // Patients/Admin booking flow
  getNextIdAndInsert(function (nextId) {
    insertAppointment(nextId);
  });
});

app.put('/appointments/:id', function (req, res) {
  var b = req.body;
  if (!b.status) return res.status(400).json({ error: 'Status required' });

  var sql = 'UPDATE Appointment SET appointment_date=?, appointment_time=?, status=?, illness_description=? WHERE appointment_id=?';
  var args = [b.appointment_date, b.appointment_time, b.status, b.illness_description || null, req.params.id];
  if (req.user.role === 'patient') { sql += ' AND patient_id=?'; args.push(req.user.id); }
  if (req.user.role === 'doctor') { sql += ' AND doctor_id=?'; args.push(req.user.id); }
  db.query(sql,
    args,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Appointment updated!' });
    });
});

app.put('/appointments/:id/status', function (req, res) {
  var b = req.body;
  if (!b.status) return res.status(400).json({ error: 'Status required' });

  var sql = 'UPDATE Appointment SET status=? WHERE appointment_id=?';
  var args = [b.status, req.params.id];
  if (req.user.role === 'patient') { sql += ' AND patient_id=?'; args.push(req.user.id); }
  if (req.user.role === 'doctor') { sql += ' AND doctor_id=?'; args.push(req.user.id); }
  db.query(sql, args, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Appointment status updated!' });
  });
});

app.delete('/appointments/:id', function (req, res) {
  var sql = 'DELETE FROM Appointment WHERE appointment_id=?';
  var args = [req.params.id];
  if (req.user.role === 'patient') { sql += ' AND patient_id=?'; args.push(req.user.id); }
  db.query(sql, args, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Appointment deleted!' });
  });
});

// USERS (admin only)
app.post('/users', function (req, res) {
  if (req.user.role !== 'admin') return forbidden(res);
  var b = req.body || {};
  if (!b.username || !b.password || !b.role) return res.status(400).json({ error: 'username, password, role required' });
  var role = String(b.role).toLowerCase();
  if (['admin', 'patient', 'doctor', 'nurse', 'staff'].indexOf(role) < 0) return res.status(400).json({ error: 'Invalid role' });

  var targetId = b.id ? Number(b.id) : null;

  function ensureEntityExists(cb) {
    if (role === 'patient' && targetId !== null) {
      return db.query('SELECT 1 FROM Patient WHERE patient_id=? LIMIT 1', [targetId], function (e, r) {
        if (e) return cb(e);
        if (!r || !r.length) return cb({ status: 400, message: 'Patient ID not found' });
        cb();
      });
    }
    if (role === 'doctor' && targetId !== null) {
      return db.query('SELECT 1 FROM Doctor WHERE doctor_id=? LIMIT 1', [targetId], function (e, r) {
        if (e) return cb(e);
        if (!r || !r.length) return cb({ status: 400, message: 'Doctor ID not found' });
        cb();
      });
    }
    cb();
  }

  ensureEntityExists(function (entityErr) {
    if (entityErr) {
      if (entityErr.status) return res.status(entityErr.status).json({ error: entityErr.message });
      return res.status(500).json({ error: entityErr.message });
    }

    function proceedInsert(idToUse) {
      usernameAvailable(b.username, idToUse, function (checkErr) {
        if (checkErr) {
          if (checkErr.status) return res.status(checkErr.status).json({ error: checkErr.message });
          return res.status(500).json({ error: checkErr.message });
        }

        db.query('INSERT INTO Users(id, username, password, role) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE username=VALUES(username), password=VALUES(password), role=VALUES(role)',
          [idToUse, b.username, b.password, role],
          function (e) {
            if (e) return res.status(500).json({ error: e.message });
            res.json({ message: 'User added/updated', id: idToUse });
          });
      });
    }

    if (targetId !== null) {
      return proceedInsert(targetId);
    }

    // fallback to next incremental id when admin did not provide one
    nextId('Users', 'id', function (err, newId) {
      if (err) return res.status(500).json({ error: err.message });
      proceedInsert(newId);
    });
  });
});

// List users (admin only)
app.get('/users', function (req, res) {
  if (req.user.role !== 'admin') return forbidden(res);
  var role = (req.query.role || '').toLowerCase();
  var allowedRoles = ['admin', 'patient', 'doctor', 'nurse', 'staff'];
  var args = [];
  var sql = 'SELECT id, username, role, password FROM Users';
  if (role && allowedRoles.indexOf(role) >= 0) {
    sql += ' WHERE role=?';
    args.push(role);
  }
  sql += ' ORDER BY role, id';
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Patient self‑registration (public)
// app.post('/register', function (req, res) {
//   var b = req.body || {};
//   if (!b.username || !b.password) return res.status(400).json({ error: 'username and password are required' });
//   if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Full name is required' });
//   if (!b.hospital_id) return res.status(400).json({ error: 'Hospital is required' });
//   if (!b.dob) return res.status(400).json({ error: 'DOB is required' });
//   if (!b.gender) return res.status(400).json({ error: 'Gender is required' });
//   if (!b.blood_group) return res.status(400).json({ error: 'Blood group is required' });
//   if (futureDOB(b.dob)) return res.status(400).json({ error: 'DOB cannot be in the future' });
//   if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
//   if (b.age !== null && b.age !== '' && b.age !== undefined && (isNaN(b.age) || b.age < 0 || b.age > 149))
//     return res.status(400).json({ error: 'Age must be 0–149' });

//   ensureHospitalExists(Number(b.hospital_id), function (hospitalErr) {
//     if (hospitalErr) {
//       if (hospitalErr.status) return res.status(hospitalErr.status).json({ error: hospitalErr.message });
//       return res.status(500).json({ error: hospitalErr.message });
//     }

//     usernameAvailable(b.username, null, function (userErr) {
//       if (userErr) {
//         if (userErr.status) return res.status(userErr.status).json({ error: userErr.message });
//         return res.status(500).json({ error: userErr.message });
//       }

//       db.query('START TRANSACTION', function (txErr) {
//         if (txErr) return res.status(500).json({ error: txErr.message });

//         db.query(
//           'INSERT INTO Patient(hospital_id, name, age, dob, gender, phone, address, blood_group, medical_history) VALUES (?,?,?,?,?,?,?,?,?)',
//           [b.hospital_id, b.name.trim(), b.age || null, b.dob, b.gender, b.phone || null, b.address || null, b.blood_group, b.medical_history || null],
//           function (e1, result) {
//             if (e1) {
//               return db.query('ROLLBACK', function () { res.status(500).json({ error: e1.message }); });
//             }

//             var newPid = result.insertId;
//             db.query('INSERT INTO Users(id, username, password, role) VALUES (?,?,?,?)',
//               [newPid, b.username.trim(), b.password, 'patient'],
//               function (e2) {
//                 if (e2) {
//                   return db.query('ROLLBACK', function () {
//                     if (e2.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already exists' });
//                     res.status(500).json({ error: e2.message });
//                   });
//                 }

//                 db.query('COMMIT', function (commitErr) {
//                   if (commitErr) {
//                     return db.query('ROLLBACK', function () { res.status(500).json({ error: commitErr.message }); });
//                   }
//                   res.json({ message: 'Registration successful', patient_id: newPid, username: b.username.trim() });
//                 });
//               });
//           }
//         );
//       });
//     });
//   });
// });

app.post('/register', function (req, res) {
  const b = req.body;

  if (!b.username || !b.password)
    return res.status(400).json({ error: 'Missing username/password' });
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.dob) return res.status(400).json({ error: 'DOB required' });
  if (!b.gender) return res.status(400).json({ error: 'Gender required' });
  if (!b.blood_group) return res.status(400).json({ error: 'Blood group required' });
  if (futureDOB(b.dob)) return res.status(400).json({ error: 'DOB cannot be in the future' });
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  if (b.age !== null && b.age !== '' && b.age !== undefined && (isNaN(b.age) || b.age < 0 || b.age > 149))
    return res.status(400).json({ error: 'Age must be 0-149' });

  usernameAvailable(b.username, null, function (userErr) {
    if (userErr) {
      if (userErr.status) return res.status(userErr.status).json({ error: userErr.message });
      return res.status(500).json({ error: userErr.message });
    }

    db.query('SELECT hospital_id FROM HOSPITAL ORDER BY hospital_id LIMIT 1', function (hospitalErr, hospitalRows) {
      if (hospitalErr) return res.status(500).json({ error: hospitalErr.message });
      if (!hospitalRows || !hospitalRows.length) return res.status(500).json({ error: 'No hospital configured for registration' });

      var defaultHospitalId = hospitalRows[0].hospital_id;
      getNextId('Patient', 'patient_id', function (err, newId) {
        if (err) return res.status(500).json({ error: err.message });

        db.query(
          `INSERT INTO Patient 
          (patient_id, hospital_id, name, age, dob, gender, phone, address, blood_group, medical_history)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId, defaultHospitalId, b.name.trim(), b.age || null, b.dob, b.gender, b.phone || null, b.address || null, b.blood_group, b.medical_history || null],
          function (insertErr) {
            if (insertErr) return res.status(500).json({ error: insertErr.message });

            db.query(
              `INSERT INTO Users(id, username, password, role)
               VALUES (?, ?, ?, 'patient')`,
              [newId, b.username, b.password],
              function (err2) {
                if (err2) {
                  db.query('DELETE FROM Patient WHERE patient_id=?', [newId]);
                  if (err2.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already exists' });
                  return res.status(500).json({ error: err2.message });
                }

                res.json({ message: 'Patient registered', patient_id: newId, id: newId });
              }
            );
          }
        );
      });
    });
  });
});

// TREATMENTS
app.get('/treatments', function (req, res) {
  var sql = `SELECT t.*, p.name patient_name, d.name doctor_name
    FROM Treatment t
    JOIN Appointment a ON t.appointment_id = a.appointment_id
    JOIN Patient p ON a.patient_id = p.patient_id
    JOIN Doctor  d ON a.doctor_id  = d.doctor_id
    `;
  var args = [];
  if (req.user.role === 'doctor') { sql += ' WHERE a.doctor_id=?'; args.push(req.user.id); }
  if (req.user.role === 'patient') { sql += ' WHERE a.patient_id=?'; args.push(req.user.id); }
  sql += ' ORDER BY t.treatment_id';
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/treatments', function (req, res) {
  var b = req.body;
  if (!b.appointment_id) return res.status(400).json({ error: 'Appointment ID required' });
  if (!b.diagnosis || !b.diagnosis.trim()) return res.status(400).json({ error: 'Diagnosis required' });
  if (!b.treatment_date) return res.status(400).json({ error: 'Treatment date required' });

  if (req.user.role === 'doctor') {
    db.query('SELECT 1 FROM Appointment WHERE appointment_id=? AND doctor_id=?', [b.appointment_id, req.user.id], function (e, r) {
      if (e) return res.status(500).json({ error: e.message });
      if (!r || !r.length) return forbidden(res, 'Doctor can only add treatments for own appointments');
      nextId('Treatment', 'treatment_id', function (idErr, newId) {
        if (idErr) return res.status(500).json({ error: idErr.message });
        db.query('INSERT INTO Treatment VALUES (?,?,?,?,?,?)',
          [newId, b.diagnosis.trim(), b.treatment_description || null, b.prescription || null, b.treatment_date, b.appointment_id],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            db.query("UPDATE Appointment SET status='Completed' WHERE appointment_id=?", [b.appointment_id], function(ue) {
              res.json({ message: 'Treatment added!', treatment_id: newId });
            });
          });
      });
    });
    return;
  }

  nextId('Treatment', 'treatment_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO Treatment VALUES (?,?,?,?,?,?)',
      [newId, b.diagnosis.trim(), b.treatment_description || null, b.prescription || null, b.treatment_date, b.appointment_id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.query("UPDATE Appointment SET status='Completed' WHERE appointment_id=?", [b.appointment_id], function(ue) {
          res.json({ message: 'Treatment added!', treatment_id: newId });
        });
      });
  });
});

app.put('/treatments/:id', function (req, res) {
  var b = req.body;
  if (!b.diagnosis || !b.diagnosis.trim()) return res.status(400).json({ error: 'Diagnosis required' });

  db.query('UPDATE Treatment SET diagnosis=?, treatment_description=?, prescription=?, treatment_date=? WHERE treatment_id=?',
    [b.diagnosis.trim(), b.treatment_description || null, b.prescription || null, b.treatment_date, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Treatment updated!' });
    });
});

app.delete('/treatments/:id', function (req, res) {
  db.query('DELETE FROM Treatment WHERE treatment_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Treatment deleted!' });
  });
});


// BILLS
app.get('/bills', function (req, res) {
  var sql = `SELECT b.*, p.name patient_name
    FROM Bill b JOIN Patient p ON b.patient_id = p.patient_id
    `;
  var args = [];
  if (req.user.role === 'patient') { sql += ' WHERE b.patient_id=?'; args.push(req.user.id); }
  sql += ' ORDER BY b.bill_date DESC';
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/bills', function (req, res) {
  var b = req.body;
  if (!b.patient_id) return res.status(400).json({ error: 'Patient ID required' });
  if (!b.total_amount || isNaN(b.total_amount) || b.total_amount < 0)
    return res.status(400).json({ error: 'Valid amount required' });
  if (!b.payment_status) return res.status(400).json({ error: 'Payment status required' });
  if (!b.payment_mode) return res.status(400).json({ error: 'Payment mode required' });
  if (!b.bill_date) return res.status(400).json({ error: 'Bill date required' });

  nextId('Bill', 'bill_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO Bill VALUES (?,?,?,?,?,?,?)',
      [newId, b.total_amount, b.payment_status, b.payment_mode, b.bill_date, b.patient_id, b.treatment_id || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Bill created!', bill_id: newId });
      });
  });
});

app.put('/bills/:id', function (req, res) {
  var b = req.body;
  if (isNaN(b.total_amount) || b.total_amount < 0)
    return res.status(400).json({ error: 'Valid amount required' });
  if (!b.payment_status) return res.status(400).json({ error: 'Payment status required' });
  if (!b.payment_mode) return res.status(400).json({ error: 'Payment mode required' });

  db.query('UPDATE Bill SET payment_status=?, payment_mode=?, total_amount=? WHERE bill_id=?',
    [b.payment_status, b.payment_mode, b.total_amount, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Bill updated! Trigger auto-set date if marked Paid.' });
    });
});

app.delete('/bills/:id', function (req, res) {
  db.query('DELETE FROM Bill WHERE bill_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Bill deleted!' });
  });
});


// ROOMS
app.get('/rooms', function (req, res) {
  db.query('SELECT * FROM Room ORDER BY room_number', function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/rooms', function (req, res) {
  var b = req.body;
  if (!b.room_number || !b.room_number.trim()) return res.status(400).json({ error: 'Room number required' });
  if (!b.room_type) return res.status(400).json({ error: 'Room type required' });
  if (!b.status) return res.status(400).json({ error: 'Status required' });
  if (!b.hospital_id) return res.status(400).json({ error: 'Hospital ID required' });
  if (b.floor !== null && b.floor !== '' && (isNaN(b.floor) || b.floor < 0)) return res.status(400).json({ error: 'Floor must be >= 0' });
  if (b.daily_charge !== null && b.daily_charge !== '' && (isNaN(b.daily_charge) || b.daily_charge < 0)) return res.status(400).json({ error: 'Daily charge must be >= 0' });

  nextId('Room', 'room_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO Room VALUES (?,?,?,?,?,?,?)',
      [newId, b.room_number.trim(), b.room_type, b.floor || 0, b.status, b.daily_charge || 0, b.hospital_id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Room added!', room_id: newId });
      });
  });
});

app.put('/rooms/:id', function (req, res) {
  var b = req.body;
  if (!b.status) return res.status(400).json({ error: 'Status required' });

  if (req.user.role === 'patient') {
    if (b.status !== 'Occupied') return forbidden(res, 'Patients can only book rooms (mark Occupied)');
    db.query("UPDATE Room SET status='Occupied' WHERE room_id=? AND status='Available'", [req.params.id], function (err, out) {
      if (err) return res.status(500).json({ error: err.message });
      if (!out.affectedRows) return res.status(400).json({ error: 'Room is not available' });
      res.json({ message: 'Room booked successfully!' });
    });
    return;
  }

  // If only status is passed (from dropdown), do a simple status update
  if (Object.keys(b).length === 1) {
    db.query('UPDATE Room SET status=? WHERE room_id=?', [b.status, req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Room status updated!' });
    });
  } else {
    db.query('UPDATE Room SET room_number=?, room_type=?, floor=?, status=?, daily_charge=? WHERE room_id=?',
      [b.room_number, b.room_type, b.floor, b.status, b.daily_charge, req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Room updated!' });
      });
  }
});

app.delete('/rooms/:id', function (req, res) {
  db.query('DELETE FROM Room WHERE room_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Room deleted!' });
  });
});


// ADMISSIONS
app.get('/admissions', function (req, res) {
  var sql = `SELECT ad.*, p.name patient_name, d.name doctor_name, r.room_number
    FROM Admission ad
    JOIN Patient p ON ad.patient_id = p.patient_id
    JOIN Doctor  d ON ad.doctor_id  = d.doctor_id
    JOIN Room    r ON ad.room_id    = r.room_id
    `;
  var args = [];
  if (req.user.role === 'doctor') { sql += ' WHERE ad.doctor_id=?'; args.push(req.user.id); }
  if (req.user.role === 'patient') { sql += ' WHERE ad.patient_id=?'; args.push(req.user.id); }
  sql += ' ORDER BY ad.admission_date DESC';
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/admissions', function (req, res) {
  var b = req.body;
  if (!b.patient_id) return res.status(400).json({ error: 'Patient ID required' });
  if (!b.room_id) return res.status(400).json({ error: 'Room ID required' });
  if (!b.doctor_id) return res.status(400).json({ error: 'Doctor ID required' });
  if (!b.admission_date) return res.status(400).json({ error: 'Admission date required' });
  if (!b.reason || !b.reason.trim()) return res.status(400).json({ error: 'Reason required' });

  if (req.user.role === 'patient') b.patient_id = req.user.id;

  nextId('Admission', 'admission_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO Admission VALUES (?,?,?,?,?,?,?)',
      [newId, b.admission_date, b.discharge_date || null, b.reason.trim(), b.patient_id, b.room_id, b.doctor_id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Admission recorded!', admission_id: newId });
      });
  });
});

app.put('/admissions/:id', function (req, res) {
  var b = req.body;
  db.query('UPDATE Admission SET discharge_date=?, reason=? WHERE admission_id=?',
    [b.discharge_date || null, b.reason, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Admission updated!' });
    });
});

app.delete('/admissions/:id', function (req, res) {
  db.query('DELETE FROM Admission WHERE admission_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Admission deleted!' });
  });
});


// PHARMACY
app.get('/pharmacy', function (req, res) {
  db.query('SELECT * FROM Pharmacy ORDER BY name', function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/medicine-options', function (req, res) {
  db.query('SELECT medication_id, name, unit, stock_quantity, category FROM Pharmacy ORDER BY name', function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/pharmacy', function (req, res) {
  var b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.category) return res.status(400).json({ error: 'Category required' });
  if (!b.unit) return res.status(400).json({ error: 'Unit required' });
  if (!oneOf(b.name, MEDICINE_NAMES)) return res.status(400).json({ error: 'Invalid medicine name' });
  if (!oneOf(b.category, PHARMACY_CATEGORIES)) return res.status(400).json({ error: 'Invalid category' });
  if (!oneOf(b.unit, PHARMACY_UNITS)) return res.status(400).json({ error: 'Invalid unit' });
  if (isNaN(b.stock_quantity) || b.stock_quantity < 0) return res.status(400).json({ error: 'Stock must be 0 or more' });
  if (isNaN(b.price_per_unit) || b.price_per_unit < 0) return res.status(400).json({ error: 'Price must be 0 or more' });

  nextId('Pharmacy', 'medication_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO Pharmacy VALUES (?,?,?,?,?,?,?)',
      [newId, b.name.trim(), b.category, b.unit, b.stock_quantity, b.price_per_unit, b.expiry_date || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Medicine added!', medication_id: newId });
      });
  });
});

app.put('/pharmacy/:id', function (req, res) {
  var b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!oneOf(b.name, MEDICINE_NAMES)) return res.status(400).json({ error: 'Invalid medicine name' });
  if (!oneOf(b.category, PHARMACY_CATEGORIES)) return res.status(400).json({ error: 'Invalid category' });
  if (!oneOf(b.unit, PHARMACY_UNITS)) return res.status(400).json({ error: 'Invalid unit' });
  if (isNaN(b.stock_quantity) || b.stock_quantity < 0) return res.status(400).json({ error: 'Stock must be 0 or more' });
  if (isNaN(b.price_per_unit) || b.price_per_unit < 0) return res.status(400).json({ error: 'Price must be 0 or more' });

  db.query('UPDATE Pharmacy SET name=?, category=?, unit=?, stock_quantity=?, price_per_unit=?, expiry_date=? WHERE medication_id=?',
    [b.name.trim(), b.category, b.unit, b.stock_quantity, b.price_per_unit, b.expiry_date || null, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Medicine updated!' });
    });
});

app.delete('/pharmacy/:id', function (req, res) {
  db.query('DELETE FROM Pharmacy WHERE medication_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Medicine deleted!' });
  });
});


// TEST REPORTS
app.get('/reports', function (req, res) {
  var sql = `SELECT tr.*, p.name patient_name
    FROM Test_Report tr
    JOIN Treatment t ON tr.treatment_id = t.treatment_id
    JOIN Appointment a ON t.appointment_id = a.appointment_id
    JOIN Patient p ON a.patient_id = p.patient_id
    `;
  var args = [];
  if (req.user.role === 'doctor') { sql += ' WHERE a.doctor_id=?'; args.push(req.user.id); }
  if (req.user.role === 'patient') { sql += ' WHERE a.patient_id=?'; args.push(req.user.id); }
  sql += ' ORDER BY tr.report_date DESC';
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/reports', function (req, res) {
  var b = req.body;
  if (!b.test_name) return res.status(400).json({ error: 'Test name required' });
  if (!b.treatment_id) return res.status(400).json({ error: 'Treatment ID required' });
  if (!b.report_date) return res.status(400).json({ error: 'Report date required' });

  nextId('Test_Report', 'report_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO Test_Report VALUES (?,?,?,?,?)',
      [newId, b.test_name, b.result || null, b.report_date, b.treatment_id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Test report added!', report_id: newId });
      });
  });
});

app.put('/reports/:id', function (req, res) {
  var b = req.body;
  db.query('UPDATE Test_Report SET result=?, report_date=? WHERE report_id=?',
    [b.result || null, b.report_date, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Report updated!' });
    });
});

app.delete('/reports/:id', function (req, res) {
  db.query('DELETE FROM Test_Report WHERE report_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Report deleted!' });
  });
});


// INSURANCE
app.get('/insurance', function (req, res) {
  var sql = `SELECT i.*, p.name patient_name FROM Insurance i
    JOIN Patient p ON i.patient_id = p.patient_id`;
  var args = [];
  if (req.user.role === 'patient') { sql += ' WHERE i.patient_id=?'; args.push(req.user.id); }
  sql += ' ORDER BY i.insurance_id';
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/insurance', function (req, res) {
  var b = req.body;
  if (!b.provider_name) return res.status(400).json({ error: 'Provider name required' });
  if (!b.policy_number) return res.status(400).json({ error: 'Policy number required' });
  if (!b.coverage_amount || isNaN(b.coverage_amount) || b.coverage_amount <= 0)
    return res.status(400).json({ error: 'Coverage must be positive' });
  if (!b.expiry_date) return res.status(400).json({ error: 'Expiry date required' });
  if (!b.patient_id) return res.status(400).json({ error: 'Patient ID required' });

  nextId('Insurance', 'insurance_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO Insurance VALUES (?,?,?,?,?,?)',
      [newId, b.provider_name, b.policy_number, b.coverage_amount, b.expiry_date, b.patient_id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Insurance added!', insurance_id: newId });
      });
  });
});

app.put('/insurance/:id', function (req, res) {
  var b = req.body;
  db.query('UPDATE Insurance SET provider_name=?, coverage_amount=?, expiry_date=? WHERE insurance_id=?',
    [b.provider_name, b.coverage_amount, b.expiry_date, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Insurance updated!' });
    });
});

app.delete('/insurance/:id', function (req, res) {
  db.query('DELETE FROM Insurance WHERE insurance_id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Insurance deleted!' });
  });
});


// EMERGENCY CONTACTS
app.get('/emergency-contacts', function (req, res) {
  var sql = `SELECT ec.*, p.name patient_name FROM Emergency_Contact ec
    JOIN Patient p ON ec.patient_id = p.patient_id`;
  var args = [];
  if (req.user.role === 'patient') { sql += ' WHERE ec.patient_id=?'; args.push(req.user.id); }
  if (req.user.role === 'doctor') { sql += ' JOIN Appointment a ON a.patient_id = p.patient_id WHERE a.doctor_id=?'; args.push(req.user.id); }
  sql += ' ORDER BY ec.contact_id';
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/emergency-contacts', function (req, res) {
  var b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Name required' });
  if (!b.relationship) return res.status(400).json({ error: 'Relationship required' });
  if (!b.phone) return res.status(400).json({ error: 'Phone required' });
  if (!b.patient_id) return res.status(400).json({ error: 'Patient ID required' });
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });

  if (req.user.role === 'patient') b.patient_id = req.user.id;

  nextId('Emergency_Contact', 'contact_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO Emergency_Contact VALUES (?,?,?,?,?)',
      [newId, b.name.trim(), b.relationship, b.phone, b.patient_id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Emergency contact added!', contact_id: newId });
      });
  });
});

app.put('/emergency-contacts/:id', function (req, res) {
  var b = req.body;
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  var sql = 'UPDATE Emergency_Contact SET name=?, relationship=?, phone=? WHERE contact_id=?';
  var args = [b.name, b.relationship, b.phone, req.params.id];
  if (req.user.role === 'patient') { sql += ' AND patient_id=?'; args.push(req.user.id); }
  db.query(sql,
    args,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Contact updated!' });
    });
});

app.delete('/emergency-contacts/:id', function (req, res) {
  var sql = 'DELETE FROM Emergency_Contact WHERE contact_id=?';
  var args = [req.params.id];
  if (req.user.role === 'patient') { sql += ' AND patient_id=?'; args.push(req.user.id); }
  db.query(sql, args, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Contact deleted!' });
  });
});


// FEEDBACK
app.get('/feedback', function (req, res) {
  var sql = `SELECT f.*, p.name patient_name, d.name doctor_name
    FROM Feedback f
    JOIN Patient p ON f.patient_id = p.patient_id
    LEFT JOIN Doctor d ON f.doctor_id = d.doctor_id
    `;
  var args = [];
  if (req.user.role === 'patient') { sql += ' WHERE f.patient_id=?'; args.push(req.user.id); }
  if (req.user.role === 'doctor') { sql += ' WHERE f.doctor_id=?'; args.push(req.user.id); }
  sql += ' ORDER BY f.feedback_date DESC';
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/feedback', function (req, res) {
  var b = req.body;
  if (!b.patient_id) return res.status(400).json({ error: 'Patient ID required' });
  if (!b.feedback_date) return res.status(400).json({ error: 'Date required' });
  if (b.rating === '' || b.rating === null || b.rating === undefined)
    return res.status(400).json({ error: 'Rating required' });
  if (isNaN(b.rating) || b.rating < 0 || b.rating > 10)
    return res.status(400).json({ error: 'Rating must be 0–10' });

  if (req.user.role === 'patient') b.patient_id = req.user.id;

  nextId('Feedback', 'feedback_id', function (idErr, newId) {
    if (idErr) return res.status(500).json({ error: idErr.message });
    db.query('INSERT INTO Feedback VALUES (?,?,?,?,?,?,?)',
      [newId, b.rating, b.comments || null, b.feedback_date, b.patient_id, b.doctor_id || null, b.hospital_id || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Feedback submitted!', feedback_id: newId });
      });
  });
});

app.put('/feedback/:id', function (req, res) {
  var b = req.body;
  if (isNaN(b.rating) || b.rating < 0 || b.rating > 10)
    return res.status(400).json({ error: 'Rating must be 0–10' });
  var sql = 'UPDATE Feedback SET rating=?, comments=? WHERE feedback_id=?';
  var args = [b.rating, b.comments || null, req.params.id];
  if (req.user.role === 'patient') { sql += ' AND patient_id=?'; args.push(req.user.id); }
  db.query(sql,
    args,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Feedback updated!' });
    });
});

app.delete('/feedback/:id', function (req, res) {
  var sql = 'DELETE FROM Feedback WHERE feedback_id=?';
  var args = [req.params.id];
  if (req.user.role === 'patient') { sql += ' AND patient_id=?'; args.push(req.user.id); }
  db.query(sql, args, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Feedback deleted!' });
  });
});


// PRESCRIPTIONS
app.get('/prescriptions', function (req, res) {
  var sql = `SELECT pd.*, ph.name medicine_name, ph.unit medicine_unit, ph.stock_quantity, t.diagnosis
    FROM Prescription_Detail pd
    JOIN Pharmacy ph ON pd.medicine_id = ph.medication_id
    JOIN Treatment t ON pd.treatment_id = t.treatment_id
    JOIN Appointment a ON t.appointment_id = a.appointment_id
    `;
  var args = [];
  if (req.user.role === 'doctor') { sql += ' WHERE a.doctor_id=?'; args.push(req.user.id); }
  if (req.user.role === 'patient') { sql += ' WHERE a.patient_id=?'; args.push(req.user.id); }
  sql += ' ORDER BY pd.prescription_id';
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/prescriptions/bulk', function (req, res) {
  var b = req.body;
  if (!b.treatment_id) return res.status(400).json({ error: 'Treatment ID required' });
  if (!b.medicines || !Array.isArray(b.medicines) || b.medicines.length === 0) 
    return res.status(400).json({ error: 'List of medicines required' });

  if (req.user.role === 'doctor') {
    db.query('SELECT 1 FROM Treatment t JOIN Appointment a ON t.appointment_id = a.appointment_id WHERE t.treatment_id=? AND a.doctor_id=? LIMIT 1',
      [b.treatment_id, req.user.id], function(ownErr, ownRows) {
        if (ownErr) return res.status(500).json({ error: ownErr.message });
        if (!ownRows || !ownRows.length) return res.status(403).json({ error: 'Doctor can only prescribe for own treatments' });
        processBulk();
      });
  } else {
    processBulk();
  }

  function processBulk() {
    db.query('START TRANSACTION', function (txErr) {
      if (txErr) return res.status(500).json({ error: txErr.message });

      var i = 0;
      function nextMedicine() {
        if (i >= b.medicines.length) {
          return db.query('COMMIT', function (commitErr) {
            if (commitErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: commitErr.message }); });
            res.json({ message: 'Bulk prescription added successfully!' });
          });
        }
        var m = b.medicines[i];
        var qty = Number(m.quantity_prescribed || 0);

        if (!m.medicine_id || !m.dosage || !m.frequency || !m.duration_days || qty <= 0) {
          return db.query('ROLLBACK', function() { res.status(400).json({ error: 'Invalid medicine details in list at index ' + i }); });
        }

        db.query('SELECT stock_quantity FROM Pharmacy WHERE medication_id=? FOR UPDATE', [m.medicine_id], function (medErr, medRows) {
          if (medErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: medErr.message }); });
          if (!medRows || !medRows.length) return db.query('ROLLBACK', function () { res.status(404).json({ error: 'Medicine not found at index ' + i }); });
          if (Number(medRows[0].stock_quantity) < qty) {
            return db.query('ROLLBACK', function () { res.status(400).json({ error: 'Not enough stock for medicine at index ' + i }); });
          }

          nextId('Prescription_Detail', 'prescription_id', function (idErr, newId) {
            if (idErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: idErr.message }); });
            db.query('INSERT INTO Prescription_Detail (prescription_id, treatment_id, medicine_id, dosage, frequency, duration_days, quantity_prescribed) VALUES (?,?,?,?,?,?,?)',
              [newId, b.treatment_id, m.medicine_id, m.dosage.trim(), m.frequency, m.duration_days, qty],
              function (insertErr) {
                if (insertErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: insertErr.message }); });
                db.query('UPDATE Pharmacy SET stock_quantity = stock_quantity - ? WHERE medication_id=?', [qty, m.medicine_id], function (stockErr) {
                  if (stockErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: stockErr.message }); });
                  i++;
                  nextMedicine();
                });
              });
          });
        });
      }
      nextMedicine();
    });
  }
});

app.post('/prescriptions', function (req, res) {
  var b = req.body;
  if (!b.treatment_id) return res.status(400).json({ error: 'Treatment ID required' });
  if (!b.medicine_id) return res.status(400).json({ error: 'Medicine ID required' });
  if (!b.dosage || !b.dosage.trim()) return res.status(400).json({ error: 'Dosage required' });
  if (!b.frequency || !oneOf(b.frequency, PRESCRIPTION_FREQUENCIES)) return res.status(400).json({ error: 'Frequency required' });
  if (!b.duration_days || isNaN(b.duration_days) || b.duration_days <= 0)
    return res.status(400).json({ error: 'Duration must be positive' });
  var qty = Number(b.quantity_prescribed || 0);
  if (!qty || isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be positive' });

  function createPrescription() {
    db.query('START TRANSACTION', function (txErr) {
      if (txErr) return res.status(500).json({ error: txErr.message });

      db.query('SELECT medication_id, stock_quantity FROM Pharmacy WHERE medication_id=? FOR UPDATE', [b.medicine_id], function (medErr, medRows) {
        if (medErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: medErr.message }); });
        if (!medRows || !medRows.length) return db.query('ROLLBACK', function () { res.status(404).json({ error: 'Medicine not found' }); });
        if (Number(medRows[0].stock_quantity) < qty) {
          return db.query('ROLLBACK', function () { res.status(400).json({ error: 'Not enough stock for this prescription' }); });
        }

        nextId('Prescription_Detail', 'prescription_id', function (idErr, newId) {
          if (idErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: idErr.message }); });
          db.query('INSERT INTO Prescription_Detail (prescription_id, treatment_id, medicine_id, dosage, frequency, duration_days, quantity_prescribed) VALUES (?,?,?,?,?,?,?)',
            [newId, b.treatment_id, b.medicine_id, b.dosage.trim(), b.frequency, b.duration_days, qty],
            function (insertErr) {
              if (insertErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: insertErr.message }); });
              db.query('UPDATE Pharmacy SET stock_quantity = stock_quantity - ? WHERE medication_id=?', [qty, b.medicine_id], function (stockErr) {
                if (stockErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: stockErr.message }); });
                db.query('COMMIT', function (commitErr) {
                  if (commitErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: commitErr.message }); });
                  res.json({ message: 'Prescription added and stock updated!', prescription_id: newId });
                });
              });
            });
        });
      });
    });
  }

  if (req.user.role === 'doctor') {
    db.query('SELECT 1 FROM Treatment t JOIN Appointment a ON t.appointment_id = a.appointment_id WHERE t.treatment_id=? AND a.doctor_id=? LIMIT 1',
      [b.treatment_id, req.user.id],
      function (ownErr, ownRows) {
        if (ownErr) return res.status(500).json({ error: ownErr.message });
        if (!ownRows || !ownRows.length) return forbidden(res, 'Doctor can only prescribe for own treatments');
        createPrescription();
      });
    return;
  }

  createPrescription();
});

app.put('/prescriptions/:id', function (req, res) {
  var b = req.body;
  if (!b.dosage || !b.dosage.trim()) return res.status(400).json({ error: 'Dosage required' });
  if (!b.frequency || !oneOf(b.frequency, PRESCRIPTION_FREQUENCIES)) return res.status(400).json({ error: 'Frequency required' });
  if (!b.duration_days || isNaN(b.duration_days) || b.duration_days <= 0)
    return res.status(400).json({ error: 'Duration must be positive' });
  var newQty = Number(b.quantity_prescribed || 0);
  if (!newQty || isNaN(newQty) || newQty <= 0) return res.status(400).json({ error: 'Quantity must be positive' });

  db.query('START TRANSACTION', function (txErr) {
    if (txErr) return res.status(500).json({ error: txErr.message });
    db.query('SELECT * FROM Prescription_Detail WHERE prescription_id=? FOR UPDATE', [req.params.id], function (findErr, rows) {
      if (findErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: findErr.message }); });
      if (!rows || !rows.length) return db.query('ROLLBACK', function () { res.status(404).json({ error: 'Prescription not found' }); });

      var oldRx = rows[0];
      var nextMedicineId = b.medicine_id || oldRx.medicine_id;

      db.query('UPDATE Pharmacy SET stock_quantity = stock_quantity + ? WHERE medication_id=?',
        [oldRx.quantity_prescribed || 1, oldRx.medicine_id],
        function (restoreErr) {
          if (restoreErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: restoreErr.message }); });
          db.query('SELECT stock_quantity FROM Pharmacy WHERE medication_id=? FOR UPDATE', [nextMedicineId], function (stockErr, stockRows) {
            if (stockErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: stockErr.message }); });
            if (!stockRows || !stockRows.length) return db.query('ROLLBACK', function () { res.status(404).json({ error: 'Medicine not found' }); });
            if (Number(stockRows[0].stock_quantity) < newQty) {
              return db.query('ROLLBACK', function () { res.status(400).json({ error: 'Not enough stock for updated prescription' }); });
            }

            db.query('UPDATE Prescription_Detail SET medicine_id=?, dosage=?, frequency=?, duration_days=?, quantity_prescribed=? WHERE prescription_id=?',
              [nextMedicineId, b.dosage.trim(), b.frequency, b.duration_days, newQty, req.params.id],
              function (updateErr) {
                if (updateErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: updateErr.message }); });
                db.query('UPDATE Pharmacy SET stock_quantity = stock_quantity - ? WHERE medication_id=?', [newQty, nextMedicineId], function (deductErr) {
                  if (deductErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: deductErr.message }); });
                  db.query('COMMIT', function (commitErr) {
                    if (commitErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: commitErr.message }); });
                    res.json({ message: 'Prescription updated and stock synced!' });
                  });
                });
              });
          });
        });
    });
  });
});

app.delete('/prescriptions/:id', function (req, res) {
  db.query('START TRANSACTION', function (txErr) {
    if (txErr) return res.status(500).json({ error: txErr.message });
    db.query('SELECT * FROM Prescription_Detail WHERE prescription_id=? FOR UPDATE', [req.params.id], function (findErr, rows) {
      if (findErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: findErr.message }); });
      if (!rows || !rows.length) return db.query('ROLLBACK', function () { res.status(404).json({ error: 'Prescription not found' }); });

      var rx = rows[0];
      db.query('DELETE FROM Prescription_Detail WHERE prescription_id=?', [req.params.id], function (deleteErr) {
        if (deleteErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: deleteErr.message }); });
        db.query('UPDATE Pharmacy SET stock_quantity = stock_quantity + ? WHERE medication_id=?',
          [rx.quantity_prescribed || 1, rx.medicine_id],
          function (restoreErr) {
            if (restoreErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: restoreErr.message }); });
            db.query('COMMIT', function (commitErr) {
              if (commitErr) return db.query('ROLLBACK', function () { res.status(500).json({ error: commitErr.message }); });
              res.json({ message: 'Prescription deleted and stock restored!' });
            });
          });
      });
    });
  });
});


// NURSE-TREATMENT
app.get('/nurse-treatments', function (req, res) {
  var sql = `SELECT nt.*, n.name nurse_name, t.diagnosis
    FROM Nurse_Treatment nt
    JOIN Nurse n ON nt.nurse_id = n.nurse_id
    JOIN Treatment t ON nt.treatment_id = t.treatment_id
    JOIN Appointment a ON t.appointment_id = a.appointment_id
    `;
  var args = [];
  if (req.user.role === 'patient') { sql += ' WHERE a.patient_id=?'; args.push(req.user.id); }
  if (req.user.role === 'doctor') { sql += ' WHERE a.doctor_id=?'; args.push(req.user.id); }
  if (req.user.role === 'staff') {
    sql += ' JOIN STAFF s ON s.hospital_id = n.hospital_id WHERE s.staff_id=?';
    args.push(req.user.id);
  }
  sql += ' ORDER BY nt.nurse_id';
  db.query(sql, args, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/nurse-treatments', function (req, res) {
  var b = req.body;
  if (!b.nurse_id) return res.status(400).json({ error: 'Nurse ID required' });
  if (!b.treatment_id) return res.status(400).json({ error: 'Treatment ID required' });

  db.query('INSERT INTO Nurse_Treatment VALUES (?,?)', [b.nurse_id, b.treatment_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Nurse assigned to treatment!' });
  });
});

app.delete('/nurse-treatments/:nid/:tid', function (req, res) {
  db.query('DELETE FROM Nurse_Treatment WHERE nurse_id=? AND treatment_id=?',
    [req.params.nid, req.params.tid],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Assignment removed!' });
    });
});


// ========== NEW ENDPOINTS FOR USER FLOW ==========

// PATIENT PROFILE - Get full profile with Aadhar and documents
app.get('/patient-profile', function (req, res) {
  if (req.user.role !== 'patient') return forbidden(res);
  db.query('SELECT * FROM Patient WHERE patient_id=?', [req.user.id], function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows || !rows.length) return res.status(404).json({ error: 'Patient not found' });
    res.json(rows[0]);
  });
});

// PATIENT PROFILE - Update patient profile with Aadhar and documents
app.put('/patient-profile', function (req, res) {
  if (req.user.role !== 'patient') return forbidden(res);
  var b = req.body;
  if (badPhone(b.phone)) return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  if (badEmail(b.email)) return res.status(400).json({ error: 'Invalid email format' });

  db.query('UPDATE Patient SET name=?, email=?, phone=?, address=?, aadhar_number=?, aadhar_doc_url=?, license_doc_url=?, gender=?, blood_group=?, medical_history=? WHERE patient_id=?',
    [b.name || null, b.email || null, b.phone || null, b.address || null, b.aadhar_number || null, 
     b.aadhar_doc_url || null, b.license_doc_url || null, b.gender || null, b.blood_group || null, 
     b.medical_history || null, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Patient profile updated!' });
    });
});

// PATIENT DASHBOARD - Get departments with doctor count and senior doctor details
app.get('/patient-dashboard', function (req, res) {
  if (req.user.role !== 'patient') return forbidden(res);
  
  db.query(`SELECT DISTINCT d.specialization, COUNT(*) dept_doctors, 
            GROUP_CONCAT(d.name ORDER BY d.experience_years DESC LIMIT 1) senior_doctor_name,
            MAX(d.experience_years) senior_doctor_exp
            FROM Doctor d
            GROUP BY d.specialization
            ORDER BY d.specialization`, function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// DOCTOR PENDING APPOINTMENTS - Get pending appointments for logged-in doctor
app.get('/doctor/pending-appointments', function (req, res) {
  if (req.user.role !== 'doctor') return forbidden(res);
  
  db.query(`SELECT a.*, p.name patient_name, p.phone patient_phone, p.age patient_age, p.gender patient_gender
    FROM Appointment a
    JOIN Patient p ON a.patient_id = p.patient_id
    WHERE a.doctor_id=? AND a.status='Pending'
    ORDER BY a.appointment_date ASC`, [req.user.id], function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// PHARMACY PURCHASE - Patient buys prescribed medicine (reduces stock)
app.post('/pharmacy-purchase', function (req, res) {
  if (req.user.role !== 'patient') return forbidden(res);
  
  var b = req.body;
  if (!b.medication_id) return res.status(400).json({ error: 'Medicine ID required' });
  if (!b.quantity || isNaN(b.quantity) || b.quantity <= 0) 
    return res.status(400).json({ error: 'Valid quantity required' });
  if (!b.prescription_id) return res.status(400).json({ error: 'Prescription ID required' });

  // Verify patient has this prescription and appointment is completed
  db.query(`SELECT pd.*, ph.stock_quantity, ph.price_per_unit, ph.name medicine_name,
            t.treatment_id, a.patient_id
    FROM Prescription_Detail pd
    JOIN Pharmacy ph ON pd.medicine_id = ph.medication_id
    JOIN Treatment t ON pd.treatment_id = t.treatment_id
    JOIN Appointment a ON t.appointment_id = a.appointment_id
    WHERE pd.prescription_id=? AND pd.medicine_id=? AND a.patient_id=? AND a.status='Completed'`, 
    [b.prescription_id, b.medication_id, req.user.id], 
    function (err, rows) {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || !rows.length) return res.status(403).json({ error: 'Prescription not found or appointment not completed' });
      
      var prescription = rows[0];
      if (prescription.stock_quantity < b.quantity) 
        return res.status(400).json({ error: 'Insufficient stock. Available: ' + prescription.stock_quantity });
      
      var totalPrice = b.quantity * prescription.price_per_unit;
      
      // Reduce pharmacy stock
      db.query('UPDATE Pharmacy SET stock_quantity = stock_quantity - ? WHERE medication_id=?',
        [b.quantity, b.medication_id], function (updateErr) {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          res.json({ 
            message: 'Medicine purchased!', 
            medicine_name: prescription.medicine_name,
            quantity: b.quantity,
            price_per_unit: prescription.price_per_unit,
            total_price: totalPrice,
            remaining_stock: prescription.stock_quantity - b.quantity
          });
        });
    });
});

// ADMITTED PATIENTS - Doctor view of admitted patients under this doctor
app.get('/admitted-patients', function (req, res) {
  if (req.user.role !== 'doctor') return forbidden(res);
  
  db.query(`SELECT ad.*, p.name patient_name, p.age patient_age, p.phone patient_phone, r.room_number, r.room_type
    FROM Admission ad
    JOIN Patient p ON ad.patient_id = p.patient_id
    JOIN Room r ON ad.room_id = r.room_id
    WHERE ad.doctor_id=? AND ad.discharge_date IS NULL
    ORDER BY ad.admission_date DESC`, [req.user.id], function (err, rows) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// DOCTOR DISCHARGE PATIENT - Mark patient as discharged
app.post('/discharge-patient/:admission_id', function (req, res) {
  if (req.user.role !== 'doctor') return forbidden(res);
  
  db.query('SELECT doctor_id FROM Admission WHERE admission_id=?', [req.params.admission_id],
    function (err, rows) {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || !rows.length) return res.status(404).json({ error: 'Admission not found' });
      if (rows[0].doctor_id !== req.user.id) 
        return forbidden(res, 'You can only discharge your own admitted patients');
      
      db.query('UPDATE Admission SET discharge_date=CURDATE() WHERE admission_id=?', 
        [req.params.admission_id], function (updateErr) {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          res.json({ message: 'Patient discharged successfully!' });
        });
    });
});


// TRANSACTIONS DEMO
app.post('/transactions-test', function (req, res) {
  var testType = req.body.type || 'simple';
  
  if (testType === 'simple') {
    // Simple transaction - commit
    db.query('START TRANSACTION', function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.query("UPDATE Room SET status='Occupied' WHERE room_id=1", function(err) {
        if (err) {
          db.query('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        db.query('COMMIT', function(err) {
          if (err) return res.status(500).json({ error: err.message });
          db.query('SELECT * FROM Room WHERE room_id=1', function(err, rows) {
            res.json({ message: 'Transaction committed', result: rows ? rows[0] : null });
          });
        });
      });
    });
  } else if (testType === 'rollback') {
    // Transaction with rollback
    db.query('START TRANSACTION', function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.query("UPDATE Room SET status='Under Maintenance' WHERE room_id=2", function(err) {
        if (err) {
          db.query('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        // Intentional error to trigger rollback
        db.query('ROLLBACK', function(err) {
          if (err) return res.status(500).json({ error: err.message });
          db.query('SELECT * FROM Room WHERE room_id=2', function(err, rows) {
            res.json({ message: 'Transaction rolled back', result: rows ? rows[0] : null });
          });
        });
      });
    });
  }
});


// START
var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('Server running at http://localhost:' + PORT);
});
