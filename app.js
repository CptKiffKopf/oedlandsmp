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

let allRanks = [], allGUIs = [], allCrates = [], allShop = [], allAds = [], allPlugins = [], allBroadcasts = [];
let allQuestBatches = [], allHolograms = [], allEvents = [];
let editingRankId = null, editingPluginId = null, editingShopId = null, editingEventId = null;
let listenersActive = false; 

window.crateCollapsed = {}; window.crateSortModes = {}; window.pluginCollapsed = {}; window.adCollapsed = {}; window.guiCollapsed = {}; window.questCollapsed = {}; window.holoCollapsed = {};
let draggedCrateBox = null; 
window.dragDropActive = false;

// --- DARK MODE LOGIK ---
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') { document.body.classList.add('dark-mode'); }

document.getElementById('btn-darkmode').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});


// ==========================================
// HILFSFUNKTIONEN & AUTH
// ==========================================

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
        if (!listenersActive) { 
            startRealtimeListeners(); 
            listenersActive = true; 
        }
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value; const password = document.getElementById('login-password').value; const errorText = document.getElementById('login-error');
    if(!email || !password) return errorText.innerText = "Bitte beides ausfüllen!";
    errorText.innerText = "Logge ein..."; errorText.style.color = "var(--text-muted)";
    try { await signInWithEmailAndPassword(auth, email, password); errorText.innerText = ""; } 
    catch (error) { errorText.style.color = "var(--danger)"; errorText.innerText = "Falsche E-Mail oder Passwort!"; }
});

document.getElementById('btn-logout').addEventListener('click', () => { signOut(auth); });

document.querySelectorAll('.nav-item:not(#btn-logout):not(#btn-darkmode)').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.querySelectorAll('.category-section').forEach(sec => sec.classList.remove('active')); 
        document.getElementById(targetId).classList.add('active');
        
        if(targetId === 'gui-editor') { 
            setTimeout(() => { initEditor(); if(window.resizeCanvas) window.resizeCanvas(); }, 100); 
        }
        if(targetId === 'menu-planner') {
            setTimeout(() => { if(window.initMenuPlanner) window.initMenuPlanner(); }, 100);
        }
    });
});

function updateDashboard() {
    document.getElementById('stat-ranks').innerText = allRanks.length;
    document.getElementById('stat-crates').innerText = allCrates.length;
    document.getElementById('stat-plugins').innerText = allPlugins.length;
    document.getElementById('stat-shop').innerText = allShop.length;
    document.getElementById('stat-guis').innerText = allGUIs.length; 
    document.getElementById('stat-events').innerText = allEvents.length;
    let questCount = 0; allQuestBatches.forEach(b => { questCount += (b.quests || []).length; });
    document.getElementById('stat-quests').innerText = questCount; 
}

function sortRanksHierarchically(ranks) {
    let sorted = [], visited = new Set(), baseRanks = ranks.filter(r => !r.inherits_from);
    function addChildren(parentName) { let children = ranks.filter(r => r.inherits_from === parentName); children.forEach(child => { if (!visited.has(child.id)) { visited.add(child.id); sorted.push(child); addChildren(child.name); } }); }
    baseRanks.forEach(baseRank => { if (!visited.has(baseRank.id)) { visited.add(baseRank.id); sorted.push(baseRank); addChildren(baseRank.name); } });
    ranks.forEach(r => { if (!visited.has(r.id)) sorted.push(r); });
    return sorted;
}


// ==========================================
// LIVE SERVER STATUS PING
// ==========================================
window.checkServerStatus = async function() {
    const ip = document.getElementById('server-ip').value; const resDiv = document.getElementById('server-status-result');
    if(!ip) return alert("Bitte eine Minecraft-Server IP eingeben!");
    resDiv.style.display = 'block'; resDiv.innerHTML = "<span style='color: var(--text-muted);'>📡 Pinge Server an... Bitte warten.</span>";
    try {
        const response = await fetch('https://api.mcsrvstat.us/3/' + ip); const data = await response.json();
        if(data.online) {
            let iconHtml = data.icon ? `<img src="${data.icon}" style="width:64px; height:64px; border-radius:8px; border: 2px solid var(--border-color);">` : `<div style="width:64px; height:64px; background:#444; border-radius:8px;"></div>`;
            resDiv.innerHTML = `<div style="display:flex; align-items:center; gap: 20px;">${iconHtml}<div><div style="color: #4CAF50; font-weight:bold; font-size:18px; margin-bottom: 5px;">🟢 ONLINE</div><div style="font-size: 14px;"><strong>Spieler:</strong> ${data.players.online} / ${data.players.max}</div><div style="font-size: 14px; color: var(--text-muted);"><strong>Version:</strong> ${data.version}</div></div></div>`;
        } else { resDiv.innerHTML = `<div style="color:var(--danger); font-weight:bold; font-size:16px;">🔴 OFFLINE (oder nicht erreichbar)</div>`; }
    } catch(e) { resDiv.innerHTML = "<span style='color:var(--danger);'>❌ Fehler beim Abrufen der API.</span>"; }
}


// ==========================================
// DATEN LADEN (REALTIME LISTENER)
// ==========================================

