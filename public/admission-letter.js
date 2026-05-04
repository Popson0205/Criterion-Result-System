// ============================================================
// admission-letter.js — Admission Letter Generator
// Criterion Amazing College Result Management System
// Called via: openAdmissionLetterWindow(applicantObject)
// ============================================================

function openAdmissionLetterWindow(applicant) {
  const a = applicant;
  const fullName = [a.surname, a.first_name, a.other_name].filter(Boolean).join(' ');
  const admittedDate = a.admittedAt
    ? new Date(a.admittedAt).toLocaleDateString('en-NG', { day:'numeric', month:'long', year:'numeric' })
    : new Date().toLocaleDateString('en-NG', { day:'numeric', month:'long', year:'numeric' });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Admission Letter — ${fullName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; background: #f3f4f6; padding: 30px 20px; color: #111; }

    .letter-page {
      background: white; max-width: 720px; margin: 0 auto;
      padding: 50px 55px; box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      border-top: 8px solid #1a6e3c;
    }
    .letterhead {
      display: flex; align-items: center; justify-content: center; gap: 18px;
      margin-bottom: 8px; border-bottom: 3px solid #f5c518; padding-bottom: 16px;
    }
    .letterhead img { width: 80px; height: 80px; border-radius: 50%; object-fit: contain; border: 3px solid #1a6e3c; }
    .letterhead .logo-ph {
      width: 80px; height: 80px; border-radius: 50%; background: #1a6e3c;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 900; color: white; border: 3px solid #1a6e3c;
    }
    .school-name-hdr h1 { font-family: sans-serif; font-size: 22px; font-weight: 900; color: #1a6e3c; letter-spacing: 1px; text-align: center; }
    .school-name-hdr .phone { font-size: 13px; color: #b8860b; font-weight: 700; margin: 3px 0; text-align: center; }
    .school-name-hdr .motto { font-size: 12px; font-style: italic; color: #6b7280; text-align: center; }

    .letter-title {
      text-align: center; font-family: sans-serif; font-size: 17px; font-weight: 900;
      color: #1a6e3c; letter-spacing: 2px; text-transform: uppercase;
      margin: 22px 0 6px; text-decoration: underline; text-underline-offset: 4px;
    }
    .letter-subtitle { text-align: center; font-size: 13px; color: #6b7280; margin-bottom: 22px; }

    .student-header { display: flex; gap: 20px; margin-bottom: 20px; align-items: flex-start; }
    .student-passport { flex-shrink: 0; }
    .student-passport img { width: 90px; height: 110px; object-fit: cover; border: 2px solid #1a6e3c; border-radius: 4px; }
    .student-passport .pp-ph {
      width: 90px; height: 110px; background: #f3f4f6; border: 2px dashed #d1d5db;
      border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 32px;
    }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 5px 8px; font-size: 13px; border-bottom: 1px dotted #e5e7eb; }
    .info-table td:first-child { font-weight: 700; color: #1a6e3c; width: 38%; font-size: 12px; text-transform: uppercase; }

    .letter-body { font-size: 14px; line-height: 1.8; margin-bottom: 20px; }
    .letter-body p { margin-bottom: 12px; }
    .letter-body strong { color: #1a6e3c; }

    .rules-box { border: 2px solid #1a6e3c; border-radius: 6px; padding: 16px 20px; margin: 20px 0; background: #f0fdf4; }
    .rules-title {
      font-family: sans-serif; font-size: 13px; font-weight: 800; color: #1a6e3c;
      text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;
      border-bottom: 1px solid #bbf7d0; padding-bottom: 6px;
    }
    .rules-list { list-style: none; padding: 0; }
    .rules-list li {
      font-size: 13px; line-height: 1.6; padding: 5px 0 5px 22px;
      position: relative; border-bottom: 1px dotted #d1fae5;
    }
    .rules-list li:last-child { border-bottom: none; }
    .rules-list li::before { content: '✦'; position: absolute; left: 0; color: #f5c518; font-size: 11px; top: 7px; }

    .signature-section { margin-top: 28px; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 20px; }
    .sig-block { text-align: center; }
    .sig-line { border-top: 1px solid #111; width: 180px; margin-bottom: 6px; }
    .sig-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .sig-sub { font-size: 11px; color: #6b7280; }

    .ref-date-row { display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-bottom: 18px; }
    .letter-footer { margin-top: 30px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }

    @media print {
      body { background: white; padding: 0; }
      .letter-page { box-shadow: none; padding: 30px 40px; max-width: 100%; border-top-width: 6px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

<div class="no-print" style="text-align:center;margin-bottom:20px;">
  <button onclick="window.print()" style="background:#1a6e3c;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;font-family:sans-serif;">
    🖨 Print Admission Letter
  </button>
  <button onclick="window.close()" style="background:#f3f4f6;color:#374151;border:1px solid #d1d5db;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;font-family:sans-serif;margin-left:10px;">
    ✕ Close
  </button>
</div>

<div class="letter-page">

  <div class="letterhead">
    <img src="/icons/icon-192x192.png" alt="Criterion Amazing College Logo"
         onerror="this.style.display='none';document.getElementById('lhPh').style.display='flex'" />
    <div class="logo-ph" id="lhPh" style="display:none">CC</div>
    <div class="school-name-hdr">
      <h1>CRITERION AMAZING COLLEGE, OSOGBO</h1>
      <div class="phone">+234 806 322 4872</div>
      <div class="motto">….training global competitive students is our watchword</div>
    </div>
  </div>

  <div class="ref-date-row">
    <span>Ref: <strong>${a.ref_number}</strong></span>
    <span>Date: <strong>${admittedDate}</strong></span>
  </div>

  <div class="letter-title">Letter of Admission</div>
  <div class="letter-subtitle">Academic Session 2026/2027</div>

  <div class="student-header">
    <div class="student-passport">
      ${a.passport
        ? `<img src="${a.passport}" alt="Passport" />`
        : `<div class="pp-ph">👤</div>`}
    </div>
    <div style="flex:1;">
      <table class="info-table">
        <tr><td>Full Name</td><td><strong>${fullName}</strong></td></tr>
        <tr><td>Sex</td><td>${a.sex || '—'}</td></tr>
        <tr><td>Date of Birth</td><td>${a.dob ? new Date(a.dob).toLocaleDateString('en-NG', {day:'numeric',month:'long',year:'numeric'}) : '—'}</td></tr>
        <tr><td>State of Origin</td><td>${a.state_of_origin || '—'}</td></tr>
        <tr><td>Class Admitted</td><td><strong style="color:#1a6e3c;">${a.class_admitted}</strong></td></tr>
        <tr><td>Parent / Guardian</td><td>${a.parent_name || '—'} (${a.parent_relationship || '—'})</td></tr>
        <tr><td>Phone</td><td>${a.phone || '—'}</td></tr>
      </table>
    </div>
  </div>

  <div class="letter-body">
    <p>Dear <strong>${a.parent_name || 'Parent/Guardian'}</strong>,</p>
    <p>
      We are pleased to inform you that your ward, <strong>${fullName}</strong>, has been
      <strong>successfully admitted</strong> into Criterion Amazing College, Osogbo for the
      <strong>2026/2027 Academic Session</strong>, having satisfied the requirements for admission.
    </p>
    <p>
      Your ward has been placed in <strong>${a.class_admitted}</strong>.
      Resumption date and further details will be communicated in due course.
      Please ensure your ward reports to school on the stipulated resumption date with all required items.
    </p>
    ${a.remark ? `<p><strong>Note from the School:</strong> ${a.remark}</p>` : ''}
  </div>

  <div class="rules-box">
    <div class="rules-title">📋 School Rules & Conditions of Admission</div>
    <ul class="rules-list">
      <li><strong>School Fees:</strong> All fees must be paid in full at the beginning of each term before or on resumption day. No student will be allowed to sit for examinations with outstanding fees.</li>
      <li><strong>School Uniform:</strong> Students must wear the approved school uniform at all times on school premises, including school shoes, socks, and ID card every school day.</li>
      <li><strong>Punctuality & Attendance:</strong> Students must be in school by 7:45 AM daily. A minimum of 75% attendance is required per term. Habitual lateness and absenteeism will attract disciplinary action.</li>
      <li><strong>Academic Conduct:</strong> Examination malpractice of any kind is strictly prohibited and will result in immediate suspension or expulsion. All assignments and projects must be submitted on time.</li>
      <li><strong>Discipline & Behaviour:</strong> Fighting, bullying, stealing, use of foul language, and any form of misconduct are strictly forbidden. The school reserves the right to suspend or expel any student found guilty of serious misconduct.</li>
      <li><strong>Mobile Phones & Electronics:</strong> Mobile phones, earphones, and electronic gadgets are not permitted on school premises during school hours. Any device found will be confiscated and returned only to a parent/guardian.</li>
      <li><strong>School Property:</strong> Students must take care of all school property. Willful damage to school property will require the parent to repair or replace the item at their own expense.</li>
      <li><strong>Communication:</strong> All communication between parents and the school must go through official school channels. Parents are encouraged to attend all PTA meetings and school events.</li>
      <li><strong>Documents:</strong> Original birth certificate, previous school report card, and transfer certificate must be submitted to the school office within two weeks of resumption.</li>
      <li><strong>Health:</strong> Parents must notify the school of any known medical condition or allergy. A medical certificate is required for absences exceeding two consecutive days.</li>
      <li><strong>Withdrawal:</strong> A term's written notice must be given before withdrawing a student. Fees paid are non-refundable once the term has commenced.</li>
    </ul>
  </div>

  <div class="letter-body">
    <p>
      By accepting this admission, you confirm that you have read, understood, and agreed to abide by
      all the rules and regulations of Criterion Amazing College, Osogbo. We look forward to a productive and
      successful academic journey with your ward.
    </p>
    <p>Congratulations and welcome to the Criterion Amazing College family!</p>
  </div>

  <div class="signature-section">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Principal's Signature</div>
      <div class="sig-sub">Criterion Amazing College, Osogbo</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Parent / Guardian Signature</div>
      <div class="sig-sub">Name: ___________________________</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Date</div>
      <div class="sig-sub">&nbsp;</div>
    </div>
  </div>

  <div class="letter-footer">
    Criterion Amazing College, Osogbo &nbsp;|&nbsp; +234 806 322 4872 &nbsp;|&nbsp;
    ….training global competitive students is our watchword
  </div>

</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=820,height=900,scrollbars=yes');
  win.document.write(html);
  win.document.close();
}
