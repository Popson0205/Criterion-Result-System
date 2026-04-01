// ============================================================
// api.js — replaces localStorage DB object with server API calls
// All functions are async; app.js calls await DB.*()
// ============================================================

const API = {
  // ── Token management ──────────────────────────────────────
  getToken() { return localStorage.getItem('cc_token'); },
  getRole()  { return localStorage.getItem('cc_role'); },
  getUser()  { return JSON.parse(localStorage.getItem('cc_user') || 'null'); },

  headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.getToken()
    };
  },

  async request(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) {
      // Token expired — redirect to login
      localStorage.removeItem('cc_token');
      localStorage.removeItem('cc_role');
      localStorage.removeItem('cc_user');
      window.location.href = '/';
      return;
    }
    return res.json();
  },

  get(path)         { return this.request('GET', path); },
  post(path, body)  { return this.request('POST', path, body); },
  put(path, body)   { return this.request('PUT', path, body); },
  del(path)         { return this.request('DELETE', path); },
};

// ── DB object — same interface as original data.js DB ─────────
// app.js calls these; they now hit the server instead of localStorage
const DB = {
  // Cache to avoid hammering the server on every render
  _students: null,
  _results:  null,
  _settings: null,

  async init() {
    [this._students, this._results, this._settings] = await Promise.all([
      API.get('/api/students'),
      API.get('/api/results'),
      API.get('/api/settings'),
    ]);
  },

  invalidate() {
    this._students = null;
    this._results  = null;
    this._settings = null;
  },

  // ── Students ──────────────────────────────────────────────
  getStudents() {
    return this._students || [];
  },
  getStudent(id) {
    return (this._students || []).find(s => s.id === id) || null;
  },
  async saveStudents(students) {
    // Called with full array — diff against cache and save changed ones
    for (const s of students) {
      await API.post('/api/students', s);
    }
    this._students = students;
  },
  async saveStudent(student) {
    await API.post('/api/students', student);
    if (this._students) {
      const idx = this._students.findIndex(s => s.id === student.id);
      if (idx >= 0) this._students[idx] = student;
      else this._students.push(student);
    }
  },
  async deleteStudent(id) {
    await API.del('/api/students/' + id);
    if (this._students) this._students = this._students.filter(s => s.id !== id);
    if (this._results)  this._results  = this._results.filter(r => r.studentId !== id);
  },

  // ── Results ───────────────────────────────────────────────
  getResults() {
    return this._results || [];
  },
  getResult(studentId, session, term) {
    return (this._results || []).find(r =>
      r.studentId === studentId && r.session === session && r.term === term
    ) || null;
  },
  async saveResults(results) {
    for (const r of results) {
      await API.post('/api/results', r);
    }
    this._results = results;
  },
  async saveResult(result) {
    await API.post('/api/results', result);
    if (this._results) {
      const idx = this._results.findIndex(r =>
        r.studentId === result.studentId && r.session === result.session && r.term === result.term
      );
      if (idx >= 0) this._results[idx] = result;
      else this._results.push(result);
    }
  },

  // ── Settings ──────────────────────────────────────────────
  getSettings() {
    return this._settings || { session:'', term:'', daysInSchool:'', resumptionDate:'', stampImage:'' };
  },
  async saveSettings(s) {
    await API.post('/api/settings', s);
    this._settings = s;
  },

  // ── Share tokens ──────────────────────────────────────────
  async createShareToken(studentId, session, term) {
    const res = await API.post('/api/share', { studentId, session, term });
    return res.token;
  },

  // ── Teachers (admin only) ─────────────────────────────────
  async getTeachers()             { return API.get('/api/teachers'); },
  async createTeacher(data)       { return API.post('/api/teachers', data); },
  async updateTeacher(id, data)   { return API.put('/api/teachers/' + id, data); },
  async deleteTeacher(id)         { return API.del('/api/teachers/' + id); },
};
