// ============================================================
// AUTO-COMMENT ENGINE
// ============================================================
const TEACHER_COMMENTS = {
  90: [
    "It is a delight to report that this student has demonstrated an exceptional level of dedication and intellectual ability this term. The results speak volumes of consistent hard work and a genuine passion for learning. We are immensely proud and look forward to even greater achievements.",
    "This student has delivered a truly outstanding performance this term, excelling across all subjects with remarkable consistency. The depth of understanding shown is commendable, and it reflects a disciplined and focused approach to academics. Keep this standard high.",
    "What a brilliant term it has been! This student has shown extraordinary commitment and mastery of the curriculum. Every subject has been approached with seriousness and enthusiasm. This is the kind of performance that sets a lasting example for peers.",
  ],
  80: [
    "This student has had an excellent term, demonstrating strong academic ability and a commendable work ethic. The results across subjects reflect a student who is focused, diligent, and growing steadily. With continued effort, the very top is within reach.",
    "A very impressive performance this term. This student has shown real strength in understanding and applying knowledge across the curriculum. The consistency shown is encouraging, and we are confident that sustained effort will yield even greater results.",
    "This term's results reflect a student who takes their education seriously and puts in genuine effort. The academic performance has been strong and well-rounded. We encourage this student to keep pushing forward — the potential for excellence is clearly there.",
  ],
  70: [
    "This student has had a good term overall, showing solid understanding across most subjects. There is clear potential here, and with a little more focus and consistency, the results can climb even higher. We encourage continued dedication and self-belief.",
    "A pleasing performance this term. This student has demonstrated the ability to grasp and apply key concepts well. We encourage more revision and active participation in class, as we believe this student is capable of achieving even more impressive results.",
    "Good work this term. This student has shown a growing confidence in their studies and a willingness to engage with the curriculum. A stronger push in the areas of challenge will make a significant difference. We are rooting for a stellar next term.",
  ],
  60: [
    "This student has shown satisfactory progress this term, demonstrating a reasonable grasp of the subjects covered. There is visible effort, and we encourage this student to build on that foundation by dedicating more time to study and revision going forward.",
    "A fair performance this term. This student has shown the ability to engage with the material, and we are encouraged by the effort made. With greater consistency and focus, especially in weaker areas, there is every reason to expect a stronger result next term.",
    "This student is on the right path. The results this term reflect a student who is trying, and that effort is valued. We encourage a more structured approach to studying, as we believe this student has the capacity to achieve significantly better results.",
  ],
  50: [
    "This student has made a decent effort this term, and while there is room for improvement, the foundation is there to build upon. We encourage a more disciplined study routine and greater engagement with class work. With determination, a much stronger result is achievable.",
    "This term's result shows that this student is capable of more with the right focus and commitment. We encourage the student to identify areas of difficulty and seek help early. Every step taken toward improvement is a step toward a brighter academic future.",
    "We acknowledge the effort made this term and encourage this student not to be discouraged. Academic growth is a journey, and the right attitude and consistent work will make a real difference. We are confident that next term will bring a marked improvement.",
  ],
  0: [
    "While this term's result has not reflected this student's full potential, we want to encourage them to keep going. Every great achiever faces challenges, and what matters most is the decision to rise and try again. We are here to support this student every step of the way.",
    "This term has been a learning experience, and we believe it will serve as a turning point. This student has the ability to do better, and with renewed focus, proper guidance, and consistent effort, we are confident that the next term will tell a very different story.",
    "We encourage this student to see this result not as a setback, but as motivation to work harder. The teachers and staff of this school believe in this student's potential and are committed to providing all the support needed to achieve a much better outcome next term.",
  ],
};

