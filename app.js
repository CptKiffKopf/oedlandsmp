import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
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

let allRanks = [], allGUIs = [], allCrates = [], allShop = [], allAds = [];
// NEU: Globale Variable, die sich merkt, ob wir gerade einen Rang bearbeiten
let editingRankId = null; 

async function uploadImage(file, folderPath) {
    if (!file) return null;
    const storageRef = ref(storage, `${folderPath}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.querySelectorAll('.category-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
    });
});

function updateDashboard() {
    document.getElementById('stat-ranks').innerText = allRanks.length;
    document.getElementById('stat-crates').innerText = allCrates.length;
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
// REALTIME LISTENER (LIVE-UPDATES)
// ==========================================

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

        // NEU: Bearbeiten-Button (editRank) in die Zeile eingefügt
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
    
    // Dropdown (Erbt von) aktualisieren (ohne den aktuell bearbeiteten Rang, damit er nicht von sich selbst erben kann)
    const dropdown = document.getElementById('rank-inherit'); 
    dropdown.innerHTML = '<option value="">Erbt von... (Keiner)</option>';
    allRanks.forEach(r => {
        if(r.id !== editingRankId) {
            dropdown.innerHTML += `<option value="${r.name}">${r.name}</option>`;
        }
    });
    
    // Falls wir gerade bearbeiten, den alten Wert im Dropdown wieder setzen
    if(editingRankId) {
        const currentEdit = allRanks.find(r => r.id === editingRankId);
        if(currentEdit) document.getElementById('rank-inherit').value = currentEdit.inherits_from || '';
    }

    updateDashboard();
});

onSnapshot(collection(db, "crates"), (snap) => {
    allCrates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const container = document.getElementById('crates-container');
    container.innerHTML = '';
    allCrates.forEach(crate => {
        let items = crate.items || [];
        let crateImgHtml = crate.image_url ? `<img src="${crate.image_url}" class="thumbnail" style="width:50px;height:50px;">` : `<div class="thumbnail" style="width:50px;height:50px;"></div>`;
        let itemsHtml = items.map(item => `
            <tr>
                <td>${item.image_url ? `<img src="${item.image_url}" class="thumbnail" style="width:30px;height:30px;">` : '-'}</td>
                <td><strong>${item.name}</strong></td>
                <td>${item.chance}%</td>
                <td style="text-align: right;"><button class="btn btn-danger btn-sm" onclick="deleteCrateItem('${crate.id}', '${item.id}')">Item entfernen</button></td>
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
                ${items.length > 0 ? `<table class="crate-items-table"><thead><tr><th>Bild</th><th>Item Name</th><th>Chance</th><th style="text-align: right;">Aktion</th></tr></thead><tbody>${itemsHtml}</tbody></table>` : '<p style="font-size: 13px; color: var(--text-muted);">Noch keine Items in dieser Kiste. Klicke auf "+ Item hinzufügen".</p>'}
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


// ==========================================
// RANG BEARBEITEN LOGIK
// ==========================================

// Hilfsfunktion: Setzt das Formular wieder auf "Neu erstellen" zurück
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

// Wird aufgerufen, wenn man in der Tabelle auf "Bearbeiten" klickt
window.editRank = (id) => {
    const rank = allRanks.find(r => r.id === id);
    if (!rank) return;

    editingRankId = id; // Wir merken uns die ID
    
    // Formular mit alten Daten füllen
    document.getElementById('rank-name').value = rank.name;
    document.getElementById('rank-perms').value = (rank.permissions || []).join('\n');
    document.getElementById('rank-inherit').value = rank.inherits_from || '';
    
    // Optik ändern
    document.getElementById('rank-form-title').innerText = "Rang bearbeiten: " + rank.name;
    document.getElementById('btn-save-rank').innerText = "Änderungen speichern";
    document.getElementById('btn-cancel-rank').style.display = "inline-block";
    
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Elegant nach oben scrollen
};

// Abbrechen Button
document.getElementById('btn-cancel-rank').addEventListener('click', resetRankForm);


// ==========================================
// SPEICHERN LOGIK (Aktualisiert für Bearbeiten)
// ==========================================

document.getElementById('btn-save-rank').addEventListener('click', async () => {
    try {
        const name = document.getElementById('rank-name').value;
        const perms = document.getElementById('rank-perms').value.split('\n').map(p => p.trim()).filter(p => p !== "");
        const inherits = document.getElementById('rank-inherit').value;
        const file = document.getElementById('rank-image').files[0];
        const status = document.getElementById('rank-status');

        if(!name) return alert("Name fehlt!");
        status.innerText = "Speichere...";
        
        // Das Daten-Paket, das wir an Firebase schicken
        const rankData = { 
            name: name, 
            permissions: perms, 
            inherits_from: inherits || null 
        };

        // Bild nur hochladen und updaten, wenn ein neues ausgewählt wurde
        if (file) {
            rankData.image_url = await uploadImage(file, 'ranks');
        }

        // Entscheiden: Neu erstellen oder updaten?
        if (editingRankId) {
            await updateDoc(doc(db, "ranks", editingRankId), rankData);
            status.innerText = "Rang erfolgreich aktualisiert!";
        } else {
            await addDoc(collection(db, "ranks"), rankData);
            status.innerText = "Neuer Rang erstellt!";
        }
        
        setTimeout(() => status.innerText = "", 2000);
        resetRankForm(); // Formular wieder leeren
        
    } catch (error) {
        console.error("Fehler beim Speichern des Rangs:", error);
        alert("Fehler beim Speichern: " + error.message);
    }
});


// ... Restliche Speicherfunktionen (Kisten, Shop, etc.) bleiben unverändert ...
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
    } catch (error) {
        console.error(error); alert("Fehler: " + error.message);
    }
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
        const chance = document.getElementById('modal-item-chance').value;
        const file = document.getElementById('modal-item-image').files[0];
        const status = document.getElementById('modal-status');
        if(!name || !chance) return alert("Item-Name und Chance fehlen!");
        status.innerText = "Speichere Item in Kiste...";
        const imageUrl = await uploadImage(file, 'crates/items') || null;
        const newItem = { id: Date.now().toString(), name: name, chance: Number(chance), image_url: imageUrl };
        const crateRef = doc(db, "crates", crateId);
        const crate = allCrates.find(c => c.id === crateId);
        const updatedItems = [...(crate.items || []), newItem];
        await updateDoc(crateRef, { items: updatedItems });
        status.innerText = "";
        document.getElementById('modal-item-name').value = ''; document.getElementById('modal-item-chance').value = '';
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