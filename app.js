import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
// NEU: Auth Import
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, deleteDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

// DEINE FIREBASE CONFIG
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
const auth = getAuth(app); // Auth initialisieren

let allRanks = [], allGUIs = [], allCrates = [], allShop = [], allAds = [], allPlugins = [];
let editingRankId = null; 
let listenersActive = false; // Verhindert doppeltes Laden

// ==========================================
// AUTHENTIFIZIERUNG LOGIK (LOGIN / LOGOUT)
// ==========================================

// Beobachtet, ob der User ein- oder ausgeloggt ist
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User ist EINGELOGGT: Login verstecken, App anzeigen
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        
        // Starte die Datenbank-Verbindung nur einmal!
        if (!listenersActive) {
            startRealtimeListeners();
            listenersActive = true;
        }
    } else {
        // User ist AUSGELOGGT: Login zeigen, App verstecken
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

// Login Button Klick
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorText = document.getElementById('login-error');
    
    if(!email || !password) return errorText.innerText = "Bitte beides ausfüllen!";
    
    errorText.innerText = "Logge ein...";
    errorText.style.color = "var(--text-muted)";
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        errorText.innerText = "";
    } catch (error) {
        console.error(error);
        errorText.style.color = "var(--danger)";
        errorText.innerText = "Falsche E-Mail oder Passwort!";
    }
});

// Logout Button Klick
document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth);
});


// ==========================================
// ALLGEMEINE HILFSFUNKTIONEN
// ==========================================