const PRINCIPAL_COMMENTS = {
  90: [
    "This is an outstanding result that reflects the very best of what a Criterion College student can achieve. You have made your family and this institution immensely proud. I urge you to maintain this standard and continue to inspire those around you.",
    "Exceptional performance! This result is a testament to your hard work, discipline, and commitment to excellence. Criterion College is proud to have students of your calibre. I encourage you to keep this momentum and aim even higher in the terms ahead.",
    "A truly remarkable achievement. You have demonstrated that dedication and focus produce extraordinary results. As you progress, I challenge you to remain humble, keep learning, and continue to set the standard for academic excellence in this institution.",
  ],
  80: [
    "This is a commendable result that reflects a serious and hardworking student. You have represented this school with distinction, and I am proud of your achievement. I encourage you to keep building on this strong foundation and aim for the very top.",
    "Excellent work this term. Your performance shows that you understand the value of education and are willing to put in the work required to succeed. I urge you to sustain this level of commitment and continue to make Criterion College proud.",
    "A very impressive performance. It is clear that you are a focused and determined student. I encourage you to keep this energy going, address any areas of weakness, and come back next term ready to deliver an even greater result.",
  ],
  70: [
    "A good result this term. You have shown that you are capable of achieving strong academic outcomes when you apply yourself. I encourage you to push a little harder, seek help where needed, and come back next term with even greater determination.",
    "Well done on a solid performance this term. You are clearly making progress, and I am pleased with the effort you have shown. I challenge you to raise the bar further — the potential for excellence is evident, and I look forward to seeing it fully realised.",
    "This is an encouraging result. You have demonstrated good academic ability, and I urge you to continue building on it. Consistency is key — keep attending classes, completing your assignments, and engaging with your studies, and the results will continue to improve.",
  ],
  60: [
    "A satisfactory result this term. While there is room for improvement, I am encouraged by the effort you have shown. I urge you to work harder in the coming term, seek guidance from your teachers, and believe in your ability to achieve a much stronger outcome.",
    "You have shown some good effort this term, and I encourage you to keep that spirit alive. With a more focused approach to your studies and greater consistency, I am confident you can achieve significantly better results. This school is behind you all the way.",
    "A fair performance this term. I encourage you to use this result as motivation to work harder and smarter. Identify the subjects where you need more support and take action early. You have the potential to do much better, and we are here to help you get there.",
  ],
  50: [
    "While this term's result is below your potential, I encourage you not to be discouraged. Use this as a call to action — work harder, engage more in class, and seek help where you are struggling. I believe in your ability to achieve a much better result next term.",
    "This result shows that there is significant room for growth, and I want you to see that as an opportunity. With the right effort, focus, and support from your teachers, you can turn this around completely. Criterion College is committed to helping you succeed.",
    "I encourage you to reflect on this term's result and use it as a stepping stone. Academic success requires consistent effort and a willingness to improve. Come back next term with renewed determination, and I am confident you will surprise yourself and everyone around you.",
  ],
  0: [
    "I want to encourage you to keep your head up. This result does not define your potential — it is simply a signal that more effort and support are needed. This school is fully committed to helping you grow, and I urge you to come back next term ready to give your very best.",
    "Every student has the capacity to succeed, and I firmly believe that includes you. This term may not have gone as hoped, but it is not the end of the story. With hard work, the right attitude, and the support of your teachers, a much better result is absolutely within your reach.",
    "Do not be discouraged by this term's result. Some of the greatest success stories begin with a difficult chapter. I challenge you to use this as your motivation, engage more with your studies, and let next term be the beginning of your academic turnaround. We are with you.",
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
  /* ── Suppress browser header/footer (date, URL, title) on print ── */
  @page {
    size: A4;
    margin: 12mm 14mm;
    /* These suppress the browser-added header/footer in most browsers */
    margin-top: 12mm;
    margin-bottom: 12mm;
  }
  @media print {
    /* Chrome/Edge: hide running heads */
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* Hide default browser print header/footer by setting title to empty */
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
        <th style="text-align:left;width:25%;background:#55A845;color:#fff;font-size:12px;border:1px solid #999;">SUBJECTS</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">TEST</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">EXAM</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">TOTAL</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">AVRG</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">GRADE</th>
        <th style="background:#55A845;color:#fff;border:1px solid #999;">RMKS</th>
      </tr>
      <tr>
        <th style="text-align:left;background:#6ab55a;color:#fff;font-size:12px;border:1px solid #999;">SUBJECTS</th>
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

  <!-- ═══ KEYS — centred below table ═══ -->
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
          <tr><td style="text-align:left;background:#fff;font-size:12px;border:1px solid #999;">School Days</td><td style="font-size:12px;border:1px solid #999;">${settings.daysInSchool || ''}</td></tr>
          <tr><td style="text-align:left;background:#C4D79B;font-size:12px;border:1px solid #999;">Days Attended</td><td style="background:#C4D79B;font-size:12px;border:1px solid #999;">${student.daysAttended || ''}</td></tr>
          <tr><td style="text-align:left;background:#fff;font-size:12px;border:1px solid #999;">Days Absent</td><td style="font-size:12px;border:1px solid #999;">${daysAbsent}</td></tr>
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

  <!-- ═══ COMMENTS — two-column with vertical divider (matching image) ═══ -->
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
