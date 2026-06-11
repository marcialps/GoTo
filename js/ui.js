const UI = {
    renderDashboard() {
        State.syncAllCustomerStatuses();
        const stats = State.getStats();
        document.getElementById('stat-active-clients').textContent = stats.active;
        document.getElementById('stat-trial-clients').textContent = stats.trial;
        document.getElementById('stat-overdue-clients').textContent = stats.overdue;
        document.getElementById('stat-monthly-revenue').textContent = Utils.formatCurrency(stats.monthlyRevenue);

        this.initCharts();
    },

    initCharts() {
        const ctxRevenue = document.getElementById('revenueChart').getContext('2d');
        const ctxConversion = document.getElementById('conversionChart').getContext('2d');

        // Revenue Chart
        if (window.myRevenueChart) window.myRevenueChart.destroy();
        window.myRevenueChart = new Chart(ctxRevenue, {
            type: 'line',
            data: {
                labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
                datasets: [{
                    label: 'Receita (R$)',
                    data: [1200, 1900, 2400, 3100, 4500, 5200],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });

        // Conversion Chart
        if (window.myConversionChart) window.myConversionChart.destroy();
        window.myConversionChart = new Chart(ctxConversion, {
            type: 'doughnut',
            data: {
                labels: ['Ativos', 'Testes', 'Cancelados'],
                datasets: [{
                    data: [State.getStats().active, State.getStats().trial, 2],
                    backgroundColor: ['#10b981', '#0ea5e9', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20 } } },
                cutout: '70%'
            }
        });
    },

    renderCustomers() {
        State.syncAllCustomerStatuses();
        const tbody = document.querySelector('#customers-table tbody');
        tbody.innerHTML = '';

        State.customers.forEach(customer => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600;">${customer.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim);">${customer.email}</div>
                </td>
                <td>${Utils.getStatusBadge(customer.status)}</td>
                <td>${Utils.formatCurrency(customer.planValue)}</td>
                <td>Dia ${customer.dueDay}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary" onclick="generatePix(${customer.id})" title="Gerar Cobrança">
                            <i data-lucide="qr-code" style="width: 16px;"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="editCustomer(${customer.id})" title="Editar">
                            <i data-lucide="edit-2" style="width: 16px;"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="toggleCustomerStatus(${customer.id})" title="${customer.status === 'cancelled' ? 'Reativar Cliente' : 'Cancelar Serviço'}">
                            <i data-lucide="${customer.status === 'cancelled' ? 'play' : 'ban'}" style="width: 16px; color: ${customer.status === 'cancelled' ? 'var(--success)' : 'var(--warning)'};"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="deleteCustomer(${customer.id})" style="color: var(--danger);" title="Excluir">
                            <i data-lucide="trash" style="width: 16px;"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    },

    renderBilling() {
        const tbody = document.querySelector('#billing-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        State.customers.filter(customer => customer.status !== 'cancelled').forEach(customer => {
            const info = Utils.getFinancialInfo(customer);
            const tr = document.createElement('tr');
            
            let deadlineClass = '';
            let deadlineText = '';
            
            if (info.isTrial) {
                if (info.diffDays < 0) {
                    deadlineText = `Teste encerrado há ${Math.abs(info.diffDays)} dias`;
                    deadlineClass = 'text-danger';
                } else if (info.diffDays === 0) {
                    deadlineText = 'Teste encerra hoje!';
                    deadlineClass = 'text-warning';
                } else {
                    deadlineText = `${info.diffDays} dias restantes do teste`;
                    deadlineClass = 'text-success';
                }
            } else if (info.isPaid) {
                deadlineText = `Coberto até ${info.formattedDate}`;
                deadlineClass = 'text-dim';
            } else if (info.diffDays < 0) {
                deadlineText = `${Math.abs(info.diffDays)} dias de atraso`;
                deadlineClass = 'text-danger';
            } else if (info.diffDays === 0) {
                deadlineText = 'Vence hoje!';
                deadlineClass = 'text-warning';
            } else {
                deadlineText = `${info.diffDays} dias restantes`;
                deadlineClass = 'text-success';
            }

            tr.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="font-weight: 600;">${customer.name}</div>
                        ${info.shouldAlert ? `
                            <div class="alert-pulse" title="Cobrar Amanhã!">
                                <i data-lucide="bell" style="width: 14px; color: var(--warning);"></i>
                            </div>
                        ` : ''}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-dim);">${customer.saasType}</div>
                </td>
                <td>
                    <div style="font-weight: 600;">${Utils.formatCurrency(customer.planValue)}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">${Utils.getBillingPeriodLabel(customer)}</div>
                </td>
                <td>
                    <div style="font-weight: 600;">${info.formattedDate}</div>
                    <div style="font-size: 0.75rem;" class="${deadlineClass}">${deadlineText}</div>
                </td>
                <td>${Utils.getStatusBadge(info.isTrial ? 'trial' : info.status)}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary" onclick="generatePix(${customer.id})" title="Gerar Cobrança">
                            <i data-lucide="send" style="width: 16px;"></i>
                        </button>
                        ${!info.isPaid && !info.isTrial ? `
                            <button class="btn btn-primary" onclick="openPaymentModal(${customer.id})" title="Confirmar Recebimento">
                                <i data-lucide="check-circle" style="width: 16px;"></i>
                            </button>
                        ` : `
                            <button class="btn btn-secondary" disabled title="Já Recebido">
                                <i data-lucide="check-circle" style="width: 16px; opacity: 0.5;"></i>
                            </button>
                        `}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    },

    renderSettings() {
        document.getElementById('config-pix-key').value = State.config.pixKey;
        document.getElementById('config-merchant-name').value = State.config.merchantName;
        document.getElementById('config-merchant-city').value = State.config.merchantCity;
    },

    renderSaasTypes() {
        const select = document.getElementById('customer-saas-type');
        const managementList = document.getElementById('saas-management-list');
        if (!select) return;
        
        // Render Select Options
        let html = '<option value="" disabled selected>Selecione um SaaS</option>';
        State.saasTypes.forEach(type => {
            html += `<option value="${type}">${type}</option>`;
        });
        html += `<option value="ADD_NEW">+ Adicionar Novo...</option>`;
        select.innerHTML = html;

        // Render Management List in Settings
        if (managementList) {
            managementList.innerHTML = '';
            State.saasTypes.forEach(type => {
                const item = document.createElement('div');
                item.className = 'saas-item';
                item.innerHTML = `
                    <span class="saas-name">${type}</span>
                    <button class="btn-delete-saas" onclick="deleteSaas('${type}')" title="Excluir">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                    </button>
                `;
                managementList.appendChild(item);
            });
            lucide.createIcons();
        }

        // Also update reports filter dropdown
        const reportFilterSaas = document.getElementById('report-filter-saas');
        if (reportFilterSaas) {
            let filterHtml = '<option value="all">Todos os SaaS</option>';
            State.saasTypes.forEach(type => {
                filterHtml += `<option value="${type}">${type}</option>`;
            });
            reportFilterSaas.innerHTML = filterHtml;
        }
    },

    renderReports(filteredCustomers = State.customers) {
        const tbody = document.querySelector('#reports-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        let totalRevenue = 0;

        filteredCustomers.forEach(customer => {
            const tr = document.createElement('tr');
            const revenue = (customer.status === 'active' || customer.status === 'overdue') ? parseFloat(customer.planValue) : 0;
            totalRevenue += revenue;

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600;">${customer.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim);">${customer.email}</div>
                </td>
                <td><span class="badge badge-info">${customer.saasType}</span></td>
                <td>${Utils.getStatusBadge(customer.status)}</td>
                <td>${Utils.formatCurrency(customer.planValue)}</td>
                <td>${customer.trialStart || 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('report-total-clients').textContent = filteredCustomers.length;
        document.getElementById('report-total-revenue').textContent = Utils.formatCurrency(totalRevenue);
    },

    showView(viewId) {
        const views = ['dashboard', 'customers', 'billing', 'reports', 'settings'];
        views.forEach(v => {
            const el = document.getElementById(`${v}-view`);
            if (el) el.style.display = v === viewId ? 'block' : 'none';
        });

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewId);
        });

        // Update title
        const titles = {
            'dashboard': 'Dashboard',
            'customers': 'Gerenciar Clientes',
            'billing': 'Controle Financeiro',
            'reports': 'Relatórios e Filtros',
            'settings': 'Configurações'
        };
        document.getElementById('view-title').textContent = titles[viewId] || viewId;

        // Trigger render
        if (viewId === 'dashboard') this.renderDashboard();
        if (viewId === 'customers') this.renderCustomers();
        if (viewId === 'billing') this.renderBilling();
        if (viewId === 'reports') this.renderReports();
        if (viewId === 'settings') this.renderSettings();
    },

    renderQuickFilter(customers, title) {
        document.getElementById('quick-filter-title').textContent = title;
        const tbody = document.querySelector('#quick-filter-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        customers.forEach(customer => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600;">${customer.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim);">${customer.email}</div>
                </td>
                <td><span class="badge badge-info">${customer.saasType}</span></td>
                <td>${Utils.getStatusBadge(customer.status)}</td>
                <td>${Utils.formatCurrency(customer.planValue)}</td>
                <td>
                    <button class="btn btn-secondary" onclick="closeModal('quick-filter-modal'); editCustomer(${customer.id})">
                        <i data-lucide="eye" style="width: 14px;"></i> Detalhes
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
        openModal('quick-filter-modal');
    }
};
