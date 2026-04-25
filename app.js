import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, deleteDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, uploadString, getBlob } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZXXBcEnn5YjURWupDLZt4p0ljGZvsKb0",
  authDomain: "mc-server-planer.firebaseapp.com",
  projectId: "mc-server-planer",
  storageBucket: "mc-server-planer.firebasestorage.app",
  messagingSenderId: "1077187026071",
  appId: "1:1077187026071:web:0b98377f91773aba815dd2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Globale Listen
let allRanks = [], allGUIs = [], allCrates = [], allShop = [], allAds = [], allPlugins = [], allBroadcasts = [];
let allQuestBatches = [], allHolograms = [], allEvents = [];

let editingRankId = null, editingPluginId = null, editingShopId = null, editingEventId = null;
let listenersActive = false; 

// Toggle States
window.crateCollapsed = {}; window.crateSortModes = {}; window.pluginCollapsed = {}; window.adCollapsed = {}; window.guiCollapsed = {}; window.questCollapsed = {}; window.holoCollapsed = {};
let draggedCrateBox = null; window.dragDropActive = false;

// Dark Mode Toggle
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') { document.body.classList.add('dark-mode'); }
document.getElementById('btn-darkmode').addEventListener('click', () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); });

async function uploadImage(file, folderPath) {
    if (!file) return null;
    const storageRef = ref(storage, `${folderPath}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        if (!listenersActive) { startRealtimeListeners(); listenersActive = true; }
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value; const password = document.getElementById('login-password').value; const errorText = document.getElementById('login-error');
    if(!email || !password) return errorText.innerText = "Bitte beides ausfüllen!"; errorText.innerText = "Logge ein..."; errorText.style.color = "var(--text-muted)";
    try { await signInWithEmailAndPassword(auth, email, password); errorText.innerText = ""; } catch (error) { errorText.style.color = "var(--danger)"; errorText.innerText = "Falsche E-Mail oder Passwort!"; }
});

document.getElementById('btn-logout').addEventListener('click', () => { signOut(auth); });

document.querySelectorAll('.nav-item:not(#btn-logout):not(#btn-darkmode)').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.querySelectorAll('.category-section').forEach(sec => sec.classList.remove('active')); document.getElementById(targetId).classList.add('active');
        if(targetId === 'gui-editor') { setTimeout(() => { initEditor(); if(window.resizeCanvas) window.resizeCanvas(); }, 100); }
        if(targetId === 'menu-planner') { setTimeout(() => { if(window.initMenuPlanner) window.initMenuPlanner(); }, 100); }
    });
});

function updateDashboard() {
    if(document.getElementById('stat-ranks')) document.getElementById('stat-ranks').innerText = allRanks.length;
    if(document.getElementById('stat-crates')) document.getElementById('stat-crates').innerText = allCrates.length;
    if(document.getElementById('stat-plugins')) document.getElementById('stat-plugins').innerText = allPlugins.length;
    if(document.getElementById('stat-shop')) document.getElementById('stat-shop').innerText = allShop.length;
    if(document.getElementById('stat-guis')) document.getElementById('stat-guis').innerText = allGUIs.length; 
    if(document.getElementById('stat-events')) document.getElementById('stat-events').innerText = allEvents.length;
    let questCount = 0; allQuestBatches.forEach(b => { questCount += (b.quests || []).length; });
    if(document.getElementById('stat-quests')) document.getElementById('stat-quests').innerText = questCount; 
    if(document.getElementById('stat-holograms')) document.getElementById('stat-holograms').innerText = allHolograms.length; 
}

window.checkServerStatus = async function() {
    const ip = document.getElementById('server-ip').value; const resDiv = document.getElementById('server-status-result');
    if(!ip) return alert("Bitte eine Minecraft-Server IP eingeben!"); resDiv.style.display = 'block'; resDiv.innerHTML = "<span style='color: var(--text-muted);'>📡 Pinge Server an... Bitte warten.</span>";
    try {
        const response = await fetch('https://api.mcsrvstat.us/3/' + ip); const data = await response.json();
        if(data.online) {
            let iconHtml = data.icon ? `<img src="${data.icon}" style="width:64px; height:64px; border-radius:8px; border: 2px solid var(--border-color);">` : `<div style="width:64px; height:64px; background:#444; border-radius:8px;"></div>`;
            resDiv.innerHTML = `<div style="display:flex; align-items:center; gap: 20px;">${iconHtml}<div><div style="color: #4CAF50; font-weight:bold; font-size:18px; margin-bottom: 5px;">🟢 ONLINE</div><div style="font-size: 14px;"><strong>Spieler:</strong> ${data.players.online} / ${data.players.max}</div><div style="font-size: 14px; color: var(--text-muted);"><strong>Version:</strong> ${data.version}</div></div></div>`;
        } else { resDiv.innerHTML = `<div style="color:var(--danger); font-weight:bold; font-size:16px;">🔴 OFFLINE (oder nicht erreichbar)</div>`; }
    } catch(e) { resDiv.innerHTML = "<span style='color:var(--danger);'>❌ Fehler beim Abrufen der API.</span>"; }
}

window.deleteEntry = async (collectionName, id) => { if(confirm('Wirklich komplett löschen?')) { await deleteDoc(doc(db, collectionName, id)); } };

function startRealtimeListeners() {
    // EVENTS
    onSnapshot(collection(db, "events"), (snap) => {
        allEvents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allEvents.sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
        const container = document.getElementById('events-container'); if(!container) return; container.innerHTML = '';
        allEvents.forEach(ev => {
            const dateObj = new Date(ev.date); const formattedDate = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            container.innerHTML += `<div class="event-card"><div class="event-card-date">📅 ${formattedDate} ${ev.time ? '- ' + ev.time + ' Uhr' : ''}</div><div style="margin-top: 25px; margin-bottom: 10px;"><h3 style="margin: 0; font-size: 18px;">${ev.name}</h3></div><p style="font-size: 13px; color: var(--text-muted); flex-grow: 1;">${ev.description || 'Keine Beschreibung'}</p><div class="button-group" style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 10px;"><button class="btn btn-secondary btn-sm" onclick="window.editEvent('${ev.id}')">✏️ Bearbeiten</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('events', '${ev.id}')">🗑️ Löschen</button></div></div>`;
        });
        updateDashboard();
    });

    // BROADCASTER
    onSnapshot(collection(db, "broadcasts"), (snap) => {
        allBroadcasts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('bc-list'); if(!list) return; list.innerHTML = '';
        allBroadcasts.forEach(bc => {
            let formattedMsg = window.formatMcText(bc.message);
            list.innerHTML += `<tr><td><div style="font-size: 11px; color: #888; margin-bottom: 4px;">Original: <span style="font-family:monospace;">${bc.message}</span></div><div class="mc-preview-box" style="padding: 8px; font-size: 13px;">${formattedMsg}</div></td><td style="vertical-align: middle;">Alle ${bc.interval} Sek.</td><td style="text-align: right; vertical-align: middle;"><button class="btn btn-secondary btn-sm" onclick="window.editBroadcast('${bc.id}')">✏️ Bearbeiten</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('broadcasts', '${bc.id}')">🗑️ Löschen</button></td></tr>`;
        });
    });

    // RÄNGE
    onSnapshot(collection(db, "ranks"), (snap) => {
        let rawRanks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let sorted = [], visited = new Set(), baseRanks = rawRanks.filter(r => !r.inherits_from);
        function addC(pn) { rawRanks.filter(r => r.inherits_from === pn).forEach(c => { if (!visited.has(c.id)) { visited.add(c.id); sorted.push(c); addC(c.name); } }); }
        baseRanks.forEach(br => { if (!visited.has(br.id)) { visited.add(br.id); sorted.push(br); addC(br.name); } });
        rawRanks.forEach(r => { if (!visited.has(r.id)) sorted.push(r); }); allRanks = sorted;

        const list = document.getElementById('rank-list'); if(list) list.innerHTML = '';
        allRanks.forEach(rank => {
            const myPerms = rank.permissions || []; const parentRank = rank.inherits_from ? allRanks.find(r => r.name === rank.inherits_from) : null; const inherited = parentRank ? (parentRank.permissions || []) : [];
            let permsHtml = myPerms.map(p => `<span class="perm-badge">${p}</span>`).join('') + inherited.map(p => `<span class="perm-badge perm-inherited">${p}</span>`).join('');
            let imgHtml = rank.image_url ? `<img src="${rank.image_url}" class="thumbnail">` : '<div class="thumbnail"></div>';
            let indent = rank.inherits_from ? '<span style="color:#9ca3af; margin-right:5px;">↳</span>' : '';
            if(list) list.innerHTML += `<tr><td>${imgHtml}</td><td><strong>${indent}${rank.name}</strong></td><td>${rank.inherits_from || '-'}</td><td>${permsHtml || '-'}</td><td class="action-cell"><button class="btn btn-secondary btn-sm" onclick="window.editRank('${rank.id}')">Bearbeiten</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('ranks', '${rank.id}')">Löschen</button></td></tr>`;
        });
        const dropdown = document.getElementById('rank-inherit'); if(dropdown) dropdown.innerHTML = '<option value="">Erbt von... (Keiner)</option>';
        allRanks.forEach(r => { if(r.id !== editingRankId && dropdown) { dropdown.innerHTML += `<option value="${r.name}">${r.name}</option>`; } });
        if(editingRankId && dropdown) { const currentEdit = allRanks.find(r => r.id === editingRankId); if(currentEdit) document.getElementById('rank-inherit').value = currentEdit.inherits_from || ''; }
        updateDashboard();
    });

    // PLUGINS
    onSnapshot(collection(db, "plugins"), (snap) => {
        allPlugins = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('plugins-container'); if(!container) return; container.innerHTML = '';
        allPlugins.forEach(plugin => { 
            let permsText = plugin.perms || plugin.info || '-'; let settingsHtml = '';
            if (plugin.settingsType === 'daily') {
                settingsHtml = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-top:5px;">`;
                (plugin.dailyRewards || []).forEach((req, idx) => { settingsHtml += `<div style="background:var(--bg-color); padding:4px 8px; border-radius:4px; font-size:12px; border:1px solid var(--border-color);"><strong>Tag ${idx+1}:</strong> ${req}</div>`; });
                settingsHtml += `</div>`;
            } else { settingsHtml = `<div style="white-space:pre-wrap; font-size:13px; margin-top:5px;">${plugin.settingsText || '-'}</div>`; }

            let isCollapsed = window.pluginCollapsed[plugin.id] !== false; let displayStyle = isCollapsed ? 'none' : 'block'; let iconText = isCollapsed ? '▶️' : '🔽';

            container.innerHTML += `<div class="crate-box"><div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.togglePlugin('${plugin.id}')"><div class="crate-header-left"><span id="plugin-icon-${plugin.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span><h3 style="font-size: 18px; margin: 0;">${plugin.name}</h3></div><div class="button-group" onclick="event.stopPropagation()"><button class="btn btn-secondary btn-sm" onclick="window.editPlugin('${plugin.id}')">✏️ Bearbeiten</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('plugins', '${plugin.id}')">🗑️ Löschen</button></div></div><div id="plugin-content-${plugin.id}" style="display: ${displayStyle}; margin-top: 15px;"><div style="margin-bottom: 15px;"><h4 style="font-size: 13px; color: var(--text-muted); margin-bottom: 5px;">Permissions / Commands:</h4><div style="font-size:13px; white-space:pre-wrap; background: var(--bg-color); padding: 10px; border-radius: 4px; border: 1px solid var(--border-color);">${permsText}</div></div><div><h4 style="font-size: 13px; color: var(--text-muted); margin-bottom: 5px;">Einstellungen:</h4>${settingsHtml}</div></div></div>`; 
        });
        updateDashboard();
    });

    // KISTEN
    onSnapshot(collection(db, "crates"), (snap) => {
        allCrates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCrates.sort((a, b) => (a.order || 0) - (b.order || 0)); 
        window.renderCrates(); 
        updateDashboard();
    });

    // SHOP
    onSnapshot(collection(db, "shop"), (snap) => {
        allShop = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('shop-list'); if(!list) return; list.innerHTML = '';
        allShop.forEach(item => { 
            let imgHtml = item.image_url ? `<img src="${item.image_url}" class="thumbnail">` : '<div class="thumbnail"></div>'; 
            list.innerHTML += `<tr><td>${imgHtml}</td><td><strong>${item.name}</strong></td><td>${item.price} Pkt.</td><td style="text-align: right;"><button class="btn btn-secondary btn-sm" onclick="window.editShopItem('${item.id}')">✏️ Bearbeiten</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('shop', '${item.id}')">🗑️ Löschen</button></td></tr>`; 
        });
        updateDashboard();
    });

    // WERBUNG KAMPAGNEN
    onSnapshot(collection(db, "ads"), (snap) => {
        allAds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('ad-campaigns-container'); if(!container) return; container.innerHTML = '';
        allAds.forEach(camp => {
            let itemsHtml = (camp.items || []).map(item => {
                let linkHtml = item.link ? `<a href="${item.link}" target="_blank" style="font-size:12px; display:block; margin-bottom:10px; color:#00BCD4;">Link öffnen</a>` : '';
                return `<div class="gui-card"><div class="gui-card-header"><span>${item.title}</span><div><button class="btn btn-danger btn-sm" onclick="window.deleteAdItem('${camp.id}', '${item.id}')">Löschen</button></div></div>${linkHtml}<img src="${item.image_url}" alt="${item.title}"></div>`;
            }).join('');
            let isCollapsed = window.adCollapsed[camp.id] !== false; let displayStyle = isCollapsed ? 'none' : 'block'; let iconText = isCollapsed ? '▶️' : '🔽';
            container.innerHTML += `<div class="crate-box"><div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.toggleAdCampaign('${camp.id}')"><div class="crate-header-left"><span id="ad-icon-${camp.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span><h3 style="font-size: 18px; margin: 0;">${camp.name || 'Unbenannte Kampagne'}</h3></div><div class="button-group" onclick="event.stopPropagation()"><button class="btn btn-primary btn-sm" onclick="window.openAdUploadModal('${camp.id}')">🖼️ Werbung hinzufügen</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('ads', '${camp.id}')">Kampagne löschen</button></div></div><div id="ad-content-${camp.id}" style="display: ${displayStyle}; margin-top: 15px;">${(camp.items && camp.items.length > 0) ? `<div class="gui-grid">${itemsHtml}</div>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Werbungen in dieser Kampagne.</p>'}</div></div>`;
        });
    });

    // QUESTS BATCHES
    onSnapshot(collection(db, "quest_batches"), (snap) => {
        allQuestBatches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('quest-batches-container'); if(!container) return; container.innerHTML = '';
        allQuestBatches.forEach(batch => {
            let questsHtml = (batch.quests || []).map(quest => {
                let tasksHtml = (quest.tasks || []).map(task => {
                    let typeText = task.type; if(task.type === 'FARMING') typeText = '⛏️ Abbauen'; if(task.type === 'CRAFTING') typeText = '🛠️ Craften'; if(task.type === 'KILL_MOB') typeText = '🧟 Mob töten'; if(task.type === 'KILL_PLAYER') typeText = '⚔️ Spieler töten';
                    return `<tr><td><span class="perm-badge">${typeText}</span></td><td><strong>${task.target}</strong></td><td>${task.amount}x</td><td style="text-align: right;"><button class="btn btn-danger btn-sm" onclick="window.deleteQuestTask('${batch.id}', '${quest.id}', '${task.id}')">Löschen</button></td></tr>`;
                }).join('');
                return `<div style="background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 6px; padding: 15px; margin-bottom: 15px;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;"><h4 style="margin:0; font-size:16px;">${quest.name}</h4><div class="button-group"><button class="btn btn-primary btn-sm" onclick="window.openQuestTaskModal('${batch.id}', '${quest.id}')">+ Aufgabe</button><button class="btn btn-secondary btn-sm" onclick="window.editQuest('${batch.id}', '${quest.id}')">✏️ Bearbeiten</button><button class="btn btn-danger btn-sm" onclick="window.deleteQuest('${batch.id}', '${quest.id}')">🗑️ Löschen</button></div></div><p style="font-size:13px; color:var(--text-muted); margin-bottom:5px;"><strong>Beschreibung:</strong> ${window.formatMcText(quest.desc || '-')}</p><p style="font-size:13px; color:var(--text-muted); margin-bottom:15px;"><strong>Belohnung:</strong> ${quest.reward || '-'}</p>${(quest.tasks && quest.tasks.length > 0) ? `<table class="crate-items-table" style="background: var(--bg-color);"><thead><tr><th style="width: 120px;">Typ</th><th>Ziel</th><th>Anzahl</th><th style="text-align: right;">Aktion</th></tr></thead><tbody>${tasksHtml}</tbody></table>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Aufgaben.</p>'}</div>`;
            }).join('');
            let isCollapsed = window.questCollapsed[batch.id] !== false; let displayStyle = isCollapsed ? 'none' : 'block'; let iconText = isCollapsed ? '▶️' : '🔽';
            container.innerHTML += `<div class="crate-box"><div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.toggleQuestBatch('${batch.id}')"><div class="crate-header-left"><span id="quest-icon-${batch.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span><h3 style="font-size: 18px; margin: 0;">${batch.name}</h3></div><div class="button-group" onclick="event.stopPropagation()"><button class="btn btn-info btn-sm" onclick="window.exportQuestYaml('${batch.id}')">📥 Quest Export</button><button class="btn btn-primary btn-sm" onclick="window.openQuestModal('${batch.id}')">+ Quest erstellen</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('quest_batches', '${batch.id}')">Batch löschen</button></div></div><div id="quest-content-${batch.id}" style="display: ${displayStyle}; margin-top: 15px; padding: 15px; background: var(--bg-color); border-radius: 8px;">${(batch.quests && batch.quests.length > 0) ? questsHtml : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Quests in diesem Batch.</p>'}</div></div>`;
        });
        updateDashboard();
    });

    // HOLOGRAMME
    onSnapshot(collection(db, "holograms"), (snap) => {
        allHolograms = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('holograms-container'); if(!container) return; container.innerHTML = '';
        allHolograms.forEach(holo => {
            let linesPreviewHtml = ''; let linesTableHtml = '';
            (holo.lines || []).forEach(line => {
                if(line.type === 'item') { linesPreviewHtml += `<div class="holo-item">💎</div><div style="font-size:10px; color:#aaa; margin-top:-5px;">[ITEM: ${line.content}]</div>`; } else { linesPreviewHtml += `<div class="holo-line">${window.formatMcText(line.content)}</div>`; }
                let typeBadge = line.type === 'item' ? '💎 Item' : '📝 Text'; linesTableHtml += `<tr><td><span class="perm-badge">${typeBadge}</span></td><td>${line.content}</td><td style="text-align: right;"><button class="btn btn-danger btn-sm" onclick="window.deleteHoloLine('${holo.id}', '${line.id}')">Löschen</button></td></tr>`;
            });
            let isCollapsed = window.holoCollapsed[holo.id] !== false; let displayStyle = isCollapsed ? 'none' : 'flex'; let iconText = isCollapsed ? '▶️' : '🔽';
            container.innerHTML += `<div class="crate-box"><div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.toggleHolo('${holo.id}')"><div class="crate-header-left"><span id="holo-icon-${holo.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span><h3 style="font-size: 18px; margin: 0;">${holo.name}</h3></div><div class="button-group" onclick="event.stopPropagation()"><button class="btn btn-info btn-sm" onclick="window.exportHoloYaml('${holo.id}')">📥 DH Export</button><button class="btn btn-primary btn-sm" onclick="window.openHoloLineModal('${holo.id}')">+ Zeile</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('holograms', '${holo.id}')">Holo löschen</button></div></div><div id="holo-content-${holo.id}" style="display: ${displayStyle}; margin-top: 15px; gap: 20px;"><div style="flex: 1;"><p style="font-size:13px; color:var(--text-muted); margin-bottom:10px;"><strong>Location:</strong> ${holo.location || '-'}</p>${(holo.lines && holo.lines.length > 0) ? `<table class="crate-items-table"><thead><tr><th style="width: 100px;">Typ</th><th>Inhalt</th><th style="text-align: right;">Aktion</th></tr></thead><tbody>${linesTableHtml}</tbody></table>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Zeilen. Klicke auf "+ Zeile".</p>'}</div><div style="width: 250px; flex-shrink: 0;"><h4 style="font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">In-Game Vorschau:</h4><div class="holo-preview-container">${linesPreviewHtml || '<span style="color:#555;">Leer</span>'}</div></div></div></div>`;
        });
        updateDashboard();
    });

    // GUI PAKETE
    onSnapshot(collection(db, "guis"), (snap) => {
        allGUIs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('gui-packages-container');
        const editorSelect = document.getElementById('editor-pkg-select'); const plannerSelect = document.getElementById('planner-pkg-select'); const plannerBgSelect = document.getElementById('planner-bg-select');
        if(!container) return; container.innerHTML = '';
        
        const currentEditorVal = editorSelect ? editorSelect.value : ''; const currentPlannerVal = plannerSelect ? plannerSelect.value : ''; const currentBgVal = plannerBgSelect ? plannerBgSelect.value : '';
        if(editorSelect) editorSelect.innerHTML = '<option value="">Ziel-Paket wählen...</option>'; if(plannerSelect) plannerSelect.innerHTML = '<option value="">Ziel-Paket wählen...</option>'; if(plannerBgSelect) plannerBgSelect.innerHTML = '<option value="">Kein Bild (Nur Grid)</option>';

        allGUIs.forEach(pkg => {
            if(editorSelect) editorSelect.innerHTML += `<option value="${pkg.id}">${pkg.name}</option>`; if(plannerSelect) plannerSelect.innerHTML += `<option value="${pkg.id}">${pkg.name}</option>`;
            let items = pkg.items || [];
            let itemsHtml = items.map(item => {
                if (plannerBgSelect && item.type !== 'layout' && item.image_url) { plannerBgSelect.innerHTML += `<option value="${item.image_url}">${pkg.name} - ${item.name}</option>`; }
                if (item.type === 'layout') { return `<div class="gui-card"><div class="gui-card-header"><span>${item.name}</span><div><button class="btn btn-secondary btn-sm" onclick="window.editLayoutInPlanner('${pkg.id}', '${item.id}')" title="Im Planer bearbeiten">✏️</button><button class="btn btn-danger btn-sm" onclick="window.deleteGuiItem('${pkg.id}', '${item.id}')">Löschen</button></div></div><div style="width:100%; height:120px; background:#1e1e1e; border: 2px solid #555; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-direction: column;"><span style="font-size: 30px; margin-bottom: 10px;">📋</span><span style="color:#4CAF50; font-size:12px; font-weight:bold;">Menü Layout (${item.rows} Reihen)</span></div></div>`; } 
                else { return `<div class="gui-card"><div class="gui-card-header"><span>${item.name}</span><div><button class="btn btn-secondary btn-sm" onclick="window.editGuiItemInEditor('${pkg.id}', '${item.id}')" title="Im Editor bearbeiten">✏️</button><button class="btn btn-danger btn-sm" onclick="window.deleteGuiItem('${pkg.id}', '${item.id}')">Löschen</button></div></div><img src="${item.image_url}" alt="${item.name}"></div>`; }
            }).join('');

            let isCollapsed = window.guiCollapsed[pkg.id] !== false; let displayStyle = isCollapsed ? 'none' : 'block'; let iconText = isCollapsed ? '▶️' : '🔽';

            container.innerHTML += `<div class="crate-box"><div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.toggleGuiPackage('${pkg.id}')"><div class="crate-header-left"><span id="gui-icon-${pkg.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span><h3 style="font-size: 18px; margin: 0;">${pkg.name}</h3></div><div class="button-group" onclick="event.stopPropagation()"><button class="btn btn-info btn-sm" onclick="window.openMenuPlannerForPkg('${pkg.id}')">📋 Menü planen</button><button class="btn btn-secondary btn-sm" onclick="window.openGuiEditorForPkg('${pkg.id}')">🖌️ Pixel Editor</button><button class="btn btn-primary btn-sm" onclick="window.openGuiUploadModal('${pkg.id}')">🖼️ Upload</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('guis', '${pkg.id}')">Paket löschen</button></div></div><div id="gui-content-${pkg.id}" style="display: ${displayStyle}; margin-top: 15px;">${items.length > 0 ? `<div class="gui-grid">${itemsHtml}</div>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine GUIs in diesem Paket.</p>'}</div></div>`;
        });
        if(editorSelect && currentEditorVal) editorSelect.value = currentEditorVal; if(plannerSelect && currentPlannerVal) plannerSelect.value = currentPlannerVal; if(plannerBgSelect && currentBgVal) plannerBgSelect.value = currentBgVal;
        updateDashboard();
    });
}

