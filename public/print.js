// ============================================================
// AUTO-COMMENT ENGINE
// ============================================================
const TEACHER_COMMENTS = {
  90: [
    "This student has demonstrated exceptional dedication and intellectual ability this term, and we are immensely proud of this outstanding achievement.",
    "An outstanding performance this term — this student has excelled across all subjects with remarkable consistency and a genuine passion for learning.",
    "This student has shown extraordinary commitment and mastery of the curriculum this term, setting a lasting example for peers.",
  ],
  80: [
    "This student has had an excellent term, demonstrating strong academic ability and a commendable work ethic across all subjects.",
    "A very impressive performance this term, reflecting a focused and diligent student who is growing steadily toward the very top.",
    "This term's results reflect a student who takes their education seriously, and we are confident that sustained effort will yield even greater results.",
  ],
  70: [
    "This student has had a good term overall, showing solid understanding across most subjects, and with more focus the results can climb even higher.",
    "A pleasing performance this term — this student has demonstrated the ability to grasp and apply key concepts well.",
    "Good work this term; a stronger push in the areas of challenge will make a significant difference next term.",
  ],
  60: [
    "This student has shown satisfactory progress this term, and we encourage greater dedication to study and revision going forward.",
    "A fair performance this term — with greater consistency and focus, especially in weaker areas, a stronger result next term is very achievable.",
    "This student is on the right path, and we encourage a more structured approach to studying to unlock significantly better results.",
  ],
  50: [
    "This student has made a decent effort this term, and with a more disciplined study routine a much stronger result is achievable.",
    "This term's result shows this student is capable of more with the right focus and commitment, and we encourage early engagement with areas of difficulty.",
    "We acknowledge the effort made this term and are confident that consistent work will bring a marked improvement next term.",
  ],
  0: [
    "While this term's result has not reflected this student's full potential, we encourage them to keep going with renewed focus and determination.",
    "This term has been a learning experience, and with renewed focus and consistent effort, we are confident the next term will tell a very different story.",
    "We encourage this student to see this result as motivation to work harder, and the school remains committed to providing all the support needed.",
  ],
};

const PRINCIPAL_COMMENTS = {
  90: [
    "This is an outstanding result that reflects the very best of what a Criterion College student can achieve, and I urge you to maintain this standard.",
    "Exceptional performance — this result is a testament to your hard work, discipline, and commitment to excellence, and Criterion College is proud of you.",
    "A truly remarkable achievement that demonstrates dedication and focus; I challenge you to remain humble and continue setting the standard for excellence.",
  ],
  80: [
    "This is a commendable result that reflects a serious and hardworking student, and I encourage you to keep building on this strong foundation.",
    "Excellent work this term — your performance shows you understand the value of education, and I urge you to sustain this level of commitment.",
    "A very impressive performance; I encourage you to keep this energy going, address any areas of weakness, and aim even higher next term.",
  ],
  70: [
    "A good result this term — you have shown that you are capable of strong academic outcomes, and I encourage you to push a little harder.",
    "Well done on a solid performance this term; I challenge you to raise the bar further, as the potential for excellence is clearly evident.",
    "This is an encouraging result, and I urge you to continue building on it with consistency, class engagement, and completed assignments.",
  ],
  60: [
    "A satisfactory result this term — I urge you to work harder in the coming term and believe in your ability to achieve a much stronger outcome.",
    "You have shown some good effort this term, and with a more focused approach I am confident you can achieve significantly better results.",
    "A fair performance this term — I encourage you to identify subjects where you need more support and take action early next term.",
  ],
  50: [
    "While this term's result is below your potential, I encourage you to use it as a call to action and come back next term with renewed determination.",
    "This result shows significant room for growth, and with the right effort, focus, and support from your teachers, you can turn this around completely.",
    "I encourage you to reflect on this term's result and come back next term with renewed determination — I am confident you will surprise yourself.",
  ],
  0: [
    "I want to encourage you to keep your head up, as this result does not define your potential — come back next term ready to give your very best.",
    "Every student has the capacity to succeed, and with hard work, the right attitude, and teacher support, a much better result is absolutely within your reach.",
    "Do not be discouraged by this term's result; I challenge you to use it as motivation and let next term be the beginning of your academic turnaround.",
  ],
};

