// 1. Firebase Imports (angepasst für Browser/GitHub Pages)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

// 2. Deine Konfiguration
const firebaseConfig = {
  apiKey: "AIzaSyBZXXBcEnn5YjURWupDLZt4p0ljGZvsKb0",
  authDomain: "mc-server-planer.firebaseapp.com",
  projectId: "mc-server-planer",
  storageBucket: "mc-server-planer.firebasestorage.app",
  messagingSenderId: "1077187026071",
  appId: "1:1077187026071:web:0b98377f91773aba815dd2"
};

// 3. Firebase initialisieren
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Globale Variable für Ränge (wichtig für die Vererbung)
let allRanks = [];

// --- NAVIGATION LOGIK ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        // Menü optisch anpassen
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        e.target.classList.add('active');

        // Sektion anzeigen
        const targetId = e.target.getAttribute('data-target');
        document.querySelectorAll('.category-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
    });
});


// --- RÄNGE LOGIK ---
async function loadRanks() {
    const querySnapshot = await getDocs(collection(db, "ranks"));
    allRanks = [];
    querySnapshot.forEach((doc) => {
        allRanks.push({ id: doc.id, ...doc.data() });
    });
    renderRanks();
    updateRankDropdown();
}

function renderRanks() {
    const list = document.getElementById('rank-list');
    list.innerHTML = '';

    allRanks.forEach(rank => {
        const li = document.createElement('li');
        
        // Vererbung berechnen
        let inheritedPerms = [];
        if (rank.inherits_from) {
            const parentRank = allRanks.find(r => r.name === rank.inherits_from);
            if (parentRank) {
                inheritedPerms = parentRank.permissions;
            }
        }

        // HTML zusammenbauen
        let html = `<strong>${rank.name}</strong> `;
        if(rank.inherits_from) html += `<em>(Erbt von: ${rank.inherits_from})</em><br>`;
        else html += `<br>`;

        // Eigene Perms (Rot)
        rank.permissions.forEach(p => { html += `<span class="perm-badge">${p}</span>`; });
        // Vererbte Perms (Blau)
        inheritedPerms.forEach(p => { html += `<span class="perm-badge perm-inherited">${p}</span>`; });

        li.innerHTML = html;
        list.appendChild(li);
    });
}

function updateRankDropdown() {
    const dropdown = document.getElementById('rank-inherit');
    dropdown.innerHTML = '<option value="">Erbt von... (Keiner)</option>';
    allRanks.forEach(rank => {
        dropdown.innerHTML += `<option value="${rank.name}">${rank.name}</option>`;
    });
}

document.getElementById('btn-save-rank').addEventListener('click', async () => {
    const name = document.getElementById('rank-name').value;
    const permsInput = document.getElementById('rank-perms').value;
    const inherits = document.getElementById('rank-inherit').value;

    if(!name) return alert("Bitte einen Namen eingeben!");

    // Permissions aus Textfeld lesen, an Kommas trennen und Leerzeichen entfernen
    const permissions = permsInput.split(',').map(p => p.trim()).filter(p => p !== "");

    await addDoc(collection(db, "ranks"), {
        name: name,
        permissions: permissions,
        inherits_from: inherits || null
    });

    document.getElementById('rank-name').value = '';
    document.getElementById('rank-perms').value = '';
    loadRanks(); // Liste neu laden
});


// --- GUI LOGIK ---
async function loadGUIs() {
    const querySnapshot = await getDocs(collection(db, "guis"));
    const list = document.getElementById('gui-list');
    list.innerHTML = '';

    querySnapshot.forEach((doc) => {
        const gui = doc.data();
        list.innerHTML += `
            <div class="gui-card">
                <strong>${gui.name}</strong>
                <img src="${gui.image_url}" alt="${gui.name}">
            </div>
        `;
    });
}

document.getElementById('btn-save-gui').addEventListener('click', async () => {
    const name = document.getElementById('gui-name').value;
    const fileInput = document.getElementById('gui-image');
    const statusText = document.getElementById('gui-upload-status');

    if(!name || fileInput.files.length === 0) {
        return alert("Bitte Name und Bild angeben!");
    }

    const file = fileInput.files[0];
    statusText.innerText = "Lade Bild hoch...";

    try {
        // 1. Bild in Storage hochladen
        const storageRef = ref(storage, 'guis/' + file.name);
        await uploadBytes(storageRef, file);
        
        // 2. Download-URL holen
        const downloadURL = await getDownloadURL(storageRef);

        // 3. Infos in Firestore speichern
        statusText.innerText = "Speichere in Datenbank...";
        await addDoc(collection(db, "guis"), {
            name: name,
            image_url: downloadURL
        });

        statusText.innerText = "Erfolgreich gespeichert!";
        document.getElementById('gui-name').value = '';
        fileInput.value = '';
        loadGUIs(); // Liste neu laden

    } catch (error) {
        console.error(error);
        statusText.innerText = "Fehler beim Hochladen!";
    }
});

// Start: Daten laden, wenn Seite geöffnet wird
loadRanks();
loadGUIs();