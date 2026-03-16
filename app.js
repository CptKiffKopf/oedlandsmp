import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
// NEU: Wir importieren jetzt 'onSnapshot' anstelle von 'getDocs'
import { getFirestore, collection, addDoc, doc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
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

// HILFSFUNKTION: Bilder hochladen
async function uploadImage(file, folderPath) {
    if (!file) return null;
    const storageRef = ref(storage, `${folderPath}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

// NAVIGATION
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

// HILFSFUNKTION: Ränge sortieren
function sortRanksHierarchically(ranks) {
    let sorted = [];
    let visited = new Set();
    let baseRanks = ranks.filter(r => !r.inherits_from);
    
    function addChildren(parentName) {
        let children = ranks.filter(r => r.inherits_from === parentName);
        children.forEach(child => {
            if (!visited.has(child.id)) {
                visited.add(child.id);
                sorted.push(child);
                addChildren(child.name);
            }
        });
    }

    baseRanks.forEach(baseRank => {
        if (!visited.has(baseRank.id)) {
            visited.add(baseRank.id);
            sorted.push(baseRank);
            addChildren(baseRank.name);
        }
    });

    ranks.forEach(r => { if (!visited.has(r.id)) sorted.push(r); });
    return sorted;
}

// ==========================================
// REALTIME LISTENER (LIVE-UPDATES)
// ==========================================

// RÄNGE Live-Update
onSnapshot(collection(db, "ranks"), (snap) => {
    let unsortedRanks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allRanks = sortRanksHierarchically(unsortedRanks);
    
    const list = document.getElementById('rank-list');
    list.innerHTML = '';
    allRanks.forEach(rank => {
        const myPerms = rank.permissions || [];
        const parentRank = rank.inherits_from ? allRanks.find(r => r.name === rank.inherits_from) : null;
        const inherited = parentRank ? (parentRank.permissions || []) : [];
        
        let permsHtml = myPerms.map(p => `<span class="perm-badge">${p}</span>`).join('') + 
                        inherited.map(p => `<span class="perm-badge perm-inherited">${p}</span>`).join('');
        
        let imgHtml = rank.image_url ? `<img src="${rank.image_url}" class="thumbnail">` : '<div class="thumbnail"></div>';
        let indent = rank.inherits_from ? '<span style="color:#9ca3af; margin-right:5px;">↳</span>' : '';

        list.innerHTML += `<tr>
            <td>${imgHtml}</td>
            <td><strong>${indent}${rank.name}</strong></td>
            <td>${rank.inherits_from || '-'}</td>
            <td>${permsHtml || '-'}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteEntry('ranks', '${rank.id}')">Löschen</button></td>
        </tr>`;
    });
    
    const dropdown = document.getElementById('rank-inherit');
    dropdown.innerHTML = '<option value="">Erbt von... (Keiner)</option>';
    allRanks.forEach(r => dropdown.innerHTML += `<option value="${r.name}">${r.name}</option>`);
    updateDashboard();
});

// KISTEN Live-Update
onSnapshot(collection(db, "crates"), (snap) => {
    allCrates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const list = document.getElementById('crate-list');
    list.innerHTML = '';
    allCrates.forEach(item => {
        let imgHtml = item.image_url ? `<img src="${item.image_url}" class="thumbnail">` : '<div class="thumbnail"></div>';
        list.innerHTML += `<tr>
            <td>${imgHtml}</td><td><strong>${item.crate_name}</strong></td><td>${item.item_name}</td>
            <td>${item.chance}%</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteEntry('crates', '${item.id}')">Löschen</button></td>
        </tr>`;
    });
    updateDashboard();
});

// SHOP Live-Update
onSnapshot(collection(db, "shop"), (snap) => {
    allShop = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const list = document.getElementById('shop-list');
    list.innerHTML = '';
    allShop.forEach(item => {
        let imgHtml = item.image_url ? `<img src="${item.image_url}" class="thumbnail">` : '<div class="thumbnail"></div>';
        list.innerHTML += `<tr>
            <td>${imgHtml}</td><td><strong>${item.name}</strong></td><td>${item.price} Pkt.</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteEntry('shop', '${item.id}')">Löschen</button></td>
        </tr>`;
    });
    updateDashboard();
});

// GUIs Live-Update
onSnapshot(collection(db, "guis"), (snap) => {
    allGUIs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const list = document.getElementById('gui-list');
    list.innerHTML = '';
    allGUIs.forEach(gui => {
        let title = gui.name || gui.title;
        list.innerHTML += `
            <div class="gui-card">
                <div class="gui-card-header"><span>${title}</span><button class="btn btn-danger btn-sm" onclick="deleteEntry('guis', '${gui.id}')">Löschen</button></div>
                <img src="${gui.image_url}" alt="${title}">
            </div>`;
    });
    updateDashboard();
});

// ADS Live-Update
onSnapshot(collection(db, "ads"), (snap) => {
    allAds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const list = document.getElementById('ad-list');
    list.innerHTML = '';
    allAds.forEach(ad => {
        let title = ad.name || ad.title;
        let linkHtml = ad.link ? `<a href="${ad.link}" target="_blank" style="font-size:12px; display:block; margin-bottom:10px;">Link öffnen</a>` : '';
        list.innerHTML += `
            <div class="gui-card">
                <div class="gui-card-header"><span>${title}</span><button class="btn btn-danger btn-sm" onclick="deleteEntry('ads', '${ad.id}')">Löschen</button></div>
                ${linkHtml}
                <img src="${ad.image_url}" alt="${title}">
            </div>`;
    });
});


// ==========================================
// SPEICHERN & LÖSCHEN LOGIK
// ==========================================

document.getElementById('btn-save-rank').addEventListener('click', async () => {
    const name = document.getElementById('rank-name').value;
    const perms = document.getElementById('rank-perms').value.split('\n').map(p => p.trim()).filter(p => p !== "");
    const inherits = document.getElementById('rank-inherit').value;
    const file = document.getElementById('rank-image').files[0];
    const status = document.getElementById('rank-status');

    if(!name) return alert("Name fehlt!");
    status.innerText = "Speichere...";

    const imageUrl = await uploadImage(file, 'ranks') || null;
    await addDoc(collection(db, "ranks"), { name, permissions: perms, inherits_from: inherits || null, image_url: imageUrl });
    
    // Eingabefelder leeren
    status.innerText = "";
    document.getElementById('rank-name').value = ''; 
    document.getElementById('rank-perms').value = ''; 
    if(document.getElementById('rank-image')) document.getElementById('rank-image').value = '';
});

document.getElementById('btn-save-crate').addEventListener('click', async () => {
    const crate_name = document.getElementById('crate-name').value;
    const item_name = document.getElementById('crate-item').value;
    const chance = document.getElementById('crate-chance').value;
    const file = document.getElementById('crate-image').files[0];
    const status = document.getElementById('crate-status');

    if(!crate_name || !item_name) return alert("Kisten- und Item-Name fehlen!");
    status.innerText = "Speichere...";
    
    const imageUrl = await uploadImage(file, 'crates') || null;
    await addDoc(collection(db, "crates"), { crate_name, item_name, chance: Number(chance), image_url: imageUrl });
    
    status.innerText = "";
    document.getElementById('crate-name').value = ''; document.getElementById('crate-item').value = ''; document.getElementById('crate-chance').value = '';
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
    document.getElementById('gui-upload-status').innerText = "Speichere...";
    const imageUrl = await uploadImage(file, 'guis');
    await addDoc(collection(db, "guis"), { name: document.getElementById('gui-name').value, image_url: imageUrl });
    
    document.getElementById('gui-upload-status').innerText = "";
    document.getElementById('gui-name').value = '';
    document.getElementById('gui-image').value = '';
});

document.getElementById('btn-save-ad').addEventListener('click', async () => {
    const file = document.getElementById('ad-image').files[0];
    if(!file || !document.getElementById('ad-title').value) return alert("Bild und Titel fehlen!");
    document.getElementById('ad-status').innerText = "Speichere...";
    const imageUrl = await uploadImage(file, 'ads');
    await addDoc(collection(db, "ads"), { title: document.getElementById('ad-title').value, link: document.getElementById('ad-link').value, image_url: imageUrl });
    
    document.getElementById('ad-status').innerText = "";
    document.getElementById('ad-title').value = '';
    document.getElementById('ad-link').value = '';
    document.getElementById('ad-image').value = '';
});

// Lösch-Funktion (braucht auch keinen Reload mehr!)
window.deleteEntry = async (collectionName, id) => {
    if(confirm('Wirklich löschen?')) {
        await deleteDoc(doc(db, collectionName, id));
    }
};