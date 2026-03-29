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

    // KISTEN
    onSnapshot(collection(db, "crates"), (snap) => {
        allCrates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCrates.sort((a, b) => (a.order || 0) - (b.order || 0)); 
        window.renderCrates(); 
        updateDashboard();
    });

    onSnapshot(collection(db, "shop"), (snap) => { allShop = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); updateDashboard(); });
    onSnapshot(collection(db, "ranks"), (snap) => { allRanks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); updateDashboard(); });
    onSnapshot(collection(db, "guis"), (snap) => { 
        allGUIs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
        updateDashboard(); 
        const editorSelect = document.getElementById('editor-pkg-select');
        const plannerSelect = document.getElementById('planner-pkg-select');
        if(editorSelect) { editorSelect.innerHTML = '<option value="">Ziel-Paket wählen...</option>'; allGUIs.forEach(pkg => editorSelect.innerHTML += `<option value="${pkg.id}">${pkg.name}</option>`); }
        if(plannerSelect) { plannerSelect.innerHTML = '<option value="">Ziel-Paket wählen...</option>'; allGUIs.forEach(pkg => plannerSelect.innerHTML += `<option value="${pkg.id}">${pkg.name}</option>`); }
    });
}

window.deleteEntry = async (collectionName, id) => { if(confirm('Wirklich komplett löschen?')) { await deleteDoc(doc(db, collectionName, id)); } };

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
        document.getElementById('event-status').innerText = "Erfolgreich!";
        setTimeout(() => document.getElementById('event-status').innerText = "", 2000);
        window.resetEventForm();
    } catch(e) { console.error(e); alert("Fehler beim Speichern!"); }
});

// ==========================================
// KISTEN LOGIK & DRAG-DROP
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
            if(item.type === 'money') typeIcon = '💰';
            
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
                        </select>
                        <button class="btn btn-primary btn-sm" onclick="window.openItemModal('${crate.id}')">+ Item</button>
                        <button class="btn btn-danger btn-sm" onclick="window.deleteEntry('crates', '${crate.id}')">Löschen</button>
                    </div>
                </div>
                <div id="crate-content-${crate.id}" style="display: ${displayStyle}; margin-top: 15px;">
                    ${items.length > 0 ? `<table class="crate-items-table"><thead><tr><th style="width: 50px;">Art</th><th>Item Name</th><th>Menge</th><th>Chance</th><th style="text-align: right;">Aktion</th></tr></thead><tbody>${itemsHtml}</tbody></table>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Items in dieser Kiste.</p>'}
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

window.toggleCrate = (id) => { 
    window.crateCollapsed[id] = window.crateCollapsed[id] === false ? true : false; 
    const content = document.getElementById(`crate-content-${id}`); const icon = document.getElementById(`crate-icon-${id}`); const header = content.previousElementSibling;
    if (window.crateCollapsed[id] !== false) { content.style.display = 'none'; icon.innerText = '▶️'; header.style.paddingBottom = '0'; header.style.borderBottom = 'none'; } 
    else { content.style.display = 'block'; icon.innerText = '🔽'; header.style.paddingBottom = '15px'; header.style.borderBottom = '1px solid var(--border-color)'; } 
};
window.changeCrateSort = (crateId, mode) => { window.crateSortModes[crateId] = mode; window.renderCrates(); };

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


// ==========================================
// MENÜ PLANER & GUI EDITOR LOGIK
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

let editorInitialized = false;
function initEditor() {
    if (editorInitialized) return; 
    const canvas = document.getElementById('pixelCanvas'); 
    if(!canvas) return;
    
    editorInitialized = true;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let currentZoom = 2; let selectedColor = '#a49e95'; 
    let isDrawing = false; 
    
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