// ==========================================
// ALLGEMEINE TOGGLE FUNKTIONEN
// ==========================================
window.toggleGuiPackage = (id) => { window.guiCollapsed[id] = window.guiCollapsed[id] === false ? true : false; const content = document.getElementById(`gui-content-${id}`); const icon = document.getElementById(`gui-icon-${id}`); const header = content.previousElementSibling; if (window.guiCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } else { content.style.display = 'block'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; } };
window.togglePlugin = (id) => { window.pluginCollapsed[id] = window.pluginCollapsed[id] === false ? true : false; const content = document.getElementById(`plugin-content-${id}`); const icon = document.getElementById(`plugin-icon-${id}`); const header = content.previousElementSibling; if (window.pluginCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } else { content.style.display = 'block'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; } };
window.toggleAdCampaign = (id) => { window.adCollapsed[id] = window.adCollapsed[id] === false ? true : false; const content = document.getElementById(`ad-content-${id}`); const icon = document.getElementById(`ad-icon-${id}`); const header = content.previousElementSibling; if (window.adCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } else { content.style.display = 'block'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; } };
window.toggleQuestBatch = (id) => { window.questCollapsed[id] = window.questCollapsed[id] === false ? true : false; const content = document.getElementById(`quest-content-${id}`); const icon = document.getElementById(`quest-icon-${id}`); const header = content.previousElementSibling; if (window.questCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } else { content.style.display = 'block'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; } };
window.toggleHolo = (id) => { window.holoCollapsed[id] = window.holoCollapsed[id] === false ? true : false; const content = document.getElementById(`holo-content-${id}`); const icon = document.getElementById(`holo-icon-${id}`); const header = content.previousElementSibling; if (window.holoCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } else { content.style.display = 'flex'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; } };


