import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

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

let allRanks = [];
let allGUIs = [];
let editingRankId = null; // Speichert die ID, wenn wir bearbeiten
let editingGuiId = null;

// --- NAVIGATION ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.querySelectorAll('.category-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
    });
});

// --- ÜBERSICHT (DASHBOARD) ---
function updateDashboard() {
    document.getElementById('stat-ranks').innerText = allRanks.length;
    document.getElementById('stat-guis').innerText = allGUIs.length;
}

// --- RÄNGE ---
async function loadRanks() {
    const querySnapshot = await getDocs(collection(db, "ranks"));
    allRanks = [];
    querySnapshot.forEach((doc) => {
        allRanks.push({ id: doc.id, ...doc.data() });
    });
    renderRanks();
    updateRankDropdown();
    updateDashboard();
}

function renderRanks() {
    const list = document.getElementById('rank-list');
    list.innerHTML = '';

    allRanks.forEach(rank => {
        let inheritedPerms = [];
        if (rank.inherits_from) {
            const parentRank = allRanks.find(r => r.name === rank.inherits_from);
            if (parentRank) inheritedPerms = parentRank.permissions;
        }

        let permsHtml = rank.permissions.map(p => `<span class="perm-badge">${p}</span>`).join('');
        permsHtml += inheritedPerms.map(p => `<span class="perm-badge perm-inherited">${p}</span>`).join('');

        list.innerHTML += `
            <tr>
                <td><strong>${rank.name}</strong></td>
                <td><span style="color: #6b7280; font-size: 13px;">${rank.inherits_from || '-'}</span></td>
                <td>${permsHtml || '<span style="color:#9ca3af; font-size: 12px;">Keine</span>'}</td>
                <td class="action-cell">
                    <button class="btn btn-secondary btn-sm edit-rank-btn" data-id="${rank.id}">Bearbeiten</button>
                    <button class="btn btn-danger btn-sm delete-rank-btn" data-id="${rank.id}">Löschen</button>
                </td>
            </tr>
        `;
    });
}

function updateRankDropdown() {
    const dropdown = document.getElementById('rank-inherit');
    dropdown.innerHTML = '<option value="">Erbt von... (Keiner)</option>';
    allRanks.forEach(rank => {
        // Man soll nicht von sich selbst erben können
        if(rank.id !== editingRankId) {
            dropdown.innerHTML += `<option value="${rank.name}">${rank.name}</option>`;
        }
    });
}

// Rang Speichern / Updaten
document.getElementById('btn-save-rank').addEventListener('click', async () => {
    const name = document.getElementById('rank-name').value;
    const permsInput = document.getElementById('rank-perms').value;
    const inherits = document.getElementById('rank-inherit').value;

    if(!name) return alert("Bitte einen Namen eingeben!");

    const permissions = permsInput.split(',').map(p => p.trim()).filter(p => p !== "");
    const rankData = { name, permissions, inherits_from: inherits || null };

    if (editingRankId) {
        // Bearbeiten-Modus
        await updateDoc(doc(db, "ranks", editingRankId), rankData);
        resetRankForm();
    } else {
        // Neu erstellen
        await addDoc(collection(db, "ranks"), rankData);
        document.getElementById('rank-name').value = '';
        document.getElementById('rank-perms').value = '';
    }
    loadRanks();
});

function resetRankForm() {
    editingRankId = null;
    document.getElementById('rank-form-title').innerText = "Neuen Rang erstellen";
    document.getElementById('btn-save-rank').innerText = "Rang speichern";
    document.getElementById('btn-cancel-rank').style.display = "none";
    document.getElementById('rank-name').value = '';
    document.getElementById('rank-perms').value = '';
    updateRankDropdown();
}

document.getElementById('btn-cancel-rank').addEventListener('click', resetRankForm);

// Event Delegation für Ränge (Bearbeiten/Löschen Buttons in der Tabelle)
document.getElementById('rank-list').addEventListener('click', async (e) => {
    const id = e.target.getAttribute('data-id');
    if (!id) return;

    if (e.target.classList.contains('edit-rank-btn')) {
        const rank = allRanks.find(r => r.id === id);
        document.getElementById('rank-name').value = rank.name;
        document.getElementById('rank-perms').value = rank.permissions.join(', ');
        editingRankId = rank.id;
        updateRankDropdown(); // Wichtig, damit man im Dropdown den alten Erbe-Status setzen kann
        document.getElementById('rank-inherit').value = rank.inherits_from || '';
        
        document.getElementById('rank-form-title').innerText = "Rang bearbeiten";
        document.getElementById('btn-save-rank').innerText = "Änderungen speichern";
        document.getElementById('btn-cancel-rank').style.display = "inline-block";
        window.scrollTo(0, 0); // Nach oben scrollen
    }

    if (e.target.classList.contains('delete-rank-btn')) {
        if(confirm('Möchtest du diesen Rang wirklich löschen?')) {
            await deleteDoc(doc(db, "ranks", id));
            loadRanks();
        }
    }
});


