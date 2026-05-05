var vscode = acquireVsCodeApi();
var profiles = [];
var activeProfileName = null;
var rows = [];
var currentProfileName = '';
var originalProfileName = '';

// ── Render env var table ────────────────────────────────
function renderTable() {
  var body = document.getElementById('envBody');
  body.textContent = '';
  rows.forEach(function(r, i) {
    var tr = document.createElement('tr');

    var tdName = document.createElement('td');
    tdName.className = 'nm';
    var inpName = document.createElement('input');
    inpName.type = 'text';
    inpName.className = 'ev-name';
    inpName.value = r.name;
    inpName.placeholder = 'VAR_NAME';
    inpName.dataset.idx = String(i);
    tdName.appendChild(inpName);

    var tdVal = document.createElement('td');
    tdVal.className = 'vl';
    var inpVal = document.createElement('input');
    inpVal.type = r.name === 'ANTHROPIC_AUTH_TOKEN' ? 'password' : 'text';
    inpVal.className = 'ev-value';
    inpVal.value = r.value;
    inpVal.dataset.idx = String(i);
    tdVal.appendChild(inpVal);

    var tdDel = document.createElement('td');
    tdDel.className = 'act';
    var btnDel = document.createElement('button');
    btnDel.className = 'rbtn del';
    btnDel.textContent = '✕';
    btnDel.title = 'Remove';
    btnDel.dataset.idx = String(i);
    tdDel.appendChild(btnDel);

    tr.appendChild(tdName);
    tr.appendChild(tdVal);
    tr.appendChild(tdDel);
    body.appendChild(tr);
  });
}

// ── Collect form data ────────────────────────────────────
function collect() {
  var names = document.querySelectorAll('.ev-name');
  var values = document.querySelectorAll('.ev-value');
  var result = [];
  for (var i = 0; i < names.length; i++) {
    var n = names[i].value.trim();
    if (n) result.push({ name: n, value: values[i].value });
  }
  return result;
}

// ── Load profile into form ───────────────────────────────
function loadProfile(profile) {
  currentProfileName = profile.name;
  originalProfileName = profile.name;
  document.getElementById('profileName').value = profile.name;
  rows = profile.envVars.map(function(ev) {
    return { name: ev.name, value: ev.value };
  });
  renderTable();
  document.getElementById('deleteBtn').disabled = false;
  var isActive = profile.name === activeProfileName;
  document.getElementById('activateBtn').disabled = isActive;
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('editorContent').classList.add('visible');
  rebuildSidebar(profile.name);
  updateBadge();
}

// ── Default template vars ────────────────────────────────
function defaultVars() {
  return [
    { name: 'ANTHROPIC_BASE_URL', value: '' },
    { name: 'ANTHROPIC_AUTH_TOKEN', value: '' },
    { name: 'ANTHROPIC_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_OPUS_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_SONNET_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', value: '' },
  ];
}

// ── Rebuild profile list in sidebar ──────────────────────
function rebuildSidebar(keepName) {
  var list = document.getElementById('profileList');
  list.textContent = '';
  profiles.forEach(function(p) {
    var div = document.createElement('div');
    div.className = 'profile-item' + (p.name === keepName ? ' active' : '');
    div.dataset.name = p.name;
    var dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = p.name === activeProfileName ? '●' : '○';
    div.appendChild(dot);
    div.appendChild(document.createTextNode(p.name));
    list.appendChild(div);
  });
}

// ── Update active badge ──────────────────────────────────
function updateBadge() {
  var b = document.getElementById('activeBadge');
  var isActive = activeProfileName && currentProfileName === activeProfileName;
  if (isActive) {
    b.textContent = '● Active';
    b.title = 'This profile is currently active';
    b.className = 'active-pill';
  } else {
    b.textContent = 'Not active';
    b.title = 'Click Activate to switch to this profile';
    b.className = 'active-pill inactive';
  }
}