async function uploadImage(file, folderPath) {
    if (!file) return null;
    const storageRef = ref(storage, `${folderPath}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

document.querySelectorAll('.nav-item:not(#btn-logout)').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item:not(#btn-logout)').forEach(nav => nav.classList.remove('active'));
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.querySelectorAll('.category-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
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
    function addChildren(parentName) {
        let children = ranks.filter(r => r.inherits_from === parentName);
        children.forEach(child => {
            if (!visited.has(child.id)) { visited.add(child.id); sorted.push(child); addChildren(child.name); }
        });
    }
    baseRanks.forEach(baseRank => {
        if (!visited.has(baseRank.id)) { visited.add(baseRank.id); sorted.push(baseRank); addChildren(baseRank.name); }
    });
    ranks.forEach(r => { if (!visited.has(r.id)) sorted.push(r); });
    return sorted;
}


// ==========================================
// DATEN LADEN (REALTIME LISTENER)
// ==========================================
// Wird erst aufgerufen, wenn man erfolgreich eingeloggt ist!

function startRealtimeListeners() {
    
    onSnapshot(collection(db, "ranks"), (snap) => {
        allRanks = sortRanksHierarchically(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        const list = document.getElementById('rank-list'); list.innerHTML = '';
        
        allRanks.forEach(rank => {
            const myPerms = rank.permissions || [];
            const parentRank = rank.inherits_from ? allRanks.find(r => r.name === rank.inherits_from) : null;
            const inherited = parentRank ? (parentRank.permissions || []) : [];
            let permsHtml = myPerms.map(p => `<span class="perm-badge">${p}</span>`).join('') + inherited.map(p => `<span class="perm-badge perm-inherited">${p}</span>`).join('');
            let imgHtml = rank.image_url ? `<img src="${rank.image_url}" class="thumbnail">` : '<div class="thumbnail"></div>';
            let indent = rank.inherits_from ? '<span style="color:#9ca3af; margin-right:5px;">↳</span>' : '';

            list.innerHTML += `<tr>
                <td>${imgHtml}</td>
                <td><strong>${indent}${rank.name}</strong></td>
                <td>${rank.inherits_from || '-'}</td>
                <td>${permsHtml || '-'}</td>
                <td class="action-cell">
                    <button class="btn btn-secondary btn-sm" onclick="editRank('${rank.id}')">Bearbeiten</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteEntry('ranks', '${rank.id}')">Löschen</button>
                </td>
            </tr>`;
        });
        
        const dropdown = document.getElementById('rank-inherit'); 
        dropdown.innerHTML = '<option value="">Erbt von... (Keiner)</option>';
        allRanks.forEach(r => {
            if(r.id !== editingRankId) { dropdown.innerHTML += `<option value="${r.name}">${r.name}</option>`; }
        });
        
        if(editingRankId) {
            const currentEdit = allRanks.find(r => r.id === editingRankId);
            if(currentEdit) document.getElementById('rank-inherit').value = currentEdit.inherits_from || '';
        }
        updateDashboard();
    });

    onSnapshot(collection(db, "plugins"), (snap) => {
        allPlugins = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('plugin-list'); list.innerHTML = '';
        allPlugins.forEach(plugin => {
            list.innerHTML += `<tr>
                <td><strong>${plugin.name}</strong></td>
                <td style="white-space: pre-wrap; font-size: 13px;">${plugin.info || '-'}</td>
                <td style="text-align: right;"><button class="btn btn-danger btn-sm" onclick="deleteEntry('plugins', '${plugin.id}')">Löschen</button></td>
            </tr>`;
        });
        updateDashboard();
    });

    onSnapshot(collection(db, "crates"), (snap) => {
        allCrates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('crates-container'); container.innerHTML = '';
        allCrates.forEach(crate => {
            let items = crate.items || [];
            let crateImgHtml = crate.image_url ? `<img src="${crate.image_url}" class="thumbnail" style="width:50px;height:50px;">` : `<div class="thumbnail" style="width:50px;height:50px;"></div>`;
            
            let itemsHtml = items.map(item => `
                <tr>
                    <td>${item.image_url ? `<img src="${item.image_url}" class="thumbnail" style="width:30px;height:30px;">` : '-'}</td>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.quantity || 1}x</td>
                    <td>${item.chance}%</td>
                    <td style="text-align: right;"><button class="btn btn-danger btn-sm" onclick="deleteCrateItem('${crate.id}', '${item.id}')">Entfernen</button></td>
                </tr>
            `).join('');

            container.innerHTML += `
                <div class="crate-box">
                    <div class="crate-header">
                        <div class="crate-header-left">${crateImgHtml}<h3 style="font-size: 18px;">${crate.name || 'Unbenannte Kiste'}</h3></div>
                        <div class="button-group">
                            <button class="btn btn-primary btn-sm" onclick="openItemModal('${crate.id}')">+ Item hinzufügen</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteEntry('crates', '${crate.id}')">Kiste löschen</button>
                        </div>
                    </div>
                    ${items.length > 0 ? `<table class="crate-items-table"><thead><tr><th>Bild</th><th>Item Name</th><th>Menge</th><th>Chance</th><th style="text-align: right;">Aktion</th></tr></thead><tbody>${itemsHtml}</tbody></table>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Items in dieser Kiste. Klicke auf "+ Item hinzufügen".</p>'}
                </div>
            `;
        });
        updateDashboard();
    });

    onSnapshot(collection(db, "shop"), (snap) => {
        allShop = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('shop-list'); list.innerHTML = '';
        allShop.forEach(item => {
            let imgHtml = item.image_url ? `<img src="${item.image_url}" class="thumbnail">` : '<div class="thumbnail"></div>';
            list.innerHTML += `<tr><td>${imgHtml}</td><td><strong>${item.name}</strong></td><td>${item.price} Pkt.</td><td><button class="btn btn-danger btn-sm" onclick="deleteEntry('shop', '${item.id}')">Löschen</button></td></tr>`;
        });
        updateDashboard();
    });

    onSnapshot(collection(db, "guis"), (snap) => {
        allGUIs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('gui-list'); list.innerHTML = '';
        allGUIs.forEach(gui => {
            list.innerHTML += `<div class="gui-card"><div class="gui-card-header"><span>${gui.name || gui.title}</span><button class="btn btn-danger btn-sm" onclick="deleteEntry('guis', '${gui.id}')">Löschen</button></div><img src="${gui.image_url}"></div>`;
        });
        updateDashboard();
    });

    onSnapshot(collection(db, "ads"), (snap) => {
        allAds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('ad-list'); list.innerHTML = '';
        allAds.forEach(ad => {
            let linkHtml = ad.link ? `<a href="${ad.link}" target="_blank" style="font-size:12px; display:block; margin-bottom:10px;">Link öffnen</a>` : '';
            list.innerHTML += `<div class="gui-card"><div class="gui-card-header"><span>${ad.title}</span><button class="btn btn-danger btn-sm" onclick="deleteEntry('ads', '${ad.id}')">Löschen</button></div>${linkHtml}<img src="${ad.image_url}"></div>`;
        });
    });
}


// ==========================================
// RANG BEARBEITEN & EXPORTIEREN
// ==========================================

