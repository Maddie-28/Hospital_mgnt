SELECT * FROM Patient;

SELECT name, specialization FROM Doctor;

SELECT name FROM Patient
WHERE gender = 'Female';

SELECT name FROM Doctor
WHERE experience_years > 15;

SELECT room_number FROM Room
WHERE status = 'Available';

SELECT COUNT(*) AS total_patients
FROM Patient;

SELECT specialization, COUNT(*) 
FROM Doctor
GROUP BY specialization;

SELECT SUM(total_amount) 
FROM Bill;

SELECT MAX(total_amount) 
FROM Bill;

SELECT P.name, B.total_amount
FROM Patient P
JOIN Bill B ON P.patient_id = B.patient_id;

SELECT A.appointment_date, D.name
FROM Appointment A
JOIN Doctor D ON A.doctor_id = D.doctor_id;

SELECT treatment_id, diagnosis
FROM Treatment;

CREATE VIEW ortho_doctor AS (Select name FROM Doctors WHERE specialization = "orthopaedics")

SELECT name FROM Pharmacy
WHERE stock_quantity < 100;

SELECT P.name, I.provider_name
FROM Patient P
JOIN Insurance I ON P.patient_id = I.patient_id;

SELECT room_type, COUNT(*)
FROM Room
GROUP BY room_type;

SELECT doctor_id, AVG(rating)
FROM Feedback
GROUP BY doctor_id;

