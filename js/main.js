// App Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize data from server
    await State.init();

    // Check session
    const loggedUser = State.getLoggedUser();
    if (loggedUser) {
        showApp(loggedUser);
    }

    // Login Form
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('login-username').value;
        const pass = document.getElementById('login-password').value;

        if (State.authenticate(user, pass)) {
            showApp(user);
        } else {
            alert('Usuário ou senha incorretos!');
        }
    });

    function showApp(username) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-main').style.display = 'flex';
        document.getElementById('view-subtitle').textContent = `Bem-vindo de volta, ${username.charAt(0).toUpperCase() + username.slice(1)}!`;
        UI.renderSaasTypes();
        UI.showView('dashboard');
    }

    // Logout
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Deseja realmente sair?')) {
            State.logout();
            location.reload();
        }
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            if (view) UI.showView(view);
        });
    });

    // Add Customer Button
    document.getElementById('add-customer-btn').addEventListener('click', () => {
        document.getElementById('customer-form').reset();
        delete document.getElementById('customer-form').dataset.editId;
        document.querySelector('#customer-modal h2').textContent = 'Novo Cliente';
        document.getElementById('new-saas-group').style.display = 'none';
        UI.renderSaasTypes();
        openModal('customer-modal');
    });

    // Toggle New SaaS Group Button
    document.getElementById('btn-toggle-new-saas').addEventListener('click', () => {
        const group = document.getElementById('new-saas-group');
        const isHidden = group.style.display === 'none';
        group.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            document.getElementById('new-saas-name').focus();
            document.getElementById('customer-saas-type').value = 'ADD_NEW';
        } else {
            document.getElementById('customer-saas-type').value = '';
        }
    });

    // SaaS Selection Change
    document.getElementById('customer-saas-type').addEventListener('change', (e) => {
        const isNew = e.target.value === 'ADD_NEW';
        document.getElementById('new-saas-group').style.display = isNew ? 'block' : 'none';
    });

    // Form Submission
    document.getElementById('customer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const customerData = Object.fromEntries(formData.entries());
        
        // Handle new SaaS type
        if (customerData.saasType === 'ADD_NEW') {
            const newName = document.getElementById('new-saas-name').value.trim();
            if (newName) {
                if (!State.saasTypes.includes(newName)) {
                    State.saasTypes.push(newName);
                    await State.save();
                }
                customerData.saasType = newName;
            } else {
                alert('Por favor, informe o nome do novo SaaS');
                return;
            }
        }

        const editId = e.target.dataset.editId;
        if (editId) {
            await State.updateCustomer(parseInt(editId), customerData);
        } else {
            await State.addCustomer(customerData);
        }
        
        closeModal('customer-modal');
        UI.renderDashboard();
        UI.renderCustomers();
    });

    // Settings Form
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        State.config.pixKey = document.getElementById('config-pix-key').value;
        State.config.merchantName = document.getElementById('config-merchant-name').value;
        State.config.merchantCity = document.getElementById('config-merchant-city').value;
        await State.save();
        alert('Configurações salvas com sucesso!');
    });

    // Reports Filtering Logic
    const filterElements = ['report-filter-saas', 'report-filter-status', 'report-filter-search'];
    filterElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => applyFilters());
        }
    });

    function applyFilters() {
        const saasFilter = document.getElementById('report-filter-saas').value;
        const statusFilter = document.getElementById('report-filter-status').value;
        const searchFilter = document.getElementById('report-filter-search').value.toLowerCase();

        const filtered = State.customers.filter(customer => {
            const matchesSaas = saasFilter === 'all' || customer.saasType === saasFilter;
            const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
            const matchesSearch = customer.name.toLowerCase().includes(searchFilter) || 
                                 customer.email.toLowerCase().includes(searchFilter);
            
            return matchesSaas && matchesStatus && matchesSearch;
        });

        UI.renderReports(filtered);
    }

    // Dashboard Quick Filter Listeners
    document.getElementById('card-active-clients').addEventListener('click', () => {
        const filtered = State.customers.filter(c => c.status === 'active');
        UI.renderQuickFilter(filtered, 'Clientes Ativos');
    });

    document.getElementById('card-trial-clients').addEventListener('click', () => {
        const filtered = State.customers.filter(c => c.status === 'trial');
        UI.renderQuickFilter(filtered, 'Clientes em Período de Teste');
    });

    document.getElementById('card-overdue-clients').addEventListener('click', () => {
        const filtered = State.customers.filter(c => c.status === 'overdue');
        UI.renderQuickFilter(filtered, 'Vencimentos Hoje / Atrasados');
    });
});

// Global functions for inline handlers
window.deleteCustomer = async (id) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
        await State.deleteCustomer(id);
        UI.renderCustomers();
        UI.renderDashboard();
    }
};

window.toggleCustomerStatus = async (id) => {
    const customer = State.customers.find(c => c.id === id);
    if (!customer) return;
    const action = customer.status === 'cancelled' ? 'reativar' : 'cancelar o serviço d';
    if (confirm(`Tem certeza que deseja ${action}e cliente?`)) {
        await State.toggleCustomerStatus(id);
        UI.renderCustomers();
        UI.renderDashboard();
    }
};

window.editCustomer = (id) => {
    const customer = State.customers.find(c => c.id === id);
    if (customer) {
        const form = document.getElementById('customer-form');
        form.dataset.editId = id;
        document.querySelector('#customer-modal h2').textContent = 'Editar Cliente';
        
        // Fill form
        Object.keys(customer).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) input.value = customer[key];
        });
        
        openModal('customer-modal');
    }
};

