// --- Firestore CRUD Helpers ---
async function fetchTransactionsFromFirestore() {
    const snapshot = await db.collection('transactions').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function addTransactionToFirestore(transaction) {
    const { id, ...data } = transaction;
    const docRef = await db.collection('transactions').add(data);
    return docRef.id;
}

async function updateTransactionInFirestore(id, data) {
    await db.collection('transactions').doc(id).set(data, { merge: true });
}

async function deleteTransactionFromFirestore(id) {
    await db.collection('transactions').doc(id).delete();
}



// Petty Cash Manager JavaScript
class PettyCashManager {
    constructor() {
        this.transactions = [];
        this.availableFunds = 5000.00; // Admin-set value
        this.apiUrl = 'http://localhost:3000/api'; // Backend API URL
        this.filteredTransactions = [];
        this.init();
    }

    init() {
        this.loadTransactions();
        this.bindEvents();
        this.updateDisplay();
        this.setDefaultDates();
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('borrowDate').value = today;
        document.getElementById('returnDate').value = '';
    }

    bindEvents() {
        // Transaction form submission
        document.getElementById('transactionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTransaction();
        });

        // Return form submission
        document.getElementById('returnForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.returnTransaction();
        });

        // Report form submission
        document.getElementById('reportForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateReport();
        });

        // Report period change
        document.getElementById('reportPeriod').addEventListener('change', (e) => {
            const customRange = document.getElementById('customDateRange');
            if (e.target.value === 'custom') {
                customRange.style.display = 'block';
            } else {
                customRange.style.display = 'none';
            }
        });

        // Modal close events
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    async loadTransactions() {
        try {
            this.showLoading(true);
            // For demo purposes, using local storage
            const savedData = localStorage.getItem('pettyCashData');
            if (savedData) {
                const data = JSON.parse(savedData);
                this.transactions = data.transactions || [];
                this.availableFunds = data.availableFunds || 5000.00;
            } else {
                // Load sample data
                this.loadSampleData();
            }
            
            this.filteredTransactions = [...this.transactions];
            this.updateDisplay();
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.showNotification('Error loading transactions', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    loadSampleData() {
        this.transactions = [
            {
                id: 1,
                borrowDate: '2025-07-10',
                amount: 150.00,
                returnedAmount: 0.00,
                borrower: 'John Smith',
                contact: 'john@example.com',
                description: 'Office supplies purchase',
                status: 'borrowed',
                returnDate: null,
                returnNotes: null,
                createdAt: '2025-07-10T10:00:00Z'
            },
            {
                id: 2,
                borrowDate: '2025-07-09',
                amount: 75.00,
                returnedAmount: 75.00,
                borrower: 'Sarah Johnson',
                contact: '+1234567890',
                description: 'Client lunch meeting',
                status: 'returned',
                returnDate: '2025-07-11',
                returnNotes: 'Returned with receipt',
                createdAt: '2025-07-09T14:30:00Z'
            },
            {
                id: 3,
                borrowDate: '2025-07-08',
                amount: 200.00,
                returnedAmount: 0.00,
                borrower: 'Mike Wilson',
                contact: 'mike@example.com',
                description: 'Travel expenses',
                status: 'borrowed',
                returnDate: null,
                returnNotes: null,
                createdAt: '2025-07-08T09:15:00Z'
            }
        ];
        this.saveToStorage();
    }

    async addTransaction() {
        try {
            const form = document.getElementById('transactionForm');
            const editId = form.dataset.editId ? parseInt(form.dataset.editId) : null;
            const attachmentInput = document.getElementById('attachment');
            let attachmentData = '';
            if (attachmentInput && attachmentInput.files && attachmentInput.files[0]) {
                // Read as base64
                attachmentData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(attachmentInput.files[0]);
                });
            } else if (editId) {
                // If editing and no new file, keep existing
                const transaction = this.transactions.find(t => t.id === editId);
                if (transaction && transaction.attachment) {
                    attachmentData = transaction.attachment;
                }
            }
            // Call original logic, but inject attachment
            const formData = {
                borrowDate: document.getElementById('borrowDate').value,
                amount: parseFloat(document.getElementById('amount').value),
                returnAmount: parseFloat(document.getElementById('returnAmount').value) || 0,
                borrower: document.getElementById('borrower').value,
                contact: document.getElementById('contact').value,
                description: document.getElementById('description').value,
                returnDate: document.getElementById('returnDate').value,
                returnNotes: document.getElementById('returnNotes').value,
                attachment: attachmentData
            };
            // Validation
            if (!formData.borrowDate || !formData.amount || !formData.borrower) {
                this.showNotification('Please fill in all required fields', 'error');
                return;
            }
            if (formData.amount <= 0) {
                this.showNotification('Borrow amount must be greater than 0', 'error');
                return;
            }
            if (formData.returnAmount < 0) {
                this.showNotification('Return amount cannot be negative', 'error');
                return;
            }
            this.showLoading(true);
            if (editId) {
                // Editing existing transaction
                const transaction = this.transactions.find(t => t.id === editId);
                if (!transaction) {
                    this.showNotification('Transaction not found', 'error');
                    return;
                }
                if (formData.returnAmount > formData.amount) {
                    this.showNotification(`Return amount cannot exceed borrow amount of Rs${formData.amount.toFixed(2)}`, 'error');
                    return;
                }
                transaction.borrowDate = formData.borrowDate;
                transaction.amount = formData.amount;
                transaction.returnedAmount = formData.returnAmount;
                transaction.borrower = formData.borrower;
                transaction.contact = formData.contact;
                transaction.description = formData.description;
                transaction.returnDate = formData.returnDate || null;
                transaction.returnNotes = formData.returnNotes || null;
                transaction.attachment = formData.attachment || '';
                transaction.status = formData.returnAmount >= formData.amount ? 'returned' : 'borrowed';
                this.showNotification('Transaction updated successfully!', 'success');
            } else {
                if (formData.returnAmount > formData.amount) {
                    this.showNotification(`Return amount cannot exceed borrow amount of Rs${formData.amount.toFixed(2)}`, 'error');
                    return;
                }
                const transaction = {
                    id: Date.now(),
                    ...formData,
                    returnedAmount: formData.returnAmount,
                    status: formData.returnAmount >= formData.amount ? 'returned' : 'borrowed',
                    createdAt: new Date().toISOString()
                };
                this.transactions.push(transaction);
                this.showNotification('Transaction added successfully!', 'success');
            }
            this.saveToStorage();
            this.filteredTransactions = [...this.transactions];
            this.updateDisplay();
            this.clearForm('transactionForm');
            this.closeModal('addModal');
        } catch (error) {
            console.error('Error processing transaction:', error);
            this.showNotification('Error processing transaction', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async returnTransaction() {
        try {
            const transactionId = parseInt(document.getElementById('returnTransactionId').value);
            const returnDate = document.getElementById('returnDate').value;
            const returnAmount = parseFloat(document.getElementById('returnAmount').value);
            const returnNotes = document.getElementById('returnNotes').value;

            // Validation
            if (!returnDate) {
                this.showNotification('Please select a return date', 'error');
                return;
            }
            // Remove restrictions on returnAmount
            // (No check for isNaN, <= 0, or exceeding remaining balance)

            this.showLoading(true);

            const transaction = this.transactions.find(t => t.id === transactionId);
            if (!transaction) {
                this.showNotification('Transaction not found', 'error');
                return;
            }

            // Remove restriction on exceeding remaining amount
            // (No check for returnAmount > remainingAmount)

            // Update transaction
            transaction.returnedAmount = (transaction.returnedAmount || 0) + returnAmount;
            transaction.returnDate = returnDate;
            transaction.returnNotes = returnNotes;
            transaction.status = transaction.returnedAmount >= transaction.amount ? 'returned' : 'borrowed';

            // Do NOT update availableFunds here!

            this.saveToStorage();
            this.filteredTransactions = [...this.transactions];
            this.updateDisplay();
            this.clearForm('returnForm');
            this.closeModal('returnModal');
            this.showNotification(`Returned Rs${returnAmount.toFixed(2)} successfully!`, 'success');

        } catch (error) {
            console.error('Error returning transaction:', error);
            this.showNotification('Error processing return', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async deleteTransaction(id) {
        if (!confirm('Are you sure you want to delete this transaction?')) {
            return;
        }

        try {
            this.showLoading(true);

            this.transactions = this.transactions.filter(t => t.id !== id);
            this.saveToStorage();
            this.filteredTransactions = [...this.transactions];
            this.updateDisplay();
            this.showNotification('Transaction deleted successfully!', 'success');

        } catch (error) {
            console.error('Error deleting transaction:', error);
            this.showNotification('Error deleting transaction', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    openReturnModal(id) {
        const transaction = this.transactions.find(t => t.id === id);
        if (transaction) {
            document.getElementById('returnTransactionId').value = id;
            document.getElementById('returnDate').value = transaction.returnDate || '';
            document.getElementById('returnAmount').value = '';
            document.getElementById('returnNotes').value = '';
            this.openModal('returnModal');
        }
    }

    editTransaction(id) {
        const transaction = this.transactions.find(t => t.id === id);
        if (transaction) {
            document.getElementById('borrowDate').value = transaction.borrowDate;
            document.getElementById('amount').value = transaction.amount;
            document.getElementById('returnAmount').value = transaction.returnedAmount || '';
            document.getElementById('borrower').value = transaction.borrower;
            document.getElementById('contact').value = transaction.contact || '';
            document.getElementById('description').value = transaction.description || '';
            document.getElementById('returnDate').value = transaction.returnDate || '';
            document.getElementById('returnNotes').value = transaction.returnNotes || '';
            document.getElementById('transactionForm').dataset.editId = id;
            this.openModal('addModal');
        }
    }

    filterTransactions() {
        const statusFilter = document.getElementById('statusFilter').value;
        const dateFromFilter = document.getElementById('dateFromFilter').value;
        const dateToFilter = document.getElementById('dateToFilter').value;
        const personFilter = document.getElementById('personFilter').value.toLowerCase();

        this.filteredTransactions = this.transactions.filter(transaction => {
            if (statusFilter !== 'all' && transaction.status !== statusFilter) {
                return false;
            }
            if (dateFromFilter && transaction.borrowDate < dateFromFilter) {
                return false;
            }
            if (dateToFilter && transaction.borrowDate > dateToFilter) {
                return false;
            }
            if (personFilter && !transaction.borrower.toLowerCase().includes(personFilter)) {
                return false;
            }
            return true;
        });

        this.renderTransactions();
    }

    calculateStats() {
        const totalBorrowed = this.transactions.reduce((sum, t) => sum + t.amount, 0);
        const totalReturned = this.transactions.reduce((sum, t) => sum + (t.returnedAmount || 0), 0);
        const pendingReturns = this.transactions.filter(t => t.status === 'borrowed').reduce((sum, t) => sum + (t.amount - (t.returnedAmount || 0)), 0);
        const currentBalance = this.availableFunds - pendingReturns;
        return {
            totalBorrowed,
            totalReturned,
            pendingReturns,
            currentBalance
        };
    }

    updateDisplay() {
        const stats = this.calculateStats();
        document.getElementById('currentBalance').textContent = `Rs ${stats.currentBalance.toFixed(2)}`;
        document.getElementById('availableFundsDisplay').textContent = `Rs ${this.availableFunds.toFixed(2)}`;
        document.getElementById('totalBorrowed').textContent = `Rs ${stats.totalBorrowed.toFixed(2)}`;
        document.getElementById('totalReturned').textContent = `Rs ${stats.totalReturned.toFixed(2)}`;
        this.renderTransactions();
    }

    renderTransactions() {
        const container = document.getElementById('transactionsList');
        
        if (this.filteredTransactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>No transactions found</h3>
                    <p>Add your first petty cash transaction or adjust your filters</p>
                </div>
            `;
            return;
        }

        const sortedTransactions = [...this.filteredTransactions].sort((a, b) => new Date(b.createdAt || b.borrowDate) - new Date(a.createdAt || a.borrowDate));

        container.innerHTML = sortedTransactions.map(transaction => {
            // Generate initials from borrower name
            const initials = transaction.borrower
                ? transaction.borrower.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                : '?';
            // Generate a color based on the borrower's name
            function stringToColor(str) {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = str.charCodeAt(i) + ((hash << 5) - hash);
                }
                let color = '#';
                for (let i = 0; i < 3; i++) {
                    color += ('00' + ((hash >> (i * 8)) & 0xFF).toString(16)).slice(-2);
                }
                return color;
            }
            const avatarColor = stringToColor(transaction.borrower || '');
            return `
            <div class="transaction-item ${transaction.status === 'returned' ? 'returned' : ''}">
                <div class="transaction-header">
                    <div class="transaction-amount">Rs ${transaction.amount.toFixed(2)}</div>
                    <div class="transaction-status status-${transaction.status}">
                        <i class="fas fa-${transaction.status === 'borrowed' ? 'arrow-up' : 'check-circle'}"></i>
                        ${transaction.status === 'borrowed' ? 'Borrowed' : 'Returned'}
                    </div>
                </div>
                <div class="transaction-details">
                    <div class="transaction-detail">
                        <div class="transaction-detail-label">Borrower</div>
                        <div class="transaction-detail-value" style="display: flex; align-items: center; gap: 8px;">
                            <span class="avatar-initials" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${avatarColor};color:#fff;font-weight:600;font-size:1rem;">${initials}</span>
                            ${transaction.borrower}
                        </div>
                    </div>
                    <div class="transaction-detail">
                        <div class="transaction-detail-label">Borrow Date</div>
                        <div class="transaction-detail-value">${this.formatDate(transaction.borrowDate)}</div>
                    </div>
                    ${transaction.returnDate ? `
                        <div class="transaction-detail">
                            <div class="transaction-detail-label">Return Date</div>
                            <div class="transaction-detail-value">${this.formatDate(transaction.returnDate)}</div>
                        </div>
                    ` : ''}
                    ${transaction.returnedAmount > 0 ? `
                        <div class="transaction-detail">
                            <div class="transaction-detail-label">Returned Amount</div>
                            <div class="transaction-detail-value">Rs ${transaction.returnedAmount.toFixed(2)}</div>
                        </div>
                    ` : ''}
                    ${transaction.attachment ? `
                        <div class="transaction-detail">
                            <div class="transaction-detail-label">Attachment</div>
                            <div class="transaction-detail-value">
                                <img src="${transaction.attachment}" alt="Attachment" style="max-width:60px;max-height:60px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.08);cursor:pointer;" onclick="openAttachmentModal('${transaction.attachment.replace(/'/g, '\'')}' )" title="Click to view" />
                            </div>
                        </div>
                    ` : ''}
                    ${transaction.contact ? `
                        <div class="transaction-detail">
                            <div class="transaction-detail-label">Contact</div>
                            <div class="transaction-detail-value">${transaction.contact}</div>
                        </div>
                    ` : ''}
                    ${transaction.description ? `
                        <div class="transaction-detail">
                            <div class="transaction-detail-label">Description</div>
                            <div class="transaction-detail-value">${transaction.description}</div>
                        </div>
                    ` : ''}
                    ${transaction.returnNotes ? `
                        <div class="transaction-detail">
                            <div class="transaction-detail-label">Return Notes</div>
                            <div class="transaction-detail-value">${transaction.returnNotes}</div>
                        </div>
                    ` : ''}
                </div>
                <div class="transaction-actions">
                    ${transaction.status === 'borrowed' ? 
                        `<button class="btn btn-success" onclick="pettyCash.openReturnModal(${transaction.id})">
                            <i class="fas fa-undo"></i> Mark as Returned
                        </button>` : 
                        ''
                    }
                    <button class="btn btn-warning" onclick="pettyCash.editTransaction(${transaction.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger" onclick="pettyCash.deleteTransaction(${transaction.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `}).join('');
    }

    async generateReport() {
        try {
            const reportType = document.getElementById('reportType').value;
            const reportPeriod = document.getElementById('reportPeriod').value;
            const fromDate = document.getElementById('reportFromDate').value;
            const toDate = document.getElementById('reportToDate').value;

            this.showLoading(true);

            const reportData = this.generateReportData(reportType, reportPeriod, fromDate, toDate);
            this.displayReport(reportData);
            this.closeModal('reportModal');

        } catch (error) {
            console.error('Error generating report:', error);
            this.showNotification('Error generating report', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    generateReportData(reportType, reportPeriod, fromDate, toDate) {
        const dateRange = this.getDateRange(reportPeriod, fromDate, toDate);
        const filteredTransactions = this.transactions.filter(t => {
            const borrowDate = new Date(t.borrowDate);
            return borrowDate >= dateRange.start && borrowDate <= dateRange.end;
        });

        const stats = {
            totalTransactions: filteredTransactions.length,
            totalBorrowed: filteredTransactions.reduce((sum, t) => sum + t.amount, 0),
            totalReturned: filteredTransactions.reduce((sum, t) => sum + (t.returnedAmount || 0), 0),
            pendingReturns: filteredTransactions.filter(t => t.status === 'borrowed').reduce((sum, t) => sum + (t.amount - (t.returnedAmount || 0)), 0),
            borrowedCount: filteredTransactions.filter(t => t.status === 'borrowed').length,
            returnedCount: filteredTransactions.filter(t => t.status === 'returned').length
        };

        return {
            reportType,
            reportPeriod,
            dateRange,
            stats,
            transactions: filteredTransactions
        };
    }

    getDateRange(period, fromDate, toDate) {
        const today = new Date();
        let start, end;

        switch (period) {
            case 'today':
                start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
                break;
            case 'week':
                start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
                end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 6, 23, 59, 59);
                break;
            case 'month':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'quarter':
                const quarter = Math.floor(today.getMonth() / 3);
                start = new Date(today.getFullYear(), quarter * 3, 1);
                end = new Date(today.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
                break;
            case 'year':
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
                break;
            case 'custom':
                start = new Date(fromDate);
                end = new Date(toDate);
                break;
            default:
                start = new Date(0);
                end = new Date();
        }

        return { start, end };
    }

    displayReport(reportData) {
        const reportWindow = window.open('', '_blank', 'width=800,height=600');
        const reportHTML = this.generateReportHTML(reportData);
        reportWindow.document.write(reportHTML);
        reportWindow.document.close();
    }

    generateReportHTML(data) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Petty Cash Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                    .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
                    .stat-value { font-size: 24px; font-weight: bold; color: #333; }
                    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    .status-borrowed { color: #dc3545; }
                    .status-returned { color: #28a745; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Petty Cash Report</h1>
                    <p>Report Type: ${data.reportType.toUpperCase()}</p>
                    <p>Period: ${data.reportPeriod.toUpperCase()}</p>
                    <p>From: ${data.dateRange.start.toDateString()} To: ${data.dateRange.end.toDateString()}</p>
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value">${data.stats.totalTransactions}</div>
                        <div class="stat-label">Total Transactions</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">Rs${data.stats.totalBorrowed.toFixed(2)}</div>
                        <div class="stat-label">Total Borrowed</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">Rs${data.stats.totalReturned.toFixed(2)}</div>
                        <div class="stat-label">Total Returned</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">Rs${data.stats.pendingReturns.toFixed(2)}</div>
                        <div class="stat-label">Pending Returns</div>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Borrower</th>
                            <th>Amount</th>
                            <th>Returned Amount</th>
                            <th>Status</th>
                            <th>Return Date</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.transactions.map(t => `
                            <tr>
                                <td>${this.formatDate(t.borrowDate)}</td>
                                <td>${t.borrower}</td>
                                <td>Rs${t.amount.toFixed(2)}</td>
                                <td>Rs${t.returnedAmount.toFixed(2)}</td>
                                <td class="status-${t.status}">${t.status.toUpperCase()}</td>
                                <td>${t.returnDate ? this.formatDate(t.returnDate) : '-'}</td>
                                <td>${t.description || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;
    }

    exportData() {
        const csvData = this.generateCSV();
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `petty_cash_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.showNotification('Data exported successfully!', 'success');
    }

    generateCSV() {
        const headers = ['ID', 'Borrow Date', 'Borrower', 'Amount', 'Returned Amount', 'Status', 'Return Date', 'Contact', 'Description', 'Return Notes'];
        const rows = this.transactions.map(t => [
            t.id,
            t.borrowDate,
            t.borrower,
            t.amount,
            t.returnedAmount || 0,
            t.status,
            t.returnDate || '',
            t.contact || '',
            t.description || '',
            t.returnNotes || ''
        ]);

        return [headers, ...rows].map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        this.clearForm('transactionForm');
        this.clearForm('returnForm');
        this.clearForm('reportForm');
    }

    clearForm(formId) {
        const form = document.getElementById(formId);
        form.reset();
        delete form.dataset.editId;
        this.setDefaultDates();
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        
        notificationText.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    showLoading(show) {
        document.getElementById('loadingSpinner').style.display = show ? 'flex' : 'none';
    }

    saveToStorage() {
        const data = {
            transactions: this.transactions,
            availableFunds: this.availableFunds
        };
        localStorage.setItem('pettyCashData', JSON.stringify(data));
    }
}

// Global functions for HTML onclick events
function openModal(modalId) {
    pettyCash.openModal(modalId);
}

function closeModal(modalId) {
    pettyCash.closeModal(modalId);
}

function filterTransactions() {
    pettyCash.filterTransactions();
}

function exportData() {
    pettyCash.exportData();
}

// On page load, render empty charts if no data
window.addEventListener('DOMContentLoaded', () => {
    // No charts to render here anymore
});

// Initialize the application
const pettyCash = new PettyCashManager();

// --- Attachment Upload Logic ---
// Preview selected image in the form, with remove button
function handleAttachmentPreview(input, previewId) {
    const preview = document.getElementById(previewId);
    preview.innerHTML = '';
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Attachment Preview" style="max-width:80px;max-height:80px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.08);" />
                <button type="button" id="removeAttachmentBtn" title="Remove attachment" style="background:none;border:none;color:#d33;font-size:1.5rem;cursor:pointer;">&times;</button>
            `;
            // Remove handler
            document.getElementById('removeAttachmentBtn').onclick = function() {
                input.value = '';
                preview.innerHTML = '';
            };
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Open attachment modal with full image
function openAttachmentModal(imgSrc) {
    const modal = document.getElementById('attachmentModal');
    const modalImg = document.getElementById('attachmentModalImg');
    modalImg.src = imgSrc;
    modal.style.display = 'block';
}

// Patch renderTransactions to make thumbnails clickable
const originalRenderTransactions = PettyCashManager.prototype.renderTransactions;
PettyCashManager.prototype.renderTransactions = function() {
    const container = document.getElementById('transactionsList');
    if (this.filteredTransactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>No transactions found</h3>
                <p>Add your first petty cash transaction or adjust your filters</p>
            </div>
        `;
        return;
    }
    const sortedTransactions = [...this.filteredTransactions].sort((a, b) => new Date(b.createdAt || b.borrowDate) - new Date(a.createdAt || a.borrowDate));
    container.innerHTML = sortedTransactions.map(transaction => {
        // Generate initials from borrower name
        const initials = transaction.borrower
            ? transaction.borrower.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
            : '?';
        function stringToColor(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            let color = '#';
            for (let i = 0; i < 3; i++) {
                color += ('00' + ((hash >> (i * 8)) & 0xFF).toString(16)).slice(-2);
            }
            return color;
        }
        const avatarColor = stringToColor(transaction.borrower || '');
        return `
        <div class="transaction-item ${transaction.status === 'returned' ? 'returned' : ''}">
            <div class="transaction-header">
                <div class="transaction-amount">Rs ${transaction.amount.toFixed(2)}</div>
                <div class="transaction-status status-${transaction.status}">
                    <i class="fas fa-${transaction.status === 'borrowed' ? 'arrow-up' : 'check-circle'}"></i>
                    ${transaction.status === 'borrowed' ? 'Borrowed' : 'Returned'}
                </div>
            </div>
            <div class="transaction-details">
                <div class="transaction-detail">
                    <div class="transaction-detail-label">Borrower</div>
                    <div class="transaction-detail-value" style="display: flex; align-items: center; gap: 8px;">
                        <span class="avatar-initials" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${avatarColor};color:#fff;font-weight:600;font-size:1rem;">${initials}</span>
                        ${transaction.borrower}
                    </div>
                </div>
                <div class="transaction-detail">
                    <div class="transaction-detail-label">Borrow Date</div>
                    <div class="transaction-detail-value">${this.formatDate(transaction.borrowDate)}</div>
                </div>
                ${transaction.returnDate ? `
                    <div class="transaction-detail">
                        <div class="transaction-detail-label">Return Date</div>
                        <div class="transaction-detail-value">${this.formatDate(transaction.returnDate)}</div>
                    </div>
                ` : ''}
                ${transaction.returnedAmount > 0 ? `
                    <div class="transaction-detail">
                        <div class="transaction-detail-label">Returned Amount</div>
                        <div class="transaction-detail-value">Rs ${transaction.returnedAmount.toFixed(2)}</div>
                    </div>
                ` : ''}
                ${transaction.attachment ? `
                    <div class="transaction-detail">
                        <div class="transaction-detail-label">Attachment</div>
                        <div class="transaction-detail-value">
                            <img src="${transaction.attachment}" alt="Attachment" style="max-width:60px;max-height:60px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.08);cursor:pointer;" onclick="openAttachmentModal('${transaction.attachment.replace(/'/g, '\'')}' )" title="Click to view" />
                        </div>
                    </div>
                ` : ''}
                ${transaction.contact ? `
                    <div class="transaction-detail">
                        <div class="transaction-detail-label">Contact</div>
                        <div class="transaction-detail-value">${transaction.contact}</div>
                    </div>
                ` : ''}
                ${transaction.description ? `
                    <div class="transaction-detail">
                        <div class="transaction-detail-label">Description</div>
                        <div class="transaction-detail-value">${transaction.description}</div>
                    </div>
                ` : ''}
                ${transaction.returnNotes ? `
                    <div class="transaction-detail">
                        <div class="transaction-detail-label">Return Notes</div>
                        <div class="transaction-detail-value">${transaction.returnNotes}</div>
                    </div>
                ` : ''}
            </div>
            <div class="transaction-actions">
                ${transaction.status === 'borrowed' ? 
                    `<button class="btn btn-success" onclick="pettyCash.openReturnModal(${transaction.id})">
                        <i class="fas fa-undo"></i> Mark as Returned
                    </button>` : 
                    ''
                }
                <button class="btn btn-warning" onclick="pettyCash.editTransaction(${transaction.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger" onclick="pettyCash.deleteTransaction(${transaction.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `}).join('');
};

// Close modal on background click
window.addEventListener('click', function(e) {
    const modal = document.getElementById('attachmentModal');
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const attachmentInput = document.getElementById('attachment');
    if (attachmentInput) {
        attachmentInput.addEventListener('change', function() {
            handleAttachmentPreview(this, 'attachmentPreview');
        });
    }

    const editFundsBtn = document.getElementById('editFundsBtn');
    if (editFundsBtn) {
        editFundsBtn.addEventListener('click', function() {
            openModal('editFundsModal');
            document.getElementById('newFunds').value = pettyCash.availableFunds;
        });
    }

    const editFundsForm = document.getElementById('editFundsForm');
    if (editFundsForm) {
        editFundsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const adminPass = prompt('Enter admin password to change available funds:');
            if (adminPass !== 'admin123') {
                pettyCash.showNotification('Incorrect admin password!', 'error');
                return;
            }
            const newFunds = parseFloat(document.getElementById('newFunds').value);
            if (isNaN(newFunds) || newFunds < 0) {
                pettyCash.showNotification('Please enter a valid amount.', 'error');
                return;
            }
            pettyCash.availableFunds = newFunds;
            pettyCash.saveToStorage();
            pettyCash.updateDisplay();
            closeModal('editFundsModal');
            pettyCash.showNotification('Available funds updated!', 'success');
        });
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openModal('addModal');
    }
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.style.display = 'none');
    }
});

// Auto-save functionality
setInterval(() => {
    pettyCash.saveToStorage();
}, 30000); // Save every 30 seconds