// --- GUI ---
async function loadGUIs() {
    const querySnapshot = await getDocs(collection(db, "guis"));
    allGUIs = [];
    querySnapshot.forEach((doc) => {
        allGUIs.push({ id: doc.id, ...doc.data() });
    });
    renderGUIs();
    updateDashboard();
}

function renderGUIs() {
    const list = document.getElementById('gui-list');
    list.innerHTML = '';
    allGUIs.forEach(gui => {
        list.innerHTML += `
            <div class="gui-card">
                <div class="gui-card-header">
                    <span>${gui.name}</span>
                    <button class="btn btn-danger btn-sm delete-gui-btn" data-id="${gui.id}">Löschen</button>
                </div>
                <img src="${gui.image_url}" alt="${gui.name}">
                <button class="btn btn-secondary btn-sm edit-gui-btn" data-id="${gui.id}">Name ändern</button>
            </div>
        `;
    });
}

// GUI Speichern / Updaten
document.getElementById('btn-save-gui').addEventListener('click', async () => {
    const name = document.getElementById('gui-name').value;
    const fileInput = document.getElementById('gui-image');
    const statusText = document.getElementById('gui-upload-status');

    if(!name) return alert("Bitte einen Namen angeben!");

    if (editingGuiId) {
        // Nur den Namen aktualisieren (Bild bleibt vorerst gleich, um es simpel zu halten)
        await updateDoc(doc(db, "guis", editingGuiId), { name: name });
        resetGuiForm();
        loadGUIs();
        return;
    }

    if(fileInput.files.length === 0) return alert("Bitte ein Bild zum Hochladen auswählen!");

    const file = fileInput.files[0];
    statusText.innerText = "Lade Bild hoch...";

    try {
        const storageRef = ref(storage, 'guis/' + Date.now() + '_' + file.name); // Eindeutiger Dateiname
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        statusText.innerText = "Speichere in Datenbank...";
        await addDoc(collection(db, "guis"), { name: name, image_url: downloadURL });

        statusText.innerText = "Erfolgreich gespeichert!";
        setTimeout(() => statusText.innerText = "", 3000);
        document.getElementById('gui-name').value = '';
        fileInput.value = '';
        loadGUIs();
    } catch (error) {
        console.error(error);
        statusText.innerText = "Fehler beim Hochladen!";
    }
});

function resetGuiForm() {
    editingGuiId = null;
    document.getElementById('gui-form-title').innerText = "Neues GUI hochladen";
    document.getElementById('btn-save-gui').innerText = "GUI speichern";
    document.getElementById('btn-cancel-gui').style.display = "none";
    document.getElementById('gui-name').value = '';
    document.getElementById('gui-image').style.display = "block"; // Dateiauswahl wieder anzeigen
}

document.getElementById('btn-cancel-gui').addEventListener('click', resetGuiForm);

// Event Delegation für GUI (Bearbeiten/Löschen)
document.getElementById('gui-list').addEventListener('click', async (e) => {
    const id = e.target.getAttribute('data-id');
    if (!id) return;

    if (e.target.classList.contains('edit-gui-btn')) {
        const gui = allGUIs.find(g => g.id === id);
        document.getElementById('gui-name').value = gui.name;
        editingGuiId = gui.id;
        
        document.getElementById('gui-form-title').innerText = "GUI Name bearbeiten";
        document.getElementById('btn-save-gui').innerText = "Name aktualisieren";
        document.getElementById('btn-cancel-gui').style.display = "inline-block";
        document.getElementById('gui-image').style.display = "none"; // Beim Bearbeiten ändern wir nur den Namen
        window.scrollTo(0, 0);
    }

    if (e.target.classList.contains('delete-gui-btn')) {
        if(confirm('Möchtest du dieses GUI wirklich löschen?')) {
            await deleteDoc(doc(db, "guis", id));
            loadGUIs();
        }
    }
});

// Start
loadRanks();
loadGUIs();