window.generatePix = (id) => {
    const customer = State.customers.find(c => c.id === id);
    if (!customer) return;

    document.getElementById('pix-client-name').textContent = customer.name;
    
    // Use Configured Pix Data
    const pixKey = State.config.pixKey;
    const merchantName = State.config.merchantName;
    const merchantCity = State.config.merchantCity;
    const amount = parseFloat(customer.planValue);
    const description = `HORA SOLUTION - ${customer.name}`;
    
    const payload = Utils.generatePixPayload(merchantName, merchantCity, pixKey, amount, description);
    
    document.getElementById('pix-code').value = payload;
    
    // Generate QR Code
    const qrContainer = document.getElementById('pix-qr-container');
    qrContainer.innerHTML = '';
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    qrContainer.innerHTML = qr.createImgTag(5);
    
    openModal('pix-modal');
    
    // Store current customer for WhatsApp sharing
    window.currentPixCustomer = customer;
};

window.copyPixCode = () => {
    const pixInput = document.getElementById('pix-code');
    pixInput.select();
    document.execCommand('copy');
    alert('Código PIX copiado!');
};

window.sendWhatsApp = () => {
    const customer = window.currentPixCustomer;
    const pixCode = document.getElementById('pix-code').value;
    const amount = Utils.formatCurrency(customer.planValue);
    
    const message = `Olá ${customer.name}! 🚀\n\nPassando para lembrar do vencimento do seu plano Hora Solution.\n\n*Valor:* ${amount}\n\n*PIX Copia e Cola:*\n${pixCode}\n\nApós o pagamento, o sistema será renovado automaticamente. Obrigado!`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
};

window.deleteSaas = async (type) => {
    if (confirm(`Tem certeza que deseja excluir o SaaS "${type}"?`)) {
        State.saasTypes = State.saasTypes.filter(t => t !== type);
        await State.save();
        UI.renderSaasTypes();
    }
};

window.openPaymentModal = (id) => {
    const customer = State.customers.find(c => c.id === id);
    if (!customer) return;

    document.getElementById('payment-customer-id').value = id;
    document.getElementById('payment-client-name').textContent = customer.name;
    const lastMonths = customer.billingPeriodMonths || 1;
    const standardPeriods = ['1', '3', '6', '12'];
    const periodSelect = document.getElementById('payment-period');
    const customGroup = document.getElementById('payment-custom-months-group');
    const customInput = document.getElementById('payment-custom-months');

    if (standardPeriods.includes(String(lastMonths))) {
        periodSelect.value = String(lastMonths);
        customInput.value = '';
        customGroup.style.display = 'none';
    } else {
        periodSelect.value = 'custom';
        customInput.value = lastMonths;
        customGroup.style.display = 'block';
    }
    updatePaymentPreview();
    openModal('payment-modal');
    lucide.createIcons();
};

function getSelectedPaymentMonths() {
    const select = document.getElementById('payment-period');
    if (select.value === 'custom') {
        return parseInt(document.getElementById('payment-custom-months').value, 10) || 0;
    }
    return parseInt(select.value, 10);
}

function updatePaymentPreview() {
    const id = parseInt(document.getElementById('payment-customer-id').value, 10);
    const customer = State.customers.find(c => c.id === id);
    const months = getSelectedPaymentMonths();
    const previewDate = document.getElementById('payment-preview-date');
    const previewLabel = document.getElementById('payment-preview-label');

    if (!customer || months < 1) {
        previewDate.textContent = '—';
        previewLabel.textContent = 'Informe um período válido';
        return;
    }

    const paidUntil = Utils.calculatePaidUntil(customer.dueDay, months);
    previewDate.textContent = Utils.formatDate(Utils.toDateStr(paidUntil));
    previewLabel.textContent = Utils.getPeriodLabel(months);
}

document.getElementById('payment-period')?.addEventListener('change', (e) => {
    const isCustom = e.target.value === 'custom';
    document.getElementById('payment-custom-months-group').style.display = isCustom ? 'block' : 'none';
    if (isCustom) document.getElementById('payment-custom-months').focus();
    updatePaymentPreview();
});

document.getElementById('payment-custom-months')?.addEventListener('input', updatePaymentPreview);

document.getElementById('payment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('payment-customer-id').value, 10);
    const months = getSelectedPaymentMonths();

    if (months < 1) {
        alert('Informe um período válido (mínimo 1 mês).');
        return;
    }

    const customer = State.customers.find(c => c.id === id);
    const paidUntil = Utils.calculatePaidUntil(customer.dueDay, months);
    const trialEnded = customer && Utils.isTrialEnded(customer.trialEnd);
    const trialNote = trialEnded && customer.status === 'trial'
        ? '\n\nO cliente sairá do período de teste e ficará como Ativo.'
        : '';

    if (!confirm(
        `Confirmar pagamento de ${customer.name}?\n\n` +
        `Período: ${Utils.getPeriodLabel(months)}\n` +
        `Válido até: ${Utils.formatDate(Utils.toDateStr(paidUntil))}${trialNote}`
    )) return;

    await State.confirmPayment(id, months);
    closeModal('payment-modal');
    UI.renderBilling();
    UI.renderDashboard();
    UI.renderCustomers();
});
