// ============================================================
// CRITERION COLLEGE — DATA STORE (localStorage-backed)
// ============================================================
key, val) {
    try { localStorage.setItem('cc_' + key, JSON.stringify(val)); } catch {}
  },
  // Students: { id, name, classId, passport(base64), daysAttended, session, term }
  getStudents() { return this.get('students', []); },
  saveStudents(s) { this.set('students', s); },
  getStudent(id) { return this.getStudents().find(s => s.id === id) || null; },
  // Results: { studentId, session, term, scores: {subject: {ca, exam}}, teacherComment, principalComment }
  getResults() { return this.get('results', []); },
  saveResults(r) { this.set('results', r); },
  getResult(studentId, session, term) {
    return this.getResults().find(r => r.studentId === studentId && r.session === session && r.term === term) || null;
  },
  upsertResult(result) {
    const results = this.getResults();
    const idx = results.findIndex(r => r.studentId === result.studentId && r.session === result.session && r.term === result.term);
    if (idx >= 0) results[idx] = result; else results.push(result);
    this.saveResults(results);
  },
  // Settings
  getSettings() { return this.get('settings', { session: '2025/2026', term: '1ST TERM', daysInSchool: '', resumptionDate: '', principalName: 'The Principal', schoolMotto: 'Excellence in Learning' }); },
  saveSettings(s) { this.set('settings', s); },
  // Share tokens: { token, studentId, session, term, createdAt }
  getShareTokens() { return this.get('share_tokens', []); },
  saveShareTokens(t) { this.set('share_tokens', t); },
  createShareToken(studentId, session, term) {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const tokens = this.getShareTokens().filter(t => !(t.studentId === studentId && t.session === session && t.term === term));
    tokens.push({ token, studentId, session, term, createdAt: Date.now() });
    this.saveShareTokens(tokens);
    return token;
  },
  getByToken(token) { return this.getShareTokens().find(t => t.token === token) || null; },
};

const CLASS_SUBJECTS = {
  "Creche 1":    ["Reading","Qur'an","Speaking","Writing Skill","Arts","Arabic","Numeracy"],
  "Creche 2":    ["Reading","Qur'an","Speaking","Writing Skill","Arts","Arabic","Numeracy"],
  "Pre-Nursery": ["Mathematics Skill","Writing Skill","English Skill","CCA","Science","Arabic Studies","Qur'an","Social Habits","Rhymes/Poems","Health Habits"],
  "Nursery 1":   ["Mathematics Skill","Writing Skill","English Skill","CCA","Science","Arabic Studies","Qur'an","Social Habits","Rhymes/Poems","Health Habits"],
  "Nursery 2":   ["Mathematics Skill","Writing Skill","English Skill","CCA","Science","Arabic Studies","Qur'an","Social Habits","Rhymes/Poems","Health Habits"],
  "Primary 1":   ["English Studies","Basic Science and Technology","Writing Skills","Mathematics","Qur'an","Yoruba","Nigeria History","Physical & Health Education","Social and Citizenship Studies","Islamic Studies","Quantitative Reasoning","CCA","Verbal Reasoning","Arabic Studies"],
  "Primary 2":   ["English Studies","Basic Science and Technology","Writing Skills","Mathematics","Qur'an","Yoruba","Nigeria History","Physical & Health Education","Social and Citizenship Studies","Islamic Studies","Quantitative Reasoning","CCA","Verbal Reasoning","Arabic Studies"],
  "Primary 3":   ["English Studies","Basic Science and Technology","Writing Skills","Mathematics","Qur'an","Yoruba","Nigeria History","Physical & Health Education","Social and Citizenship Studies","Islamic Studies","Quantitative Reasoning","CCA","Verbal Reasoning","Arabic Studies"],
  "Primary 4":   ["English Studies","Basic Science and Technology","Writing Skills","Mathematics","Qur'an","Yoruba","Nigeria History","Physical & Health Education","Social and Citizenship Studies","Islamic Studies","Quantitative Reasoning","CCA","Verbal Reasoning","Arabic Studies"],
  "J.S.S 1":     ["Mathematics","English Studies","Business Studies","Nigeria History","CCA","Intermediate Science","Literature in English","Islamic Studies","Arabic Studies","Agricultural Science","Social and Citizenship Studies","Qur'an","Yoruba","Digital Technology"],
  "J.S.S 2":     ["Mathematics","English Studies","Business Studies","Nigeria History","CCA","Intermediate Science","Literature in English","Islamic Studies","Arabic Studies","Agricultural Science","Social and Citizenship Studies","Qur'an","Yoruba","Digital Technology"],
  "J.S.S 3":     ["Mathematics","English Studies","Business Studies","Nigeria History","CCA","Intermediate Science","Literature in English","Islamic Studies","Arabic Studies","Agricultural Science","Social and Citizenship Studies","Qur'an","Yoruba","Digital Technology"],
  "S.S 1":       ["Mathematics","English Language","Physics","Biology","Chemistry","Geography","Citizenship and Heritage Education","Agricultural Science","Qur'an","Arabic Studies","Digital Technology"],
  "S.S 2":       ["Mathematics","English Language","Physics","Biology","Chemistry","Geography","Citizenship and Heritage Education","Agricultural Science","Qur'an","Arabic Studies","Digital Technology"],
  "S.S 3":       ["Mathematics","English Language","Physics","Biology","Chemistry","Geography","Citizenship and Heritage Education","Agricultural Science","Qur'an","Arabic Studies","Digital Technology"],
};

const ALL_CLASSES = Object.keys(CLASS_SUBJECTS);
const TERMS = ["1ST TERM","2ND TERM","3RD TERM"];

function getGrade(score) {
  if (score >= 70) return { grade:'A', remark:'Excellent', color:'#1a6e3c' };
  if (score >= 60) return { grade:'B', remark:'Very Good', color:'#0588f0' };
  if (score >= 50) return { grade:'C', remark:'Good',      color:'#d97706' };
  if (score >= 40) return { grade:'D', remark:'Pass',      color:'#7c3aed' };
  return               { grade:'F', remark:'Fail',      color:'#dc2626' };
}

function getOrdinal(n) {
  const s=['th','st','nd','rd'], v=n%100;
  return n+(s[(v-20)%10]||s[v]||s[0]);
}

function computeResult(scores, subjects) {
  let totalCA=0, totalExam=0, totalScore=0, count=0;
  const gradeCounts = {A:0,B:0,C:0,D:0,F:0};
  const rows = subjects.map(sub => {
    const ca   = parseFloat(scores[sub]?.ca)   || 0;
    const exam = parseFloat(scores[sub]?.exam) || 0;
    const total = ca + exam;
    const { grade, remark, color } = getGrade(total);
    const has = scores[sub]?.ca !== '' && scores[sub]?.ca !== undefined && scores[sub]?.exam !== '' && scores[sub]?.exam !== undefined;
    if (has) { totalCA+=ca; totalExam+=exam; totalScore+=total; gradeCounts[grade]++; count++; }
    return { sub, ca: has?ca:'', exam: has?exam:'', total: has?total:'', grade: has?grade:'', remark: has?remark:'', color: has?color:'', has };
  });
  const avg = count > 0 ? (totalScore/count).toFixed(2) : '0.00';
  return { rows, totalCA, totalExam, totalScore, count, avg, gradeCounts };
}

function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