function resetRankForm() {
    editingRankId = null;
    document.getElementById('rank-form-title').innerText = "Neuen Rang erstellen";
    document.getElementById('btn-save-rank').innerText = "Rang speichern";
    document.getElementById('btn-cancel-rank').style.display = "none";
    document.getElementById('rank-name').value = ''; 
    document.getElementById('rank-perms').value = ''; 
    document.getElementById('rank-inherit').value = '';
    if(document.getElementById('rank-image')) document.getElementById('rank-image').value = '';
}

window.editRank = (id) => {
    const rank = allRanks.find(r => r.id === id);
    if (!rank) return;
    editingRankId = id; 
    document.getElementById('rank-name').value = rank.name;
    document.getElementById('rank-perms').value = (rank.permissions || []).join('\n');
    document.getElementById('rank-inherit').value = rank.inherits_from || '';
    
    document.getElementById('rank-form-title').innerText = "Rang bearbeiten: " + rank.name;
    document.getElementById('btn-save-rank').innerText = "Änderungen speichern";
    document.getElementById('btn-cancel-rank').style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
document.getElementById('btn-cancel-rank').addEventListener('click', resetRankForm);

document.getElementById('btn-export-ranks').addEventListener('click', () => {
    if(allRanks.length === 0) return alert("Es gibt noch keine Ränge zum Exportieren!");
    let yamlContent = "groups:\n";
    allRanks.forEach(rank => {
        const safeName = rank.name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        yamlContent += `  ${safeName}:\n`;
        if (rank.permissions && rank.permissions.length > 0) {
            yamlContent += `    permissions:\n`;
            rank.permissions.forEach(p => { yamlContent += `      - ${p}: true\n`; });
        }
        if (rank.inherits_from) {
            const safeInherit = rank.inherits_from.toLowerCase().replace(/[^a-z0-9_-]/g, '');
            yamlContent += `    parents:\n`;
            yamlContent += `      - ${safeInherit}\n`;
        }
    });

    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'luckperms_ranks.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});


// ==========================================
// SPEICHERN LOGIK
// ==========================================

document.getElementById('btn-save-plugin').addEventListener('click', async () => {
    try {
        const name = document.getElementById('plugin-name').value;
        const info = document.getElementById('plugin-info').value;
        const status = document.getElementById('plugin-status');
        if(!name) return alert("Bitte gib einen Plugin-Namen ein!");
        status.innerText = "Speichere...";
        await addDoc(collection(db, "plugins"), { name: name, info: info });
        status.innerText = "Erfolgreich!";
        setTimeout(() => status.innerText = "", 2000);
        document.getElementById('plugin-name').value = ''; 
        document.getElementById('plugin-info').value = '';
    } catch (error) { console.error(error); alert("Fehler: " + error.message); }
});

document.getElementById('btn-save-rank').addEventListener('click', async () => {
    try {
        const name = document.getElementById('rank-name').value;
        const perms = document.getElementById('rank-perms').value.split('\n').map(p => p.trim()).filter(p => p !== "");
        const inherits = document.getElementById('rank-inherit').value;
        const file = document.getElementById('rank-image').files[0];
        const status = document.getElementById('rank-status');

        if(!name) return alert("Name fehlt!");
        status.innerText = "Speichere...";
        const rankData = { name: name, permissions: perms, inherits_from: inherits || null };
        if (file) { rankData.image_url = await uploadImage(file, 'ranks'); }

        if (editingRankId) {
            await updateDoc(doc(db, "ranks", editingRankId), rankData);
            status.innerText = "Rang erfolgreich aktualisiert!";
        } else {
            await addDoc(collection(db, "ranks"), rankData);
            status.innerText = "Neuer Rang erstellt!";
        }
        setTimeout(() => status.innerText = "", 2000);
        resetRankForm(); 
    } catch (error) { console.error(error); alert("Fehler: " + error.message); }
});

document.getElementById('btn-save-crate').addEventListener('click', async () => {
    try {
        const crate_name = document.getElementById('crate-name').value;
        const fileInput = document.getElementById('crate-image');
        const file = fileInput ? fileInput.files[0] : null;
        const status = document.getElementById('crate-status');
        if(!crate_name) return alert("Bitte gib einen Namen für die Kiste ein!");
        status.innerText = "Erstelle Kiste...";
        let imageUrl = null;
        if (file) imageUrl = await uploadImage(file, 'crates');
        await addDoc(collection(db, "crates"), { name: crate_name, image_url: imageUrl, items: [] });
        status.innerText = "Erfolgreich!";
        setTimeout(() => status.innerText = "", 2000);
        document.getElementById('crate-name').value = ''; if(fileInput) fileInput.value = '';
    } catch (error) { console.error(error); alert("Fehler: " + error.message); }
});

document.getElementById('btn-save-shop').addEventListener('click', async () => {
    const name = document.getElementById('shop-item').value;
    const price = document.getElementById('shop-price').value;
    const file = document.getElementById('shop-image').files[0];
    if(!name || !price) return alert("Name und Preis fehlen!");
    document.getElementById('shop-status').innerText = "Speichere...";
    const imageUrl = await uploadImage(file, 'shop') || null;
    await addDoc(collection(db, "shop"), { name, price: Number(price), image_url: imageUrl });
    document.getElementById('shop-status').innerText = "";
    document.getElementById('shop-item').value = ''; document.getElementById('shop-price').value = '';
});

document.getElementById('btn-save-gui').addEventListener('click', async () => {
    const file = document.getElementById('gui-image').files[0];
    if(!file || !document.getElementById('gui-name').value) return alert("Bild und Name fehlen!");
    const imageUrl = await uploadImage(file, 'guis');
    await addDoc(collection(db, "guis"), { name: document.getElementById('gui-name').value, image_url: imageUrl });
    document.getElementById('gui-name').value = ''; document.getElementById('gui-image').value = '';
});

document.getElementById('btn-save-ad').addEventListener('click', async () => {
    const file = document.getElementById('ad-image').files[0];
    if(!file || !document.getElementById('ad-title').value) return alert("Bild und Titel fehlen!");
    const imageUrl = await uploadImage(file, 'ads');
    await addDoc(collection(db, "ads"), { title: document.getElementById('ad-title').value, link: document.getElementById('ad-link').value, image_url: imageUrl });
    document.getElementById('ad-title').value = ''; document.getElementById('ad-link').value = ''; document.getElementById('ad-image').value = '';
});


// ==========================================
// MODAL (ITEMS ZU KISTE HINZUFÜGEN) LOGIK
// ==========================================

window.openItemModal = (crateId) => {
    document.getElementById('modal-crate-id').value = crateId;
    document.getElementById('item-modal').classList.add('active');
};
document.getElementById('btn-close-modal').addEventListener('click', () => { document.getElementById('item-modal').classList.remove('active'); });

document.getElementById('btn-save-item').addEventListener('click', async () => {
    try {
        const crateId = document.getElementById('modal-crate-id').value;
        const name = document.getElementById('modal-item-name').value;
        const quantity = document.getElementById('modal-item-quantity').value;
        const chance = document.getElementById('modal-item-chance').value;
        const file = document.getElementById('modal-item-image').files[0];
        const status = document.getElementById('modal-status');

        if(!name || !chance || !quantity) return alert("Item-Name, Menge und Chance fehlen!");
        status.innerText = "Speichere Item in Kiste...";

        const imageUrl = await uploadImage(file, 'crates/items') || null;
        
        const newItem = { 
            id: Date.now().toString(), 
            name: name, 
            quantity: Number(quantity),
            chance: Number(chance), 
            image_url: imageUrl 
        };

        const crateRef = doc(db, "crates", crateId);
        const crate = allCrates.find(c => c.id === crateId);
        const updatedItems = [...(crate.items || []), newItem];
        
        await updateDoc(crateRef, { items: updatedItems });

        status.innerText = "";
        document.getElementById('modal-item-name').value = ''; 
        document.getElementById('modal-item-quantity').value = '1'; 
        document.getElementById('modal-item-chance').value = '';
        if(document.getElementById('modal-item-image')) document.getElementById('modal-item-image').value = '';
        
        document.getElementById('item-modal').classList.remove('active');
    } catch (error) { console.error(error); alert("Fehler: " + error.message); }
});

window.deleteCrateItem = async (crateId, itemId) => {
    if(confirm("Möchtest du dieses Item wirklich aus der Kiste entfernen?")) {
        try {
            const crateRef = doc(db, "crates", crateId);
            const crate = allCrates.find(c => c.id === crateId);
            const updatedItems = (crate.items || []).filter(i => i.id !== itemId);
            await updateDoc(crateRef, { items: updatedItems });
        } catch (error) { console.error(error); }
    }
};

window.deleteEntry = async (collectionName, id) => {
    if(confirm('Wirklich löschen?')) {
        await deleteDoc(doc(db, collectionName, id));
    }
};