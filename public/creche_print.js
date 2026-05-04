// ============================================================
// CRECHE TEMPLATE — rating-based, Times New Roman, full A4
// Classes: Creche 1, Creche 2, Pre-Nursery, Nursery 1, Nursery 2
// ============================================================

const CRECHE_CLASSES = ['Creche 1', 'Creche 2'];

function isCrecheClass(classId) {
  return CRECHE_CLASSES.includes(classId);
}

// Sections and skills per class
const CRECHE_SECTIONS = {
  'Creche 1': {
    sections: [
      {
        title: 'SKILLS AND ABILITIES',
        color: '#00B050',
        skills: ['WRITING', 'READING', 'SPEAKING', 'NUMERACY', 'ARTS', "QUR'AN"]
      },
      {
        title: 'PERSONALITY AND CHARACTER',
        color: '#00B050',
        skills: ['FRIENDLY', 'PUNCTUAL', 'CLEAN AND ORDERLY', 'ATTENTIVE', 'RESPECTFUL']
      }
    ]
  },
  'Creche 2': {
    sections: [
      {
        title: 'SKILLS AND ABILITIES',
        color: '#00B050',
        skills: ['WRITING', 'READING', 'SPEAKING', 'NUMERACY', 'ARTS', "QUR'AN"]
      },
      {
        title: 'PERSONALITY AND CHARACTER',
        color: '#00B050',
        skills: ['FRIENDLY', 'PUNCTUAL', 'CLEAN AND ORDERLY', 'ATTENTIVE', 'RESPECTFUL']
      }
    ]
  },
  'Pre-Nursery': {
    sections: [
      {
        title: 'SKILLS AND ABILITIES',
        color: '#00B050',
        skills: ['MATHEMATICS SKILL', 'WRITING SKILL', 'ENGLISH SKILL', 'CCA', 'SCIENCE', 'ARABIC STUDIES', "QUR'AN", 'RHYMES/POEMS']
      },
      {
        title: 'SOCIAL AND PERSONAL DEVELOPMENT',
        color: '#00B050',
        skills: ['SOCIAL HABITS', 'HEALTH HABITS', 'PUNCTUAL', 'CLEAN AND ORDERLY', 'ATTENTIVE', 'RESPECTFUL']
      }
    ]
  },
  'Nursery 1': {
    sections: [
      {
        title: 'SKILLS AND ABILITIES',
        color: '#00B050',
        skills: ['MATHEMATICS SKILL', 'WRITING SKILL', 'ENGLISH SKILL', 'CCA', 'SCIENCE', 'ARABIC STUDIES', "QUR'AN", 'RHYMES/POEMS']
      },
      {
        title: 'SOCIAL AND PERSONAL DEVELOPMENT',
        color: '#00B050',
        skills: ['SOCIAL HABITS', 'HEALTH HABITS', 'PUNCTUAL', 'CLEAN AND ORDERLY', 'ATTENTIVE', 'RESPECTFUL']
      }
    ]
  },
  'Nursery 2': {
    sections: [
      {
        title: 'SKILLS AND ABILITIES',
        color: '#00B050',
        skills: ['MATHEMATICS SKILL', 'WRITING SKILL', 'ENGLISH SKILL', 'CCA', 'SCIENCE', 'ARABIC STUDIES', "QUR'AN", 'RHYMES/POEMS']
      },
      {
        title: 'SOCIAL AND PERSONAL DEVELOPMENT',
        color: '#00B050',
        skills: ['SOCIAL HABITS', 'HEALTH HABITS', 'PUNCTUAL', 'CLEAN AND ORDERLY', 'ATTENTIVE', 'RESPECTFUL']
      }
    ]
  }
};

const RATING_OPTIONS = ['Outstanding', 'Very Good', 'Good', 'Fair', 'Poor'];

// Score-based grading for Creche: CA(40) + Exam(60) = Total(100)
function getCrecheGrade(total) {
  const t = parseFloat(total) || 0;
  if (t > 70)  return { rating: 'Outstanding', color: '#1a6e3c' };
  if (t >= 60) return { rating: 'Very Good',   color: '#0588f0' };
  if (t >= 40) return { rating: 'Good',         color: '#d97706' };
  return             { rating: 'Fair',          color: '#7c3aed' };
}