// ==========================================
// EVENTS LOGIK
// ==========================================
window.resetEventForm = () => { editingEventId = null; document.getElementById('event-form-title').innerText = "Neues Event eintragen"; document.getElementById('btn-save-event').innerText = "Event speichern"; document.getElementById('btn-cancel-event').style.display = "none"; document.getElementById('event-name').value = ''; document.getElementById('event-date').value = ''; document.getElementById('event-time').value = ''; document.getElementById('event-desc').value = ''; };
window.editEvent = (id) => { const ev = allEvents.find(e => e.id === id); if(!ev) return; editingEventId = id; document.getElementById('event-form-title').innerText = "Event bearbeiten: " + ev.name; document.getElementById('event-name').value = ev.name; document.getElementById('event-date').value = ev.date; document.getElementById('event-time').value = ev.time || ''; document.getElementById('event-desc').value = ev.description || ''; document.getElementById('btn-save-event').innerText = "Änderungen speichern"; document.getElementById('btn-cancel-event').style.display = "inline-block"; window.scrollTo({ top: 0, behavior: 'smooth' }); };
document.getElementById('btn-save-event').addEventListener('click', async () => { const name = document.getElementById('event-name').value; const date = document.getElementById('event-date').value; const time = document.getElementById('event-time').value; const desc = document.getElementById('event-desc').value; if(!name || !date) return alert("Name und Datum sind Pflichtfelder!"); document.getElementById('event-status').innerText = "Speichere..."; const eventData = { name, date, time, description: desc }; try { if(editingEventId) { await updateDoc(doc(db, "events", editingEventId), eventData); } else { await addDoc(collection(db, "events"), eventData); } document.getElementById('event-status').innerText = "Erfolgreich!"; setTimeout(() => document.getElementById('event-status').innerText = "", 2000); window.resetEventForm(); } catch(e) { console.error(e); alert("Fehler beim Speichern!"); } });

