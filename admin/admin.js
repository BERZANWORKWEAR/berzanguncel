import { supabase } from '../assets/js/supabaseClient.js';

// 1. Authentication Check
function checkAuth() {
    const isAuth = sessionStorage.getItem('berzan_admin_auth');
    if (isAuth !== 'true') {
        window.location.href = '/admin/login.html';
        return false;
    }
    
    const authCheck = document.getElementById('authCheck');
    if (authCheck) authCheck.style.display = 'none';
    
    const welcomeUser = document.getElementById('welcomeUser');
    if (welcomeUser) {
        const user = sessionStorage.getItem('berzan_admin_user') || 'Admin';
        welcomeUser.textContent = `Hoş geldin, ${user}`;
    }
    return true;
}

// 2. State & Constants
let PRODUCTS = [];
let CATEGORIES = [];

// 3. UI Elements
const productTableBody = document.getElementById('productTableBody');
const prodModalOverlay = document.getElementById('productModalOverlay');
const productForm = document.getElementById('loginForm'); // Wait, I named it loginForm in the HTML, let's fix that
const prodForm = document.getElementById('productForm');
const modalTitle = document.getElementById('modalTitle');
const prodSelect = document.getElementById('prodCategory');
const loadingOverlay = document.getElementById('loadingOverlay');

// 4. Initial Load
async function init() {
    if (!checkAuth()) return;
    
    showLoading(true);
    await loadCategories();
    await loadProducts();
    showLoading(false);
    
    setupEvents();
}

async function loadCategories() {
    try {
        const { data, error } = await supabase.from('categories').select('*').order('name');
        if (error) throw error;
        CATEGORIES = data || [];
        
        prodSelect.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (e) {
        console.error('Kategoriler yüklenemedi:', e);
    }
}

async function loadProducts() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        PRODUCTS = data || [];
        renderProducts();
        updateStats();
    } catch (e) {
        console.error('Ürünler yüklenemedi:', e);
    }
}

function renderProducts() {
    if (!productTableBody) return;
    
    productTableBody.innerHTML = PRODUCTS.map(p => {
        const cat = CATEGORIES.find(c => c.id === p.category_id);
        const catName = cat ? cat.name : '—';
        
        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${p.cover_image_url || '/img/product-placeholder.webp'}" class="prod-img" onerror="this.src='/img/product-placeholder.webp'">
                        <div>
                            <div class="prod-name">${p.name}</div>
                            <div style="font-size:12px; color:#999;">${p.slug || '-'}</div>
                        </div>
                    </div>
                </td>
                <td class="prod-price">₺ ${new Intl.NumberFormat('tr-TR').format(p.price_try || 0)}</td>
                <td>${catName}</td>
                <td>
                    <span class="status-badge ${p.is_active ? 'status-active' : 'status-inactive'}">
                        ${p.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                </td>
                <td style="text-align:right;">
                    <div class="actions" style="justify-content: flex-end;">
                        <button class="btn-icon edit-btn" data-id="${p.id}" title="Düzenle">✏️</button>
                        <button class="btn-icon btn-delete delete-btn" data-id="${p.id}" title="Sil">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Add event listeners to dynamic buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-id')));
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDelete(btn.getAttribute('data-id')));
    });
}

function updateStats() {
    const statTotal = document.getElementById('statTotal');
    const statActive = document.getElementById('statActive');
    
    if (statTotal) statTotal.textContent = PRODUCTS.length;
    if (statActive) statActive.textContent = PRODUCTS.filter(p => p.is_active).length;
}

// 5. CRUD Actions
async function handleSubmit(e) {
    e.preventDefault();
    showLoading(true);
    
    const id = document.getElementById('editId').value;
    const name = document.getElementById('prodName').value;
    const price = parseFloat(document.getElementById('prodPrice').value);
    const category_id = document.getElementById('prodCategory').value;
    const short_desc = document.getElementById('prodShortDesc').value;
    const cover_image_url = document.getElementById('prodCover').value;
    const is_active = document.getElementById('prodActive').checked;
    
    // Simple slug generator
    const slug = name.toLowerCase().trim()
        .replace(/[ğĞ]/g, 'g').replace(/[üÜ]/g, 'u').replace(/[şŞ]/g, 's')
        .replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c')
        .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    const productData = {
        name,
        slug,
        price_try: price,
        category_id,
        short_desc,
        description: short_desc, // Use same for both for now
        cover_image_url,
        is_active
    };

    try {
        if (id) {
            // Update
            const { error } = await supabase.from('products').update(productData).eq('id', id);
            if (error) throw error;
        } else {
            // Insert
            const { error } = await supabase.from('products').insert([productData]);
            if (error) throw error;
        }
        
        closeModal();
        await loadProducts();
    } catch (e) {
        alert('Hata oluştu: ' + (e.message || e));
    } finally {
        showLoading(false);
    }
}

async function handleDelete(id) {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
    
    showLoading(true);
    try {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        await loadProducts();
    } catch (e) {
        alert('Silme işlemi başarısız: ' + (e.message || e));
    } finally {
        showLoading(false);
    }
}

// 6. UI Helpers
function openAddModal() {
    modalTitle.textContent = 'Yeni Ürün Ekle';
    prodForm.reset();
    document.getElementById('editId').value = '';
    prodModalOverlay.style.display = 'flex';
}

function openEditModal(id) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) return;
    
    modalTitle.textContent = 'Ürünü Düzenle';
    document.getElementById('editId').value = p.id;
    document.getElementById('prodName').value = p.name || '';
    document.getElementById('prodPrice').value = p.price_try || 0;
    document.getElementById('prodCategory').value = p.category_id || '';
    document.getElementById('prodShortDesc').value = p.short_desc || p.description || '';
    document.getElementById('prodCover').value = p.cover_image_url || '';
    document.getElementById('prodActive').checked = p.is_active;
    
    prodModalOverlay.style.display = 'flex';
}

function closeModal() {
    prodModalOverlay.style.display = 'none';
}

function showLoading(show) {
    if (show) loadingOverlay.classList.add('visible');
    else loadingOverlay.classList.remove('visible');
}

// 7. Event Listeners
function setupEvents() {
    document.getElementById('openAddModal').addEventListener('click', openAddModal);
    document.getElementById('closeModal').addEventListener('click', closeModal);
    prodForm.addEventListener('submit', handleSubmit);
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('berzan_admin_auth');
        window.location.href = '/admin/login.html';
    });
    
    // Close modal on click outside
    prodModalOverlay.addEventListener('click', (e) => {
        if (e.target === prodModalOverlay) closeModal();
    });
}

// Start
init();
