import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api';

function InvoiceForm({ onClose, onSuccess }) {
    const [items, setItems] = useState([]);
    const [formData, setFormData] = useState({
        invoice_number: '',
        customer_name: '',
        customer_ico: '',
        customer_dic: '',
        due_date: '',
        paid: false,
        note: '',
        job_number: '',
        delivery_note: '',
        invoice_type: 'MATERIAL',
        reverse_charge: false,
        date_of_supply: '',
        place_of_supply: '',
        responsible_person: '',
        payment_method: 'Bankový prevod',
    });
    const [invoiceItems, setInvoiceItems] = useState([{ item: '', quantity: 1, unit_price: 0 }]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            const response = await axios.get(`${API_URL}/items/`);
            setItems(response.data);
        } catch (error) {
            console.error('Chyba pri načítaní položiek:', error);
        }
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...invoiceItems];
        newItems[index][field] = value;
        
        if (field === 'item') {
            const selectedItem = items.find(i => i.id === parseInt(value));
            if (selectedItem) {
                newItems[index].unit_price = parseFloat(selectedItem.price);
            }
        }
        
        setInvoiceItems(newItems);
    };

    const addItemRow = () => {
        setInvoiceItems([...invoiceItems, { item: '', quantity: 1, unit_price: 0 }]);
    };

    const removeItemRow = (index) => {
        const newItems = invoiceItems.filter((_, i) => i !== index);
        setInvoiceItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const data = {
            ...formData,
            items: invoiceItems.map(item => ({
                item: parseInt(item.item),
                quantity: parseInt(item.quantity),
                unit_price: parseFloat(item.unit_price)
            }))
        };

        try {
            await axios.post(`${API_URL}/invoices/`, data);
            alert('Faktúra bola úspešne vytvorená');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Chyba pri vytváraní faktúry:', error);
            alert('Chyba pri vytváraní faktúry. Skontroluj údaje.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4">Nová faktúra</h2>
                
                <form onSubmit={handleSubmit}>
                    {/* Základné údaje */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Číslo faktúry *</label>
                            <input
                                type="text"
                                name="invoice_number"
                                value={formData.invoice_number}
                                onChange={handleFormChange}
                                required
                                className="w-full border rounded px-2 py-1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Zákazník *</label>
                            <input
                                type="text"
                                name="customer_name"
                                value={formData.customer_name}
                                onChange={handleFormChange}
                                required
                                className="w-full border rounded px-2 py-1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">IČO</label>
                            <input
                                type="text"
                                name="customer_ico"
                                value={formData.customer_ico}
                                onChange={handleFormChange}
                                className="w-full border rounded px-2 py-1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">DIČ</label>
                            <input
                                type="text"
                                name="customer_dic"
                                value={formData.customer_dic}
                                onChange={handleFormChange}
                                className="w-full border rounded px-2 py-1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Dátum splatnosti *</label>
                            <input
                                type="date"
                                name="due_date"
                                value={formData.due_date}
                                onChange={handleFormChange}
                                required
                                className="w-full border rounded px-2 py-1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Poznámka</label>
                            <input
                                type="text"
                                name="note"
                                value={formData.note}
                                onChange={handleFormChange}
                                className="w-full border rounded px-2 py-1"
                            />
                        </div>
                    </div>

                    {/* Údaje pre dopravné značenie */}
                    <div className="border-t pt-4 mb-4">
                        <h3 className="text-lg font-semibold mb-2">Údaje pre dopravné značenie</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Číslo zákazky</label>
                                <input
                                    type="text"
                                    name="job_number"
                                    value={formData.job_number}
                                    onChange={handleFormChange}
                                    className="w-full border rounded px-2 py-1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Dodací list</label>
                                <input
                                    type="text"
                                    name="delivery_note"
                                    value={formData.delivery_note}
                                    onChange={handleFormChange}
                                    className="w-full border rounded px-2 py-1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Typ faktúry</label>
                                <select
                                    name="invoice_type"
                                    value={formData.invoice_type}
                                    onChange={handleFormChange}
                                    className="w-full border rounded px-2 py-1"
                                >
                                    <option value="HORIZONTAL">Vodorovné značenie</option>
                                    <option value="VERTICAL">Zvislé značenie</option>
                                    <option value="INSTALL">Montáž</option>
                                    <option value="MATERIAL">Predaj materiálu</option>
                                    <option value="VRP">VRP predaj</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Spôsob úhrady</label>
                                <select
                                    name="payment_method"
                                    value={formData.payment_method}
                                    onChange={handleFormChange}
                                    className="w-full border rounded px-2 py-1"
                                >
                                    <option value="Bankový prevod">Bankový prevod</option>
                                    <option value="Hotovosť">Hotovosť</option>
                                    <option value="Karta">Karta</option>
                                    <option value="Dobierka">Dobierka</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="reverse_charge"
                                    checked={formData.reverse_charge}
                                    onChange={handleFormChange}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm">Prenos daňovej povinnosti (reverse charge)</label>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Dátum dodania / vykonania prác</label>
                                <input
                                    type="date"
                                    name="date_of_supply"
                                    value={formData.date_of_supply}
                                    onChange={handleFormChange}
                                    className="w-full border rounded px-2 py-1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Miesto dodania (ulica, obec)</label>
                                <input
                                    type="text"
                                    name="place_of_supply"
                                    value={formData.place_of_supply}
                                    onChange={handleFormChange}
                                    className="w-full border rounded px-2 py-1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Zodpovedná osoba</label>
                                <input
                                    type="text"
                                    name="responsible_person"
                                    value={formData.responsible_person}
                                    onChange={handleFormChange}
                                    className="w-full border rounded px-2 py-1"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Položky faktúry */}
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2">Položky faktúry</h3>
                        {invoiceItems.map((item, index) => (
                            <div key={index} className="grid grid-cols-4 gap-2 mb-2">
                                <select
                                    value={item.item}
                                    onChange={(e) => handleItemChange(index, 'item', e.target.value)}
                                    required
                                    className="border rounded px-2 py-1"
                                >
                                    <option value="">Vyber položku</option>
                                    {items.map(i => (
                                        <option key={i.id} value={i.id}>
                                            {i.name} (skladom: {i.quantity})
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    placeholder="Množstvo"
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                    required
                                    min="1"
                                    className="border rounded px-2 py-1"
                                />
                                <input
                                    type="number"
                                    placeholder="Cena"
                                    value={item.unit_price}
                                    onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                                    required
                                    step="0.01"
                                    className="border rounded px-2 py-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeItemRow(index)}
                                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                                >
                                    Zmazať
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addItemRow}
                            className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 mt-2"
                        >
                            + Pridať položku
                        </button>
                    </div>

                    {/* Tlačidlá */}
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                        >
                            Zrušiť
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
                        >
                            {loading ? 'Vytváram...' : 'Vytvoriť faktúru'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default InvoiceForm;