// ── Handle init from extension ───────────────────────────
function handleInit(data) {
  profiles = data.profiles || [];
  activeProfileName = data.activeProfileName;
  updateBadge();

  // Preserve current selection if still valid
  var keepName = currentProfileName;
  if (keepName && profiles.every(function(p) { return p.name !== keepName; })) {
    // currently selected profile was deleted
    keepName = activeProfileName || (profiles.length > 0 ? profiles[0].name : '');
  }
  rebuildSidebar(keepName);

  if (keepName) {
    var p = profiles.find(function(p) { return p.name === keepName; });
    if (p) loadProfile(p);
  } else if (profiles.length > 0) {
    var first = activeProfileName
      ? profiles.find(function(p) { return p.name === activeProfileName; })
      : profiles[0];
    if (first) loadProfile(first);
  } else {
    clearForm();
  }
}

// ── Clear the form ───────────────────────────────────────
function clearForm() {
  currentProfileName = '';
  originalProfileName = '';
  document.getElementById('profileName').value = '';
  rows = defaultVars();
  renderTable();
  document.getElementById('deleteBtn').disabled = true;
  document.getElementById('activateBtn').disabled = true;
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('editorContent').classList.remove('visible');
  rebuildSidebar('');
}

// ── Event: messages from extension ───────────────────────
window.addEventListener('message', function(e) {
  var msg = e.data;
  if (msg.command === 'init') {
    handleInit(msg);
  }
});

// ── Event: sidebar profile click ─────────────────────────
document.getElementById('profileList').addEventListener('click', function(e) {
  var el = /** @type {HTMLElement} */ (e.target);
  var item = el.closest('.profile-item');
  if (!item) return;
  var name = item.dataset.name;
  var p = profiles.find(function(p) { return p.name === name; });
  if (p) loadProfile(p);
});

// ── Event: + New Profile button ──────────────────────────
document.getElementById('newBtn').addEventListener('click', function() {
  clearForm();
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('editorContent').classList.add('visible');
  document.getElementById('profileName').focus();
});

// ── Event: Delete button ─────────────────────────────────
document.getElementById('deleteBtn').addEventListener('click', function() {
  if (!currentProfileName) return;
  vscode.postMessage({ command: 'delete', profileName: currentProfileName });
});

// ── Event: Env table input changes ───────────────────────
document.getElementById('envBody').addEventListener('input', function(e) {
  var el = /** @type {HTMLInputElement} */ (e.target);
  var idx = parseInt(el.dataset.idx);
  if (isNaN(idx) || !rows[idx]) return;
  rows[idx][el.classList.contains('ev-name') ? 'name' : 'value'] = el.value;
});

// ── Event: Env table delete row ──────────────────────────
document.getElementById('envBody').addEventListener('click', function(e) {
  var btn = /** @type {HTMLElement} */ (e.target);
  if (!btn.classList.contains('del')) return;
  var idx = parseInt(btn.dataset.idx);
  rows.splice(idx, 1);
  renderTable();
});

// ── Event: Add variable row ──────────────────────────────
document.getElementById('addRow').addEventListener('click', function() {
  rows.push({ name: '', value: '' });
  renderTable();
});

// ── Event: Parse from bash snippet ───────────────────────
document.getElementById('importBtn').addEventListener('click', function() {
  var text = document.getElementById('importArea').value;
  if (!text.trim()) return;
  var lines = text.split(/\r?\n/);
  lines.forEach(function(line) {
    var trimmed = line.trim();
    if (!trimmed) return;
    var m = trimmed.match(/^(?:export\s+)?(\w+)=(.+)$/);
    if (!m) return;
    var found = false;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].name === m[1]) {
        rows[i].value = m[2];
        found = true;
        break;
      }
    }
    if (!found) rows.push({ name: m[1], value: m[2] });
  });
  document.getElementById('importArea').value = '';
  renderTable();
});

// ── Event: Save ──────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', function() {
  var name = document.getElementById('profileName').value.trim();
  if (!name) { document.getElementById('profileName').focus(); return; }
  var msg = { command: 'save', profile: { name: name, envVars: collect() }, oldName: originalProfileName };
  vscode.postMessage(msg);
});

// ── Event: Activate ──────────────────────────────────────
document.getElementById('activateBtn').addEventListener('click', function() {
  if (!currentProfileName) return;
  vscode.postMessage({ command: 'activate', profileName: currentProfileName });
});

// ── Start: tell extension we're ready ────────────────────
renderTable();
vscode.postMessage({ command: 'ready' });