function getAutoComment(avg, pool) {
  const score = parseFloat(avg) || 0;
  let bracket = 0;
  if (score >= 90) bracket = 90;
  else if (score >= 80) bracket = 80;
  else if (score >= 70) bracket = 70;
  else if (score >= 60) bracket = 60;
  else if (score >= 50) bracket = 50;
  else bracket = 0;
  const arr = pool[bracket];
  return arr[Math.floor(Math.random() * arr.length)];
}
function getTeacherComment(avg)   { return getAutoComment(avg, TEACHER_COMMENTS); }
function getPrincipalComment(avg) { return getAutoComment(avg, PRINCIPAL_COMMENTS); }

// ============================================================
// PRINT ENGINE
// ============================================================
function buildResultHTML(student, result, position, totalStudents, forPrint=true) {
  const settings = DB.getSettings();
  const subjects  = CLASS_SUBJECTS[student.classId] || [];
  const { rows, totalCA, totalExam, totalScore, count, avg, gradeCounts } = computeResult(result.scores || {}, subjects);

  const teacherComment   = (result.teacherComment   && result.teacherComment.trim())   ? result.teacherComment   : getTeacherComment(avg);
  const principalComment = (result.principalComment && result.principalComment.trim()) ? result.principalComment : getPrincipalComment(avg);

  const resumptionFormatted = settings.resumptionDate
    ? new Date(settings.resumptionDate).toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' })
    : '—';

  const daysAbsent = (settings.daysInSchool && student.daysAttended)
    ? parseInt(settings.daysInSchool) - parseInt(student.daysAttended) : '';

  // Only top 5 get a position; others get blank
  const posStr = (position && position <= 5) ? getOrdinal(position) : '';

  const logoHTML = (typeof SCHOOL_LOGO !== 'undefined' && SCHOOL_LOGO)
    ? `<img src="${SCHOOL_LOGO}" style="width:76px;height:76px;object-fit:contain;" />`
    : `<div style="width:76px;height:76px;background:linear-gradient(135deg,#1a6e3c,#55A845);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:24px;">CC</div>`;

  const passportHTML = student.passport
    ? `<img src="${student.passport}" style="width:76px;height:86px;object-fit:cover;border:2px solid #55A845;border-radius:3px;" />`
    : `<div style="width:76px;height:86px;border:2px dashed #55A845;display:flex;align-items:center;justify-content:center;font-size:11px;color:#aaa;text-align:center;border-radius:3px;line-height:1.4;">Passport<br/>Photo</div>`;

  // Stamp — just the uploaded image, no fake box
  const stampBoxHTML = settings.stampImage
    ? `<img src="${settings.stampImage}" style="width:100%;max-width:220px;height:auto;min-height:80px;object-fit:fill;display:block;" />`
    : `<div style="width:220px;height:80px;border:2px dashed #ccc;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;color:#ccc;text-align:center;">Upload<br/>Stamp</div>`;

  // Watermark
  const watermarkHTML = (typeof SCHOOL_LOGO !== 'undefined' && SCHOOL_LOGO)
    ? `<div style="position:absolute;top:0;left:0;right:0;bottom:0;margin:auto;width:320px;height:320px;transform:rotate(-20deg);opacity:0.02;pointer-events:none;z-index:0;display:flex;align-items:center;justify-content:center;">
        <img src="${SCHOOL_LOGO}" style="width:320px;height:320px;object-fit:contain;" />
       </div>`
    : '';

  // Subject rows
  const subjectRows = rows.map((r, i) => {
    const rowBg  = i % 2 === 0 ? '#C4D79B' : '#FFFFFF';
    const cellBg = i % 2 === 0 ? '#D8DB9C' : '#FAFAFA';
    return `<tr>
      <td style="background:${rowBg};text-align:left;padding:3px 7px;font-size:12px;border:1px solid #999;">${r.sub}</td>
      <td style="background:${cellBg};font-size:12px;border:1px solid #999;">${r.ca}</td>
      <td style="background:${cellBg};font-size:12px;border:1px solid #999;">${r.exam}</td>
      <td style="background:${cellBg};font-size:12px;font-weight:bold;border:1px solid #999;">${r.total}</td>
      <td style="background:${cellBg};font-size:12px;border:1px solid #999;">${r.has ? avg : ''}</td>
      <td style="background:${cellBg};font-size:12px;font-weight:bold;color:${r.color||'#000'};border:1px solid #999;">${r.grade}</td>
      <td style="background:${cellBg};font-size:12px;border:1px solid #999;">${r.remark}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Result</title>
<style>
  @page {
    size: A4;
    margin: 12mm 14mm;
    margin-top: 12mm;
    margin-bottom: 12mm;
  }
  @media print {
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    head title { display: none; }
  }
  * { box-sizing: border-box; margin:0; padding:0; }
  body {
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: #000;
    background: #fff;
    position: relative;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #999; padding:3px 4px; text-align:center; }
  .green { color:#55A845; font-weight:bold; }
  .red   { color:#CC0000; font-weight:bold; }
  .dark  { color:#181717; font-weight:bold; }
</style>
</head>
<body>

  <div style="position:relative;z-index:1;overflow:hidden;">
  ${watermarkHTML}

  <!-- ═══ HEADER ═══ -->
  <table style="border:none;margin-bottom:6px;">
    <tr>
      <td style="border:none;width:84px;text-align:center;vertical-align:middle;">${logoHTML}</td>
      <td style="border:none;text-align:center;vertical-align:middle;padding:0 10px;">
        <div style="font-size:28px;font-weight:900;color:#55A845;text-transform:uppercase;letter-spacing:1px;line-height:1.1;">CRITERION COLLEGE, OSOGBO</div>
        <div style="font-size:13px;font-weight:bold;color:#181717;text-transform:uppercase;letter-spacing:3px;margin-top:5px;border-top:3px solid #55A845;border-bottom:2px solid #55A845;padding:4px 0;">PROGRESS REPORT SHEET</div>
      </td>
      <td style="border:none;width:84px;text-align:center;vertical-align:middle;">${passportHTML}</td>
    </tr>
  </table>

  <!-- ═══ STUDENT INFO ═══ -->
  <table style="border:none;margin-bottom:3px;border-top:1px solid #55A845;border-bottom:1px solid #55A845;">
    <tr>
      <td style="border:none;padding:3px 0;width:60%;">
        <span class="green" style="font-size:14px;">Student's Name:&nbsp;</span><span class="red">${student.name.toUpperCase()}</span>
      </td>
      <td style="border:none;padding:3px 0;text-align:right;">
        <span class="green">Class:&nbsp;</span><span class="dark">${student.classId}</span>
      </td>
    </tr>
    <tr>
      <td style="border:none;padding:2px 0;">
        <span class="green">No of Subjects:&nbsp;</span><span class="dark">${count}</span>
        &nbsp;&nbsp;&nbsp;&nbsp;
        <span class="green">Average Score:&nbsp;</span><span class="dark">${avg}</span>
      </td>
      <td style="border:none;padding:2px 0;text-align:right;">
        <span class="green">Academic Session:&nbsp;</span><span class="dark">${result.session}</span>
      </td>
    </tr>
    <tr>
      <td style="border:none;padding:2px 0;">
        <span class="green">POSITION:&nbsp;</span><span class="dark">${posStr}</span>
      </td>
      <td style="border:none;padding:2px 0;text-align:right;">
        <span class="green">Term:&nbsp;</span><span class="dark">${result.term}</span>
      </td>
    </tr>
  </table>

  <!-- ═══ SCORES TABLE ═══ -->
  <table style="margin-bottom:0;border:1px solid #999;">
    <thead>
      <tr>
        <th style="text-align:left;width:25%;background:#55A845;color:#fff;font-size:12px;border:1px solid #999;">SUBJECT</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">TEST</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">EXAM</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">TOTAL</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">AVRG</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">GRADE</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">RMKS</th>
      </tr>
      <tr>
        <th style="text-align:left;background:#6ab55a;color:#fff;font-size:12px;border:1px solid #999;">SUBJECT</th>
        <th style="background:#6ab55a;color:#fff;border:1px solid #999;">40</th>
        <th style="background:#6ab55a;color:#fff;border:1px solid #999;">60</th>
        <th style="background:#6ab55a;color:#fff;border:1px solid #999;">100</th>
        <th style="background:#6ab55a;color:#fff;border:1px solid #999;">AVRG</th>
        <th style="background:#6ab55a;color:#fff;border:1px solid #999;">GRADE</th>
        <th style="background:#6ab55a;color:#fff;border:1px solid #999;">RMKS</th>
      </tr>
    </thead>
    <tbody>${subjectRows}</tbody>
    <tfoot>
      <tr>
        <td style="background:#D8DB9C;font-weight:bold;text-align:left;padding:3px 7px;border:1px solid #999;">Total</td>
        <td style="background:#D8DB9C;font-weight:bold;border:1px solid #999;">${totalCA}</td>
        <td style="background:#D8DB9C;font-weight:bold;border:1px solid #999;">${totalExam}</td>
        <td style="background:#D8DB9C;font-weight:bold;border:1px solid #999;">${totalScore}</td>
        <td style="background:#D8DB9C;font-weight:bold;border:1px solid #999;">${avg}</td>
        <td style="background:#D8DB9C;border:1px solid #999;"></td>
        <td style="background:#D8DB9C;border:1px solid #999;"></td>
      </tr>
    </tfoot>
  </table>

  <!-- ═══ KEYS ═══ -->
  <div style="text-align:center;font-size:11px;color:#555;font-style:italic;padding:3px 0 5px;border-bottom:1px solid #ccc;margin-bottom:5px;">
    <strong>Keys:</strong>&nbsp;&nbsp;
    ≥70 = <strong style="color:#1a6e3c;">A</strong> Excellent &nbsp;|&nbsp;
    ≥60 = <strong style="color:#0588f0;">B</strong> Very Good &nbsp;|&nbsp;
    ≥50 = <strong style="color:#d97706;">C</strong> Good &nbsp;|&nbsp;
    ≥40 = <strong style="color:#7c3aed;">D</strong> Pass &nbsp;|&nbsp;
    &lt;40 = <strong style="color:#dc2626;">F</strong> Fail
  </div>

  <!-- ═══ BOTTOM SECTION ═══ -->
  <table style="border:none;margin-bottom:5px;">
    <tr>
      <td style="border:none;width:33%;vertical-align:top;padding-right:4px;">
        <table style="border:1px solid #999;">
          <tr><th colspan="2" style="background:#D8DB9C;color:#181717;font-size:10px;font-weight:bold;border:1px solid #999;">Attendance Table</th></tr>
          <tr><td style="text-align:left;background:#fff;font-size:12px;border:1px solid #999;">School Days</td><td style="font-size:12px;border:1px solid #999;width:45%;">${settings.daysInSchool || ''}</td></tr>
          <tr><td style="text-align:left;background:#C4D79B;font-size:12px;border:1px solid #999;">Days Attended</td><td style="background:#C4D79B;font-size:12px;border:1px solid #999;width:45%;">${student.daysAttended || ''}</td></tr>
          <tr><td style="text-align:left;background:#fff;font-size:12px;border:1px solid #999;">Days Absent</td><td style="font-size:12px;border:1px solid #999;width:45%;">${daysAbsent}</td></tr>
        </table>
      </td>
      <td style="border:none;width:33%;vertical-align:top;padding:0 2px;">
        <table style="border:1px solid #999;">
          <tr><th colspan="2" style="background:#D8DB9C;color:#181717;font-size:10px;font-weight:bold;border:1px solid #999;">Summary</th></tr>
          <tr><td style="text-align:left;background:#fff;font-size:12px;border:1px solid #999;">No of Subjects</td><td style="font-size:12px;border:1px solid #999;">${count}</td></tr>
          <tr><td style="text-align:left;background:#C4D79B;font-size:12px;border:1px solid #999;">Marks Obtainable</td><td style="background:#C4D79B;font-size:12px;border:1px solid #999;">${count * 100}</td></tr>
          <tr><td style="text-align:left;background:#fff;font-size:12px;border:1px solid #999;">Marks Obtained</td><td style="font-size:12px;border:1px solid #999;">${totalScore}</td></tr>
        </table>
      </td>
      <td style="border:none;width:33%;vertical-align:top;padding-left:4px;">
        <table style="border:1px solid #999;">
          <tr><th colspan="2" style="background:#D8DB9C;color:#181717;font-size:10px;font-weight:bold;border:1px solid #999;">Performance Keys</th></tr>
          <tr>
            <th style="background:#6ab55a;color:#fff;font-size:12px;border:1px solid #999;">Grade</th>
            <th style="background:#6ab55a;color:#fff;font-size:12px;border:1px solid #999;">No</th>
          </tr>
          ${Object.entries(gradeCounts).map(([g,n],i)=>`
          <tr>
            <td style="background:${i%2===0?'#D8DB9C':'#fff'};font-size:12px;border:1px solid #999;">${g}</td>
            <td style="background:${i%2===0?'#D8DB9C':'#fff'};font-size:12px;border:1px solid #999;">${n}</td>
          </tr>`).join('')}
          <tr>
            <td style="background:#D8DB9C;font-weight:bold;font-size:12px;border:1px solid #999;">Total</td>
            <td style="background:#D8DB9C;font-weight:bold;font-size:12px;border:1px solid #999;">${count}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ═══ COMMENTS ═══ -->
  <table style="border:none;border-top:1px solid #ccc;border-bottom:1px solid #ccc;margin-bottom:0;width:100%;">
    <tr>
      <td style="border:none;border-right:1px solid #999;width:38%;padding:5px 8px 5px 0;vertical-align:top;">
        <div style="font-size:10px;font-style:italic;color:#333;font-weight:600;">Teacher's Comments</div>
      </td>
      <td style="border:none;padding:5px 0 5px 10px;vertical-align:top;font-size:10px;color:#333;line-height:1.5;">
        ${teacherComment}
      </td>
    </tr>
    <tr>
      <td style="border:none;border-right:1px solid #999;border-top:1px solid #eee;width:38%;padding:5px 8px 5px 0;vertical-align:top;">
        <div style="font-size:10px;font-style:italic;color:#333;font-weight:600;">Principal's Comments</div>
      </td>
      <td style="border:none;border-top:1px solid #eee;padding:5px 0 5px 10px;vertical-align:top;font-size:10px;color:#333;line-height:1.5;">
        ${principalComment}
      </td>
    </tr>
    <tr>
      <td style="border:none;border-right:1px solid #999;border-top:1px solid #eee;padding:5px 8px 5px 0;vertical-align:middle;">
        <div style="font-size:10px;font-style:italic;color:#333;font-weight:600;">Next School Resumption Date</div>
      </td>
      <td style="border:none;border-top:1px solid #eee;padding:5px 0 5px 10px;vertical-align:middle;font-size:10px;font-weight:bold;color:#181717;">
        ${resumptionFormatted}
      </td>
    </tr>
    <tr>
      <td style="border:none;border-right:1px solid #999;border-top:1px solid #eee;padding:5px 8px 5px 0;vertical-align:middle;">
        <div style="font-size:10px;font-style:italic;color:#333;font-weight:600;">Signature, Stamp and Date</div>
      </td>
      <td style="border:none;border-top:1px solid #eee;padding:4px 0 4px 4px;vertical-align:middle;">
        ${stampBoxHTML}
      </td>
    </tr>
  </table>

  <!-- ═══ DISCLAIMER ═══ -->
  <div style="font-size:9px;color:#888;font-style:italic;text-align:center;margin-top:5px;">
    Any alteration whatsoever on this document renders it invalid
  </div>

  </div>
</body>
</html>`;
}
