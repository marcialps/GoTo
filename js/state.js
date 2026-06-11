const IS_PROD = !window.location.origin.includes('localhost');
const API_URL = IS_PROD ? 'api.php' : 'http://localhost:3001/api';
console.log('State: API_URL set to', API_URL, 'Mode:', IS_PROD ? 'PHP/Prod' : 'Node/Dev');

const State = {
    customers: [],
    payments: [],
    saasTypes: ["Hora Clínica", "Hora Barber", "Hora Pet"],
    config: {
        pixKey: 'suachave@email.com',
        merchantName: 'Marcial',
        merchantCity: 'SAO PAULO'
    },

    async init() {
        const fetchUrl = IS_PROD ? API_URL : `${API_URL}/data`;
        try {
            console.log('State: Initializing from server:', fetchUrl);
            const response = await fetch(fetchUrl);
            if (!response.ok) {
                console.error(`State: HTTP Error ${response.status} at ${fetchUrl}`);
                throw new Error('Falha ao carregar dados do servidor');
            }
            
            const data = await response.json();
            this.customers = data.customers || [];
            this.payments = data.payments || [];
            this.saasTypes = data.saasTypes || this.saasTypes;
            this.config = data.config || this.config;
            await this.syncAllCustomerStatuses(true);
            console.log('State: Data loaded successfully');
        } catch (error) {
            console.error('State: Failed to load data from', fetchUrl, 'Error:', error);
            alert('⚠️ Atenção: Não foi possível carregar os dados. Verifique se o servidor está rodando.');
        }
    },

    async save() {
        const saveUrl = IS_PROD ? API_URL : `${API_URL}/save`;
        try {
            console.log('State: Saving data to server:', saveUrl);
            const response = await fetch(saveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customers: this.customers,
                    payments: this.payments,
                    saasTypes: this.saasTypes,
                    config: this.config
                })
            });

            if (!response.ok) throw new Error('Erro ao salvar no servidor');
            console.log('State: Data saved successfully');
        } catch (error) {
            console.error('State: Failed to save data:', error);
            alert('❌ Erro Crítico: Não foi possível salvar as alterações. Verifique sua conexão com o servidor.');
        }
    },

    syncCustomerStatus(customer) {
        if (customer.status === 'cancelled') return false;

        const previous = customer.status;
        const trialEnded = Utils.isTrialEnded(customer.trialEnd);
        const paymentCovered = Utils.isPaymentCovered(customer);

        if (customer.status === 'trial' && trialEnded) {
            customer.status = paymentCovered ? 'active' : 'overdue';
        }

        return previous !== customer.status;
    },

    async syncAllCustomerStatuses(persist = false) {
        let changed = false;
        this.customers.forEach(c => {
            const beforePaidUntil = c.paidUntil;
            Utils.migrateLegacyPayment(c);
            if (beforePaidUntil !== c.paidUntil) changed = true;
            if (this.syncCustomerStatus(c)) changed = true;
        });
        if (persist && changed) await this.save();
    },

    async addCustomer(customer) {
        customer.id = Date.now();
        if (!customer.status) {
            customer.status = Utils.isTrialEnded(customer.trialEnd) ? 'overdue' : 'trial';
        }
        this.syncCustomerStatus(customer);
        this.customers.push(customer);
        await this.save();
        return customer;
    },

    async updateCustomer(id, data) {
        const index = this.customers.findIndex(c => c.id === id);
        if (index !== -1) {
            this.customers[index] = { ...this.customers[index], ...data };
            this.syncCustomerStatus(this.customers[index]);
            await this.save();
        }
    },

    async toggleCustomerStatus(id) {
        const index = this.customers.findIndex(c => c.id === id);
        if (index !== -1) {
            const currentStatus = this.customers[index].status;
            this.customers[index].status = currentStatus === 'cancelled' ? 'active' : 'cancelled';
            await this.save();
        }
    },

    async deleteCustomer(id) {
        this.customers = this.customers.filter(c => c.id !== id);
        await this.save();
    },

    async confirmPayment(id, periodMonths = 1) {
        const index = this.customers.findIndex(c => c.id === id);
        if (index !== -1) {
            const customer = this.customers[index];
            const months = Math.max(1, parseInt(periodMonths, 10) || 1);
            const paidUntil = Utils.calculatePaidUntil(customer.dueDay, months);

            customer.paidUntil = Utils.toDateStr(paidUntil);
            customer.billingPeriodMonths = months;
            customer.lastPaidMonth = Utils.getCurrentMonthStr();
            customer.lastPaymentDate = Utils.toDateStr(new Date());

            const trialEnded = Utils.isTrialEnded(customer.trialEnd);
            if (customer.status === 'overdue' || (customer.status === 'trial' && trialEnded)) {
                customer.status = 'active';
            }

            await this.save();
        }
    },

    getStats() {
        const active = this.customers.filter(c => c.status === 'active').length;
        const trial = this.customers.filter(c => c.status === 'trial').length;
        const overdue = this.customers.filter(c => c.status === 'overdue').length;
        
        const monthlyRevenue = this.customers
            .filter(c => c.status === 'active' || c.status === 'overdue')
            .reduce((sum, c) => sum + parseFloat(c.planValue), 0);

        return { active, trial, overdue, monthlyRevenue };
    },

    users: [
        { username: 'alana', password: 'senha@123' },
        { username: 'marcial', password: 'senha@123' }
    ],

    authenticate(username, password) {
        const user = this.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
        if (user) {
            localStorage.setItem('hora_logged_user', username);
            return true;
        }
        return false;
    },

    getLoggedUser() {
        return localStorage.getItem('hora_logged_user');
    },

    logout() {
        localStorage.removeItem('hora_logged_user');
    }
};
