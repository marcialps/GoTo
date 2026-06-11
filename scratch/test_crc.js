function generatePixPayload(name, city, key, amount, description) {
    const tlv = (id, value) => {
        const val = value.toString();
        const len = val.length.toString().padStart(2, '0');
        return `${id}${len}${val}`;
    };

    let cleanKey = key.trim();
    if (cleanKey.includes('@')) {
    } else if (/^[0-9+() \-]+$/.test(cleanKey)) {
        cleanKey = cleanKey.replace(/[() \-]/g, '');
    }

    const gui = tlv('00', 'br.gov.bcb.pix');
    const keyField = tlv('01', cleanKey);
    const merchantAccount = tlv('26', gui + keyField);

    const cleanDesc = (description || 'PGTO').toUpperCase().substring(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "");
    const reference = tlv('05', cleanDesc || '***');
    const additionalData = tlv('62', reference);

    const cleanName = name.toUpperCase().substring(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "");
    const cleanCity = city.toUpperCase().substring(0, 15).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "");

    const parts = [
        tlv('00', '01'),
        tlv('01', '11'),
        merchantAccount,
        tlv('52', '0000'),
        tlv('53', '986'),
        tlv('54', amount.toFixed(2)),
        tlv('58', 'BR'),
        tlv('59', cleanName),
        tlv('60', cleanCity),
        additionalData,
        '6304'
    ];

    const payload = parts.join('');

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
    
    return payload + crc.toString(16).toUpperCase().padStart(4, '0');
}

const payload = generatePixPayload("MARCIAL", "SAO PAULO", "suachave@email.com", 100.00, "FATURA TESTE");
console.log("Generated Payload:", payload);
// Check if Tag 01 is present after 00
console.log("Has Tag 01 (010211):", payload.includes("010211"));

