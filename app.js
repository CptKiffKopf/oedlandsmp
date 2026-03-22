import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, deleteDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, uploadString } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

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

let allRanks = [], allGUIs = [], allCrates = [], allShop = [], allAds = [], allPlugins = [];
let editingRankId = null; 
let listenersActive = false; 

// ==========================================
// HILFSFUNKTIONEN & AUTH
// ==========================================

async function uploadImage(file, folderPath) {
    if (!file) return null;
    const storageRef = ref(storage, `${folderPath}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

function dataURLtoFile(dataurl, filename) {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){ u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], filename, {type:mime});
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        if (!listenersActive) { startRealtimeListeners(); initEditor(); listenersActive = true; }
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorText = document.getElementById('login-error');
    if(!email || !password) return errorText.innerText = "Bitte beides ausfüllen!";
    errorText.innerText = "Logge ein..."; errorText.style.color = "var(--text-muted)";
    try { await signInWithEmailAndPassword(auth, email, password); errorText.innerText = ""; } 
    catch (error) { errorText.style.color = "var(--danger)"; errorText.innerText = "Falsche E-Mail oder Passwort!"; }
});
document.getElementById('btn-logout').addEventListener('click', () => { signOut(auth); });

document.querySelectorAll('.nav-item:not(#btn-logout)').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item:not(#btn-logout)').forEach(nav => nav.classList.remove('active'));
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.querySelectorAll('.category-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        
        if(targetId === 'gui-editor') {
            setTimeout(() => { if(window.resizeCanvas) window.resizeCanvas(); }, 50);
        }
    });
});

function updateDashboard() {
    document.getElementById('stat-ranks').innerText = allRanks.length;
    document.getElementById('stat-crates').innerText = allCrates.length;
    document.getElementById('stat-plugins').innerText = allPlugins.length;
    document.getElementById('stat-shop').innerText = allShop.length;
    document.getElementById('stat-guis').innerText = allGUIs.length; 
}

function sortRanksHierarchically(ranks) {
    let sorted = [], visited = new Set(), baseRanks = ranks.filter(r => !r.inherits_from);
    function addChildren(parentName) { let children = ranks.filter(r => r.inherits_from === parentName); children.forEach(child => { if (!visited.has(child.id)) { visited.add(child.id); sorted.push(child); addChildren(child.name); } }); }
    baseRanks.forEach(baseRank => { if (!visited.has(baseRank.id)) { visited.add(baseRank.id); sorted.push(baseRank); addChildren(baseRank.name); } });
    ranks.forEach(r => { if (!visited.has(r.id)) sorted.push(r); });
    return sorted;
}


// ==========================================
// DATEN LADEN (REALTIME LISTENER)
// ==========================================

function startRealtimeListeners() {
    onSnapshot(collection(db, "ranks"), (snap) => {
        allRanks = sortRanksHierarchically(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        const list = document.getElementById('rank-list'); list.innerHTML = '';
        allRanks.forEach(rank => {
            const myPerms = rank.permissions || []; const parentRank = rank.inherits_from ? allRanks.find(r => r.name === rank.inherits_from) : null; const inherited = parentRank ? (parentRank.permissions || []) : [];
            let permsHtml = myPerms.map(p => `<span class="perm-badge">${p}</span>`).join('') + inherited.map(p => `<span class="perm-badge perm-inherited">${p}</span>`).join('');
            let imgHtml = rank.image_url ? `<img src="${rank.image_url}" class="thumbnail">` : '<div class="thumbnail"></div>';
            let indent = rank.inherits_from ? '<span style="color:#9ca3af; margin-right:5px;">↳</span>' : '';
            list.innerHTML += `<tr><td>${imgHtml}</td><td><strong>${indent}${rank.name}</strong></td><td>${rank.inherits_from || '-'}</td><td>${permsHtml || '-'}</td><td class="action-cell"><button class="btn btn-secondary btn-sm" onclick="window.editRank('${rank.id}')">Bearbeiten</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('ranks', '${rank.id}')">Löschen</button></td></tr>`;
        });
        const dropdown = document.getElementById('rank-inherit'); dropdown.innerHTML = '<option value="">Erbt von... (Keiner)</option>';
        allRanks.forEach(r => { if(r.id !== editingRankId) { dropdown.innerHTML += `<option value="${r.name}">${r.name}</option>`; } });
        if(editingRankId) { const currentEdit = allRanks.find(r => r.id === editingRankId); if(currentEdit) document.getElementById('rank-inherit').value = currentEdit.inherits_from || ''; }
        updateDashboard();
    });

    onSnapshot(collection(db, "plugins"), (snap) => {
        allPlugins = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('plugin-list'); list.innerHTML = '';
        allPlugins.forEach(plugin => { list.innerHTML += `<tr><td><strong>${plugin.name}</strong></td><td style="white-space: pre-wrap; font-size: 13px;">${plugin.info || '-'}</td><td style="text-align: right;"><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('plugins', '${plugin.id}')">Löschen</button></td></tr>`; });
        updateDashboard();
    });

    onSnapshot(collection(db, "crates"), (snap) => {
        allCrates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('crates-container'); container.innerHTML = '';
        allCrates.forEach(crate => {
            let items = crate.items || []; let crateImgHtml = crate.image_url ? `<img src="${crate.image_url}" class="thumbnail" style="width:50px;height:50px;">` : `<div class="thumbnail" style="width:50px;height:50px;"></div>`;
            let itemsHtml = items.map(item => `<tr><td>${item.image_url ? `<img src="${item.image_url}" class="thumbnail" style="width:30px;height:30px;">` : '-'}</td><td><strong>${item.name}</strong></td><td>${item.quantity || 1}x</td><td>${item.chance}%</td><td style="text-align: right;"><button class="btn btn-danger btn-sm" onclick="window.deleteCrateItem('${crate.id}', '${item.id}')">Entfernen</button></td></tr>`).join('');
            container.innerHTML += `<div class="crate-box"><div class="crate-header"><div class="crate-header-left">${crateImgHtml}<h3 style="font-size: 18px;">${crate.name || 'Unbenannte Kiste'}</h3></div><div class="button-group"><button class="btn btn-primary btn-sm" onclick="window.openItemModal('${crate.id}')">+ Item hinzufügen</button><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('crates', '${crate.id}')">Kiste löschen</button></div></div>${items.length > 0 ? `<table class="crate-items-table"><thead><tr><th>Bild</th><th>Item Name</th><th>Menge</th><th>Chance</th><th style="text-align: right;">Aktion</th></tr></thead><tbody>${itemsHtml}</tbody></table>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Items in dieser Kiste.</p>'}</div>`;
        });
        updateDashboard();
    });

    onSnapshot(collection(db, "shop"), (snap) => {
        allShop = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('shop-list'); list.innerHTML = '';
        allShop.forEach(item => { let imgHtml = item.image_url ? `<img src="${item.image_url}" class="thumbnail">` : '<div class="thumbnail"></div>'; list.innerHTML += `<tr><td>${imgHtml}</td><td><strong>${item.name}</strong></td><td>${item.price} Pkt.</td><td><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('shop', '${item.id}')">Löschen</button></td></tr>`; });
        updateDashboard();
    });

    onSnapshot(collection(db, "guis"), (snap) => {
        allGUIs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('gui-packages-container');
        const editorSelect = document.getElementById('editor-pkg-select');
        if(!container) return;
        container.innerHTML = '';
        const currentEditorVal = editorSelect.value;
        editorSelect.innerHTML = '<option value="">Ziel-Paket wählen...</option>';

        allGUIs.forEach(pkg => {
            editorSelect.innerHTML += `<option value="${pkg.id}">${pkg.name}</option>`;
            let items = pkg.items || [];
            let itemsHtml = items.map(item => `
                <div class="gui-card">
                    <div class="gui-card-header">
                        <span>${item.name}</span>
                        <div>
                            <button class="btn btn-secondary btn-sm" onclick="window.editGuiItemInEditor('${pkg.id}', '${item.id}')" title="Im Editor bearbeiten">✏️</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteGuiItem('${pkg.id}', '${item.id}')">Löschen</button>
                        </div>
                    </div>
                    <img src="${item.image_url}" alt="${item.name}">
                </div>
            `).join('');

            container.innerHTML += `
                <div class="crate-box">
                    <div class="crate-header">
                        <div class="crate-header-left"><h3 style="font-size: 18px;">${pkg.name}</h3></div>
                        <div class="button-group">
                            <button class="btn btn-primary btn-sm" onclick="window.openGuiUploadModal('${pkg.id}')">🖼️ Bild hochladen</button>
                            <button class="btn btn-secondary btn-sm" onclick="window.openGuiEditorForPkg('${pkg.id}')">✏️ Neues GUI zeichnen</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteEntry('guis', '${pkg.id}')">Paket löschen</button>
                        </div>
                    </div>
                    ${items.length > 0 ? `<div class="gui-grid">${itemsHtml}</div>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine GUIs in diesem Paket.</p>'}
                </div>
            `;
        });
        if(currentEditorVal) editorSelect.value = currentEditorVal;
        updateDashboard();
    });

    onSnapshot(collection(db, "ads"), (snap) => {
        allAds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('ad-list'); list.innerHTML = '';
        allAds.forEach(ad => { let linkHtml = ad.link ? `<a href="${ad.link}" target="_blank" style="font-size:12px; display:block; margin-bottom:10px;">Link öffnen</a>` : ''; list.innerHTML += `<div class="gui-card"><div class="gui-card-header"><span>${ad.title}</span><button class="btn btn-danger btn-sm" onclick="window.deleteEntry('ads', '${ad.id}')">Löschen</button></div>${linkHtml}<img src="${ad.image_url}"></div>`; });
    });
}

window.deleteEntry = async (collectionName, id) => {
    if(confirm('Wirklich komplett löschen?')) { await deleteDoc(doc(db, collectionName, id)); }
};

// ==========================================
// 4. SPEICHERN LOGIK
// ==========================================

document.getElementById('btn-save-plugin').addEventListener('click', async () => {
    try { const name = document.getElementById('plugin-name').value; const info = document.getElementById('plugin-info').value; const status = document.getElementById('plugin-status'); if(!name) return alert("Bitte gib einen Plugin-Namen ein!"); status.innerText = "Speichere..."; await addDoc(collection(db, "plugins"), { name: name, info: info }); status.innerText = "Erfolgreich!"; setTimeout(() => status.innerText = "", 2000); document.getElementById('plugin-name').value = ''; document.getElementById('plugin-info').value = ''; } catch (error) { console.error(error); alert("Fehler: " + error.message); }
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

document.getElementById('btn-save-crate').addEventListener('click', async () => {
    try {
        const crate_name = document.getElementById('crate-name').value; const fileInput = document.getElementById('crate-image'); const file = fileInput ? fileInput.files[0] : null; const status = document.getElementById('crate-status');
        if(!crate_name) return alert("Bitte gib einen Namen für die Kiste ein!"); status.innerText = "Erstelle Kiste...";
        let imageUrl = null; if (file) imageUrl = await uploadImage(file, 'crates');
        await addDoc(collection(db, "crates"), { name: crate_name, image_url: imageUrl, items: [] });
        status.innerText = "Erfolgreich!"; setTimeout(() => status.innerText = "", 2000); document.getElementById('crate-name').value = ''; if(fileInput) fileInput.value = '';
    } catch (error) { console.error(error); alert("Fehler: " + error.message); }
});

window.openItemModal = (crateId) => { document.getElementById('modal-crate-id').value = crateId; document.getElementById('item-modal').classList.add('active'); };
document.getElementById('btn-save-item').addEventListener('click', async () => {
    try {
        const crateId = document.getElementById('modal-crate-id').value; const name = document.getElementById('modal-item-name').value; const quantity = document.getElementById('modal-item-quantity').value; const chance = document.getElementById('modal-item-chance').value; const file = document.getElementById('modal-item-image').files[0]; const status = document.getElementById('modal-status');
        if(!name || !chance || !quantity) return alert("Item-Name, Menge und Chance fehlen!"); status.innerText = "Speichere Item...";
        const imageUrl = await uploadImage(file, 'crates/items') || null;
        const newItem = { id: Date.now().toString(), name: name, quantity: Number(quantity), chance: Number(chance), image_url: imageUrl };
        const crateRef = doc(db, "crates", crateId); const crate = allCrates.find(c => c.id === crateId);
        await updateDoc(crateRef, { items: [...(crate.items || []), newItem] });
        status.innerText = "Erfolgreich!"; setTimeout(() => { status.innerText = ""; document.getElementById('modal-item-name').value = ''; document.getElementById('modal-item-quantity').value = '1'; document.getElementById('modal-item-chance').value = ''; if(document.getElementById('modal-item-image')) document.getElementById('modal-item-image').value = ''; document.getElementById('item-modal').classList.remove('active'); }, 1000);
    } catch (error) { console.error(error); alert("Fehler: " + error.message); }
});
window.deleteCrateItem = async (crateId, itemId) => { if(confirm("Item entfernen?")) { try { const crateRef = doc(db, "crates", crateId); const crate = allCrates.find(c => c.id === crateId); await updateDoc(crateRef, { items: (crate.items || []).filter(i => i.id !== itemId) }); } catch (error) { console.error(error); } } };

document.getElementById('btn-save-shop').addEventListener('click', async () => {
    try {
        const name = document.getElementById('shop-item').value; const price = document.getElementById('shop-price').value; const file = document.getElementById('shop-image').files[0];
        if(!name || !price) return alert("Name und Preis fehlen!"); document.getElementById('shop-status').innerText = "Speichere...";
        const imageUrl = await uploadImage(file, 'shop') || null; await addDoc(collection(db, "shop"), { name, price: Number(price), image_url: imageUrl });
        document.getElementById('shop-status').innerText = ""; document.getElementById('shop-item').value = ''; document.getElementById('shop-price').value = '';
    } catch (error) { console.error(error); alert("Fehler: " + error.message); }
});

document.getElementById('btn-save-ad').addEventListener('click', async () => {
    try {
        const file = document.getElementById('ad-image').files[0]; if(!file || !document.getElementById('ad-title').value) return alert("Bild und Titel fehlen!");
        const imageUrl = await uploadImage(file, 'ads'); await addDoc(collection(db, "ads"), { title: document.getElementById('ad-title').value, link: document.getElementById('ad-link').value, image_url: imageUrl });
        document.getElementById('ad-title').value = ''; document.getElementById('ad-link').value = ''; document.getElementById('ad-image').value = '';
    } catch (error) { console.error(error); alert("Fehler: " + error.message); }
});


// ==========================================
// 5. GUI PAKETE & UPLOAD LOGIK
// ==========================================

document.getElementById('btn-save-gui-package').addEventListener('click', async () => {
    try {
        const pkgName = document.getElementById('gui-package-name').value; const status = document.getElementById('gui-package-status');
        if(!pkgName) return alert("Bitte gib dem GUI Paket einen Namen!"); status.innerText = "Erstelle Paket...";
        await addDoc(collection(db, "guis"), { name: pkgName, items: [] });
        status.innerText = "Erfolgreich!"; setTimeout(() => status.innerText = "", 2000); document.getElementById('gui-package-name').value = '';
    } catch (e) { console.error(e); alert("Fehler: " + e.message); }
});

window.openGuiUploadModal = (pkgId) => {
    document.getElementById('modal-gui-package-id').value = pkgId; document.getElementById('gui-upload-modal').classList.add('active');
};

document.getElementById('btn-save-gui-upload').addEventListener('click', async () => {
    const status = document.getElementById('modal-gui-status');
    try {
        const pkgId = document.getElementById('modal-gui-package-id').value; const name = document.getElementById('modal-gui-name').value; const file = document.getElementById('modal-gui-image').files[0];
        if(!name || !file) return alert("Bitte Name und Bild angeben!"); status.innerText = "Lade hoch (Bitte warten)...";
        const imageUrl = await uploadImage(file, 'guis/images');
        if(!imageUrl) throw new Error("Upload fehlgeschlagen.");
        
        status.innerText = "Speichere in Paket...";
        const newItem = { id: Date.now().toString(), name: name, image_url: imageUrl };
        const pkgRef = doc(db, "guis", pkgId); const pkg = allGUIs.find(g => g.id === pkgId);
        await updateDoc(pkgRef, { items: [...(pkg.items || []), newItem] });
        
        status.innerText = "Erfolgreich!"; setTimeout(() => { status.innerText = ""; document.getElementById('modal-gui-name').value = ''; document.getElementById('modal-gui-image').value = ''; document.getElementById('gui-upload-modal').classList.remove('active'); }, 1500);
    } catch (e) { console.error("Upload Error:", e); status.innerText = "Fehler!"; alert("Fehler beim Hochladen: " + e.message); }
});

window.deleteGuiItem = async (pkgId, itemId) => {
    if(confirm("GUI löschen?")) {
        try {
            const pkgRef = doc(db, "guis", pkgId); const pkg = allGUIs.find(g => g.id === pkgId);
            await updateDoc(pkgRef, { items: (pkg.items || []).filter(i => i.id !== itemId) });
        } catch (error) { console.error(error); alert("Fehler: " + error.message); }
    }
};

window.openGuiEditorForPkg = (pkgId) => {
    document.querySelector('[data-target="gui-editor"]').click();
    document.getElementById('editor-pkg-select').value = pkgId;
    document.getElementById('editor-gui-name').value = '';
    document.getElementById('editor-gui-item-id').value = '';
    if(window.clearCanvasSilent) window.clearCanvasSilent();
};

window.editGuiItemInEditor = (pkgId, itemId) => {
    const pkg = allGUIs.find(g => g.id === pkgId); if(!pkg) return;
    const item = (pkg.items || []).find(i => i.id === itemId); if(!item) return;

    document.querySelector('[data-target="gui-editor"]').click();
    document.getElementById('editor-pkg-select').value = pkgId;
    document.getElementById('editor-gui-name').value = item.name;
    document.getElementById('editor-gui-item-id').value = item.id; 
    
    if(item.image_url) {
        const img = new Image(); img.crossOrigin = "Anonymous";
        img.onload = () => {
            if(window.clearCanvasSilent) window.clearCanvasSilent();
            const canvas = document.getElementById('pixelCanvas');
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            if(window.triggerSaveState) window.triggerSaveState();
        };
        img.onerror = () => { alert("CORS Blockade: Das Bild kann leider nicht importiert werden."); };
        img.src = item.image_url;
    } else {
        if(window.clearCanvasSilent) window.clearCanvasSilent();
    }
};


// ==========================================
// 6. GUI EDITOR LOGIK (MIT ZOOM SLIDER!)
// ==========================================
let editorInitialized = false;

function initEditor() {
    if (editorInitialized) return;
    editorInitialized = true;

    // --- FONT DATA ---
    const fontMap={A:[[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],Ä:[[1,0,0,1],[0,0,0,0],[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],B:[[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,1],[1,1,1,0]],C:[[0,1,1,1],[1,0,0,0],[1,0,0,0],[1,0,0,0],[0,1,1,1]],D:[[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,0]],E:[[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,1,1,1]],F:[[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,0,0,0]],G:[[0,1,1,1],[1,0,0,0],[1,0,1,1],[1,0,0,1],[0,1,1,1]],H:[[1,0,0,1],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],I:[[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],J:[[0,0,1,1],[0,0,0,1],[0,0,0,1],[1,0,0,1],[0,1,1,0]],K:[[1,0,0,1],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,0,0,1]],L:[[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,1]],M:[[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1]],N:[[1,0,0,1],[1,1,0,1],[1,0,1,1],[1,0,0,1],[1,0,0,1]],O:[[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],Ö:[[1,0,0,1],[0,0,0,0],[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],P:[[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,0],[1,0,0,0]],Q:[[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,1,1],[0,1,1,1]],R:[[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,1,0],[1,0,0,1]],S:[[0,1,1,1],[1,0,0,0],[0,1,1,0],[0,0,0,1],[1,1,1,0]],T:[[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],U:[[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],Ü:[[1,0,0,1],[0,0,0,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],V:[[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0],[0,0,1,0]],W:[[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1]],X:[[1,0,0,1],[0,1,1,0],[0,1,1,0],[1,0,0,1]],Y:[[1,0,0,1],[0,1,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],Z:[[1,1,1,1],[0,0,0,1],[0,1,1,0],[1,0,0,0],[1,1,1,1]],0:[[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],1:[[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],2:[[1,1,1,0],[0,0,0,1],[0,1,1,0],[1,0,0,0],[1,1,1,1]],3:[[1,1,1,0],[0,0,0,1],[0,1,1,0],[0,0,0,1],[1,1,1,0]],4:[[1,0,0,1],[1,0,0,1],[1,1,1,1],[0,0,0,1],[0,0,0,1]],5:[[1,1,1,1],[1,0,0,0],[1,1,1,0],[0,0,0,1],[1,1,1,0]],6:[[0,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,1],[0,1,1,0]],7:[[1,1,1,1],[0,0,0,1],[0,0,1,0],[0,1,0,0],[0,1,0,0]],8:[[0,1,1,0],[1,0,0,1],[0,1,1,0],[1,0,0,1],[0,1,1,0]],9:[[0,1,1,0],[1,0,0,1],[0,1,1,1],[0,0,0,1],[0,1,1,0]],' ':[[0],[0],[0],[0],[0]],'.':[[0],[0],[0],[0],[1]],'ß':[[0,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,1],[1,1,1,0]]};

    const canvas = document.getElementById('pixelCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    let currentZoom = 2; let currentTool = 'brush'; let selectedColor = '#a49e95'; window.currentStamp = 'slot'; 
    let autoCenter = false; let isDrawing = false; let isEraseMode = false; let startPos = {x:0, y:0}; 
    let canvasSnapshot; let selectionBuffer = null; let clipboardData = { img: null, x: 0, y: 0 }; let importedImage = null; 
    const undoStack = []; const maxUndoSteps = 30;

    function showToast(msg) { const t = document.getElementById('editor-toast'); t.innerText = msg; t.style.opacity = 1; setTimeout(() => t.style.opacity = 0, 2000); }
    
    window.loadReference = function(input) { if(input.files && input.files[0]) { const reader = new FileReader(); reader.onload = function(e) { const img = document.getElementById('refOverlay'); img.src = e.target.result; img.style.display = 'block'; img.style.width = (canvas.width * currentZoom) + 'px'; img.style.height = (canvas.height * currentZoom) + 'px'; showToast("👻 Referenzbild geladen!"); }; reader.readAsDataURL(input.files[0]); } }
    window.clearReference = function() { const img = document.getElementById('refOverlay'); img.style.display = 'none'; img.src = ''; document.getElementById('refInput').value = ''; showToast("🚫 Referenz entfernt"); }
    window.deleteSelectedColor = function() { if(confirm("Farbe " + selectedColor + " löschen?")) { saveState(); const targetRgb = window.hexToRgb(selectedColor); if (!targetRgb) return; const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); const d = imgData.data; let deletedCount = 0; for(let i = 0; i < d.length; i += 4) { if(d[i+3] > 0 && d[i] === targetRgb.r && d[i+1] === targetRgb.g && d[i+2] === targetRgb.b) { d[i+3] = 0; deletedCount++; } } if (deletedCount > 0) { ctx.putImageData(imgData, 0, 0); refreshSnapshot(); showToast("🧹 Pixel gelöscht!"); } else { undoStack.pop(); showToast("ℹ️ Farbe nicht gefunden."); } } }
    window.handleImport = function(input) { if(input.files && input.files[0]) { const reader = new FileReader(); reader.onload = function(e) { const img = new Image(); img.onload = function() { importedImage = img; window.setTool('import'); showToast("🖼️ Bild geladen! Klicke zum Platzieren."); }; img.src = e.target.result; }; reader.readAsDataURL(input.files[0]); } }

    function saveState() { undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); if (undoStack.length > maxUndoSteps) undoStack.shift(); refreshSnapshot(); }
    window.triggerSaveState = saveState;
    function refreshSnapshot() { canvasSnapshot = ctx.getImageData(0,0,canvas.width,canvas.height); }
    window.undo = function() { if (undoStack.length > 0) { const data = undoStack.pop(); ctx.putImageData(data, 0, 0); refreshSnapshot(); isDrawing = false; selectionBuffer = null; window.updateGuides(); } }
    document.addEventListener('keydown', e => { if((e.ctrlKey||e.metaKey)&&e.key==='z') window.undo(); });

    // NEU: ZOOM SLIDER LOGIK
    window.changeZoom = function(val) {
        currentZoom = parseInt(val);
        document.getElementById('zoomVal').innerText = currentZoom;
        canvas.style.width = (canvas.width * currentZoom) + 'px';
        canvas.style.height = (canvas.height * currentZoom) + 'px';
        window.updateGuides();
    }

    // NEU: LEINWAND GRÖSSE VIA DROPDOWN
    window.resizeCanvas = function() {
        saveState(); 
        const s = document.getElementById('canvas-resolution').value;
        const tempCanvas = document.createElement('canvas'); tempCanvas.width = canvas.width; tempCanvas.height = canvas.height; 
        tempCanvas.getContext('2d').putImageData(ctx.getImageData(0,0,canvas.width, canvas.height), 0, 0);
        
        if (s === 'square') { canvas.width = 256; canvas.height = 256; } else if (s === 'rect') { canvas.width = 256; canvas.height = 128; } else if (s === 'tall') { canvas.width = 192; canvas.height = 256; } else if (s === 'mid') { canvas.width = 50; canvas.height = 50; } else if (s === 'icon') { canvas.width = 16; canvas.height = 16; }
        
        canvas.style.width = (canvas.width * currentZoom) + 'px'; canvas.style.height = (canvas.height * currentZoom) + 'px';
        window.updateGuides(); ctx.imageSmoothingEnabled = false; ctx.drawImage(tempCanvas, 0, 0); saveState();
    }

    document.getElementById('uploadInput').addEventListener('change', e => { if(e.target.files[0]){ saveState(); const r = new FileReader(); r.onload = ev => { const i = new Image(); i.onload = () => { ctx.imageSmoothingEnabled = false; ctx.drawImage(i, 0, 0, canvas.width, canvas.height); saveState(); }; i.src = ev.target.result; }; r.readAsDataURL(e.target.files[0]); } });

    window.setTool = function(tool) {
        currentTool = tool; document.querySelectorAll('#gui-editor .tool-grid .btn-editor').forEach(b => b.classList.remove('active')); const btn = document.getElementById('tool' + tool.charAt(0).toUpperCase() + tool.slice(1)); if(btn) btn.classList.add('active');
        if(tool === 'import' && !importedImage) document.getElementById('toolImport')?.classList.remove('active');
        document.getElementById('stampOptions').style.display = (tool === 'stamp') ? 'block' : 'none'; document.getElementById('textOptions').style.display = (tool === 'text') ? 'block' : 'none';
        if (tool !== 'select') selectionBuffer = null; if(canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0); refreshSnapshot();
    }

    window.toggleEraseMode = function() { isEraseMode = !isEraseMode; const btn = document.getElementById('btnEraseMode'); if (isEraseMode) { btn.classList.add('active'); btn.innerText = "🧽 Radier-Modus (AN)"; showToast("🧽 Alles ist Radierer!"); } else { btn.classList.remove('active'); btn.innerText = "🧽 Radier-Modus (AUS)"; } }
    window.pasteFromClipboard = function() { if (!clipboardData.img) { showToast("⚠️ Leer!"); return; } saveState(); ctx.putImageData(clipboardData.img, clipboardData.x, clipboardData.y); refreshSnapshot(); showToast("📋 Eingefügt"); }
    window.pasteClipboardMove = function() { if (!clipboardData.img) { showToast("⚠️ Leer!"); return; } window.setTool('select'); selectionBuffer = clipboardData.img; showToast("🖱️ Klicke zum Platzieren"); }
    
    // KOORDINATEN BERECHNUNG FUNKTIONIERT AUCH BEIM SCROLLEN PERFEKT!
    function getMousePos(evt) { const r = canvas.getBoundingClientRect(); return { x: Math.floor((evt.clientX - r.left)/currentZoom), y: Math.floor((evt.clientY - r.top)/currentZoom) }; }

    canvas.addEventListener('mousedown', function(e) {
        if(canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0);
        if(currentTool !== 'select' || !selectionBuffer) saveState();
        const pos = getMousePos(e);
        if (currentTool === 'picker') { const p = ctx.getImageData(pos.x, pos.y, 1, 1).data; const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1); selectedColor = hex; document.getElementById('colorPicker').value = hex; window.setTool('brush'); }
        else if (currentTool === 'fill') { floodFill(pos.x, pos.y, isEraseMode); refreshSnapshot(); }
        else if (currentTool === 'text') { if(!document.getElementById('textInput').value) showToast("⚠️ Kein Text!"); drawPixelText(document.getElementById('textInput').value, window.getAutoX(pos, 'text'), window.getAutoY(pos), false); refreshSnapshot(); }
        else if (currentTool === 'stamp') { drawStamp(window.currentStamp, window.getAutoX(pos), window.getAutoY(pos), false); refreshSnapshot(); }
        else if (currentTool === 'import' && importedImage) { const w = importedImage.width; const h = importedImage.height; ctx.drawImage(importedImage, Math.floor(pos.x - w/2), Math.floor(pos.y - h/2)); refreshSnapshot(); }
        else if (currentTool === 'select' && selectionBuffer) { ctx.putImageData(selectionBuffer, pos.x, pos.y); selectionBuffer = null; saveState(); } 
        else { isDrawing = true; startPos = pos; if(isEraseMode) ctx.globalCompositeOperation = 'destination-out'; if (currentTool === 'brush') { drawBrush(pos.x, pos.y); refreshSnapshot(); } else if (currentTool === 'eraser') { drawEraser(pos.x, pos.y); refreshSnapshot(); } else if (currentTool === 'lighten' || currentTool === 'darken') { shadingBrush(pos.x, pos.y, currentTool==='lighten'); refreshSnapshot(); } if(isEraseMode) ctx.globalCompositeOperation = 'source-over'; }
    });

    canvas.addEventListener('mousemove', function(e) {
        const pos = getMousePos(e); if(canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0);
        if (isDrawing) {
            if(isEraseMode) ctx.globalCompositeOperation = 'destination-out';
            if (currentTool === 'brush') { drawBrush(pos.x, pos.y); refreshSnapshot(); } else if (currentTool === 'eraser') { drawEraser(pos.x, pos.y); refreshSnapshot(); } else if (currentTool === 'lighten' || currentTool === 'darken') { shadingBrush(pos.x, pos.y, currentTool==='lighten'); refreshSnapshot(); } else if (currentTool === 'line') drawLine(startPos.x, startPos.y, pos.x, pos.y); else if (currentTool === 'rect') drawRectShape(startPos.x, startPos.y, pos.x, pos.y, false); else if (currentTool === 'rectFill') drawRectShape(startPos.x, startPos.y, pos.x, pos.y, true); else if (currentTool === 'select' && !selectionBuffer) drawSelectionBox(startPos.x, startPos.y, pos.x, pos.y); else if (currentTool === 'copy') drawSelectionBox(startPos.x, startPos.y, pos.x, pos.y);
            if(isEraseMode) ctx.globalCompositeOperation = 'source-over';
        } else {
            if (['rect', 'rectFill', 'line', 'select', 'copy', 'picker', 'fill'].includes(currentTool)) drawPixelCursor(pos.x, pos.y); else if (['brush', 'lighten', 'darken'].includes(currentTool)) drawBrushPreview(pos.x, pos.y); else if (currentTool === 'eraser') drawBrushPreview(pos.x, pos.y, true); else if (currentTool === 'stamp') drawStamp(window.currentStamp, window.getAutoX(pos), window.getAutoY(pos), true); else if (currentTool === 'text') drawPixelText(document.getElementById('textInput').value, window.getAutoX(pos, 'text'), window.getAutoY(pos), true); else if (currentTool === 'select' && selectionBuffer) ctx.putImageData(selectionBuffer, pos.x, pos.y); else if (currentTool === 'import' && importedImage) { const w = importedImage.width; const h = importedImage.height; ctx.globalAlpha = 0.6; ctx.drawImage(importedImage, Math.floor(pos.x - w/2), Math.floor(pos.y - h/2)); ctx.globalAlpha = 1.0; }
        }
    });
    canvas.addEventListener('mouseout', function() { if(canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0); isDrawing = false; });
    window.addEventListener('mouseup', function(e) {
        if (!isDrawing) return; const pos = getMousePos(e);
        if(isEraseMode) ctx.globalCompositeOperation = 'destination-out';
        if (currentTool === 'line') { drawLine(startPos.x, startPos.y, pos.x, pos.y); } else if (currentTool === 'rect') { drawRectShape(startPos.x, startPos.y, pos.x, pos.y, false); } else if (currentTool === 'rectFill') { drawRectShape(startPos.x, startPos.y, pos.x, pos.y, true); }
        if(isEraseMode) ctx.globalCompositeOperation = 'source-over';
        if (currentTool === 'select' && !selectionBuffer) { const x = Math.min(startPos.x, pos.x), y = Math.min(startPos.y, pos.y); const w = Math.abs(pos.x - startPos.x) + 1, h = Math.abs(pos.y - startPos.y) + 1; if (w > 0 && h > 0) { selectionBuffer = ctx.getImageData(x, y, w, h); ctx.clearRect(x, y, w, h); } }
        else if (currentTool === 'copy') { ctx.putImageData(canvasSnapshot, 0, 0); const x = Math.min(startPos.x, pos.x), y = Math.min(startPos.y, pos.y); const w = Math.abs(pos.x - startPos.x) + 1, h = Math.abs(pos.y - startPos.y) + 1; if (w > 0 && h > 0) { const data = ctx.getImageData(x, y, w, h); clipboardData = { img: data, x: x, y: y }; showToast("✅ Kopiert!"); } }
        isDrawing = false; refreshSnapshot(); window.updateGuides();
    });

    window.toggleGrid = function() { document.getElementById('gridOverlay').style.display = document.getElementById('gridCheck').checked ? 'block' : 'none'; window.updateGuides(); }
    window.toggleAutoCenter = function() { autoCenter = !autoCenter; document.getElementById('btnAutoCenter').classList.toggle('active'); document.getElementById('btnAutoCenter').innerText = autoCenter ? "🧲 Zentrieren (AN)" : "🧲 Zentrieren (Aus)"; document.getElementById('centerSettings').style.display = autoCenter ? 'block' : 'none'; window.updateGuides(); }
    window.toggleYInput = function() { const el = document.getElementById('fixedYVal'); const active = document.getElementById('useFixedY').checked; el.disabled = !active; el.style.opacity = active ? "1" : "0.5"; }
    
    window.addToPalette = function(){window.createPaletteSwatch(document.getElementById('colorPicker').value);}
    window.createPaletteSwatch = function(c){const d=document.createElement('div');d.className='color-swatch';d.style.backgroundColor=c;d.onclick=()=>{selectedColor=c;document.getElementById('colorPicker').value=c;document.querySelectorAll('#gui-editor .color-swatch').forEach(e=>e.classList.remove('active'));d.classList.add('active'); window.setTool('brush');};document.getElementById('paletteGrid').appendChild(d);}
    
    window.clearCanvasSilent = function() { ctx.clearRect(0,0,canvas.width,canvas.height); saveState(); }
    window.clearCanvas = function(){if(confirm("Löschen?")){window.clearCanvasSilent();}}
    
    window.hexToRgb = function(h){const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);return r?{r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)}:null;}
    window.getAutoY = function(p){if(autoCenter&&document.getElementById('useFixedY').checked)return parseInt(document.getElementById('fixedYVal').value)||0;return p.y;}
    window.getAutoX = function(p,t){if(!autoCenter)return p.x;let cx=canvas.width/2;if(document.getElementById('useContentAlign').checked)cx=window.getContentBounds().centerX;if(t==='text'){const txt=document.getElementById('textInput').value;const s=parseInt(document.getElementById('textScale').value)||1;let w=0;for(let c of txt.toUpperCase()){const m=fontMap[c]||fontMap[' '];w+=((m[0]?.length||3)*s)+s;}w-=s;return Math.floor(cx-(w/2));}else{const w=(t.startsWith('job')?45:(window.currentStamp==='slot')?18:16);return Math.floor(cx-(w/2));}}
    window.getContentBounds = function() {const w=canvas.width, h=canvas.height, d=ctx.getImageData(0,0,w,h).data;let minX=w, maxX=0, found=false;for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(d[(y*w+x)*4+3]>0) { if(x<minX)minX=x; if(x>maxX)maxX=x; found=true; }return found ? {minX, maxX, centerX:Math.floor(minX+(maxX-minX)/2), found:true} : {minX:0, maxX:w, centerX:w/2, found:false};}
    
    window.updateGuides = function() { 
        const cl=document.getElementById('centerLine'); cl.style.display='none'; 
        const grid = document.getElementById('gridOverlay'); const gridSize = 18 * currentZoom; grid.style.backgroundSize = `${gridSize}px ${gridSize}px`; 
        const refImg = document.getElementById('refOverlay'); 
        if (refImg && refImg.style.display === 'block') { refImg.style.width = (canvas.width * currentZoom) + 'px'; refImg.style.height = (canvas.height * currentZoom) + 'px'; } 
        // WICHTIG: Overlays müssen die gleiche Größe wie das Canvas annehmen!
        grid.style.width = (canvas.width * currentZoom) + 'px'; grid.style.height = (canvas.height * currentZoom) + 'px';
        if (autoCenter) { let cp = canvas.width / 2; if (document.getElementById('useContentAlign').checked) { const b = window.getContentBounds(); if(b.found) { cp=b.centerX; } } cl.style.left = (cp * currentZoom) + 'px'; cl.style.display = 'block'; } 
    }

    function drawBrush(x, y) { ctx.fillStyle = selectedColor; const s = parseInt(document.getElementById('brushSize').value); ctx.fillRect(x - Math.floor(s/2), y - Math.floor(s/2), s, s); }
    function drawEraser(x, y) { const s = parseInt(document.getElementById('brushSize').value); ctx.clearRect(x - Math.floor(s/2), y - Math.floor(s/2), s, s); }
    function drawPixelCursor(x, y) { ctx.fillStyle = selectedColor; ctx.fillRect(x, y, 1, 1); }
    function drawBrushPreview(x, y, eraser) { const s = parseInt(document.getElementById('brushSize').value); ctx.fillStyle = selectedColor; if(currentTool==='eraser'||eraser) ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5; ctx.fillRect(x - Math.floor(s/2), y - Math.floor(s/2), s, s); ctx.globalAlpha = 1.0; }
    function shadingBrush(x, y, l) { const s = parseInt(document.getElementById('brushSize').value); const sx = x - Math.floor(s/2); const sy = y - Math.floor(s/2); const i = ctx.getImageData(sx, sy, s, s); const d = i.data; const a = 15; for(let k=0; k<d.length; k+=4) { if(d[k+3] === 0) continue; if(l) { d[k]=Math.min(255,d[k]+a); d[k+1]=Math.min(255,d[k+1]+a); d[k+2]=Math.min(255,d[k+2]+a); } else { d[k]=Math.max(0,d[k]-a); d[k+1]=Math.max(0,d[k+1]-a); d[k+2]=Math.max(0,d[k+2]-a); } } ctx.putImageData(i, sx, sy); }
    function drawLine(x0,y0,x1,y1){const dx=x1-x0,dy=y1-y0;const st=Math.max(Math.abs(dx),Math.abs(dy));const s=parseInt(document.getElementById('brushSize').value);const o=Math.floor(s/2);ctx.fillStyle=selectedColor;for(let i=0;i<=st;i++){const t=st===0?0:i/st;ctx.fillRect(Math.round(x0+dx*t)-o,Math.round(y0+dy*t)-o,s,s);}}
    function drawRectShape(x0,y0,x1,y1,f){const x=Math.min(x0,x1),y=Math.min(y0,y1);const w=Math.abs(x1-x0)+1,h=Math.abs(y1-y0)+1;ctx.fillStyle=selectedColor;if(f){ctx.fillRect(x,y,w,h);}else{const s=parseInt(document.getElementById('brushSize').value);ctx.fillRect(x,y,w,s);ctx.fillRect(x,y+h-s,w,s);ctx.fillRect(x,y,s,h);ctx.fillRect(x+w-s,y,s,h);}}
    function drawSelectionBox(x0,y0,x1,y1){const x=Math.min(x0,x1),y=Math.min(y0,y1);const w=Math.abs(x1-x0),h=Math.abs(y1-y0);ctx.strokeStyle='#fff';ctx.setLineDash([4,2]);ctx.strokeRect(x+0.5,y+0.5,w,h);ctx.setLineDash([]);}
    
    function drawStamp(t,x,y,p){
        if(p)ctx.globalAlpha=0.5;
        if(t==='slot'){drawRect(x,y,18,18,'#8b8b8b');drawRect(x,y,17,1,'#373737');drawRect(x,y,1,18,'#373737');drawRect(x,y+17,18,1,'#ffffff');drawRect(x+17,y,1,18,'#ffffff');drawRect(x+1,y+1,16,16,'#8b8b8b');}
        else if(t.startsWith('job')) { drawJobIcon(t, x, y); }
        else {
            ctx.fillStyle=selectedColor;let m=[];
            if(t==='sArrowR')m=["00100","00110","11111","00110","00100"]; else if(t==='iconExclam')m=["0000001111000000","0000001111000000","0000001111000000","0000001111000000","0000001111000000","0000001111000000","0000001111000000","0000001111000000","0000001111000000","0000000000000000","0000000000000000","0000001111000000","0000001111000000","0000001111000000","0000000000000000","0000000000000000"]; else if(t==='iconWarn')m=["0000000000000000","0000000110000000","0000001111000000","0000001111000000","0000011111100000","0000011111100000","0000111111110000","0000111111110000","0001100110011000","0001100110011000","0011100110011100","0011100000011100","0111100110011110","0111111111111110","1111111111111111","0000000000000000"]; else if(t==='iconGear')m=["0000001111000000","0000111111110000","0011100110011100","0011000000001100","0011000000001100","0110000000000110","1100000000000011","1100000000000011","1100000000000011","1100000000000011","0110000000000110","0011000000001100","0011000000001100","0011100110011100","0000111111110000","0000001111000000"]; else if(t==='iconPlus')m=["0000000000000000","0000000110000000","0000000110000000","0000000110000000","0000000110000000","0000000110000000","0000000110000000","1111111111111111","1111111111111111","0000000110000000","0000000110000000","0000000110000000","0000000110000000","0000000110000000","0000000110000000","0000000000000000"]; else if(t==='iconMinus')m=["0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","1111111111111111","1111111111111111","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"]; else if(t==='lArrowR')m=["0000000010000000","0000000011000000","0000000011100000","0000000011110000","0000000011111000","1111111111111100","1111111111111110","1111111111111111","1111111111111111","1111111111111110","1111111111111100","0000000011111000","0000000011110000","0000000011100000","0000000011000000","0000000010000000"]; else if(t==='lArrowL')m=["0000000100000000","0000001100000000","0000011100000000","0000111100000000","0001111100000000","0011111111111111","0111111111111111","1111111111111111","1111111111111111","0111111111111111","0011111111111111","0001111100000000","0000111100000000","0000011100000000","0000001100000000","0000000100000000"]; else if(t==='lArrowU')m=["0000000110000000","0000001111000000","0000011111100000","0000111111110000","0001111111111000","0011111111111100","0111111111111110","1111111111111111","0000011111100000","0000011111100000","0000011111100000","0000011111100000","0000011111100000","0000011111100000","0000011111100000","0000011111100000"]; else if(t==='lArrowD')m=["0000011111100000","0000011111100000","0000011111100000","0000011111100000","0000011111100000","0000011111100000","0000011111100000","0000011111100000","1111111111111111","0111111111111110","0011111111111100","0001111111111000","0000111111110000","0000011111100000","0000001111000000","0000000110000000"];
            for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c]==='1')ctx.fillRect(x+c,y+r,1,1);
        }
        if(p)ctx.globalAlpha=1.0;
    }

    function drawJobIcon(t, x, y) { ctx.fillStyle = selectedColor; if(t==='jobMiner') { for(let i=0;i<30;i++) ctx.fillRect(x+10+i, y+10+i, 3, 3); for(let i=0;i<15;i++) { ctx.fillRect(x+5+i, y+5+15-i, 4, 4); ctx.fillRect(x+35+i, y+5+i, 4, 4); } } else if(t==='jobDigger') { ctx.fillRect(x+20, y+15, 5, 25); ctx.fillRect(x+15, y+5, 15, 12); ctx.fillRect(x+17, y+17, 11, 2); } else if(t==='jobLumber') { for(let i=0;i<30;i++) ctx.fillRect(x+35-i, y+10+i, 3, 3); ctx.fillRect(x+5, y+5, 15, 15); ctx.fillRect(x+20, y+10, 5, 5); } else if(t==='jobHunter') { ctx.fillRect(x+10, y+5, 5, 35); ctx.fillRect(x+15, y+5, 15, 2); ctx.fillRect(x+30, y+7, 2, 31); ctx.fillRect(x+15, y+38, 15, 2); } else if(t==='jobCrafter') { ctx.fillRect(x+5, y+5, 35, 35); ctx.clearRect(x+15, y+5, 2, 35); ctx.clearRect(x+28, y+5, 2, 35); ctx.clearRect(x+5, y+15, 35, 2); ctx.clearRect(x+5, y+28, 35, 2); } else if(t==='jobSmith') { ctx.fillRect(x+5, y+10, 35, 10); ctx.fillRect(x+15, y+20, 15, 15); ctx.fillRect(x+5, y+35, 35, 5); } }
    function drawPixelText(t, x, y, preview) { if(!t) return; if(preview) ctx.globalAlpha = 0.5; t = t.toUpperCase(); const s = parseInt(document.getElementById('textScale').value)||1; const shad = document.getElementById('textShadow').checked; function dC(ch, dx, dy, col) { ctx.fillStyle = col; const m = fontMap[ch]||fontMap[' ']; if(!m) return 4*s; for(let r=0;r<m.length;r++) for(let c=0;c<m[r].length;c++) if(m[r][c]) ctx.fillRect(dx+(c*s), dy+(r*s), s, s); return ((m[0]?.length||3)*s)+s; } if(shad) { let sx=x+s; for(let c of t) sx+=dC(c, sx, y+s, "#1a1a1a"); } let cx=x; for(let c of t) cx+=dC(c, cx, y, selectedColor); if(preview) ctx.globalAlpha = 1.0; }
    function drawRect(x,y,w,h,col){ctx.fillStyle=col;ctx.fillRect(x,y,w,h);}
    function drawGuiBase(x,y,w,h){ctx.fillStyle='#c6c6c6';ctx.fillRect(x,y,w,h);ctx.fillStyle='#ffffff';ctx.fillRect(x,y,w,2);ctx.fillRect(x,y,2,h);ctx.fillStyle='#555555';ctx.fillRect(x+2,y+h-2,w-2,2);ctx.fillRect(x+w-2,y+2,2,h-2);}
    
    window.applyTemplate = function(type) { 
        saveState(); const w=canvas.width; const cx=Math.floor((w-176)/2); 
        if(type==='chest'){ const sy=10; drawGuiBase(cx,sy,176,166); for(let r=0;r<3;r++)for(let c=0;c<9;c++)drawStamp('slot',cx+7+c*18,sy+17+r*18,false); for(let r=0;r<3;r++)for(let c=0;c<9;c++)drawStamp('slot',cx+7+c*18,sy+83+r*18,false); for(let c=0;c<9;c++)drawStamp('slot',cx+7+c*18,sy+141,false); } else if(type==='double'){ const sy=5; drawGuiBase(cx,sy,176,222); for(let r=0;r<6;r++)for(let c=0;c<9;c++)drawStamp('slot',cx+7+c*18,sy+17+r*18,false); for(let r=0;r<3;r++)for(let c=0;c<9;c++)drawStamp('slot',cx+7+c*18,sy+139+r*18,false); for(let c=0;c<9;c++)drawStamp('slot',cx+7+c*18,sy+197,false); } else if(type==='inv'){ const sy=80; for(let r=0;r<3;r++)for(let c=0;c<9;c++)drawStamp('slot',cx+7+c*18,sy+r*18,false); for(let c=0;c<9;c++)drawStamp('slot',cx+7+c*18,sy+58,false); } 
        refreshSnapshot(); 
    }
    
    function floodFill(x,y,erase){ const startPixel=ctx.getImageData(x,y,1,1).data; const startR=startPixel[0],startG=startPixel[1],startB=startPixel[2],startA=startPixel[3]; const f=window.hexToRgb(selectedColor); if(erase){ if(startA===0) return; } else { if(startR===f.r&&startG===f.g&&startB===f.b&&startA===255) return; } const img=ctx.getImageData(0,0,canvas.width,canvas.height); const d=img.data; const s=[[x,y]]; const w=canvas.width,h=canvas.height; while(s.length){ const[cx,cy]=s.pop(); if(cx<0||cx>=w||cy<0||cy>=h)continue; const i=(cy*w+cx)*4; if(d[i]===startR&&d[i+1]===startG&&d[i+2]===startB&&d[i+3]===startA){ if(erase) d[i+3]=0; else { d[i]=f.r; d[i+1]=f.g; d[i+2]=f.b; d[i+3]=255; } s.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]); } } ctx.putImageData(img,0,0); }

    // IN FIREBASE SPEICHERN (GESICHERT MIT UPLOADSTRING)
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
            
            // NEU: Native Firebase Funktion für Base64 Canvas-Bilder
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
            alert("FEHLER BEIM SPEICHERN:\n" + error.message + "\n\nFalls du ein Bild bearbeitet hast, hat der Browser das Speichern wegen Sicherheitsrichtlinien (CORS) blockiert.");
            showToast("Fehler beim Speichern!"); 
        }
    }

    const myColors = ['#a49e95', '#766f6a', '#483f46', '#231c2c', '#1e1829', '#539d33', '#ffffff', '#000000'];
    myColors.forEach(c => window.createPaletteSwatch(c));
    window.resizeCanvas(); saveState(); refreshSnapshot();
}