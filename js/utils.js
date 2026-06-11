const Utils = {
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    },

    parseLocalDate(dateStr) {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    },

    isTrialEnded(trialEnd) {
        const end = this.parseLocalDate(trialEnd);
        if (!end) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return today > end;
    },

    isInTrialPeriod(customer) {
        if (!customer || customer.status === 'cancelled') return false;
        if (!customer.trialEnd) return customer.status === 'trial';
        return customer.status === 'trial' && !this.isTrialEnded(customer.trialEnd);
    },

    getCurrentMonthStr() {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    },

    toDateStr(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    addMonths(date, months) {
        const result = new Date(date);
        const day = result.getDate();
        result.setMonth(result.getMonth() + months);
        if (result.getDate() !== day) {
            result.setDate(0);
        }
        return result;
    },

    migrateLegacyPayment(customer) {
        if (customer.paidUntil) return;
        if (!customer.lastPaidMonth) return;
        const dueDay = parseInt(customer.dueDay, 10);
        if (!dueDay) return;
        if (customer.lastPaidMonth !== this.getCurrentMonthStr()) return;
        const paidUntil = this.calculatePaidUntil(dueDay, 1);
        customer.paidUntil = this.toDateStr(paidUntil);
        customer.billingPeriodMonths = customer.billingPeriodMonths || 1;
    },

    calculatePaidUntil(dueDay, periodMonths, fromDate = new Date()) {
        const now = new Date(fromDate);
        now.setHours(0, 0, 0, 0);
        const day = parseInt(dueDay, 10);
        let anchor = new Date(now.getFullYear(), now.getMonth(), day);
        anchor.setHours(0, 0, 0, 0);
        return this.addMonths(anchor, periodMonths);
    },

    isPaymentCovered(customer) {
        this.migrateLegacyPayment(customer);
        if (!customer.paidUntil) return false;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const paidUntil = this.parseLocalDate(customer.paidUntil);
        return this.daysBetween(now, paidUntil) >= 0;
    },

    getPeriodLabel(months) {
        const labels = {
            1: 'Mensal',
            3: 'Trimestral (3 meses)',
            6: 'Semestral (6 meses)',
            12: 'Anual (12 meses)'
        };
        if (labels[months]) return labels[months];
        return `${months} meses`;
    },

    getBillingPeriodLabel(customer) {
        if (Utils.isInTrialPeriod(customer)) return 'Período de teste';
        const months = parseInt(customer.billingPeriodMonths, 10);
        if (months > 0) return Utils.getPeriodLabel(months);
        return 'Mensal';
    },

    daysBetween(fromDate, toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        from.setHours(0, 0, 0, 0);
        to.setHours(0, 0, 0, 0);
        return Math.ceil((to - from) / (1000 * 60 * 60 * 24));
    },

    generatePixPayload(name, city, key, amount, description) {
        // Helper to format Tag-Length-Value
        const tlv = (id, value) => {
            const val = value.toString();
            const len = val.length.toString().padStart(2, '0');
            return `${id}${len}${val}`;
        };

        // Sanitize PIX Key
        let cleanKey = key.trim();
        if (cleanKey.includes('@')) {
            // Email, keep as is
        } else if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanKey)) {
            // Random Key (EVP), keep as is
        } else {
            // Likely phone, CPF or CNPJ.
            const digitsOnly = cleanKey.replace(/[^0-9]/g, '');
            cleanKey = cleanKey.replace(/[^0-9+]/g, '');
            
            // Function to validate CPF
            const isValidCPF = (cpf) => {
                if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
                let valid = [9, 10].map((j) => {
                    let sum = 0;
                    for (let i = 0; i < j; i++) sum += parseInt(cpf.charAt(i)) * ((j + 1) - i);
                    let rem = sum % 11;
                    return rem < 2 ? 0 : 11 - rem;
                });
                return valid[0] == parseInt(cpf.charAt(9)) && valid[1] == parseInt(cpf.charAt(10));
            };

            // If it's a phone number without the +55 prefix, add +55
            if (!cleanKey.startsWith('+')) {
                if (digitsOnly.length === 10) {
                    cleanKey = '+55' + digitsOnly; // Mobile without 9 or Landline
                } else if (digitsOnly.length === 11) {
                    if (!isValidCPF(digitsOnly)) {
                        cleanKey = '+55' + digitsOnly; // It's a mobile phone
                    } else {
                        cleanKey = digitsOnly; // It's a valid CPF
                    }
                } else if (digitsOnly.length === 14) {
                    cleanKey = digitsOnly; // CNPJ
                }
            }
        }

        // Merchant Account Information (Tag 26)
        const gui = tlv('00', 'br.gov.bcb.pix');
        const keyField = tlv('01', cleanKey);
        const merchantAccount = tlv('26', gui + keyField);

        // Additional Data Field (Tag 62)
        // TxId (Tag 05) cannot contain spaces or special characters.
        let txid = (description || 'PGTO').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").substring(0, 25);
        if (!txid) txid = '***';
        const reference = tlv('05', txid);
        const additionalData = tlv('62', reference);

        // Merchant Name & City (Standardized)
        let cleanName = (name || 'MERCHANT').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "").trim().substring(0, 25);
        if (!cleanName) cleanName = 'MERCHANT';
        
        let cleanCity = (city || 'CITY').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "").trim().substring(0, 15);
        if (!cleanCity) cleanCity = 'CITY';

        const parts = [
            tlv('00', '01'),    // Payload Format Indicator
            tlv('01', '11'),    // Point of Initiation Method (11 = Static)
            merchantAccount,
            tlv('52', '0000'),  // Merchant Category Code
            tlv('53', '986')    // Currency (BRL)
        ];

        if (amount > 0) {
            parts.push(tlv('54', amount.toFixed(2))); // Transaction Amount
        }

        parts.push(
            tlv('58', 'BR'),    // Country Code
            tlv('59', cleanName),
            tlv('60', cleanCity),
            additionalData,
            '6304'              // CRC16 Identifier + Length
        );

        const payload = parts.join('');

        // CRC16 Calculation (CCITT-FALSE / 0x1021)
        // Ensuring 16-bit integrity throughout the calculation
        let crc = 0xFFFF;
        const polynomial = 0x1021;

        for (let i = 0; i < payload.length; i++) {
            crc ^= (payload.charCodeAt(i) << 8);
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) !== 0) {
                    crc = ((crc << 1) ^ polynomial) & 0xFFFF;
                } else {
                    crc = (crc << 1) & 0xFFFF;
                }
            }
        }
        
        const finalCrc = crc.toString(16).toUpperCase().padStart(4, '0');
        return payload + finalCrc;
    },

    getStatusBadge(status) {
        const badges = {
            'active': '<span class="badge badge-success">Ativo</span>',
            'trial': '<span class="badge badge-info">Teste</span>',
            'overdue': '<span class="badge badge-danger">Atrasado</span>',
            'cancelled': '<span class="badge badge-warning">Cancelado</span>',
            'pending': '<span class="badge badge-warning">Pendente</span>',
            'paid': '<span class="badge badge-success">Pago</span>'
        };
        return badges[status] || status;
    },

    getFinancialInfo(customer) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (this.isInTrialPeriod(customer)) {
            const dueDate = this.parseLocalDate(customer.trialEnd);
            const diffDays = this.daysBetween(now, dueDate);

            return {
                dueDate,
                diffDays,
                status: diffDays < 0 ? 'overdue' : 'trial',
                isPaid: false,
                isTrial: true,
                shouldAlert: diffDays === 1,
                formattedDate: this.formatDate(customer.trialEnd)
            };
        }

        this.migrateLegacyPayment(customer);

        const dueDay = parseInt(customer.dueDay, 10);
        const isPaid = this.isPaymentCovered(customer);
        let dueDate;

        if (isPaid && customer.paidUntil) {
            dueDate = this.parseLocalDate(customer.paidUntil);
        } else {
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            dueDate = new Date(currentYear, currentMonth, dueDay);
            if (this.daysBetween(now, dueDate) < 0) {
                dueDate = new Date(currentYear, currentMonth + 1, dueDay);
            }
        }

        const diffDays = this.daysBetween(now, dueDate);

        let status = 'pending';
        if (isPaid) {
            status = 'paid';
        } else if (diffDays < 0) {
            status = 'overdue';
        }

        return {
            dueDate,
            diffDays,
            status,
            isPaid,
            isTrial: false,
            billingPeriodMonths: customer.billingPeriodMonths || 1,
            shouldAlert: !isPaid && diffDays === 1,
            formattedDate: `${dueDate.getDate().toString().padStart(2, '0')}/${(dueDate.getMonth() + 1).toString().padStart(2, '0')}/${dueDate.getFullYear()}`
        };
    }
};

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}