// Compute Creche result from CA+Exam scores
function computeCrecheResult(scores, subjects) {
  const rows = subjects.map(sub => {
    const ca   = parseFloat(scores[sub]?.ca)   || 0;
    const exam = parseFloat(scores[sub]?.exam) || 0;
    const total = ca + exam;
    const has = scores[sub]?.ca !== undefined && scores[sub]?.ca !== ''
             && scores[sub]?.exam !== undefined && scores[sub]?.exam !== '';
    const { rating, color } = getCrecheGrade(total);
    return { sub, ca: has ? ca : '', exam: has ? exam : '', total: has ? total : '', rating: has ? rating : '', color: has ? color : '', has };
  });
  return rows;
}

// Auto-comment for Creche (based on overall rating quality)
function getCrecheComment(ratings) {
  const allKeys = Object.keys(ratings || {});
  if (allKeys.length === 0) return '';
  let total = 0, count = 0;
  allKeys.forEach(sub => {
    const ca   = parseFloat(ratings[sub]?.ca)   || 0;
    const exam = parseFloat(ratings[sub]?.exam) || 0;
    if (ratings[sub]?.ca !== '' && ratings[sub]?.ca !== undefined) { total += ca + exam; count++; }
  });
  const avg = count > 0 ? total / count : 0;

  if (avg > 70) return "This child has shown a truly outstanding level of development this term, demonstrating exceptional ability across all areas. It is a joy to see such enthusiasm, focus, and growth. We are very proud and look forward to continued excellence.";
  if (avg >= 60) return "A very impressive term for this child. Strong performance across skills and character development reflects a child who is engaged, eager to learn, and growing beautifully. We encourage this wonderful progress to continue.";
  if (avg >= 40) return "This child has had a good term, showing solid development across most areas. The growth in both skills and personal character is encouraging. With continued support and engagement, we expect even greater strides ahead.";
  if (avg >= 20) return "A fair performance this term. This child is developing steadily and showing a willingness to engage. With more encouragement and practice at home, we are confident that improvement will follow in the next term.";
  return "We have noted this child's effort this term and want to encourage continued growth. Every child develops at their own pace, and we are fully committed to providing the support and care needed. We look forward to a stronger term ahead.";
}