function startRealtimeListeners() {
    
    // EVENTS
    onSnapshot(collection(db, "events"), (snap) => {
        allEvents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allEvents.sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
        
        const container = document.getElementById('events-container');
        if(!container) return; container.innerHTML = '';
        
        allEvents.forEach(ev => {
            const dateObj = new Date(ev.date);
            const formattedDate = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            container.innerHTML += `
            <div class="event-card">
                <div class="event-card-date">📅 ${formattedDate} ${ev.time ? '- ' + ev.time + ' Uhr' : ''}</div>
                <div style="margin-top: 25px; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-size: 18px;">${ev.name}</h3>
                </div>
                <p style="font-size: 13px; color: var(--text-muted); flex-grow: 1;">${ev.description || 'Keine Beschreibung'}</p>
                <div class="button-group" style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 10px;">
                    <button class="btn btn-secondary btn-sm" onclick="window.editEvent('${ev.id}')">✏️ Bearbeiten</button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteEntry('events', '${ev.id}')">🗑️ Löschen</button>
                </div>
            </div>`;
        });
        updateDashboard();
    });

    // BROADCASTER
    onSnapshot(collection(db, "broadcasts"), (snap) => {
        allBroadcasts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('bc-list'); if(!list) return; list.innerHTML = '';
        allBroadcasts.forEach(bc => {
            let formattedMsg = window.formatMcText(bc.message);
            list.innerHTML += `<tr>
                <td><div style="font-size: 11px; color: #888; margin-bottom: 4px;">Original: <span style="font-family:monospace;">${bc.message}</span></div><div class="mc-preview-box" style="padding: 8px; font-size: 13px;">${formattedMsg}</div></td>
                <td style="vertical-align: middle;">Alle ${bc.interval} Sek.</td>
                <td style="text-align: right; vertical-align: middle;">
                    <button class="btn btn-secondary btn-sm" onclick="window.editBroadcast('${bc.id}')">✏️ Bearbeiten</button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteEntry('broadcasts', '${bc.id}')">🗑️ Löschen</button>
                </td>
            </tr>`;
        });
    });

    // RÄNGE
    onSnapshot(collection(db, "ranks"), (snap) => {
        allRanks = sortRanksHierarchically(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        const list = document.getElementById('rank-list'); if(list) { list.innerHTML = '';
        allRanks.forEach(rank => {
            const myPerms = rank.permissions || []; const parentRank = rank.inherits_from ? allRanks.find(r => r.name === rank.inherits_from) : null; const inherited = parentRank ? (parentRank.permissions || []) : [];
            let permsHtml = myPerms.map(p => `<span class="perm-badge">${p}</span>`).join('') + inherited.map(p => `<span class="perm-badge perm-inherited">${p}</span>`).join('');
            let imgHtml = rank.image_url ? `<img src="${rank.image_url}" class="thumbnail">` : '<div class="thumbnail"></div>';
            let indent = rank.inherits_from ? '<span style="color:#9ca3af; margin-right:5px;">↳</span>' : '';
            list.innerHTML += `<tr><td>${imgHtml}</td><td><strong>${indent}${rank.name}</strong></td><td>${rank.inherits_from || '-'}</td><td>${permsHtml || '-'}</td><td class="action-cell"><button class="btn btn-secondary btn-sm" onclick="window.editRank('${rank.id}')">Bearbeiten</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('ranks', '${rank.id}')">Löschen</button></td></tr>`;
        });}
        const dropdown = document.getElementById('rank-inherit'); if(dropdown) { dropdown.innerHTML = '<option value="">Erbt von... (Keiner)</option>';
        allRanks.forEach(r => { if(r.id !== editingRankId) { dropdown.innerHTML += `<option value="${r.name}">${r.name}</option>`; } });
        if(editingRankId) { const currentEdit = allRanks.find(r => r.id === editingRankId); if(currentEdit) document.getElementById('rank-inherit').value = currentEdit.inherits_from || ''; } }
        updateDashboard();
    });

    // PLUGINS
    onSnapshot(collection(db, "plugins"), (snap) => {
        allPlugins = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('plugins-container');
        if(!container) return; container.innerHTML = '';
        
        allPlugins.forEach(plugin => { 
            let permsText = plugin.perms || plugin.info || '-';
            let settingsHtml = '';
            if (plugin.settingsType === 'daily') {
                settingsHtml = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-top:5px;">`;
                (plugin.dailyRewards || []).forEach((req, idx) => { settingsHtml += `<div style="background:var(--bg-color); padding:4px 8px; border-radius:4px; font-size:12px; border:1px solid var(--border-color);"><strong>Tag ${idx+1}:</strong> ${req}</div>`; });
                settingsHtml += `</div>`;
            } else {
                settingsHtml = `<div style="white-space:pre-wrap; font-size:13px; margin-top:5px;">${plugin.settingsText || '-'}</div>`;
            }

            let isCollapsed = window.pluginCollapsed[plugin.id] !== false; 
            let displayStyle = isCollapsed ? 'none' : 'block';
            let iconText = isCollapsed ? '▶️' : '🔽';

            container.innerHTML += `
                <div class="crate-box">
                    <div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.togglePlugin('${plugin.id}')">
                        <div class="crate-header-left">
                            <span id="plugin-icon-${plugin.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span>
                            <h3 style="font-size: 18px; margin: 0;">${plugin.name}</h3>
                        </div>
                        <div class="button-group" onclick="event.stopPropagation()">
                            <button class="btn btn-secondary btn-sm" onclick="window.editPlugin('${plugin.id}')">✏️ Bearbeiten</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteEntry('plugins', '${plugin.id}')">🗑️ Löschen</button>
                        </div>
                    </div>
                    <div id="plugin-content-${plugin.id}" style="display: ${displayStyle}; margin-top: 15px;">
                        <div style="margin-bottom: 15px;">
                            <h4 style="font-size: 13px; color: var(--text-muted); margin-bottom: 5px;">Permissions / Commands:</h4>
                            <div style="font-size:13px; white-space:pre-wrap; background: var(--bg-color); padding: 10px; border-radius: 4px; border: 1px solid var(--border-color);">${permsText}</div>
                        </div>
                        <div>
                            <h4 style="font-size: 13px; color: var(--text-muted); margin-bottom: 5px;">Einstellungen:</h4>
                            ${settingsHtml}
                        </div>
                    </div>
                </div>`; 
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
            list.innerHTML += `<tr>
                <td>${imgHtml}</td><td><strong>${item.name}</strong></td><td>${item.price} Pkt.</td>
                <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm" onclick="window.editShopItem('${item.id}')">✏️ Bearbeiten</button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteEntry('shop', '${item.id}')">Löschen</button>
                </td>
            </tr>`; 
        });
        updateDashboard();
    });

    // WERBUNG KAMPAGNEN
    onSnapshot(collection(db, "ads"), (snap) => {
        allAds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('ad-campaigns-container');
        if(!container) return; container.innerHTML = '';
        
        allAds.forEach(camp => {
            let itemsHtml = (camp.items || []).map(item => {
                let linkHtml = item.link ? `<a href="${item.link}" target="_blank" style="font-size:12px; display:block; margin-bottom:10px; color:#00BCD4;">Link öffnen</a>` : '';
                return `
                    <div class="gui-card">
                        <div class="gui-card-header">
                            <span>${item.title}</span>
                            <div>
                                <button class="btn btn-danger btn-sm" onclick="window.deleteAdItem('${camp.id}', '${item.id}')">Löschen</button>
                            </div>
                        </div>
                        ${linkHtml}
                        <img src="${item.image_url}" alt="${item.title}">
                    </div>`;
            }).join('');

            let isCollapsed = window.adCollapsed[camp.id] !== false;
            let displayStyle = isCollapsed ? 'none' : 'block';
            let iconText = isCollapsed ? '▶️' : '🔽';

            container.innerHTML += `
                <div class="crate-box">
                    <div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.toggleAdCampaign('${camp.id}')">
                        <div class="crate-header-left">
                            <span id="ad-icon-${camp.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span>
                            <h3 style="font-size: 18px; margin: 0;">${camp.name || 'Unbenannte Kampagne'}</h3>
                        </div>
                        <div class="button-group" onclick="event.stopPropagation()">
                            <button class="btn btn-primary btn-sm" onclick="window.openAdUploadModal('${camp.id}')">🖼️ Werbung hinzufügen</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteEntry('ads', '${camp.id}')">Kampagne löschen</button>
                        </div>
                    </div>
                    <div id="ad-content-${camp.id}" style="display: ${displayStyle}; margin-top: 15px;">
                        ${(camp.items && camp.items.length > 0) ? `<div class="gui-grid">${itemsHtml}</div>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Werbungen in dieser Kampagne.</p>'}
                    </div>
                </div>`;
        });
    });

    // QUESTS BATCHES
    onSnapshot(collection(db, "quest_batches"), (snap) => {
        allQuestBatches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('quest-batches-container');
        if(!container) return; container.innerHTML = '';

        allQuestBatches.forEach(batch => {
            let questsHtml = (batch.quests || []).map(quest => {
                let tasksHtml = (quest.tasks || []).map(task => {
                    let typeText = task.type;
                    if(task.type === 'FARMING') typeText = '⛏️ Abbauen';
                    if(task.type === 'CRAFTING') typeText = '🛠️ Craften';
                    if(task.type === 'KILL_MOB') typeText = '🧟 Mob töten';
                    if(task.type === 'KILL_PLAYER') typeText = '⚔️ Spieler töten';
                    return `<tr><td><span class="perm-badge">${typeText}</span></td><td><strong>${task.target}</strong></td><td>${task.amount}x</td><td style="text-align: right;"><button class="btn btn-danger btn-sm" onclick="window.deleteQuestTask('${batch.id}', '${quest.id}', '${task.id}')">Löschen</button></td></tr>`;
                }).join('');

                return `
                <div style="background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                        <h4 style="margin:0; font-size:16px;">${quest.name}</h4>
                        <div class="button-group">
                            <button class="btn btn-primary btn-sm" onclick="window.openQuestTaskModal('${batch.id}', '${quest.id}')">+ Aufgabe</button>
                            <button class="btn btn-secondary btn-sm" onclick="window.editQuest('${batch.id}', '${quest.id}')">✏️ Bearbeiten</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteQuest('${batch.id}', '${quest.id}')">🗑️ Löschen</button>
                        </div>
                    </div>
                    <p style="font-size:13px; color:var(--text-muted); margin-bottom:5px;"><strong>Beschreibung:</strong> ${window.formatMcText(quest.desc || '-')}</p>
                    <p style="font-size:13px; color:var(--text-muted); margin-bottom:15px;"><strong>Belohnung:</strong> ${quest.reward || '-'}</p>
                    ${(quest.tasks && quest.tasks.length > 0) ? `<table class="crate-items-table" style="background: var(--bg-color);"><thead><tr><th style="width: 120px;">Typ</th><th>Ziel</th><th>Anzahl</th><th style="text-align: right;">Aktion</th></tr></thead><tbody>${tasksHtml}</tbody></table>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Aufgaben.</p>'}
                </div>`;
            }).join('');

            let isCollapsed = window.questCollapsed[batch.id] !== false; 
            let displayStyle = isCollapsed ? 'none' : 'block';
            let iconText = isCollapsed ? '▶️' : '🔽';

            container.innerHTML += `
                <div class="crate-box">
                    <div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.toggleQuestBatch('${batch.id}')">
                        <div class="crate-header-left">
                            <span id="quest-icon-${batch.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span>
                            <h3 style="font-size: 18px; margin: 0;">${batch.name}</h3>
                        </div>
                        <div class="button-group" onclick="event.stopPropagation()">
                            <button class="btn btn-info btn-sm" onclick="window.exportQuestYaml('${batch.id}')">📥 Quest Export</button>
                            <button class="btn btn-primary btn-sm" onclick="window.openQuestModal('${batch.id}')">+ Quest erstellen</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteEntry('quest_batches', '${batch.id}')">Batch löschen</button>
                        </div>
                    </div>
                    <div id="quest-content-${batch.id}" style="display: ${displayStyle}; margin-top: 15px; padding: 15px; background: var(--bg-color); border-radius: 8px;">
                        ${(batch.quests && batch.quests.length > 0) ? questsHtml : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Quests in diesem Batch.</p>'}
                    </div>
                </div>`;
        });
        updateDashboard();
    });

    // HOLOGRAMME
    onSnapshot(collection(db, "holograms"), (snap) => {
        allHolograms = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('holograms-container');
        if(!container) return; container.innerHTML = '';

        allHolograms.forEach(holo => {
            let linesPreviewHtml = '';
            let linesTableHtml = '';

            (holo.lines || []).forEach(line => {
                if(line.type === 'item') {
                    linesPreviewHtml += `<div class="holo-item">💎</div><div style="font-size:10px; color:#aaa; margin-top:-5px;">[ITEM: ${line.content}]</div>`;
                } else {
                    linesPreviewHtml += `<div class="holo-line">${window.formatMcText(line.content)}</div>`;
                }
                let typeBadge = line.type === 'item' ? '💎 Item' : '📝 Text';
                linesTableHtml += `<tr><td><span class="perm-badge">${typeBadge}</span></td><td>${line.content}</td><td style="text-align: right;"><button class="btn btn-danger btn-sm" onclick="window.deleteHoloLine('${holo.id}', '${line.id}')">Löschen</button></td></tr>`;
            });

            let isCollapsed = window.holoCollapsed[holo.id] !== false; 
            let displayStyle = isCollapsed ? 'none' : 'flex';
            let iconText = isCollapsed ? '▶️' : '🔽';

            container.innerHTML += `
                <div class="crate-box">
                    <div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.toggleHolo('${holo.id}')">
                        <div class="crate-header-left">
                            <span id="holo-icon-${holo.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span>
                            <h3 style="font-size: 18px; margin: 0;">${holo.name}</h3>
                        </div>
                        <div class="button-group" onclick="event.stopPropagation()">
                            <button class="btn btn-info btn-sm" onclick="window.exportHoloYaml('${holo.id}')">📥 DH Export</button>
                            <button class="btn btn-primary btn-sm" onclick="window.openHoloLineModal('${holo.id}')">+ Zeile</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteEntry('holograms', '${holo.id}')">Holo löschen</button>
                        </div>
                    </div>
                    <div id="holo-content-${holo.id}" style="display: ${displayStyle}; margin-top: 15px; gap: 20px;">
                        <div style="flex: 1;">
                            <p style="font-size:13px; color:var(--text-muted); margin-bottom:10px;"><strong>Location:</strong> ${holo.location || '-'}</p>
                            ${(holo.lines && holo.lines.length > 0) ? `<table class="crate-items-table"><thead><tr><th style="width: 100px;">Typ</th><th>Inhalt</th><th style="text-align: right;">Aktion</th></tr></thead><tbody>${linesTableHtml}</tbody></table>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Zeilen. Klicke auf "+ Zeile".</p>'}
                        </div>
                        <div style="width: 250px; flex-shrink: 0;">
                            <h4 style="font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">In-Game Vorschau:</h4>
                            <div class="holo-preview-container">${linesPreviewHtml || '<span style="color:#555;">Leer</span>'}</div>
                        </div>
                    </div>
                </div>`;
        });
        updateDashboard();
    });

    // GUI PAKETE
    onSnapshot(collection(db, "guis"), (snap) => {
        allGUIs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('gui-packages-container');
        const editorSelect = document.getElementById('editor-pkg-select');
        const plannerSelect = document.getElementById('planner-pkg-select'); 
        const plannerBgSelect = document.getElementById('planner-bg-select');
        
        if(!container) return; container.innerHTML = '';
        
        const currentEditorVal = editorSelect ? editorSelect.value : ''; 
        const currentPlannerVal = plannerSelect ? plannerSelect.value : ''; 
        const currentBgVal = plannerBgSelect ? plannerBgSelect.value : '';
        
        if(editorSelect) editorSelect.innerHTML = '<option value="">Ziel-Paket wählen...</option>'; 
        if(plannerSelect) plannerSelect.innerHTML = '<option value="">Ziel-Paket wählen...</option>';
        if(plannerBgSelect) plannerBgSelect.innerHTML = '<option value="">Kein Bild (Nur Grid)</option>';

        allGUIs.forEach(pkg => {
            if(editorSelect) editorSelect.innerHTML += `<option value="${pkg.id}">${pkg.name}</option>`; 
            if(plannerSelect) plannerSelect.innerHTML += `<option value="${pkg.id}">${pkg.name}</option>`;
            
            let items = pkg.items || [];
            let itemsHtml = items.map(item => {
                if (plannerBgSelect && item.type !== 'layout' && item.image_url) { 
                    plannerBgSelect.innerHTML += `<option value="${item.image_url}">${pkg.name} - ${item.name}</option>`; 
                }

                if (item.type === 'layout') {
                    return `<div class="gui-card"><div class="gui-card-header"><span>${item.name}</span><div><button class="btn btn-secondary btn-sm" onclick="window.editLayoutInPlanner('${pkg.id}', '${item.id}')" title="Im Planer bearbeiten">✏️</button><button class="btn btn-danger btn-sm" onclick="window.deleteGuiItem('${pkg.id}', '${item.id}')">Löschen</button></div></div><div style="width:100%; height:120px; background:#1e1e1e; border: 2px solid #555; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-direction: column;"><span style="font-size: 30px; margin-bottom: 10px;">📋</span><span style="color:#4CAF50; font-size:12px; font-weight:bold;">Menü Layout (${item.rows} Reihen)</span></div></div>`;
                } else {
                    return `<div class="gui-card"><div class="gui-card-header"><span>${item.name}</span><div><button class="btn btn-secondary btn-sm" onclick="window.editGuiItemInEditor('${pkg.id}', '${item.id}')" title="Im Editor bearbeiten">✏️</button><button class="btn btn-danger btn-sm" onclick="window.deleteGuiItem('${pkg.id}', '${item.id}')">Löschen</button></div></div><img src="${item.image_url}" alt="${item.name}"></div>`;
                }
            }).join('');

            let isCollapsed = window.guiCollapsed[pkg.id] !== false;
            let displayStyle = isCollapsed ? 'none' : 'block';
            let iconText = isCollapsed ? '▶️' : '🔽';

            container.innerHTML += `
                <div class="crate-box">
                    <div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.toggleGuiPackage('${pkg.id}')">
                        <div class="crate-header-left">
                            <span id="gui-icon-${pkg.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span>
                            <h3 style="font-size: 18px; margin: 0;">${pkg.name}</h3>
                        </div>
                        <div class="button-group" onclick="event.stopPropagation()">
                            <button class="btn btn-info btn-sm" onclick="window.openMenuPlannerForPkg('${pkg.id}')">📋 Menü planen</button>
                            <button class="btn btn-secondary btn-sm" onclick="window.openGuiEditorForPkg('${pkg.id}')">🖌️ Pixel Editor</button>
                            <button class="btn btn-primary btn-sm" onclick="window.openGuiUploadModal('${pkg.id}')">🖼️ Upload</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteEntry('guis', '${pkg.id}')">Paket löschen</button>
                        </div>
                    </div>
                    <div id="gui-content-${pkg.id}" style="display: ${displayStyle}; margin-top: 15px;">
                        ${items.length > 0 ? `<div class="gui-grid">${itemsHtml}</div>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine GUIs in diesem Paket.</p>'}
                    </div>
                </div>`;
        });
        
        if(editorSelect && currentEditorVal) editorSelect.value = currentEditorVal; 
        if(plannerSelect && currentPlannerVal) plannerSelect.value = currentPlannerVal; 
        if(plannerBgSelect && currentBgVal) plannerBgSelect.value = currentBgVal;
        
        updateDashboard();
    });
}

window.deleteEntry = async (collectionName, id) => { if(confirm('Wirklich komplett löschen?')) { await deleteDoc(doc(db, collectionName, id)); } };

// ==========================================
// ALLGEMEINE TOGGLE FUNKTIONEN
// ==========================================

window.toggleGuiPackage = (id) => {
    window.guiCollapsed[id] = window.guiCollapsed[id] === false ? true : false;
    const content = document.getElementById(`gui-content-${id}`); const icon = document.getElementById(`gui-icon-${id}`); const header = content.previousElementSibling;
    if (window.guiCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } 
    else { content.style.display = 'block'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; }
};

window.togglePlugin = (id) => {
    window.pluginCollapsed[id] = window.pluginCollapsed[id] === false ? true : false;
    const content = document.getElementById(`plugin-content-${id}`); const icon = document.getElementById(`plugin-icon-${id}`); const header = content.previousElementSibling;
    if (window.pluginCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } 
    else { content.style.display = 'block'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; }
};

window.toggleAdCampaign = (id) => {
    window.adCollapsed[id] = window.adCollapsed[id] === false ? true : false;
    const content = document.getElementById(`ad-content-${id}`); const icon = document.getElementById(`ad-icon-${id}`); const header = content.previousElementSibling;
    if (window.adCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } 
    else { content.style.display = 'block'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; }
};

window.toggleQuestBatch = (id) => { 
    window.questCollapsed[id] = window.questCollapsed[id] === false ? true : false; 
    const content = document.getElementById(`quest-content-${id}`); const icon = document.getElementById(`quest-icon-${id}`); const header = content.previousElementSibling; 
    if (window.questCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } 
    else { content.style.display = 'block'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; } 
};

window.toggleHolo = (id) => { 
    window.holoCollapsed[id] = window.holoCollapsed[id] === false ? true : false; 
    const content = document.getElementById(`holo-content-${id}`); const icon = document.getElementById(`holo-icon-${id}`); const header = content.previousElementSibling; 
    if (window.holoCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } 
    else { content.style.display = 'flex'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; } 
};

// ==========================================
// EVENTS LOGIK
// ==========================================
window.resetEventForm = () => {
    editingEventId = null;
    document.getElementById('event-form-title').innerText = "Neues Event eintragen";
    document.getElementById('btn-save-event').innerText = "Event speichern";
    document.getElementById('btn-cancel-event').style.display = "none";
    document.getElementById('event-name').value = '';
    document.getElementById('event-date').value = '';
    document.getElementById('event-time').value = '';
    document.getElementById('event-desc').value = '';
};

window.editEvent = (id) => {
    const ev = allEvents.find(e => e.id === id); if(!ev) return;
    editingEventId = id;
    document.getElementById('event-form-title').innerText = "Event bearbeiten: " + ev.name;
    document.getElementById('event-name').value = ev.name;
    document.getElementById('event-date').value = ev.date;
    document.getElementById('event-time').value = ev.time || '';
    document.getElementById('event-desc').value = ev.description || '';
    document.getElementById('btn-save-event').innerText = "Änderungen speichern";
    document.getElementById('btn-cancel-event').style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.getElementById('btn-save-event').addEventListener('click', async () => {
    const name = document.getElementById('event-name').value;
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const desc = document.getElementById('event-desc').value;
    if(!name || !date) return alert("Name und Datum sind Pflichtfelder!");
    document.getElementById('event-status').innerText = "Speichere...";
    const eventData = { name, date, time, description: desc };
    try {
        if(editingEventId) { await updateDoc(doc(db, "events", editingEventId), eventData); } 
        else { await addDoc(collection(db, "events"), eventData); }
        document.getElementById('event-status').innerText = "Erfolgreich!"; setTimeout(() => document.getElementById('event-status').innerText = "", 2000);
        window.resetEventForm();
    } catch(e) { console.error(e); alert("Fehler beim Speichern!"); }
});

// ==========================================
// QUESTS LOGIK
// ==========================================
document.getElementById('btn-create-quest-batch').addEventListener('click', async () => {
    const name = document.getElementById('quest-batch-name').value;
    if(!name) return alert("Bitte Kategorien-Namen eingeben!");
    await addDoc(collection(db, "quest_batches"), { name: name, quests: [] });
    document.getElementById('quest-batch-name').value = '';
});

window.openQuestModal = (batchId) => {
    document.getElementById('quest-modal-title').innerText = "Neue Quest erstellen";
    document.getElementById('modal-quest-batch-id').value = batchId;
    document.getElementById('modal-quest-edit-id').value = '';
    document.getElementById('modal-quest-name').value = '';
    document.getElementById('modal-quest-desc').value = '';
    document.getElementById('modal-quest-reward').value = '';
    document.getElementById('quest-modal').classList.add('active');
};

window.editQuest = (batchId, questId) => {
    const batch = allQuestBatches.find(b => b.id === batchId); if(!batch) return;
    const quest = (batch.quests || []).find(q => q.id === questId); if(!quest) return;
    document.getElementById('quest-modal-title').innerText = "Quest bearbeiten";
    document.getElementById('modal-quest-batch-id').value = batchId;
    document.getElementById('modal-quest-edit-id').value = questId;
    document.getElementById('modal-quest-name').value = quest.name || '';
    document.getElementById('modal-quest-desc').value = quest.desc || '';
    document.getElementById('modal-quest-reward').value = quest.reward || '';
    document.getElementById('quest-modal').classList.add('active');
};

document.getElementById('btn-save-quest-data').addEventListener('click', async () => {
    const batchId = document.getElementById('modal-quest-batch-id').value;
    const editQuestId = document.getElementById('modal-quest-edit-id').value;
    const name = document.getElementById('modal-quest-name').value;
    const desc = document.getElementById('modal-quest-desc').value;
    const reward = document.getElementById('modal-quest-reward').value;
    if(!name) return alert("Quest Name darf nicht leer sein!");
    
    const bRef = doc(db, "quest_batches", batchId);
    const batch = allQuestBatches.find(b => b.id === batchId);
    let updatedQuests = [...(batch.quests || [])];
    
    if(editQuestId) {
        const idx = updatedQuests.findIndex(q => q.id === editQuestId);
        if(idx > -1) { updatedQuests[idx].name = name; updatedQuests[idx].desc = desc; updatedQuests[idx].reward = reward; }
    } else {
        updatedQuests.push({ id: Date.now().toString(), name, desc, reward, tasks: [] });
    }
    await updateDoc(bRef, { quests: updatedQuests });
    document.getElementById('quest-modal').classList.remove('active');
});

window.deleteQuest = async (batchId, questId) => {
    if(confirm("Quest löschen?")) {
        const bRef = doc(db, "quest_batches", batchId);
        const batch = allQuestBatches.find(b => b.id === batchId);
        await updateDoc(bRef, { quests: (batch.quests || []).filter(q => q.id !== questId) });
    }
};

window.openQuestTaskModal = (batchId, questId) => {
    document.getElementById('modal-task-batch-id').value = batchId;
    document.getElementById('modal-task-quest-id').value = questId;
    document.getElementById('modal-quest-task-target').value = '';
    document.getElementById('modal-quest-task-amount').value = '1';
    document.getElementById('quest-task-modal').classList.add('active');
};

document.getElementById('btn-save-quest-task').addEventListener('click', async () => {
    const batchId = document.getElementById('modal-task-batch-id').value;
    const questId = document.getElementById('modal-task-quest-id').value;
    const type = document.getElementById('modal-quest-task-type').value;
    const target = document.getElementById('modal-quest-task-target').value;
    const amount = document.getElementById('modal-quest-task-amount').value;
    if(!target || !amount) return alert("Ziel und Anzahl ausfüllen!");
    
    const bRef = doc(db, "quest_batches", batchId);
    const batch = allQuestBatches.find(b => b.id === batchId);
    let updatedQuests = [...(batch.quests || [])];
    const qIdx = updatedQuests.findIndex(q => q.id === questId);
    
    if(qIdx > -1) {
        let updatedTasks = [...(updatedQuests[qIdx].tasks || [])];
        updatedTasks.push({ id: Date.now().toString(), type, target, amount: Number(amount) });
        updatedQuests[qIdx].tasks = updatedTasks;
        await updateDoc(bRef, { quests: updatedQuests });
    }
    document.getElementById('quest-task-modal').classList.remove('active');
});

window.deleteQuestTask = async (batchId, questId, taskId) => {
    if(confirm("Aufgabe löschen?")) {
        const bRef = doc(db, "quest_batches", batchId);
        const batch = allQuestBatches.find(b => b.id === batchId);
        let updatedQuests = [...(batch.quests || [])];
        const qIdx = updatedQuests.findIndex(q => q.id === questId);
        if(qIdx > -1) {
            updatedQuests[qIdx].tasks = (updatedQuests[qIdx].tasks || []).filter(t => t.id !== taskId);
            await updateDoc(bRef, { quests: updatedQuests });
        }
    }
};

window.exportQuestYaml = function(batchId) {
    const batch = allQuestBatches.find(b => b.id === batchId); if(!batch) return;
    if(!batch.quests || batch.quests.length === 0) return alert("Dieser Batch hat keine Quests!");
    
    let safeBatchName = batch.name ? batch.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : 'quest_batch';
    let yaml = ``;
    
    batch.quests.forEach(quest => {
        let safeQuestName = quest.name ? quest.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : 'quest';
        yaml += `${safeQuestName}:\n  name: '${quest.name}'\n  ask-message: '${quest.desc || 'Schließe diese Quest ab!'}'\n  finish-message: '&aQuest abgeschlossen!'\n  tasks:\n`;
        (quest.tasks || []).forEach(task => {
            if(task.type === 'FARMING') yaml += `    mining:\n      - ${task.target}:${task.amount}\n`;
            if(task.type === 'CRAFTING') yaml += `    crafting:\n      - ${task.target}:${task.amount}\n`;
            if(task.type === 'KILL_MOB') yaml += `    mob-killing:\n      - ${task.target}:${task.amount}\n`;
            if(task.type === 'KILL_PLAYER') yaml += `    player-killing: ${task.amount}\n`;
        });
        yaml += `  rewards:\n    commands:\n      - 'say %player% hat ${quest.reward || 'nichts'} bekommen!'\n\n`;
    });

    const blob = new Blob([yaml], { type: 'text/yaml' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${safeBatchName}.yml`; a.click(); URL.revokeObjectURL(url);
};

// ==========================================
// HOLOGRAMME LOGIK 
// ==========================================
document.getElementById('btn-save-holo').addEventListener('click', async () => {
    const name = document.getElementById('holo-name').value;
    const loc = document.getElementById('holo-location').value;
    const status = document.getElementById('holo-status');
    if(!name) return alert("Bitte Namen eingeben!");
    status.innerText = "Erstelle...";
    await addDoc(collection(db, "holograms"), { name: name, location: loc, lines: [] });
    status.innerText = "Erfolgreich!"; setTimeout(() => status.innerText = "", 2000);
    document.getElementById('holo-name').value = ''; document.getElementById('holo-location').value = '';
});

window.changeHoloLineType = () => {
    const type = document.getElementById('modal-holo-line-type').value;
    const input = document.getElementById('modal-holo-line-content');
    const hint = document.getElementById('holo-line-hint');
    if(type === 'item') { input.placeholder = "Material Name (z.B. DIAMOND_SWORD)"; hint.innerText = "Gib den genauen Minecraft Material-Namen ein."; } 
    else { input.placeholder = "Text (z.B. &aWillkommen!)"; hint.innerText = "Nutze Minecraft Color-Codes wie &c oder &l."; }
};

window.openHoloLineModal = (holoId) => {
    document.getElementById('modal-holo-id').value = holoId;
    document.getElementById('modal-holo-line-type').value = 'text';
    document.getElementById('modal-holo-line-content').value = '';
    window.changeHoloLineType();
    document.getElementById('holo-line-modal').classList.add('active');
};

document.getElementById('btn-save-holo-line').addEventListener('click', async () => {
    const holoId = document.getElementById('modal-holo-id').value;
    const type = document.getElementById('modal-holo-line-type').value;
    const content = document.getElementById('modal-holo-line-content').value;
    if(!content) return alert("Inhalt darf nicht leer sein!");
    
    const newLine = { id: Date.now().toString(), type, content };
    const hRef = doc(db, "holograms", holoId);
    const holo = allHolograms.find(h => h.id === holoId);
    await updateDoc(hRef, { lines: [...(holo.lines || []), newLine] });
    document.getElementById('holo-line-modal').classList.remove('active');
});

window.deleteHoloLine = async (holoId, lineId) => {
    if(confirm("Zeile löschen?")) {
        const hRef = doc(db, "holograms", holoId);
        const holo = allHolograms.find(h => h.id === holoId);
        await updateDoc(hRef, { lines: (holo.lines || []).filter(l => l.id !== lineId) });
    }
};

window.exportHoloYaml = function(holoId) {
    const holo = allHolograms.find(h => h.id === holoId); if(!holo) return;
    let safeName = holo.name ? holo.name.replace(/[^a-zA-Z0-9]/g, '') : 'Hologram';
    
    let yaml = `holos:\n  ${safeName}:\n    location: ${holo.location || 'world:0:100:0'}\n    lines:\n`;
    (holo.lines || []).forEach(line => {
        if(line.type === 'item') { yaml += `      - content: '#ICON:${line.content}'\n`; } 
        else { yaml += `      - content: '${line.content}'\n`; }
    });

    const blob = new Blob([yaml], { type: 'text/yaml' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${safeName}.yml`; a.click(); URL.revokeObjectURL(url);
};


// ==========================================
// AUTO-BROADCASTER LOGIK
// ==========================================

window.formatMcText = function(text) {
    if(!text) return '';
    let safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let html = ''; let parts = safeText.split(/(&[0-9a-fl-or])/i); let currentClasses = ['mc-f'];
    for(let part of parts) {
        if(/^&[0-9a-fl-or]$/i.test(part)) {
            let code = part.charAt(1).toLowerCase();
            if(code === 'r') { currentClasses = ['mc-f']; }
            else if(/[0-9a-f]/.test(code)) { currentClasses = [`mc-${code}`]; } 
            else { currentClasses.push(`mc-${code}`); } 
        } else if(part) { html += `<span class="${currentClasses.join(' ')}">${part}</span>`; }
    }
    return html;
};

window.updateMcPreview = function() {
    let text = document.getElementById('bc-message').value;
    document.getElementById('bc-preview').innerHTML = window.formatMcText(text) || 'Vorschau...';
};

window.editBroadcast = function(id) {
    const bc = allBroadcasts.find(b => b.id === id); if(!bc) return;
    document.getElementById('bc-edit-id').value = bc.id; document.getElementById('bc-message').value = bc.message; document.getElementById('bc-interval').value = bc.interval; document.getElementById('btn-save-bc').innerText = "Änderungen speichern"; document.getElementById('btn-cancel-bc').style.display = "inline-block"; window.updateMcPreview(); window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.cancelEditBroadcast = function() {
    document.getElementById('bc-edit-id').value = ''; document.getElementById('bc-message').value = ''; document.getElementById('bc-interval').value = '300'; document.getElementById('btn-save-bc').innerText = "Speichern"; document.getElementById('btn-cancel-bc').style.display = "none"; window.updateMcPreview();
};

window.saveBroadcast = async function() {
    const msg = document.getElementById('bc-message').value; const interval = document.getElementById('bc-interval').value; const editId = document.getElementById('bc-edit-id').value;
    if(!msg || !interval) return alert("Bitte Nachricht und Intervall ausfüllen!");
    document.getElementById('bc-status').innerText = "Speichere...";
    try {
        if(editId) { await updateDoc(doc(db, "broadcasts", editId), { message: msg, interval: Number(interval) }); } else { await addDoc(collection(db, "broadcasts"), { message: msg, interval: Number(interval) }); }
        document.getElementById('bc-status').innerText = "Gespeichert!"; setTimeout(() => document.getElementById('bc-status').innerText = "", 2000); window.cancelEditBroadcast();
    } catch(e) { console.error(e); alert("Fehler!"); }
};

window.exportBroadcastYaml = function() {
    if(allBroadcasts.length === 0) return alert("Keine Nachrichten vorhanden!");
    let yaml = `settings:\n  interval: 300\n  prefix: '&8[&cServer&8] &7'\nbroadcasts:\n`;
    allBroadcasts.forEach((bc, i) => { yaml += `  'msg${i + 1}':\n    text:\n`; bc.message.split('\n').forEach(line => { yaml += `      - '${line}'\n`; }); yaml += `    interval: ${bc.interval}\n`; });
    const blob = new Blob([yaml], { type: 'text/yaml' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'autobroadcaster.yml'; a.click(); URL.revokeObjectURL(url);
};


// ==========================================
// RÄNGE & PLUGINS LOGIK 
// ==========================================

window.togglePluginSettings = function() {
    const type = document.getElementById('plugin-settings-type').value;
    if (type === 'daily') { document.getElementById('plugin-settings-text-container').style.display = 'none'; document.getElementById('plugin-settings-daily-container').style.display = 'block'; window.generateDailyFields(); } 
    else { document.getElementById('plugin-settings-text-container').style.display = 'block'; document.getElementById('plugin-settings-daily-container').style.display = 'none'; }
};

window.generateDailyFields = () => {
    const days = parseInt(document.getElementById('plugin-daily-days').value) || 0;
    const grid = document.getElementById('plugin-daily-grid'); grid.innerHTML = '';
    for(let i=1; i<=days; i++) {
        grid.innerHTML += `<div style="display:flex; align-items:center; gap:5px;">
            <span style="width:50px; color:var(--text-muted); font-size:12px;">Tag ${i}:</span>
            <input type="text" class="daily-reward-input" data-day="${i}" placeholder="z.B. eco give %player% 1000" style="flex:1; padding:6px; border-radius:4px; border:1px solid var(--border-color); background:var(--surface-color); color:var(--text-main);">
        </div>`;
    }
};

function resetPluginForm() {
    editingPluginId = null; document.getElementById('plugin-form-title').innerText = "Neues Plugin hinzufügen"; document.getElementById('btn-save-plugin').innerText = "Plugin speichern"; document.getElementById('btn-cancel-plugin').style.display = "none"; document.getElementById('plugin-name').value = ''; document.getElementById('plugin-perms').value = ''; document.getElementById('plugin-settings-type').value = 'text'; document.getElementById('plugin-settings-text').value = ''; document.getElementById('plugin-daily-days').value = ''; window.togglePluginSettings();
}

window.editPlugin = (id) => {
    const plugin = allPlugins.find(p => p.id === id); if(!plugin) return;
    editingPluginId = id; document.getElementById('plugin-name').value = plugin.name; document.getElementById('plugin-perms').value = plugin.perms || plugin.info || ''; document.getElementById('plugin-settings-type').value = plugin.settingsType || 'text'; window.togglePluginSettings();
    if (plugin.settingsType === 'daily') {
        document.getElementById('plugin-daily-days').value = plugin.dailyDays || 0; window.generateDailyFields();
        const inputs = document.querySelectorAll('.daily-reward-input'); inputs.forEach((input, idx) => { input.value = plugin.dailyRewards[idx] || ''; });
    } else { document.getElementById('plugin-settings-text').value = plugin.settingsText || ''; }
    document.getElementById('plugin-form-title').innerText = "Plugin bearbeiten: " + plugin.name; document.getElementById('btn-save-plugin').innerText = "Änderungen speichern"; document.getElementById('btn-cancel-plugin').style.display = "inline-block"; window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.getElementById('btn-cancel-plugin').addEventListener('click', resetPluginForm);

document.getElementById('btn-save-plugin').addEventListener('click', async () => {
    try { 
        const name = document.getElementById('plugin-name').value; const perms = document.getElementById('plugin-perms').value; const settingsType = document.getElementById('plugin-settings-type').value; const settingsText = document.getElementById('plugin-settings-text').value; const dailyDays = document.getElementById('plugin-daily-days').value;
        let dailyRewards = []; if (settingsType === 'daily') { const inputs = document.querySelectorAll('.daily-reward-input'); inputs.forEach(input => dailyRewards.push(input.value)); }
        const status = document.getElementById('plugin-status'); if(!name) return alert("Bitte gib einen Plugin-Namen ein!"); status.innerText = "Speichere..."; 
        const pluginData = { name: name, perms: perms, info: perms, settingsType: settingsType, settingsText: settingsText, dailyDays: Number(dailyDays), dailyRewards: dailyRewards };
        if (editingPluginId) { await updateDoc(doc(db, "plugins", editingPluginId), pluginData); } else { await addDoc(collection(db, "plugins"), pluginData); } 
        status.innerText = "Erfolgreich!"; setTimeout(() => status.innerText = "", 2000); resetPluginForm(); 
    } catch (error) { console.error(error); alert("Fehler: " + error.message); }
});

document.getElementById('btn-save-rank').addEventListener('click', async () => {
    const name = document.getElementById('rank-name').value; const perms = document.getElementById('rank-perms').value.split('\n').map(p => p.trim()).filter(p => p !== ""); const inherits = document.getElementById('rank-inherit').value; const file = document.getElementById('rank-image').files[0]; const status = document.getElementById('rank-status');
    if(!name) return alert("Name fehlt!"); status.innerText = "Speichere..."; const rankData = { name: name, permissions: perms, inherits_from: inherits || null }; if (file) { rankData.image_url = await uploadImage(file, 'ranks'); }
    if (editingRankId) { await updateDoc(doc(db, "ranks", editingRankId), rankData); } else { await addDoc(collection(db, "ranks"), rankData); }
    status.innerText = "Gespeichert!"; setTimeout(() => status.innerText = "", 2000);
    editingRankId = null; document.getElementById('rank-form-title').innerText = "Neuen Rang erstellen"; document.getElementById('btn-save-rank').innerText = "Rang speichern"; document.getElementById('btn-cancel-rank').style.display = "none"; document.getElementById('rank-name').value = ''; document.getElementById('rank-perms').value = ''; document.getElementById('rank-inherit').value = ''; if(document.getElementById('rank-image')) document.getElementById('rank-image').value = '';
});

window.editRank = (id) => { const rank = allRanks.find(r => r.id === id); if (!rank) return; editingRankId = id; document.getElementById('rank-name').value = rank.name; document.getElementById('rank-perms').value = (rank.permissions || []).join('\n'); document.getElementById('rank-inherit').value = rank.inherits_from || ''; document.getElementById('rank-form-title').innerText = "Rang bearbeiten: " + rank.name; document.getElementById('btn-save-rank').innerText = "Änderungen speichern"; document.getElementById('btn-cancel-rank').style.display = "inline-block"; window.scrollTo({ top: 0, behavior: 'smooth' }); };
document.getElementById('btn-cancel-rank').addEventListener('click', () => { editingRankId = null; document.getElementById('rank-form-title').innerText = "Neuen Rang erstellen"; document.getElementById('btn-save-rank').innerText = "Rang speichern"; document.getElementById('btn-cancel-rank').style.display = "none"; document.getElementById('rank-name').value = ''; document.getElementById('rank-perms').value = ''; document.getElementById('rank-inherit').value = ''; if(document.getElementById('rank-image')) document.getElementById('rank-image').value = '';});

document.getElementById('btn-export-ranks').addEventListener('click', () => { if(allRanks.length === 0) return alert("Keine Ränge!"); let yamlContent = "groups:\n"; allRanks.forEach(rank => { const safeName = rank.name.toLowerCase().replace(/[^a-z0-9_-]/g, ''); yamlContent += `  ${safeName}:\n`; if (rank.permissions && rank.permissions.length > 0) { yamlContent += `    permissions:\n`; rank.permissions.forEach(p => { yamlContent += `      - ${p}: true\n`; }); } if (rank.inherits_from) { const safeInherit = rank.inherits_from.toLowerCase().replace(/[^a-z0-9_-]/g, ''); yamlContent += `    parents:\n`; yamlContent += `      - ${safeInherit}\n`; } }); const blob = new Blob([yamlContent], { type: 'text/yaml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'luckperms_ranks.yml'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); });

window.importPluginPerms = () => {
    if(allPlugins.length === 0) return alert("Es sind noch keine Plugins gespeichert!");
    let currentPerms = document.getElementById('rank-perms').value.split('\n').map(p => p.trim()).filter(p => p !== "");
    allPlugins.forEach(pl => { 
        let text = pl.perms || pl.info;
        if(text) { let pluginLines = text.split('\n').map(p => p.trim()).filter(p => p !== ""); currentPerms = currentPerms.concat(pluginLines); } 
    });
    let uniquePerms = [...new Set(currentPerms)]; document.getElementById('rank-perms').value = uniquePerms.join('\n'); alert("Permissions erfolgreich importiert!");
};

// ==========================================
// KISTEN LOGIK (MIT UMBENNEN & DRAG DROP)
// ==========================================

window.toggleDragDrop = function() {
    window.dragDropActive = !window.dragDropActive;
    const btn = document.getElementById('btn-toggle-drag');
    if(window.dragDropActive) {
        btn.innerText = "🔓 Drag & Drop: AN";
        btn.style.borderColor = "#4CAF50"; btn.style.color = "#4CAF50";
    } else {
        btn.innerText = "🔒 Drag & Drop: AUS";
        btn.style.borderColor = "var(--border-color)"; btn.style.color = "var(--text-main)";
    }
    window.renderCrates(); 
};

window.renderCrates = function() {
    const container = document.getElementById('crates-container');
    if(!container) return;
    container.innerHTML = '';
    
    allCrates.forEach(crate => {
        let items = [...(crate.items || [])];
        const sortMode = window.crateSortModes[crate.id] || 'default';
        if (sortMode === 'chance') { items.sort((a, b) => (Number(b.chance) || 0) - (Number(a.chance) || 0)); } 
        else if (sortMode === 'name') { items.sort((a, b) => (a.name || '').localeCompare(b.name || '')); }

        let crateImgHtml = crate.image_url ? `<img src="${crate.image_url}" class="thumbnail" style="width:50px;height:50px;">` : `<div class="thumbnail" style="width:50px;height:50px; display:flex; align-items:center; justify-content:center; font-size:24px;">📦</div>`;
        
        let itemsHtml = items.map(item => {
            let typeIcon = '📦';
            if(item.type === 'money') typeIcon = '<span style="font-size:20px;">💰</span>';
            if(item.type === 'perk') typeIcon = '<span style="font-size:20px;">🌟</span>';
            if(item.type === 'special') typeIcon = '<span style="font-size:20px;">✨</span>';
            
            let imgContent = item.image_url ? `<img src="${item.image_url}" class="thumbnail" style="width:30px;height:30px;">` : typeIcon;
            let enchHtml = (item.enchantments && item.enchantments.length > 0) ? `<div style="font-size: 11px; color: #a855f7; margin-top: 4px;">🪄 ${item.enchantments.join(', ')}</div>` : '';
            
            return `<tr>
                <td style="text-align: center;">${imgContent}</td>
                <td><strong>${item.name}</strong>${enchHtml}</td>
                <td>${item.quantity || 1}x</td>
                <td>${item.chance}%</td>
                <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm" onclick="window.editCrateItem('${crate.id}', '${item.id}')">✏️ Bearbeiten</button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteCrateItem('${crate.id}', '${item.id}')">🗑️ Löschen</button>
                </td>
            </tr>`;
        }).join('');
        
        let isCollapsed = window.crateCollapsed[crate.id] !== false; 
        let displayStyle = isCollapsed ? 'none' : 'block';
        let iconText = isCollapsed ? '▶️' : '🔽';
        let dragAttr = window.dragDropActive ? 'draggable="true"' : '';

        container.innerHTML += `
            <div class="crate-box" ${dragAttr} data-crate-id="${crate.id}">
                <div class="crate-header" style="cursor: pointer; margin-bottom: 0; padding-bottom: ${isCollapsed ? '0' : '15px'}; border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border-color)'};" onclick="window.toggleCrate('${crate.id}')">
                    <div class="crate-header-left" ${dragAttr} title="${window.dragDropActive ? 'Halten um Kiste zu verschieben' : 'Drag & Drop ist gesperrt'}">
                        <span id="crate-icon-${crate.id}" style="margin-right: 8px; font-size: 14px;">${iconText}</span>
                        ${crateImgHtml}
                        <h3 style="font-size: 18px; margin: 0;">${crate.name || 'Unbenannte Kiste'}</h3>
                    </div>
                    <div class="button-group" onclick="event.stopPropagation()">
                        <select onchange="window.changeCrateSort('${crate.id}', this.value)" style="padding: 6px; border-radius: 4px; background: var(--surface-color); color: var(--text-main); border: 1px solid var(--border-color); font-size: 12px; outline: none;">
                            <option value="default" ${sortMode === 'default' ? 'selected' : ''}>Sortierung: Standard</option>
                            <option value="chance" ${sortMode === 'chance' ? 'selected' : ''}>Sortierung: Chance</option>
                            <option value="name" ${sortMode === 'name' ? 'selected' : ''}>Sortierung: A-Z</option>
                        </select>
                        <button class="btn btn-secondary btn-sm" style="border-color:#FF9800; color:#FF9800;" onclick="window.simulateCrate('${crate.id}')">🎲 Test-Öffnen</button>
                        <button class="btn btn-info btn-sm" onclick="window.exportCrateYaml('${crate.id}')">📥 CrazyCrates Export</button>
                        <button class="btn btn-primary btn-sm" onclick="window.openItemModal('${crate.id}')">+ Item</button>
                        <button class="btn btn-secondary btn-sm" onclick="window.renameCrate('${crate.id}')">✏️ Name ändern</button>
                        <button class="btn btn-danger btn-sm" onclick="window.deleteEntry('crates', '${crate.id}')">Löschen</button>
                    </div>
                </div>
                <div id="crate-content-${crate.id}" style="display: ${displayStyle}; margin-top: 15px;">
                    ${items.length > 0 ? `<table class="crate-items-table"><thead><tr><th style="width: 50px;">Art</th><th>Item Name</th><th>Menge</th><th>Chance</th><th style="text-align: right;">Aktion</th></tr></thead><tbody>${itemsHtml}</tbody></table>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Items in dieser Kiste. Klicke auf "+ Item hinzufügen".</p>'}
                </div>
            </div>`;
    });

    if(window.dragDropActive) {
        const boxes = document.querySelectorAll('.crate-box[data-crate-id]');
        boxes.forEach(box => {
            box.addEventListener('dragstart', function(e) { draggedCrateBox = this; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/html', this.innerHTML); this.style.opacity = '0.4'; });
            box.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag-over'); return false; });
            box.addEventListener('dragleave', function(e) { this.classList.remove('drag-over'); });
            box.addEventListener('drop', function(e) {
                e.stopPropagation(); this.classList.remove('drag-over');
                if (draggedCrateBox !== this) {
                    let parent = this.parentNode; let children = Array.from(parent.children); let srcIndex = children.indexOf(draggedCrateBox); let targetIndex = children.indexOf(this);
                    if (srcIndex < targetIndex) { this.after(draggedCrateBox); } else { this.before(draggedCrateBox); }
                    let newOrderIds = Array.from(parent.children).map(el => el.getAttribute('data-crate-id')).filter(id => id);
                    newOrderIds.forEach((id, index) => { updateDoc(doc(db, "crates", id), { order: index }); });
                }
                return false;
            });
            box.addEventListener('dragend', function(e) { this.style.opacity = '1'; boxes.forEach(b => b.classList.remove('drag-over')); });
        });
    }
};

window.renameCrate = async (id) => {
    const crate = allCrates.find(c => c.id === id); if(!crate) return;
    const newName = prompt("Bitte gib einen neuen Namen für die Kiste ein:", crate.name);
    if(newName && newName.trim() !== "" && newName !== crate.name) { await updateDoc(doc(db, "crates", id), { name: newName.trim() }); }
}

window.toggleCrate = (id) => { 
    window.crateCollapsed[id] = window.crateCollapsed[id] === false ? true : false; 
    const content = document.getElementById(`crate-content-${id}`); const icon = document.getElementById(`crate-icon-${id}`); const header = content.previousElementSibling;
    if (window.crateCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } 
    else { content.style.display = 'block'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; } 
};
window.changeCrateSort = (crateId, mode) => { window.crateSortModes[crateId] = mode; window.renderCrates(); };

document.getElementById('btn-save-crate').addEventListener('click', async () => { try { const crate_name = document.getElementById('crate-name').value; const fileInput = document.getElementById('crate-image'); const file = fileInput ? fileInput.files[0] : null; const status = document.getElementById('crate-status'); if(!crate_name) return alert("Name fehlt!"); status.innerText = "Erstelle Kiste..."; let imageUrl = null; if (file) imageUrl = await uploadImage(file, 'crates'); await addDoc(collection(db, "crates"), { name: crate_name, image_url: imageUrl, items: [], order: allCrates.length }); status.innerText = "Erfolgreich!"; setTimeout(() => status.innerText = "", 2000); document.getElementById('crate-name').value = ''; if(fileInput) fileInput.value = ''; } catch (error) { console.error(error); alert("Fehler: " + error.message); } });

window.changeCrateItemType = (preserveName = false) => { 
    const type = document.getElementById('modal-item-type').value; 
    const nameInput = document.getElementById('modal-item-name'); 
    const enchSection = document.getElementById('enchantment-section'); 
    if(type === 'money') { 
        nameInput.placeholder = "Geld-Betrag (z.B. 1000)"; 
        if(!preserveName) nameInput.value = ""; 
        enchSection.style.display = 'none'; 
    } 
    else if(type === 'perk') { 
        if(!preserveName) nameInput.value = "Platzhalter Perk"; 
        enchSection.style.display = 'none'; 
    } 
    else if(type === 'special') { 
        if(!preserveName) nameInput.value = "Platzhalter Spezial"; 
        enchSection.style.display = 'none'; 
    } 
    else { 
        nameInput.placeholder = "Item Name (z.B. Diamant)"; 
        if(!preserveName) nameInput.value = ""; 
        enchSection.style.display = 'block'; 
    } 
};

window.addEnchantmentField = (name = '', level = '1') => { 
    const container = document.getElementById('enchantments-container'); 
    const row = document.createElement('div'); 
    row.style.display = 'flex'; row.style.gap = '5px'; 
    row.innerHTML = `
        <input type="text" class="ench-name" placeholder="z.B. sharpness" value="${name}" style="flex:2; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-color); color: var(--text-main);">
        <input type="number" class="ench-level" placeholder="Lvl" value="${level}" style="flex:1; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-color); color: var(--text-main);">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">X</button>
    `; 
    container.appendChild(row); 
};

window.openItemModal = (crateId) => { 
    document.getElementById('item-modal-title').innerText = "Neues Item hinzufügen"; 
    document.getElementById('modal-crate-id').value = crateId; 
    document.getElementById('modal-edit-item-id').value = ''; 
    document.getElementById('modal-item-name').value = ''; 
    document.getElementById('modal-item-quantity').value = '1'; 
    document.getElementById('modal-item-chance').value = ''; 
    document.getElementById('enchantments-container').innerHTML = ''; 
    document.getElementById('item-modal').classList.add('active'); 
};

window.editCrateItem = (crateId, itemId) => { 
    const crate = allCrates.find(c => c.id === crateId); if (!crate) return; 
    const item = (crate.items || []).find(i => i.id === itemId); if (!item) return; 
    document.getElementById('item-modal-title').innerText = "Item bearbeiten"; 
    document.getElementById('modal-crate-id').value = crateId; 
    document.getElementById('modal-edit-item-id').value = item.id; 
    document.getElementById('modal-item-type').value = item.type || 'item'; 
    
    window.changeCrateItemType(true); 
    
    document.getElementById('modal-item-name').value = item.name || ''; 
    document.getElementById('modal-item-quantity').value = item.quantity || 1; 
    document.getElementById('modal-item-chance').value = item.chance || ''; 
    
    const enchContainer = document.getElementById('enchantments-container'); enchContainer.innerHTML = ''; 
    if (item.enchantments && item.enchantments.length > 0) { 
        item.enchantments.forEach(ench => {
            const parts = ench.split(':');
            window.addEnchantmentField(parts[0], parts[1] || '1');
        }); 
    } 
    document.getElementById('item-modal').classList.add('active'); 
};

document.getElementById('btn-save-item').addEventListener('click', async () => {
    try {
        const crateId = document.getElementById('modal-crate-id').value; 
        const editItemId = document.getElementById('modal-edit-item-id').value; 
        const type = document.getElementById('modal-item-type').value; 
        const name = document.getElementById('modal-item-name').value; 
        const quantity = document.getElementById('modal-item-quantity').value; 
        const chance = document.getElementById('modal-item-chance').value; 
        const file = document.getElementById('modal-item-image').files[0]; 
        
        if(!name || !chance || !quantity) return alert("Pflichtfelder fehlen!"); 
        
        const enchNames = document.querySelectorAll('.ench-name'); 
        const enchLevels = document.querySelectorAll('.ench-level'); 
        let enchantments = [];
        for(let i=0; i<enchNames.length; i++) {
            const eName = enchNames[i].value.trim();
            const eLevel = enchLevels[i].value.trim() || '1';
            if(eName) enchantments.push(`${eName}:${eLevel}`);
        }

        let imageUrl = null; if(file) imageUrl = await uploadImage(file, 'crates/items');
        const crateRef = doc(db, "crates", crateId); const crate = allCrates.find(c => c.id === crateId);
        let updatedItems = [...(crate.items || [])];
        if(editItemId) { 
            const idx = updatedItems.findIndex(i => i.id === editItemId); 
            if(idx > -1) { 
                updatedItems[idx].type = type; updatedItems[idx].name = name; 
                updatedItems[idx].quantity = Number(quantity); updatedItems[idx].chance = Number(chance); 
                updatedItems[idx].enchantments = enchantments; 
                if(file) updatedItems[idx].image_url = imageUrl; 
            } 
        } else { 
            updatedItems.push({ id: Date.now().toString(), type, name, quantity: Number(quantity), chance: Number(chance), enchantments, image_url: imageUrl }); 
        }
        await updateDoc(crateRef, { items: updatedItems });
        document.getElementById('item-modal').classList.remove('active');
    } catch (error) { console.error(error); alert("Fehler: " + error.message); }
});

window.deleteCrateItem = async (crateId, itemId) => { if(confirm("Item entfernen?")) { try { const crateRef = doc(db, "crates", crateId); const crate = allCrates.find(c => c.id === crateId); await updateDoc(crateRef, { items: (crate.items || []).filter(i => i.id !== itemId) }); } catch (error) { console.error(error); } } };
window.simulateCrate = function(crateId) { const crate = allCrates.find(c => c.id === crateId); if(!crate || !crate.items || crate.items.length === 0) return alert("Die Kiste hat noch keine Items!"); let totalChance = crate.items.reduce((sum, item) => sum + (Number(item.chance) || 0), 0); if(totalChance === 0) return alert("Die Items in dieser Kiste haben keine Wahrscheinlichkeit (0%)!"); let results = {}; crate.items.forEach(i => results[i.id] = 0); for(let i=0; i<1000; i++) { let rand = Math.random() * totalChance; let current = 0; for(let item of crate.items) { current += (Number(item.chance) || 0); if(rand <= current) { results[item.id]++; break; } } } let html = `<ul style="list-style:none; padding:0; margin:0;">`; let sortedItems = [...crate.items].sort((a, b) => results[b.id] - results[a.id]); sortedItems.forEach(item => { let count = results[item.id]; let realPercent = ((count / 1000) * 100).toFixed(1); html += `<li style="padding: 8px 0; border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between;"><span><strong>${item.name}</strong></span><span style="color:var(--text-muted);">${count}x gezogen <b style="color:#00BCD4;">(${realPercent}%)</b></span></li>`; }); html += `</ul>`; document.getElementById('crate-test-result').innerHTML = html; document.getElementById('crate-test-modal').classList.add('active'); };
window.exportCrateYaml = function(crateId) { const crate = allCrates.find(c => c.id === crateId); if(!crate) return alert("Kiste nicht gefunden!"); let safeName = crate.name ? crate.name.replace(/[^a-zA-Z0-9]/g, '') : 'CustomCrate'; let yaml = `Crate:\n  CrateType: CSGO\n  CrateName: '&8${crate.name || 'Unbenannte Kiste'}'\n  Preview-Name: '&8${crate.name || 'Unbenannte Kiste'} Preview'\n  StartingKeys: 0\n  InGUI: true\n  Slot: 14\nPrizes:\n`; let items = crate.items || []; items.forEach((item, index) => { yaml += `  '${index + 1}':\n    DisplayName: '&f${item.name}'\n    DisplayAmount: ${item.quantity || 1}\n    MaxRange: 100\n    Chance: ${item.chance}\n`; if(item.type === 'money') { yaml += `    DisplayItem: 'SUNFLOWER'\n    Commands:\n      - 'eco give %player% ${item.quantity || 1000}'\n`; } else if(item.type === 'perk' || item.type === 'special') { yaml += `    DisplayItem: 'NETHER_STAR'\n    Commands:\n      - 'lp user %player% permission set <deine_permission> true'\n`; } else { yaml += `    DisplayItem: 'STONE'\n    Items:\n      - 'Item:STONE, Amount:${item.quantity || 1}'\n`; } if(item.enchantments && item.enchantments.length > 0) { yaml += `    DisplayEnchantments:\n`; item.enchantments.forEach(ench => { yaml += `      - '${ench}'\n`; }); } }); const blob = new Blob([yaml], { type: 'text/yaml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${safeName}.yml`; a.click(); URL.revokeObjectURL(url); };


// ==========================================
// MENÜ PLANER & GUI EDITOR LOGIK (Repariert)
// ==========================================
const plannerPresets = [ { id: 'btn_next', text: 'Nächste', icon: '▶️' }, { id: 'btn_close', text: 'Schließen', icon: '❌' } ];
let currentMenuLayout = {}; let plannerBgImage = null;

window.initMenuPlanner = function() {
    try {
        const palette = document.getElementById('palette-items'); if(!palette) return; palette.innerHTML = '';
        plannerPresets.forEach(item => { palette.innerHTML += `<div class="palette-item" draggable="true" ondragstart="window.dragStart(event, '${item.id}')"><span style="font-size: 24px; width: 30px; text-align: center;">${item.icon}</span><span style="font-size: 14px;">${item.text}</span></div>`; });
        window.updateMenuGrid();
    } catch(e) { console.error("Planner Init Error:", e); }
}

window.updateMenuGrid = function() {
    try {
        const rowsElem = document.getElementById('menu-rows'); if(!rowsElem) return;
        const rows = parseInt(rowsElem.value); const grid = document.getElementById('mc-inventory'); 
        grid.innerHTML = '';
        for(let i=0; i < rows * 9; i++) { 
            const itemId = currentMenuLayout[i]; let icon = ''; 
            if(itemId) { const preset = plannerPresets.find(p => p.id === itemId); if(preset) icon = preset.icon; } 
            grid.innerHTML += `<div class="mc-slot" data-slot="${i}" ondragover="window.allowDrop(event)" ondragleave="window.dragLeave(event)" ondrop="window.drop(event)" onclick="window.clickSlot(${i})">${icon}</div>`; 
        }
    } catch(e) { console.error("Grid Update Error", e); }
};

window.dragStart = function(ev, id) { ev.dataTransfer.setData("text", id); };
window.allowDrop = function(ev) { ev.preventDefault(); if(ev.target.classList.contains('mc-slot')) ev.target.classList.add('drag-over'); };
window.dragLeave = function(ev) { if(ev.target.classList.contains('mc-slot')) ev.target.classList.remove('drag-over'); };
window.drop = function(ev) { ev.preventDefault(); let target = ev.target; if(!target.classList.contains('mc-slot')) target = target.closest('.mc-slot'); if(target) { target.classList.remove('drag-over'); const id = ev.dataTransfer.getData("text"); const slot = target.getAttribute('data-slot'); currentMenuLayout[slot] = id; window.updateMenuGrid(); } };
window.clickSlot = function(slot) { if(currentMenuLayout[slot]) { delete currentMenuLayout[slot]; window.updateMenuGrid(); } };

window.openMenuPlannerForPkg = (pkgId) => { document.querySelector('[data-target="menu-planner"]').click(); document.getElementById('planner-pkg-select').value = pkgId; document.getElementById('planner-menu-name').value = ''; document.getElementById('planner-menu-id').value = ''; currentMenuLayout = {}; window.updateMenuGrid(); };
window.editLayoutInPlanner = (pkgId, itemId) => { const pkg = allGUIs.find(g => g.id === pkgId); if(!pkg) return; const item = (pkg.items || []).find(i => i.id === itemId); if(!item) return; document.querySelector('[data-target="menu-planner"]').click(); document.getElementById('planner-pkg-select').value = pkgId; document.getElementById('planner-menu-name').value = item.name; document.getElementById('planner-menu-id').value = item.id; if(item.rows) document.getElementById('menu-rows').value = item.rows; if(item.bg_url) document.getElementById('planner-bg-select').value = item.bg_url; if(item.offset_x !== undefined) document.getElementById('planner-offset-x').value = item.offset_x; if(item.offset_y !== undefined) document.getElementById('planner-offset-y').value = item.offset_y; currentMenuLayout = item.layout || {}; window.updateMenuGrid(); };

window.saveMenuLayout = async function() {
    const pkgId = document.getElementById('planner-pkg-select').value; const menuName = document.getElementById('planner-menu-name').value; const editItemId = document.getElementById('planner-menu-id').value; const rows = parseInt(document.getElementById('menu-rows').value); const bgUrl = document.getElementById('planner-bg-select').value; const offX = parseInt(document.getElementById('planner-offset-x').value); const offY = parseInt(document.getElementById('planner-offset-y').value);
    if(!pkgId) return alert("Bitte wähle ein Ziel-Paket aus!"); if(!menuName) return alert("Bitte gib dem Layout einen Namen!");
    try { const pkgRef = doc(db, "guis", pkgId); const pkg = allGUIs.find(g => g.id === pkgId); let updatedItems = [...(pkg.items || [])]; const layoutData = { type: 'layout', rows: rows, bg_url: bgUrl, offset_x: offX, offset_y: offY, layout: currentMenuLayout }; if (editItemId) { const idx = updatedItems.findIndex(i => i.id === editItemId); if(idx > -1) { updatedItems[idx].name = menuName; updatedItems[idx].rows = rows; updatedItems[idx].bg_url = bgUrl; updatedItems[idx].offset_x = offX; updatedItems[idx].offset_y = offY; updatedItems[idx].layout = currentMenuLayout; } else { updatedItems.push({ id: editItemId, name: menuName, ...layoutData }); } } else { updatedItems.push({ id: Date.now().toString(), name: menuName, ...layoutData }); } await updateDoc(pkgRef, { items: updatedItems }); alert("Erfolgreich im Paket gespeichert!"); document.querySelector('[data-target="gui"]').click(); } catch (error) { console.error(error); alert("Fehler beim Speichern!"); }
};

window.exportMenuYaml = function() {
    const name = document.getElementById('planner-menu-name').value || 'custom_menu'; const rows = parseInt(document.getElementById('menu-rows').value); let yaml = `menu_title: '&8${name}'\nopen_command: '${name.toLowerCase().replace(/\s+/g, '')}'\nsize: ${rows * 9}\nitems:\n`;
    for(let slot in currentMenuLayout) { const itemId = currentMenuLayout[slot]; const preset = plannerPresets.find(p => p.id === itemId); if(!preset) continue; yaml += `  '${itemId}_${slot}':\n`; if(itemId === 'btn_next') { yaml += `    material: arrow\n    slot: ${slot}\n    display_name: '&aNächste Seite'\n    left_click_commands:\n      - '[player] menu open nächste_seite'\n`; } else if(itemId === 'btn_prev') { yaml += `    material: arrow\n    slot: ${slot}\n    display_name: '&cLetzte Seite'\n    left_click_commands:\n      - '[player] menu open vorherige_seite'\n`; } else if(itemId === 'btn_close') { yaml += `    material: barrier\n    slot: ${slot}\n    display_name: '&cSchließen'\n    left_click_commands:\n      - '[close]'\n`; } else if(itemId === 'btn_money') { yaml += `    material: gold_ingot\n    slot: ${slot}\n    display_name: '&eDein Guthaben'\n    lore:\n      - '&7Du hast: %vault_eco_balance%'\n`; } else { yaml += `    material: stone\n    slot: ${slot}\n    display_name: '&f${preset.text}'\n`; } }
    const blob = new Blob([yaml], { type: 'text/yaml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${name.toLowerCase().replace(/\s+/g, '_')}.yml`; a.click(); URL.revokeObjectURL(url);
};

window.openGuiEditorForPkg = (pkgId) => { 
    document.querySelector('[data-target="gui-editor"]').click(); 
    document.getElementById('editor-pkg-select').value = pkgId; 
    document.getElementById('editor-gui-name').value = ''; 
    document.getElementById('editor-gui-item-id').value = ''; 
    if(window.clearCanvasSilent) window.clearCanvasSilent(); 
};

window.editGuiItemInEditor = async (pkgId, itemId) => { 
    const pkg = allGUIs.find(g => g.id === pkgId); if(!pkg) return; 
    const item = (pkg.items || []).find(i => i.id === itemId); if(!item) return; 
    document.querySelector('[data-target="gui-editor"]').click(); 
    
    // Warte kurz bis UI da ist
    setTimeout(async () => {
        document.getElementById('editor-pkg-select').value = pkgId; 
        document.getElementById('editor-gui-name').value = item.name; 
        document.getElementById('editor-gui-item-id').value = item.id; 
        
        if(item.image_url) { 
            try { 
                const imgRef = ref(storage, item.image_url); const blob = await getBlob(imgRef); const localUrl = URL.createObjectURL(blob); const img = new Image(); 
                img.onload = () => { 
                    if(window.clearCanvasSilent) window.clearCanvasSilent(); 
                    const canvas = document.getElementById('pixelCanvas'); const ctx = canvas.getContext('2d'); 
                    ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
                    URL.revokeObjectURL(localUrl); if(window.triggerSaveState) window.triggerSaveState(); 
                }; 
                img.src = localUrl; 
            } catch (error) { console.error(error); alert("Fehler beim Importieren: " + error.message); } 
        } else { if(window.clearCanvasSilent) window.clearCanvasSilent(); } 
    }, 200);
};

// Canvas Editor Kapselung (Nur 1x laden)
let editorInitialized = false;
function initEditor() {
    if (editorInitialized) return; 
    const canvas = document.getElementById('pixelCanvas'); 
    if(!canvas) return;
    
    editorInitialized = true;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let currentZoom = 2; let currentTool = 'brush'; let selectedColor = '#a49e95'; 
    let isDrawing = false; let isEraseMode = false; let startPos = {x:0, y:0}; 
    const undoStack = [];
    
    window.clearCanvasSilent = function() { ctx.clearRect(0,0,canvas.width,canvas.height); }
    window.clearCanvas = function(){if(confirm("Löschen?")){window.clearCanvasSilent();}}
    
    function getMousePos(evt) { const r = canvas.getBoundingClientRect(); return { x: Math.floor((evt.clientX - r.left)/currentZoom), y: Math.floor((evt.clientY - r.top)/currentZoom) }; }
    
    canvas.addEventListener('mousedown', function(e) { 
        isDrawing = true; const pos = getMousePos(e); 
        ctx.fillStyle = selectedColor; ctx.fillRect(pos.x, pos.y, 1, 1); 
    });
    canvas.addEventListener('mousemove', function(e) { 
        if (!isDrawing) return; const pos = getMousePos(e); 
        ctx.fillStyle = selectedColor; ctx.fillRect(pos.x, pos.y, 1, 1); 
    });
    window.addEventListener('mouseup', function() { isDrawing = false; });
    
    window.saveEditorToFirebase = async function() {
        const pkgId = document.getElementById('editor-pkg-select').value;
        const guiName = document.getElementById('editor-gui-name').value;
        if(!pkgId || !guiName) return alert("Paket und Name fehlen!");

        const btn = document.getElementById('btn-editor-save');
        btn.innerText = "Lade hoch...";
        
        try {
            const dataUrl = canvas.toDataURL('image/png');
            const storageRef = ref(storage, `guis/images/gui_${Date.now()}.png`);
            await uploadString(storageRef, dataUrl, 'data_url');
            const imageUrl = await getDownloadURL(storageRef);
            
            const pkgRef = doc(db, "guis", pkgId);
            const pkg = allGUIs.find(g => g.id === pkgId);
            let updatedItems = [...(pkg.items || [])];
            updatedItems.push({ id: Date.now().toString(), name: guiName, image_url: imageUrl });
            await updateDoc(pkgRef, { items: updatedItems });

            btn.innerText = "Erfolgreich!";
            setTimeout(() => { btn.innerText = "💾 In Paket speichern"; ctx.clearRect(0,0,canvas.width,canvas.height); }, 1000);
        } catch (error) { console.error(error); alert("Fehler: " + error.message); }
    }
}