// ==========================================
// RÄNGE LOGIK
// ==========================================
document.getElementById('btn-save-rank').addEventListener('click', async () => { const name = document.getElementById('rank-name').value; const perms = document.getElementById('rank-perms').value.split('\n').map(p => p.trim()).filter(p => p !== ""); const inherits = document.getElementById('rank-inherit').value; const file = document.getElementById('rank-image').files[0]; const status = document.getElementById('rank-status'); if(!name) return alert("Name fehlt!"); status.innerText = "Speichere..."; const rankData = { name: name, permissions: perms, inherits_from: inherits || null }; if (file) { rankData.image_url = await uploadImage(file, 'ranks'); } if (editingRankId) { await updateDoc(doc(db, "ranks", editingRankId), rankData); } else { await addDoc(collection(db, "ranks"), rankData); } status.innerText = "Gespeichert!"; setTimeout(() => status.innerText = "", 2000); editingRankId = null; document.getElementById('rank-form-title').innerText = "Neuen Rang erstellen"; document.getElementById('btn-save-rank').innerText = "Rang speichern"; document.getElementById('btn-cancel-rank').style.display = "none"; document.getElementById('rank-name').value = ''; document.getElementById('rank-perms').value = ''; document.getElementById('rank-inherit').value = ''; if(document.getElementById('rank-image')) document.getElementById('rank-image').value = ''; });
window.editRank = (id) => { const rank = allRanks.find(r => r.id === id); if (!rank) return; editingRankId = id; document.getElementById('rank-name').value = rank.name; document.getElementById('rank-perms').value = (rank.permissions || []).join('\n'); document.getElementById('rank-inherit').value = rank.inherits_from || ''; document.getElementById('rank-form-title').innerText = "Rang bearbeiten: " + rank.name; document.getElementById('btn-save-rank').innerText = "Änderungen speichern"; document.getElementById('btn-cancel-rank').style.display = "inline-block"; window.scrollTo({ top: 0, behavior: 'smooth' }); };
document.getElementById('btn-cancel-rank').addEventListener('click', () => { editingRankId = null; document.getElementById('rank-form-title').innerText = "Neuen Rang erstellen"; document.getElementById('btn-save-rank').innerText = "Rang speichern"; document.getElementById('btn-cancel-rank').style.display = "none"; document.getElementById('rank-name').value = ''; document.getElementById('rank-perms').value = ''; document.getElementById('rank-inherit').value = ''; if(document.getElementById('rank-image')) document.getElementById('rank-image').value = '';});
document.getElementById('btn-export-ranks').addEventListener('click', () => { if(allRanks.length === 0) return alert("Keine Ränge!"); let yamlContent = "groups:\n"; allRanks.forEach(rank => { const safeName = rank.name.toLowerCase().replace(/[^a-z0-9_-]/g, ''); yamlContent += `  ${safeName}:\n`; if (rank.permissions && rank.permissions.length > 0) { yamlContent += `    permissions:\n`; rank.permissions.forEach(p => { yamlContent += `      - ${p}: true\n`; }); } if (rank.inherits_from) { const safeInherit = rank.inherits_from.toLowerCase().replace(/[^a-z0-9_-]/g, ''); yamlContent += `    parents:\n`; yamlContent += `      - ${safeInherit}\n`; } }); const blob = new Blob([yamlContent], { type: 'text/yaml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'luckperms_ranks.yml'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); });
window.importPluginPerms = () => { if(allPlugins.length === 0) return alert("Es sind noch keine Plugins gespeichert!"); let currentPerms = document.getElementById('rank-perms').value.split('\n').map(p => p.trim()).filter(p => p !== ""); allPlugins.forEach(pl => { let text = pl.perms || pl.info; if(text) { let pluginLines = text.split('\n').map(p => p.trim()).filter(p => p !== ""); currentPerms = currentPerms.concat(pluginLines); } }); let uniquePerms = [...new Set(currentPerms)]; document.getElementById('rank-perms').value = uniquePerms.join('\n'); alert("Permissions erfolgreich importiert!"); };

// ==========================================
// KISTEN LOGIK (MIT UMBENNEN & DRAG DROP)
// ==========================================
window.toggleDragDrop = function() { window.dragDropActive = !window.dragDropActive; const btn = document.getElementById('btn-toggle-drag'); if(window.dragDropActive) { btn.innerText = "🔓 Drag & Drop: AN"; btn.style.borderColor = "#4CAF50"; btn.style.color = "#4CAF50"; } else { btn.innerText = "🔒 Drag & Drop: AUS"; btn.style.borderColor = "var(--border-color)"; btn.style.color = "var(--text-main)"; } window.renderCrates(); };
window.renderCrates = function() {
    const container = document.getElementById('crates-container'); if(!container) return; container.innerHTML = '';
    allCrates.forEach(crate => {
        let items = [...(crate.items || [])]; const sortMode = window.crateSortModes[crate.id] || 'default';
        if (sortMode === 'chance') { items.sort((a, b) => (Number(b.chance) || 0) - (Number(a.chance) || 0)); } else if (sortMode === 'name') { items.sort((a, b) => (a.name || '').localeCompare(b.name || '')); }
        let crateImgHtml = crate.image_url ? `<img src="${crate.image_url}" class="thumbnail" style="width:50px;height:50px;">` : `<div class="thumbnail" style="width:50px;height:50px; display:flex; align-items:center; justify-content:center; font-size:24px;">📦</div>`;
        let itemsHtml = items.map(item => {
            let typeIcon = '📦'; if(item.type === 'money') typeIcon = '<span style="font-size:20px;">💰</span>'; if(item.type === 'perk') typeIcon = '<span style="font-size:20px;">🌟</span>'; if(item.type === 'special') typeIcon = '<span style="font-size:20px;">✨</span>';
            let imgContent = item.image_url ? `<img src="${item.image_url}" class="thumbnail" style="width:30px;height:30px;">` : typeIcon;
            let enchHtml = (item.enchantments && item.enchantments.length > 0) ? `<div style="font-size: 11px; color: #a855f7; margin-top: 4px;">🪄 ${item.enchantments.join(', ')}</div>` : '';
            return `<tr><td style="text-align: center;">${imgContent}</td><td><strong>${item.name}</strong>${enchHtml}</td><td>${item.quantity || 1}x</td><td>${item.chance}%</td><td style="text-align: right;"><button class="btn btn-secondary btn-sm" onclick="window.editCrateItem('${crate.id}', '${item.id}')">✏️ Bearbeiten</button><button class="btn btn-danger btn-sm" onclick="window.deleteCrateItem('${crate.id}', '${item.id}')">🗑️ Löschen</button></td></tr>`;
        }).join('');
        let isCollapsed = window.crateCollapsed[crate.id] !== false; let displayStyle = isCollapsed ? 'none' : 'block'; let iconText = isCollapsed ? '▶️' : '🔽'; let dragAttr = window.dragDropActive ? 'draggable="true"' : '';
        container.innerHTML += `<div class="crate-box" ${dragAttr} data-crate-id="${crate.id}"><div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.toggleCrate('${crate.id}')"><div class="crate-header-left" ${dragAttr} title="${window.dragDropActive ? 'Halten um Kiste zu verschieben' : 'Drag & Drop ist gesperrt'}"><span id="crate-icon-${crate.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span>${crateImgHtml}<h3 style="font-size: 18px; margin: 0;">${crate.name || 'Unbenannte Kiste'}</h3></div><div class="button-group" onclick="event.stopPropagation()"><select onchange="window.changeCrateSort('${crate.id}', this.value)" style="padding: 6px; border-radius: 4px; background: var(--surface-color); color: var(--text-main); border: 1px solid var(--border-color); font-size: 12px; outline: none;"><option value="default" ${sortMode === 'default' ? 'selected' : ''}>Sortierung: Standard</option><option value="chance" ${sortMode === 'chance' ? 'selected' : ''}>Sortierung: Chance</option><option value="name" ${sortMode === 'name' ? 'selected' : ''}>Sortierung: A-Z</option></select><button class="btn btn-secondary btn-sm" style="border-color:#FF9800; color:#FF9800;" onclick="window.simulateCrate('${crate.id}')">🎲 Test-Öffnen</button><button class="btn btn-info btn-sm" onclick="window.exportCrateYaml('${crate.id}')">📥 CrazyCrates Export</button><button class="btn btn-primary btn-sm" onclick="window.openItemModal('${crate.id}')">+ Item</button><button class="btn btn-secondary btn-sm" onclick="window.renameCrate('${crate.id}')">✏️ Name ändern</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('crates', '${crate.id}')">Löschen</button></div></div><div id="crate-content-${crate.id}" style="display: ${displayStyle}; margin-top: 15px;">${items.length > 0 ? `<table class="crate-items-table"><thead><tr><th style="width: 50px;">Art</th><th>Item Name</th><th>Menge</th><th>Chance</th><th style="text-align: right;">Aktion</th></tr></thead><tbody>${itemsHtml}</tbody></table>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Items in dieser Kiste. Klicke auf "+ Item hinzufügen".</p>'}</div></div>`;
    });
    if(window.dragDropActive) {
        const boxes = document.querySelectorAll('.crate-box[data-crate-id]');
        boxes.forEach(box => {
            box.addEventListener('dragstart', function(e) { draggedCrateBox = this; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/html', this.innerHTML); this.style.opacity = '0.4'; });
            box.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag-over'); return false; });
            box.addEventListener('dragleave', function(e) { this.classList.remove('drag-over'); });
            box.addEventListener('drop', function(e) { e.stopPropagation(); this.classList.remove('drag-over'); if (draggedCrateBox !== this) { let parent = this.parentNode; let children = Array.from(parent.children); let srcIndex = children.indexOf(draggedCrateBox); let targetIndex = children.indexOf(this); if (srcIndex < targetIndex) { this.after(draggedCrateBox); } else { this.before(draggedCrateBox); } let newOrderIds = Array.from(parent.children).map(el => el.getAttribute('data-crate-id')).filter(id => id); newOrderIds.forEach((id, index) => { updateDoc(doc(db, "crates", id), { order: index }); }); } return false; });
            box.addEventListener('dragend', function(e) { this.style.opacity = '1'; boxes.forEach(b => b.classList.remove('drag-over')); });
        });
    }
};

window.renameCrate = async (id) => { const crate = allCrates.find(c => c.id === id); if(!crate) return; const newName = prompt("Bitte gib einen neuen Namen für die Kiste ein:", crate.name); if(newName && newName.trim() !== "" && newName !== crate.name) { await updateDoc(doc(db, "crates", id), { name: newName.trim() }); } }
window.toggleCrate = (id) => { window.crateCollapsed[id] = window.crateCollapsed[id] === false ? true : false; const content = document.getElementById(`crate-content-${id}`); const icon = document.getElementById(`crate-icon-${id}`); const header = content.previousElementSibling; if (window.crateCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } else { content.style.display = 'block'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; } };
window.changeCrateSort = (crateId, mode) => { window.crateSortModes[crateId] = mode; window.renderCrates(); };

document.getElementById('btn-save-crate').addEventListener('click', async () => { try { const crate_name = document.getElementById('crate-name').value; const fileInput = document.getElementById('crate-image'); const file = fileInput ? fileInput.files[0] : null; const status = document.getElementById('crate-status'); if(!crate_name) return alert("Name fehlt!"); status.innerText = "Erstelle Kiste..."; let imageUrl = null; if (file) imageUrl = await uploadImage(file, 'crates'); await addDoc(collection(db, "crates"), { name: crate_name, image_url: imageUrl, items: [], order: allCrates.length }); status.innerText = "Erfolgreich!"; setTimeout(() => status.innerText = "", 2000); document.getElementById('crate-name').value = ''; if(fileInput) fileInput.value = ''; } catch (error) { console.error(error); alert("Fehler: " + error.message); } });

window.changeCrateItemType = (preserveName = false) => { const type = document.getElementById('modal-item-type').value; const nameInput = document.getElementById('modal-item-name'); const enchSection = document.getElementById('enchantment-section'); if(type === 'money') { nameInput.placeholder = "Geld-Betrag (z.B. 1000)"; if(!preserveName) nameInput.value = ""; enchSection.style.display = 'none'; } else if(type === 'perk') { if(!preserveName) nameInput.value = "Platzhalter Perk"; enchSection.style.display = 'none'; } else if(type === 'special') { if(!preserveName) nameInput.value = "Platzhalter Spezial"; enchSection.style.display = 'none'; } else { nameInput.placeholder = "Item Name (z.B. Diamant)"; if(!preserveName) nameInput.value = ""; enchSection.style.display = 'block'; } };
window.addEnchantmentField = (name = '', level = '1') => { const container = document.getElementById('enchantments-container'); const row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '5px'; row.innerHTML = `<input type="text" class="ench-name" placeholder="z.B. sharpness" value="${name}" style="flex:2; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-color); color: var(--text-main);"><input type="number" class="ench-level" placeholder="Lvl" value="${level}" style="flex:1; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-color); color: var(--text-main);"><button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">X</button>`; container.appendChild(row); };
window.openItemModal = (crateId) => { document.getElementById('item-modal-title').innerText = "Neues Item hinzufügen"; document.getElementById('modal-crate-id').value = crateId; document.getElementById('modal-edit-item-id').value = ''; document.getElementById('modal-item-type').value = 'item'; document.getElementById('modal-item-name').value = ''; document.getElementById('modal-item-quantity').value = '1'; document.getElementById('modal-item-chance').value = ''; document.getElementById('enchantments-container').innerHTML = ''; window.changeCrateItemType(false); document.getElementById('item-modal').classList.add('active'); };
window.editCrateItem = (crateId, itemId) => { const crate = allCrates.find(c => c.id === crateId); if (!crate) return; const item = (crate.items || []).find(i => i.id === itemId); if (!item) return; document.getElementById('item-modal-title').innerText = "Item bearbeiten"; document.getElementById('modal-crate-id').value = crateId; document.getElementById('modal-edit-item-id').value = item.id; document.getElementById('modal-item-type').value = item.type || 'item'; window.changeCrateItemType(true); document.getElementById('modal-item-name').value = item.name || ''; document.getElementById('modal-item-quantity').value = item.quantity || 1; document.getElementById('modal-item-chance').value = item.chance || ''; const enchContainer = document.getElementById('enchantments-container'); enchContainer.innerHTML = ''; if (item.enchantments && item.enchantments.length > 0) { item.enchantments.forEach(ench => { const parts = ench.split(':'); window.addEnchantmentField(parts[0], parts[1] || '1'); }); } document.getElementById('item-modal').classList.add('active'); };
document.getElementById('btn-save-item').addEventListener('click', async () => { try { const crateId = document.getElementById('modal-crate-id').value; const editItemId = document.getElementById('modal-edit-item-id').value; const type = document.getElementById('modal-item-type').value; const name = document.getElementById('modal-item-name').value; const quantity = document.getElementById('modal-item-quantity').value; const chance = document.getElementById('modal-item-chance').value; const file = document.getElementById('modal-item-image').files[0]; const status = document.getElementById('modal-status'); if(!name || !chance || !quantity) return alert("Pflichtfelder fehlen!"); status.innerText = "Speichere Item..."; const enchNames = document.querySelectorAll('.ench-name'); const enchLevels = document.querySelectorAll('.ench-level'); let enchantments = []; for(let i=0; i<enchNames.length; i++) { const eName = enchNames[i].value.trim(); const eLevel = enchLevels[i].value.trim() || '1'; if(eName) enchantments.push(`${eName}:${eLevel}`); } let imageUrl = null; if(file) imageUrl = await uploadImage(file, 'crates/items'); const crateRef = doc(db, "crates", crateId); const crate = allCrates.find(c => c.id === crateId); let updatedItems = [...(crate.items || [])]; if(editItemId) { const idx = updatedItems.findIndex(i => i.id === editItemId); if(idx > -1) { updatedItems[idx].type = type; updatedItems[idx].name = name; updatedItems[idx].quantity = Number(quantity); updatedItems[idx].chance = Number(chance); updatedItems[idx].enchantments = enchantments; if(file) updatedItems[idx].image_url = imageUrl; } } else { updatedItems.push({ id: Date.now().toString(), type, name, quantity: Number(quantity), chance: Number(chance), enchantments, image_url: imageUrl }); } await updateDoc(crateRef, { items: updatedItems }); status.innerText = "Erfolgreich!"; setTimeout(() => { status.innerText = ""; document.getElementById('item-modal').classList.remove('active'); }, 1000); } catch (error) { console.error(error); alert("Fehler: " + error.message); } });
window.deleteCrateItem = async (crateId, itemId) => { if(confirm("Item entfernen?")) { try { const crateRef = doc(db, "crates", crateId); const crate = allCrates.find(c => c.id === crateId); await updateDoc(crateRef, { items: (crate.items || []).filter(i => i.id !== itemId) }); } catch (error) { console.error(error); } } };
window.simulateCrate = function(crateId) { const crate = allCrates.find(c => c.id === crateId); if(!crate || !crate.items || crate.items.length === 0) return alert("Die Kiste hat noch keine Items!"); let totalChance = crate.items.reduce((sum, item) => sum + (Number(item.chance) || 0), 0); if(totalChance === 0) return alert("Die Items in dieser Kiste haben keine Wahrscheinlichkeit (0%)!"); let results = {}; crate.items.forEach(i => results[i.id] = 0); for(let i=0; i<1000; i++) { let rand = Math.random() * totalChance; let current = 0; for(let item of crate.items) { current += (Number(item.chance) || 0); if(rand <= current) { results[item.id]++; break; } } } let html = `<ul style="list-style:none; padding:0; margin:0;">`; let sortedItems = [...crate.items].sort((a, b) => results[b.id] - results[a.id]); sortedItems.forEach(item => { let count = results[item.id]; let realPercent = ((count / 1000) * 100).toFixed(1); html += `<li style="padding: 8px 0; border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between;"><span><strong>${item.name}</strong></span><span style="color:var(--text-muted);">${count}x gezogen <b style="color:#00BCD4;">(${realPercent}%)</b></span></li>`; }); html += `</ul>`; document.getElementById('crate-test-result').innerHTML = html; document.getElementById('crate-test-modal').classList.add('active'); };
window.exportCrateYaml = function(crateId) { const crate = allCrates.find(c => c.id === crateId); if(!crate) return alert("Kiste nicht gefunden!"); let safeName = crate.name ? crate.name.replace(/[^a-zA-Z0-9]/g, '') : 'CustomCrate'; let yaml = `Crate:\n  CrateType: CSGO\n  CrateName: '&8${crate.name || 'Unbenannte Kiste'}'\n  Preview-Name: '&8${crate.name || 'Unbenannte Kiste'} Preview'\n  StartingKeys: 0\n  InGUI: true\n  Slot: 14\nPrizes:\n`; let items = crate.items || []; items.forEach((item, index) => { yaml += `  '${index + 1}':\n    DisplayName: '&f${item.name}'\n    DisplayAmount: ${item.quantity || 1}\n    MaxRange: 100\n    Chance: ${item.chance}\n`; if(item.type === 'money') { yaml += `    DisplayItem: 'SUNFLOWER'\n    Commands:\n      - 'eco give %player% ${item.quantity || 1000}'\n`; } else if(item.type === 'perk' || item.type === 'special') { yaml += `    DisplayItem: 'NETHER_STAR'\n    Commands:\n      - 'lp user %player% permission set <deine_permission> true'\n`; } else { yaml += `    DisplayItem: 'STONE'\n    Items:\n      - 'Item:STONE, Amount:${item.quantity || 1}'\n`; } if(item.enchantments && item.enchantments.length > 0) { yaml += `    DisplayEnchantments:\n`; item.enchantments.forEach(ench => { yaml += `      - '${ench}'\n`; }); } }); const blob = new Blob([yaml], { type: 'text/yaml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${safeName}.yml`; a.click(); URL.revokeObjectURL(url); };

// --- SHOP ---
window.resetShopForm = () => { editingShopId = null; document.getElementById('shop-form-title').innerText = "Neues Item im Shop anbieten"; document.getElementById('btn-save-shop').innerText = "Shop-Item speichern"; document.getElementById('btn-cancel-shop').style.display = "none"; document.getElementById('shop-item').value = ''; document.getElementById('shop-price').value = ''; };
window.editShopItem = (id) => { const item = allShop.find(s => s.id === id); if(!item) return; editingShopId = id; document.getElementById('shop-item').value = item.name; document.getElementById('shop-price').value = item.price; document.getElementById('shop-form-title').innerText = "Item bearbeiten: " + item.name; document.getElementById('btn-save-shop').innerText = "Änderungen speichern"; document.getElementById('btn-cancel-shop').style.display = "inline-block"; window.scrollTo({ top: 0, behavior: 'smooth' }); };
document.getElementById('btn-cancel-shop').addEventListener('click', window.resetShopForm);
document.getElementById('btn-save-shop').addEventListener('click', async () => { try { const name = document.getElementById('shop-item').value; const price = document.getElementById('shop-price').value; const file = document.getElementById('shop-image').files[0]; if(!name || !price) return alert("Name und Preis fehlen!"); document.getElementById('shop-status').innerText = "Speichere..."; let imageUrl = file ? await uploadImage(file, 'shop') : null; if(editingShopId) { let updateData = { name, price: Number(price) }; if(imageUrl) updateData.image_url = imageUrl; await updateDoc(doc(db, "shop", editingShopId), updateData); } else { await addDoc(collection(db, "shop"), { name, price: Number(price), image_url: imageUrl }); } document.getElementById('shop-status').innerText = "Erfolgreich!"; setTimeout(() => document.getElementById('shop-status').innerText = "", 2000); window.resetShopForm(); } catch (error) { console.error(error); alert("Fehler: " + error.message); } });
window.exportShopYaml = function() { if(allShop.length === 0) return alert("Der Shop ist leer!"); let yaml = `shops:\n  main:\n    name: '&8Server Shop'\n    size: 54\n    items:\n`; allShop.forEach((item, index) => { yaml += `      '${index + 1}':\n        type: item\n        item:\n          material: STONE\n          name: '&e${item.name}'\n        buyPrice: ${item.price}\n        sellPrice: ${Math.floor(item.price * 0.5)}\n        slot: ${index}\n`; }); const blob = new Blob([yaml], { type: 'text/yaml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `shopgui_main.yml`; a.click(); URL.revokeObjectURL(url); }


// ==========================================
// WERBUNG & KAMPAGNEN
// ==========================================
document.getElementById('btn-create-ad-campaign').addEventListener('click', async () => { const name = document.getElementById('ad-campaign-name').value; if(!name) return alert("Bitte Kampagnen-Namen eingeben!"); await addDoc(collection(db, "ads"), { name: name, items: [] }); document.getElementById('ad-campaign-name').value = ''; });
window.openAdUploadModal = (id) => { document.getElementById('modal-ad-campaign-id').value = id; document.getElementById('ad-upload-modal').classList.add('active'); };
document.getElementById('btn-save-ad-item').addEventListener('click', async () => { const campId = document.getElementById('modal-ad-campaign-id').value; const title = document.getElementById('modal-ad-title').value; const link = document.getElementById('modal-ad-link').value; const file = document.getElementById('modal-ad-image').files[0]; const status = document.getElementById('modal-ad-status'); if(!title || !file) return alert("Titel und Bild sind Pflicht!"); status.innerText = "Lade hoch..."; try { const imageUrl = await uploadImage(file, 'ads/images'); const newItem = { id: Date.now().toString(), title, link, image_url: imageUrl }; const campRef = doc(db, "ads", campId); const camp = allAds.find(a => a.id === campId); await updateDoc(campRef, { items: [...(camp.items || []), newItem] }); status.innerText = "Erfolgreich!"; setTimeout(() => { status.innerText = ""; document.getElementById('modal-ad-title').value = ''; document.getElementById('modal-ad-link').value = ''; document.getElementById('modal-ad-image').value = ''; document.getElementById('ad-upload-modal').classList.remove('active'); }, 1500); } catch(e) { console.error(e); alert("Fehler beim Upload!"); } });
window.deleteAdItem = async (campId, itemId) => { if(confirm("Werbung aus der Kampagne löschen?")) { const campRef = doc(db, "ads", campId); const camp = allAds.find(a => a.id === campId); await updateDoc(campRef, { items: (camp.items || []).filter(i => i.id !== itemId) }); } };

// ==========================================
// GUI PAKETE & UPLOAD LOGIK
// ==========================================
document.getElementById('btn-save-gui-package').addEventListener('click', async () => { try { const pkgName = document.getElementById('gui-package-name').value; const status = document.getElementById('gui-package-status'); if(!pkgName) return alert("Bitte gib dem GUI Paket einen Namen!"); status.innerText = "Erstelle Paket..."; await addDoc(collection(db, "guis"), { name: pkgName, items: [] }); status.innerText = "Erfolgreich!"; setTimeout(() => status.innerText = "", 2000); document.getElementById('gui-package-name').value = ''; } catch (e) { console.error(e); alert("Fehler: " + e.message); } });
window.openGuiUploadModal = (pkgId) => { document.getElementById('modal-gui-package-id').value = pkgId; document.getElementById('gui-upload-modal').classList.add('active'); };
document.getElementById('btn-save-gui-upload').addEventListener('click', async () => { const status = document.getElementById('modal-gui-status'); try { const pkgId = document.getElementById('modal-gui-package-id').value; const name = document.getElementById('modal-gui-name').value; const file = document.getElementById('modal-gui-image').files[0]; if(!name || !file) return alert("Bitte Name und Bild angeben!"); status.innerText = "Lade hoch (Bitte warten)..."; const imageUrl = await uploadImage(file, 'guis/images'); if(!imageUrl) throw new Error("Upload fehlgeschlagen."); status.innerText = "Speichere in Paket..."; const newItem = { id: Date.now().toString(), name: name, image_url: imageUrl }; const pkgRef = doc(db, "guis", pkgId); const pkg = allGUIs.find(g => g.id === pkgId); await updateDoc(pkgRef, { items: [...(pkg.items || []), newItem] }); status.innerText = "Erfolgreich!"; setTimeout(() => { status.innerText = ""; document.getElementById('modal-gui-name').value = ''; document.getElementById('modal-gui-image').value = ''; document.getElementById('gui-upload-modal').classList.remove('active'); }, 1500); } catch (e) { console.error("Upload Error:", e); status.innerText = "Fehler!"; alert("Fehler beim Hochladen: " + e.message); } });
window.deleteGuiItem = async (pkgId, itemId) => { if(confirm("Element wirklich löschen?")) { try { const pkgRef = doc(db, "guis", pkgId); const pkg = allGUIs.find(g => g.id === pkgId); await updateDoc(pkgRef, { items: (pkg.items || []).filter(i => i.id !== itemId) }); } catch (error) { console.error(error); alert("Fehler: " + error.message); } } };


// ==========================================
// MENÜ PLANER LOGIK
// ==========================================
const plannerPresets = [ { id: 'btn_next', text: 'Nächste', icon: '▶️' }, { id: 'btn_prev', text: 'Letzte', icon: '◀️' }, { id: 'btn_close', text: 'Schließen', icon: '❌' }, { id: 'btn_money', text: 'Geld / Eco', icon: '💰' }, { id: 'btn_info', text: 'Information', icon: 'ℹ️' }, { id: 'btn_item', text: 'Item-Platz', icon: '📦' } ];
let currentMenuLayout = {}; let plannerBgImage = null;

window.initMenuPlanner = function() { try { const palette = document.getElementById('palette-items'); if(!palette) return; palette.innerHTML = ''; plannerPresets.forEach(item => { palette.innerHTML += `<div class="palette-item" draggable="true" ondragstart="window.dragStart(event, '${item.id}')"><span style="font-size: 24px; width: 30px; text-align: center;">${item.icon}</span><span style="font-size: 14px;">${item.text}</span></div>`; }); window.updateMenuGrid(); } catch(e) { console.error("Planner Init Error:", e); } }
window.updateMenuGrid = function() { try { const rowsElem = document.getElementById('menu-rows'); if(!rowsElem) return; const rows = parseInt(rowsElem.value); const bgUrl = document.getElementById('planner-bg-select').value; const grid = document.getElementById('mc-inventory'); const canvasInner = document.getElementById('planner-inner-canvas'); const inputX = document.getElementById('planner-offset-x'); const inputY = document.getElementById('planner-offset-y'); grid.innerHTML = ''; if (bgUrl) { canvasInner.style.backgroundImage = `url(${bgUrl})`; if (!plannerBgImage || plannerBgImage.src !== bgUrl) { plannerBgImage = new Image(); plannerBgImage.onload = () => { canvasInner.style.width = plannerBgImage.naturalWidth + 'px'; canvasInner.style.height = plannerBgImage.naturalHeight + 'px'; if(plannerBgImage.naturalWidth === 192) { inputX.value = 8; } else { inputX.value = 40; } grid.style.left = inputX.value + 'px'; }; plannerBgImage.src = bgUrl; } } else { canvasInner.style.backgroundImage = 'none'; canvasInner.style.width = '256px'; canvasInner.style.height = '256px'; } grid.style.left = inputX.value + 'px'; grid.style.top = inputY.value + 'px'; for(let i=0; i < rows * 9; i++) { const itemId = currentMenuLayout[i]; let icon = ''; if(itemId) { const preset = plannerPresets.find(p => p.id === itemId); if(preset) icon = preset.icon; } grid.innerHTML += `<div class="mc-slot" data-slot="${i}" ondragover="window.allowDrop(event)" ondragleave="window.dragLeave(event)" ondrop="window.drop(event)" onclick="window.clickSlot(${i})">${icon}</div>`; } } catch(e) { console.error("Grid Update Error", e); } };
window.dragStart = function(ev, id) { ev.dataTransfer.setData("text", id); };
window.allowDrop = function(ev) { ev.preventDefault(); if(ev.target.classList.contains('mc-slot')) ev.target.classList.add('drag-over'); };
window.dragLeave = function(ev) { if(ev.target.classList.contains('mc-slot')) ev.target.classList.remove('drag-over'); };
window.drop = function(ev) { ev.preventDefault(); let target = ev.target; if(!target.classList.contains('mc-slot')) target = target.closest('.mc-slot'); if(target) { target.classList.remove('drag-over'); const id = ev.dataTransfer.getData("text"); const slot = target.getAttribute('data-slot'); currentMenuLayout[slot] = id; window.updateMenuGrid(); } };
window.clickSlot = function(slot) { if(currentMenuLayout[slot]) { delete currentMenuLayout[slot]; window.updateMenuGrid(); } };
window.openMenuPlannerForPkg = (pkgId) => { document.querySelector('[data-target="menu-planner"]').click(); document.getElementById('planner-pkg-select').value = pkgId; document.getElementById('planner-menu-name').value = ''; document.getElementById('planner-menu-id').value = ''; currentMenuLayout = {}; window.updateMenuGrid(); };
window.editLayoutInPlanner = (pkgId, itemId) => { const pkg = allGUIs.find(g => g.id === pkgId); if(!pkg) return; const item = (pkg.items || []).find(i => i.id === itemId); if(!item) return; document.querySelector('[data-target="menu-planner"]').click(); document.getElementById('planner-pkg-select').value = pkgId; document.getElementById('planner-menu-name').value = item.name; document.getElementById('planner-menu-id').value = item.id; if(item.rows) document.getElementById('menu-rows').value = item.rows; if(item.bg_url) document.getElementById('planner-bg-select').value = item.bg_url; if(item.offset_x !== undefined) document.getElementById('planner-offset-x').value = item.offset_x; if(item.offset_y !== undefined) document.getElementById('planner-offset-y').value = item.offset_y; currentMenuLayout = item.layout || {}; window.updateMenuGrid(); };
window.saveMenuLayout = async function() { const pkgId = document.getElementById('planner-pkg-select').value; const menuName = document.getElementById('planner-menu-name').value; const editItemId = document.getElementById('planner-menu-id').value; const rows = parseInt(document.getElementById('menu-rows').value); const bgUrl = document.getElementById('planner-bg-select').value; const offX = parseInt(document.getElementById('planner-offset-x').value); const offY = parseInt(document.getElementById('planner-offset-y').value); if(!pkgId) return alert("Bitte wähle ein Ziel-Paket aus!"); if(!menuName) return alert("Bitte gib dem Layout einen Namen!"); try { const pkgRef = doc(db, "guis", pkgId); const pkg = allGUIs.find(g => g.id === pkgId); let updatedItems = [...(pkg.items || [])]; const layoutData = { type: 'layout', rows: rows, bg_url: bgUrl, offset_x: offX, offset_y: offY, layout: currentMenuLayout }; if (editItemId) { const idx = updatedItems.findIndex(i => i.id === editItemId); if(idx > -1) { updatedItems[idx].name = menuName; updatedItems[idx].rows = rows; updatedItems[idx].bg_url = bgUrl; updatedItems[idx].offset_x = offX; updatedItems[idx].offset_y = offY; updatedItems[idx].layout = currentMenuLayout; } else { updatedItems.push({ id: editItemId, name: menuName, ...layoutData }); } } else { updatedItems.push({ id: Date.now().toString(), name: menuName, ...layoutData }); } await updateDoc(pkgRef, { items: updatedItems }); alert("Erfolgreich im Paket gespeichert!"); document.querySelector('[data-target="gui"]').click(); } catch (error) { console.error(error); alert("Fehler beim Speichern!"); } };
window.exportMenuYaml = function() { const name = document.getElementById('planner-menu-name').value || 'custom_menu'; const rows = parseInt(document.getElementById('menu-rows').value); let yaml = `menu_title: '&8${name}'\nopen_command: '${name.toLowerCase().replace(/\s+/g, '')}'\nsize: ${rows * 9}\nitems:\n`; for(let slot in currentMenuLayout) { const itemId = currentMenuLayout[slot]; const preset = plannerPresets.find(p => p.id === itemId); if(!preset) continue; yaml += `  '${itemId}_${slot}':\n`; if(itemId === 'btn_next') { yaml += `    material: arrow\n    slot: ${slot}\n    display_name: '&aNächste Seite'\n    left_click_commands:\n      - '[player] menu open nächste_seite'\n`; } else if(itemId === 'btn_prev') { yaml += `    material: arrow\n    slot: ${slot}\n    display_name: '&cLetzte Seite'\n    left_click_commands:\n      - '[player] menu open vorherige_seite'\n`; } else if(itemId === 'btn_close') { yaml += `    material: barrier\n    slot: ${slot}\n    display_name: '&cSchließen'\n    left_click_commands:\n      - '[close]'\n`; } else if(itemId === 'btn_money') { yaml += `    material: gold_ingot\n    slot: ${slot}\n    display_name: '&eDein Guthaben'\n    lore:\n      - '&7Du hast: %vault_eco_balance%'\n`; } else { yaml += `    material: stone\n    slot: ${slot}\n    display_name: '&f${preset.text}'\n`; } } const blob = new Blob([yaml], { type: 'text/yaml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${name.toLowerCase().replace(/\s+/g, '_')}.yml`; a.click(); URL.revokeObjectURL(url); };


// ==========================================
// 7. GUI PIXEL EDITOR LOGIK
// ==========================================

window.openGuiEditorForPkg = (pkgId) => { document.querySelector('[data-target="gui-editor"]').click(); document.getElementById('editor-pkg-select').value = pkgId; document.getElementById('editor-gui-name').value = ''; document.getElementById('editor-gui-item-id').value = ''; if(window.clearCanvasSilent) window.clearCanvasSilent(); };
window.editGuiItemInEditor = async (pkgId, itemId) => { const pkg = allGUIs.find(g => g.id === pkgId); if(!pkg) return; const item = (pkg.items || []).find(i => i.id === itemId); if(!item) return; document.querySelector('[data-target="gui-editor"]').click(); setTimeout(async () => { document.getElementById('editor-pkg-select').value = pkgId; document.getElementById('editor-gui-name').value = item.name; document.getElementById('editor-gui-item-id').value = item.id; if(item.image_url) { try { const imgRef = ref(storage, item.image_url); const blob = await getBlob(imgRef); const localUrl = URL.createObjectURL(blob); const img = new Image(); img.onload = () => { if(window.clearCanvasSilent) window.clearCanvasSilent(); const canvas = document.getElementById('pixelCanvas'); const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(localUrl); if(window.triggerSaveState) window.triggerSaveState(); }; img.src = localUrl; } catch (error) { console.error("Firebase Download Error:", error); alert("Fehler beim Importieren: " + error.message); } } else { if(window.clearCanvasSilent) window.clearCanvasSilent(); } }, 200); };

let editorInitialized = false;

function initEditor() {
    if (editorInitialized) return; editorInitialized = true;
    const fontMap={A:[[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],Ä:[[1,0,0,1],[0,0,0,0],[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],B:[[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,1],[1,1,1,0]],C:[[0,1,1,1],[1,0,0,0],[1,0,0,0],[1,0,0,0],[0,1,1,1]],D:[[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,0]],E:[[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,1,1,1]],F:[[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,0,0,0]],G:[[0,1,1,1],[1,0,0,0],[1,0,1,1],[1,0,0,1],[0,1,1,1]],H:[[1,0,0,1],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],I:[[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],J:[[0,0,1,1],[0,0,0,1],[0,0,0,1],[1,0,0,1],[0,1,1,0]],K:[[1,0,0,1],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,0,0,1]],L:[[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,1]],M:[[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1]],N:[[1,0,0,1],[1,1,0,1],[1,0,1,1],[1,0,0,1],[1,0,0,1]],O:[[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],Ö:[[1,0,0,1],[0,0,0,0],[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],P:[[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,0],[1,0,0,0]],Q:[[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,1,1],[0,1,1,1]],R:[[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,1,0],[1,0,0,1]],S:[[0,1,1,1],[1,0,0,0],[0,1,1,0],[0,0,0,1],[1,1,1,0]],T:[[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],U:[[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],Ü:[[1,0,0,1],[0,0,0,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],V:[[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0],[0,0,1,0]],W:[[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1]],X:[[1,0,0,1],[0,1,1,0],[0,1,1,0],[1,0,0,1]],Y:[[1,0,0,1],[0,1,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],Z:[[1,1,1,1],[0,0,0,1],[0,1,1,0],[1,0,0,0],[1,1,1,1]],0:[[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],1:[[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],2:[[1,1,1,0],[0,0,0,1],[0,1,1,0],[1,0,0,0],[1,1,1,1]],3:[[1,1,1,0],[0,0,0,1],[0,1,1,0],[0,0,0,1],[1,1,1,0]],4:[[1,0,0,1],[1,0,0,1],[1,1,1,1],[0,0,0,1],[0,0,0,1]],5:[[1,1,1,1],[1,0,0,0],[1,1,1,0],[0,0,0,1],[1,1,1,0]],6:[[0,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,1],[0,1,1,0]],7:[[1,1,1,1],[0,0,0,1],[0,0,1,0],[0,1,0,0],[0,1,0,0]],8:[[0,1,1,0],[1,0,0,1],[0,1,1,0],[1,0,0,1],[0,1,1,0]],9:[[0,1,1,0],[1,0,0,1],[0,1,1,1],[0,0,0,1],[0,1,1,0]],' ':[[0],[0],[0],[0],[0]],'.':[[0],[0],[0],[0],[1]],'ß':[[0,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,1],[1,1,1,0]]};

    const canvas = document.getElementById('pixelCanvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let currentZoom = 2; let currentTool = 'brush'; let selectedColor = '#a49e95'; window.currentStamp = 'slot'; let autoCenter = false; let isDrawing = false; let isEraseMode = false; let startPos = {x:0, y:0}; let canvasSnapshot; let selectionBuffer = null; let clipboardData = { img: null, x: 0, y: 0 }; let importedImage = null; const undoStack = []; const maxUndoSteps = 30;

    function showToast(msg) { const t = document.getElementById('editor-toast'); t.innerText = msg; t.style.opacity = 1; setTimeout(() => t.style.opacity = 0, 2000); }
    window.loadReference = function(input) { if(input.files && input.files[0]) { const reader = new FileReader(); reader.onload = function(e) { const img = document.getElementById('refOverlay'); img.src = e.target.result; img.style.display = 'block'; img.style.width = (canvas.width * currentZoom) + 'px'; img.style.height = (canvas.height * currentZoom) + 'px'; showToast("👻 Referenzbild geladen!"); }; reader.readAsDataURL(input.files[0]); } }
    window.clearReference = function() { const img = document.getElementById('refOverlay'); img.style.display = 'none'; img.src = ''; document.getElementById('refInput').value = ''; showToast("🚫 Referenz entfernt"); }
    window.deleteSelectedColor = function() { if(confirm("Farbe " + selectedColor + " löschen?")) { saveState(); const targetRgb = window.hexToRgb(selectedColor); if (!targetRgb) return; const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); const d = imgData.data; let deletedCount = 0; for(let i = 0; i < d.length; i += 4) { if(d[i+3] > 0 && d[i] === targetRgb.r && d[i+1] === targetRgb.g && d[i+2] === targetRgb.b) { d[i+3] = 0; deletedCount++; } } if (deletedCount > 0) { ctx.putImageData(imgData, 0, 0); refreshSnapshot(); showToast("🧹 Pixel gelöscht!"); } else { undoStack.pop(); showToast("ℹ️ Farbe nicht gefunden."); } } }
    window.handleImport = function(input) { if(input.files && input.files[0]) { const reader = new FileReader(); reader.onload = function(e) { const img = new Image(); img.onload = function() { importedImage = img; window.setTool('import'); showToast("🖼️ Bild geladen! Klicke zum Platzieren."); }; img.src = e.target.result; }; reader.readAsDataURL(input.files[0]); } }

    function saveState() { undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); if (undoStack.length > maxUndoSteps) undoStack.shift(); refreshSnapshot(); }
    window.triggerSaveState = saveState; function refreshSnapshot() { canvasSnapshot = ctx.getImageData(0,0,canvas.width,canvas.height); }
    window.undo = function() { if (undoStack.length > 0) { const data = undoStack.pop(); ctx.putImageData(data, 0, 0); refreshSnapshot(); isDrawing = false; selectionBuffer = null; window.updateGuides(); } }
    document.addEventListener('keydown', e => { if((e.ctrlKey||e.metaKey)&&e.key==='z') window.undo(); });

    window.changeZoom = function(val) { currentZoom = parseInt(val); document.getElementById('zoomVal').innerText = currentZoom; canvas.style.width = (canvas.width * currentZoom) + 'px'; canvas.style.height = (canvas.height * currentZoom) + 'px'; window.updateGuides(); }
    window.resizeCanvas = function() { saveState(); const s = document.querySelector('#gui-editor input[name="size"]:checked').value; const tempCanvas = document.createElement('canvas'); tempCanvas.width = canvas.width; tempCanvas.height = canvas.height; tempCanvas.getContext('2d').putImageData(ctx.getImageData(0,0,canvas.width, canvas.height), 0, 0); if (s === 'square') { canvas.width = 256; canvas.height = 256; } else if (s === 'rect') { canvas.width = 256; canvas.height = 128; } else if (s === 'tall') { canvas.width = 192; canvas.height = 256; } else if (s === 'mid') { canvas.width = 50; canvas.height = 50; } else if (s === 'icon') { canvas.width = 16; canvas.height = 16; } canvas.style.width = (canvas.width * currentZoom) + 'px'; canvas.style.height = (canvas.height * currentZoom) + 'px'; window.updateGuides(); ctx.imageSmoothingEnabled = false; ctx.drawImage(tempCanvas, 0, 0); saveState(); }
    document.getElementById('uploadInput').addEventListener('change', e => { if(e.target.files[0]){ saveState(); const r = new FileReader(); r.onload = ev => { const i = new Image(); i.onload = () => { ctx.imageSmoothingEnabled = false; ctx.drawImage(i, 0, 0, canvas.width, canvas.height); saveState(); }; i.src = ev.target.result; }; r.readAsDataURL(e.target.files[0]); } });

    window.setTool = function(tool) { currentTool = tool; document.querySelectorAll('#gui-editor .tool-grid .btn-editor').forEach(b => b.classList.remove('active')); const btn = document.getElementById('tool' + tool.charAt(0).toUpperCase() + tool.slice(1)); if(btn) btn.classList.add('active'); if(tool === 'import' && !importedImage) document.getElementById('toolImport')?.classList.remove('active'); document.getElementById('stampOptions').style.display = (tool === 'stamp') ? 'block' : 'none'; document.getElementById('textOptions').style.display = (tool === 'text') ? 'block' : 'none'; if (tool !== 'select') selectionBuffer = null; if(canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0); refreshSnapshot(); }
    window.toggleEraseMode = function() { isEraseMode = !isEraseMode; const btn = document.getElementById('btnEraseMode'); if (isEraseMode) { btn.classList.add('active'); btn.innerText = "🧽 Radier-Modus (AN)"; showToast("🧽 Alles ist Radierer!"); } else { btn.classList.remove('active'); btn.innerText = "🧽 Radier-Modus (AUS)"; } }
    window.pasteFromClipboard = function() { if (!clipboardData.img) { showToast("⚠️ Leer!"); return; } saveState(); ctx.putImageData(clipboardData.img, clipboardData.x, clipboardData.y); refreshSnapshot(); showToast("📋 Eingefügt"); }
    window.pasteClipboardMove = function() { if (!clipboardData.img) { showToast("⚠️ Leer!"); return; } window.setTool('select'); selectionBuffer = clipboardData.img; showToast("🖱️ Klicke zum Platzieren"); }
    
    function getMousePos(evt) { const r = canvas.getBoundingClientRect(); return { x: Math.floor((evt.clientX - r.left)/currentZoom), y: Math.floor((evt.clientY - r.top)/currentZoom) }; }

    canvas.addEventListener('mousedown', function(e) { if(canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0); if(currentTool !== 'select' || !selectionBuffer) saveState(); const pos = getMousePos(e); if (currentTool === 'picker') { const p = ctx.getImageData(pos.x, pos.y, 1, 1).data; const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1); selectedColor = hex; document.getElementById('colorPicker').value = hex; window.setTool('brush'); } else if (currentTool === 'fill') { floodFill(pos.x, pos.y, isEraseMode); refreshSnapshot(); } else if (currentTool === 'text') { if(!document.getElementById('textInput').value) showToast("⚠️ Kein Text!"); drawPixelText(document.getElementById('textInput').value, window.getAutoX(pos, 'text'), window.getAutoY(pos), false); refreshSnapshot(); } else if (currentTool === 'stamp') { drawStamp(window.currentStamp, window.getAutoX(pos), window.getAutoY(pos), false); refreshSnapshot(); } else if (currentTool === 'import' && importedImage) { const w = importedImage.width; const h = importedImage.height; ctx.drawImage(importedImage, Math.floor(pos.x - w/2), Math.floor(pos.y - h/2)); refreshSnapshot(); } else if (currentTool === 'select' && selectionBuffer) { ctx.putImageData(selectionBuffer, pos.x, pos.y); selectionBuffer = null; saveState(); } else { isDrawing = true; startPos = pos; if(isEraseMode) ctx.globalCompositeOperation = 'destination-out'; if (currentTool === 'brush') { drawBrush(pos.x, pos.y); refreshSnapshot(); } else if (currentTool === 'eraser') { drawEraser(pos.x, pos.y); refreshSnapshot(); } else if (currentTool === 'lighten' || currentTool === 'darken') { shadingBrush(pos.x, pos.y, currentTool==='lighten'); refreshSnapshot(); } if(isEraseMode) ctx.globalCompositeOperation = 'source-over'; } });
    canvas.addEventListener('mousemove', function(e) { const pos = getMousePos(e); if(canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0); if (isDrawing) { if(isEraseMode) ctx.globalCompositeOperation = 'destination-out'; if (currentTool === 'brush') { drawBrush(pos.x, pos.y); refreshSnapshot(); } else if (currentTool === 'eraser') { drawEraser(pos.x, pos.y); refreshSnapshot(); } else if (currentTool === 'lighten' || currentTool === 'darken') { shadingBrush(pos.x, pos.y, currentTool==='lighten'); refreshSnapshot(); } else if (currentTool === 'line') drawLine(startPos.x, startPos.y, pos.x, pos.y); else if (currentTool === 'rect') drawRectShape(startPos.x, startPos.y, pos.x, pos.y, false); else if (currentTool === 'rectFill') drawRectShape(startPos.x, startPos.y, pos.x, pos.y, true); else if (currentTool === 'select' && !selectionBuffer) drawSelectionBox(startPos.x, startPos.y, pos.x, pos.y); else if (currentTool === 'copy') drawSelectionBox(startPos.x, startPos.y, pos.x, pos.y); if(isEraseMode) ctx.globalCompositeOperation = 'source-over'; } else { if (['rect', 'rectFill', 'line', 'select', 'copy', 'picker', 'fill'].includes(currentTool)) drawPixelCursor(pos.x, pos.y); else if (['brush', 'lighten', 'darken'].includes(currentTool)) drawBrushPreview(pos.x, pos.y); else if (currentTool === 'eraser') drawBrushPreview(pos.x, pos.y, true); else if (currentTool === 'stamp') drawStamp(window.currentStamp, window.getAutoX(pos), window.getAutoY(pos), true); else if (currentTool === 'text') drawPixelText(document.getElementById('textInput').value, window.getAutoX(pos, 'text'), window.getAutoY(pos), true); else if (currentTool === 'select' && selectionBuffer) ctx.putImageData(selectionBuffer, pos.x, pos.y); else if (currentTool === 'import' && importedImage) { const w = importedImage.width; const h = importedImage.height; ctx.globalAlpha = 0.6; ctx.drawImage(importedImage, Math.floor(pos.x - w/2), Math.floor(pos.y - h/2)); ctx.globalAlpha = 1.0; } } });
    canvas.addEventListener('mouseout', function() { if(canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0); isDrawing = false; });
    window.addEventListener('mouseup', function(e) { if (!isDrawing) return; const pos = getMousePos(e); if(isEraseMode) ctx.globalCompositeOperation = 'destination-out'; if (currentTool === 'line') { drawLine(startPos.x, startPos.y, pos.x, pos.y); } else if (currentTool === 'rect') { drawRectShape(startPos.x, startPos.y, pos.x, pos.y, false); } else if (currentTool === 'rectFill') { drawRectShape(startPos.x, startPos.y, pos.x, pos.y, true); } if(isEraseMode) ctx.globalCompositeOperation = 'source-over'; if (currentTool === 'select' && !selectionBuffer) { const x = Math.min(startPos.x, pos.x), y = Math.min(startPos.y, pos.y); const w = Math.abs(pos.x - startPos.x) + 1, h = Math.abs(pos.y - startPos.y) + 1; if (w > 0 && h > 0) { selectionBuffer = ctx.getImageData(x, y, w, h); ctx.clearRect(x, y, w, h); } } else if (currentTool === 'copy') { ctx.putImageData(canvasSnapshot, 0, 0); const x = Math.min(startPos.x, pos.x), y = Math.min(startPos.y, pos.y); const w = Math.abs(pos.x - startPos.x) + 1, h = Math.abs(pos.y - startPos.y) + 1; if (w > 0 && h > 0) { const data = ctx.getImageData(x, y, w, h); clipboardData = { img: data, x: x, y: y }; showToast("✅ Kopiert!"); } } isDrawing = false; refreshSnapshot(); window.updateGuides(); });

    window.toggleGrid = function() { document.getElementById('gridOverlay').style.display = document.getElementById('gridCheck').checked ? 'block' : 'none'; window.updateGuides(); }
    window.toggleAutoCenter = function() { autoCenter = !autoCenter; document.getElementById('btnAutoCenter').classList.toggle('active'); document.getElementById('btnAutoCenter').innerText = autoCenter ? "🧲 Zentrieren (AN)" : "🧲 Zentrieren (Aus)"; document.getElementById('centerSettings').style.display = autoCenter ? 'block' : 'none'; window.updateGuides(); }
    window.toggleYInput = function() { const el = document.getElementById('fixedYVal'); const active = document.getElementById('useFixedY').checked; el.disabled = !active; el.style.opacity = active ? "1" : "0.5"; }
    
    // FÜR DIE PALETTE
    window.createPaletteSwatch = function(c){const d=document.createElement('div');d.className='color-swatch';d.style.backgroundColor=c;d.onclick=()=>{selectedColor=c;document.getElementById('colorPicker').value=c;document.querySelectorAll('#gui-editor .color-swatch').forEach(e=>e.classList.remove('active'));d.classList.add('active'); window.setTool('brush');};document.getElementById('paletteGrid').appendChild(d);}
    window.addToPalette = function(){window.createPaletteSwatch(document.getElementById('colorPicker').value);}
    
    window.clearCanvasSilent = function() { ctx.clearRect(0,0,canvas.width,canvas.height); saveState(); }
    window.clearCanvas = function(){if(confirm("Löschen?")){window.clearCanvasSilent();}}
    window.hexToRgb = function(h){const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);return r?{r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)}:null;}
    window.getAutoY = function(p){if(autoCenter&&document.getElementById('useFixedY').checked)return parseInt(document.getElementById('fixedYVal').value)||0;return p.y;}
    window.getAutoX = function(p,t){if(!autoCenter)return p.x;let cx=canvas.width/2;if(document.getElementById('useContentAlign').checked)cx=window.getContentBounds().centerX;if(t==='text'){const txt=document.getElementById('textInput').value;const s=parseInt(document.getElementById('textScale').value)||1;let w=0;for(let c of txt.toUpperCase()){const m=fontMap[c]||fontMap[' '];w+=((m[0]?.length||3)*s)+s;}w-=s;return Math.floor(cx-(w/2));}else{const w=(t.startsWith('job')?45:(window.currentStamp==='slot')?18:16);return Math.floor(cx-(w/2));}}
    window.getContentBounds = function() {const w=canvas.width, h=canvas.height, d=ctx.getImageData(0,0,w,h).data;let minX=w, maxX=0, found=false;for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(d[(y*w+x)*4+3]>0) { if(x<minX)minX=x; if(x>maxX)maxX=x; found=true; }return found ? {minX, maxX, centerX:Math.floor(minX+(maxX-minX)/2), found:true} : {minX:0, maxX:w, centerX:w/2, found:false};}
    
    window.updateGuides = function() { const cl=document.getElementById('centerLine'); cl.style.display='none'; const grid = document.getElementById('gridOverlay'); const gridSize = 18 * currentZoom; grid.style.backgroundSize = `${gridSize}px ${gridSize}px`; const refImg = document.getElementById('refOverlay'); if (refImg && refImg.style.display === 'block') { refImg.style.width = (canvas.width * currentZoom) + 'px'; refImg.style.height = (canvas.height * currentZoom) + 'px'; } grid.style.width = (canvas.width * currentZoom) + 'px'; grid.style.height = (canvas.height * currentZoom) + 'px'; if (autoCenter) { let cp = canvas.width / 2; if (document.getElementById('useContentAlign').checked) { const b = window.getContentBounds(); if(b.found) { cp=b.centerX; } } cl.style.left = (cp * currentZoom) + 'px'; cl.style.display = 'block'; } }

    function drawBrush(x, y) { ctx.fillStyle = selectedColor; const s = parseInt(document.getElementById('brushSize').value); ctx.fillRect(x - Math.floor(s/2), y - Math.floor(s/2), s, s); }
    function drawEraser(x, y) { const s = parseInt(document.getElementById('brushSize').value); ctx.clearRect(x - Math.floor(s/2), y - Math.floor(s/2), s, s); }
    function drawPixelCursor(x, y) { ctx.fillStyle = selectedColor; ctx.fillRect(x, y, 1, 1); }
    function drawBrushPreview(x, y, eraser) { const s = parseInt(document.getElementById('brushSize').value); ctx.fillStyle = selectedColor; if(currentTool==='eraser'||eraser) ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5; ctx.fillRect(x - Math.floor(s/2), y - Math.floor(s/2), s, s); ctx.globalAlpha = 1.0; }
    function shadingBrush(x, y, l) { const s = parseInt(document.getElementById('brushSize').value); const sx = x - Math.floor(s/2); const sy = y - Math.floor(s/2); const i = ctx.getImageData(sx, sy, s, s); const d = i.data; const a = 15; for(let k=0; k<d.length; k+=4) { if(d[k+3] === 0) continue; if(l) { d[k]=Math.min(255,d[k]+a); d[k+1]=Math.min(255,d[k+1]+a); d[k+2]=Math.min(255,d[k+2]+a); } else { d[k]=Math.max(0,d[k]-a); d[k+1]=Math.max(0,d[k+1]-a); d[k+2]=Math.max(0,d[k+2]-a); } } ctx.putImageData(i, sx, sy); }
    function drawLine(x0,y0,x1,y1){const dx=x1-x0,dy=y1-y0;const st=Math.max(Math.abs(dx),Math.abs(dy));const s=parseInt(document.getElementById('brushSize').value);const o=Math.floor(s/2);ctx.fillStyle=selectedColor;for(let i=0;i<=st;i++){const t=st===0?0:i/st;ctx.fillRect(Math.round(x0+dx*t)-o,Math.round(y0+dy*t)-o,s,s);}}
    function drawRectShape(x0,y0,x1,y1,f){const x=Math.min(x0,x1),y=Math.min(y0,y1);const w=Math.abs(x1-x0)+1,h=Math.abs(y1-y0)+1;ctx.fillStyle=selectedColor;if(f){ctx.fillRect(x,y,w,h);}else{const s=parseInt(document.getElementById('brushSize').value);ctx.fillRect(x,y,w,s);ctx.fillRect(x,y+h-s,w,s);ctx.fillRect(x,y,s,h);ctx.fillRect(x+w-s,y,s,h);}}
    function drawSelectionBox(x0,y0,x1,y1){const x=Math.min(x0,x1),y=Math.min(y0,y1);const w=Math.abs(x1-x0),h=Math.abs(y1-y0);ctx.strokeStyle='#fff';ctx.setLineDash([4,2]);ctx.strokeRect(x+0.5,y+0.5,w,h);ctx.setLineDash([]);}
    
    window.drawStamp = function(t,x,y,p){
        if(p)ctx.globalAlpha=0.5;
        if(t==='slot'){drawRect(x,y,18,18,'#8b8b8b');drawRect(x,y,17,1,'#373737');drawRect(x,y,1,18,'#373737');drawRect(x,y+17,18,1,'#ffffff');drawRect(x+17,y,1,18,'#ffffff');drawRect(x+1,y+1,16,16,'#8b8b8b');}
        else {
            ctx.fillStyle=selectedColor;let m=[];
            if(t==='sArrowR')m=["00100","00110","11111","00110","00100"];
            for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c]==='1')ctx.fillRect(x+c,y+r,1,1);
        }
        if(p)ctx.globalAlpha=1.0;
    }

    window.drawPixelText = function(t, x, y, preview) { if(!t) return; if(preview) ctx.globalAlpha = 0.5; t = t.toUpperCase(); const s = parseInt(document.getElementById('textScale').value)||1; const shad = document.getElementById('textShadow').checked; function dC(ch, dx, dy, col) { ctx.fillStyle = col; const m = fontMap[ch]||fontMap[' ']; if(!m) return 4*s; for(let r=0;r<m.length;r++) for(let c=0;c<m[r].length;c++) if(m[r][c]) ctx.fillRect(dx+(c*s), dy+(r*s), s, s); return ((m[0]?.length||3)*s)+s; } if(shad) { let sx=x+s; for(let c of t) sx+=dC(c, sx, y+s, "#1a1a1a"); } let cx=x; for(let c of t) cx+=dC(c, cx, y, selectedColor); if(preview) ctx.globalAlpha = 1.0; }
    function drawRect(x,y,w,h,col){ctx.fillStyle=col;ctx.fillRect(x,y,w,h);}
    function drawGuiBase(x,y,w,h){ctx.fillStyle='#c6c6c6';ctx.fillRect(x,y,w,h);ctx.fillStyle='#ffffff';ctx.fillRect(x,y,w,2);ctx.fillRect(x,y,2,h);ctx.fillStyle='#555555';ctx.fillRect(x+2,y+h-2,w-2,2);ctx.fillRect(x+w-2,y+2,2,h-2);}
    
    window.applyTemplate = function(type) { 
        saveState(); const w=canvas.width; const cx=Math.floor((w-176)/2); 
        if(type==='chest'){ const sy=10; drawGuiBase(cx,sy,176,166); for(let r=0;r<3;r++)for(let c=0;c<9;c++) window.drawStamp('slot',cx+7+c*18,sy+17+r*18,false); for(let r=0;r<3;r++)for(let c=0;c<9;c++) window.drawStamp('slot',cx+7+c*18,sy+83+r*18,false); for(let c=0;c<9;c++) window.drawStamp('slot',cx+7+c*18,sy+141,false); } 
        else if(type==='double'){ const sy=5; drawGuiBase(cx,sy,176,222); for(let r=0;r<6;r++)for(let c=0;c<9;c++) window.drawStamp('slot',cx+7+c*18,sy+17+r*18,false); for(let r=0;r<3;r++)for(let c=0;c<9;c++) window.drawStamp('slot',cx+7+c*18,sy+139+r*18,false); for(let c=0;c<9;c++) window.drawStamp('slot',cx+7+c*18,sy+197,false); } 
        else if(type==='inv'){ const sy=80; for(let r=0;r<3;r++)for(let c=0;c<9;c++) window.drawStamp('slot',cx+7+c*18,sy+r*18,false); for(let c=0;c<9;c++) window.drawStamp('slot',cx+7+c*18,sy+58,false); } 
        refreshSnapshot(); 
    }
    
    function floodFill(x,y,erase){ const startPixel=ctx.getImageData(x,y,1,1).data; const startR=startPixel[0],startG=startPixel[1],startB=startPixel[2],startA=startPixel[3]; const f=window.hexToRgb(selectedColor); if(erase){ if(startA===0) return; } else { if(startR===f.r&&startG===f.g&&startB===f.b&&startA===255) return; } const img=ctx.getImageData(0,0,canvas.width,canvas.height); const d=img.data; const s=[[x,y]]; const w=canvas.width,h=canvas.height; while(s.length){ const[cx,cy]=s.pop(); if(cx<0||cx>=w||cy<0||cy>=h)continue; const i=(cy*w+cx)*4; if(d[i]===startR&&d[i+1]===startG&&d[i+2]===startB&&d[i+3]===startA){ if(erase) d[i+3]=0; else { d[i]=f.r; d[i+1]=f.g; d[i+2]=f.b; d[i+3]=255; } s.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]); } } ctx.putImageData(img,0,0); }

    window.saveEditorToFirebase = async function() {
        const pkgId = document.getElementById('editor-pkg-select').value;
        const guiName = document.getElementById('editor-gui-name').value;
        const editItemId = document.getElementById('editor-gui-item-id').value;

        if(!pkgId) return alert("Bitte wähle ein Ziel-Paket im Dropdown aus!");
        if(!guiName) return alert("Bitte gib dem GUI einen Namen!");

        const btn = document.getElementById('btn-editor-save');
        const oldText = btn.innerText;
        btn.innerText = "Lade hoch...";
        
        try {
            const dataUrl = canvas.toDataURL('image/png');
            const storageRef = ref(storage, `guis/images/gui_${Date.now()}.png`);
            
            await uploadString(storageRef, dataUrl, 'data_url');
            const imageUrl = await getDownloadURL(storageRef);
            
            const pkgRef = doc(db, "guis", pkgId);
            const pkg = allGUIs.find(g => g.id === pkgId);
            if(!pkg) throw new Error("Das ausgewählte Paket wurde nicht in der Datenbank gefunden.");

            let updatedItems = [...(pkg.items || [])];

            if (editItemId) {
                const idx = updatedItems.findIndex(i => i.id === editItemId);
                if(idx > -1) {
                    updatedItems[idx].name = guiName;
                    updatedItems[idx].image_url = imageUrl;
                } else {
                    updatedItems.push({ id: editItemId, name: guiName, image_url: imageUrl });
                }
            } else {
                updatedItems.push({ id: Date.now().toString(), name: guiName, image_url: imageUrl });
            }

            await updateDoc(pkgRef, { items: updatedItems });

            btn.innerText = "Erfolgreich!";
            setTimeout(() => {
                btn.innerText = oldText;
                document.getElementById('editor-gui-name').value = '';
                document.getElementById('editor-gui-item-id').value = '';
                ctx.clearRect(0,0,canvas.width,canvas.height); 
                refreshSnapshot();
                document.querySelector('[data-target="gui"]').click();
            }, 1000);
            
        } catch (error) { 
            console.error(error); 
            btn.innerText = oldText;
            alert("FEHLER BEIM SPEICHERN:\n" + error.message);
        }
    }

    // Farben initialisieren
    const myColors = ['#a49e95', '#766f6a', '#483f46', '#231c2c', '#1e1829', '#539d33', '#ffffff', '#000000'];
    myColors.forEach(c => window.createPaletteSwatch(c));
    window.resizeCanvas(); saveState(); refreshSnapshot();
}