// ── CRECHE PRINT HTML ──────────────────────────────────────────
function buildCrecheResultHTML(student, result) {
  const settings   = DB.getSettings();
  const classDef   = CRECHE_SECTIONS[student.classId] || CRECHE_SECTIONS['Creche 1'];
  const ratings    = result.scores || {};
  const comment    = (result.principalComment && result.principalComment.trim())
                      ? result.principalComment
                      : getCrecheComment(ratings);

  const resumptionFormatted = settings.resumptionDate
    ? new Date(settings.resumptionDate).toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' })
    : '—';

  const logoHTML = (typeof SCHOOL_LOGO !== 'undefined' && SCHOOL_LOGO)
    ? `<img src="${SCHOOL_LOGO}" style="width:90px;height:90px;object-fit:contain;" />`
    : `<div style="width:90px;height:90px;background:linear-gradient(135deg,#1a6e3c,#55A845);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:28px;font-family:'Times New Roman',serif;">CC</div>`;

  const passportHTML = student.passport
    ? `<img src="${student.passport}" style="width:90px;height:105px;object-fit:cover;border:2.5px solid #00B050;border-radius:3px;" />`
    : `<div style="width:90px;height:105px;border:2.5px dashed #00B050;display:flex;align-items:center;justify-content:center;font-size:11px;color:#aaa;text-align:center;border-radius:3px;line-height:1.6;font-family:'Times New Roman',serif;">Passport<br/>Photo</div>`;

  const stampHTML = settings.stampImage
    ? `<img src="${settings.stampImage}" style="width:100%;max-width:220px;height:auto;min-height:80px;object-fit:fill;display:block;" />`
    : '';

  const watermarkHTML = (typeof SCHOOL_LOGO !== 'undefined' && SCHOOL_LOGO)
    ? `<div style="position:absolute;top:0;left:0;right:0;bottom:0;margin:auto;width:380px;height:380px;transform:rotate(-20deg);opacity:0.02;pointer-events:none;z-index:0;display:flex;align-items:center;justify-content:center;">
        <img src="${SCHOOL_LOGO}" style="width:380px;height:380px;object-fit:contain;" />
       </div>`
    : '';

  // Build skill sections using CA+Exam scores → auto-grade
  const allSubjects = classDef.sections.flatMap(s => s.skills);
  const computedRows = computeCrecheResult(ratings, allSubjects);
  const rowMap = {};
  computedRows.forEach(r => { rowMap[r.sub] = r; });

  const sectionsHTML = classDef.sections.map(section => {
    const headerRow = `
      <tr>
        <td colspan="4" style="background:${section.color};color:#fff;font-size:15px;font-weight:bold;padding:9px 14px;text-align:left;border:1.5px solid #555;letter-spacing:0.5px;">${section.title}</td>
      </tr>`;

    const skillRows = section.skills.map((skill, i) => {
      const bg  = i % 2 === 0 ? '#C6E0B4' : '#FFFFFF';
      const row = rowMap[skill] || {};

      return `<tr>
        <td style="background:${bg};text-align:left;padding:9px 14px;font-size:14px;border:1.5px solid #999;width:40%;">${skill}</td>
        <td style="background:${bg};text-align:center;padding:9px 14px;font-size:13px;border:1.5px solid #999;width:15%;">${row.ca !== undefined ? row.ca : ''}</td>
        <td style="background:${bg};text-align:center;padding:9px 14px;font-size:13px;border:1.5px solid #999;width:15%;">${row.exam !== undefined ? row.exam : ''}</td>
        <td style="background:${bg};text-align:center;padding:9px 14px;font-size:14px;font-weight:bold;color:${row.color||'#333'};border:1.5px solid #999;width:30%;">${row.rating || ''}</td>
      </tr>`;
    }).join('');

    return `${headerRow}${skillRows}`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Result</title>
<style>
  @page { size: A4; margin: 14mm 16mm; }
  * { box-sizing: border-box; margin:0; padding:0; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 14px;
    color: #000;
    background: #fff;
    position: relative;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1.5px solid #999; padding:4px 6px; text-align:center; }
  .green { color:#00B050; font-weight:bold; }
  .red   { color:#CC0000; font-weight:bold; }
  .dark  { color:#181717; font-weight:bold; }
</style>
</head>
<body>
  <div style="position:relative;z-index:1;overflow:hidden;">
  ${watermarkHTML}

  <!-- ═══ HEADER ═══ -->
  <table style="border:none;margin-bottom:10px;">
    <tr>
      <td style="border:none;width:100px;text-align:center;vertical-align:middle;">${logoHTML}</td>
      <td style="border:none;text-align:center;vertical-align:middle;padding:0 12px;">
        <div style="font-size:32px;font-weight:900;color:#55A845;text-transform:uppercase;letter-spacing:1px;line-height:1.1;">CRITERION AMAZING COLLEGE, OSOGBO</div>
        <div style="font-size:16px;font-weight:bold;color:#181717;text-transform:uppercase;letter-spacing:3px;margin-top:7px;border-top:3px solid #55A845;border-bottom:2px solid #55A845;padding:5px 0;">PROGRESS REPORT SHEET</div>
      </td>
      <td style="border:none;width:100px;text-align:center;vertical-align:middle;">${passportHTML}</td>
    </tr>
  </table>

  <!-- ═══ STUDENT INFO ═══ -->
  <table style="border:none;margin-bottom:6px;border-top:1.5px solid #00B050;border-bottom:1.5px solid #00B050;">
    <tr>
      <td style="border:none;padding:5px 0;width:65%;">
        <span class="green" style="font-size:15px;">Student's/Pupil's Name:&nbsp;</span><span class="red" style="font-size:15px;">${student.name.toUpperCase()}</span>
      </td>
      <td style="border:none;padding:5px 0;text-align:right;">
        <span class="green" style="font-size:15px;">Class:&nbsp;</span><span class="dark" style="font-size:15px;">${student.classId}</span>
      </td>
    </tr>
    <tr>
      <td style="border:none;padding:4px 0;">
        <span class="green" style="font-size:14px;">Academic Session:&nbsp;</span><span class="dark" style="font-size:14px;">${result.session}</span>
      </td>
      <td style="border:none;padding:4px 0;text-align:right;">
        <span class="green" style="font-size:14px;">Term:&nbsp;</span><span class="dark" style="font-size:14px;">${result.term}</span>
      </td>
    </tr>
  </table>

  <!-- ═══ GRADING KEY ═══ -->
  <div style="text-align:center;font-size:12px;color:#666;font-style:italic;margin-bottom:10px;padding:4px;border:1px dashed #ccc;">
    <strong>GRADING SYSTEM:</strong>&nbsp;&nbsp;
    <strong style="color:#1a6e3c;">Outstanding</strong> (71–100) &nbsp;/&nbsp;
    <strong style="color:#0588f0;">Very Good</strong> (60–70) &nbsp;/&nbsp;
    <strong style="color:#d97706;">Good</strong> (40–59) &nbsp;/&nbsp;
    <strong style="color:#7c3aed;">Fair</strong> (&lt;40)
  </div>

  <!-- ═══ SKILLS TABLE ═══ -->
  <table style="margin-bottom:16px;border:1.5px solid #555;">
    <thead>
      <tr>
        <th style="background:#00B050;color:#fff;text-align:left;padding:7px 14px;font-size:13px;border:1.5px solid #555;width:40%;">SKILL / AREA</th>
        <th style="background:#00B050;color:#fff;padding:7px;font-size:13px;border:1.5px solid #555;width:15%;">CA /40</th>
        <th style="background:#00B050;color:#fff;padding:7px;font-size:13px;border:1.5px solid #555;width:15%;">EXAM /60</th>
        <th style="background:#00B050;color:#fff;padding:7px;font-size:13px;border:1.5px solid #555;width:30%;">RATING</th>
      </tr>
    </thead>
    ${sectionsHTML}
  </table>

  <!-- ═══ COMMENTS + FOOTER ═══ -->
  <table style="border:none;border-top:1px solid #ccc;border-bottom:1px solid #ccc;width:100%;margin-bottom:0;">
    <tr>
      <td style="border:none;border-right:1px solid #999;width:38%;padding:7px 10px 7px 0;vertical-align:top;">
        <div style="font-size:14px;font-style:italic;color:#333;font-weight:bold;">Principal's Comments</div>
      </td>
      <td style="border:none;padding:7px 0 7px 12px;vertical-align:top;font-size:13px;color:#333;line-height:1.7;">
        ${comment}
      </td>
    </tr>
    <tr>
      <td style="border:none;border-right:1px solid #999;border-top:1px solid #eee;padding:7px 10px 7px 0;vertical-align:middle;">
        <div style="font-size:14px;font-style:italic;color:#333;font-weight:bold;">Next School Resumption Date</div>
      </td>
      <td style="border:none;border-top:1px solid #eee;padding:7px 0 7px 12px;vertical-align:middle;font-size:14px;font-weight:bold;color:#181717;">
        ${resumptionFormatted}
      </td>
    </tr>
    <tr>
      <td style="border:none;border-right:1px solid #999;border-top:1px solid #eee;padding:7px 10px 7px 0;vertical-align:middle;">
        <div style="font-size:14px;font-style:italic;color:#333;font-weight:bold;">Signature, Stamp and Date</div>
      </td>
      <td style="border:none;border-top:1px solid #eee;padding:4px 0 4px 12px;vertical-align:middle;">
        ${stampHTML}
      </td>
    </tr>
  </table>

  <div style="text-align:center;font-size:11px;color:#888;font-style:italic;margin-top:8px;">
    Any alteration whatsoever on this document renders it invalid!
  </div>

  </div>
</body>
</html>`;
}
