document.addEventListener('DOMContentLoaded', function () {

    // =============================
    // 🚗 Utility: Load Available Vehicles
    // =============================
    async function loadAvailableVehicles(selectId = 'vehicle_id') {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '';
        try {
            const response = await fetch('/get-available-vehicles');
            const data = await response.json();

            if (data.success && data.vehicles.length > 0) {
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Select Vehicle';
                select.appendChild(defaultOption);

                data.vehicles.forEach(vehicle => {
                    const option = document.createElement('option');
                    option.value = vehicle.vehicle_id;
                    option.textContent = `${vehicle.vehicle_id} - ${vehicle.model} (${vehicle.reg_no})`;
                    select.appendChild(option);
                });
                select.disabled = false;
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No available vehicles';
                select.appendChild(option);
                select.disabled = true;
            }
        } catch (error) {
            console.error('Error loading vehicles:', error);
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Error loading vehicles';
            select.appendChild(option);
            select.disabled = true;
        }
    }

    // =============================
    // 🔐 Login Form Handler
    // =============================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(new FormData(this))
                });

                const data = await response.json();
                if (data.success) {
                    showMessage('Login successful! Redirecting...', 'success');
                    setTimeout(() => window.location.href = data.redirect, 1000);
                } else {
                    showMessage(data.message || 'Invalid username or password', 'error');
                }
            } catch (error) {
                showMessage('An error occurred during login', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // =============================
    // 📋 Assignment Form Setup
    // =============================
    if (document.getElementById('assignmentForm')) {
        fetch('/get-next-assignment-id')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('assignment_id_display').textContent = data.assignment_id;
                    document.getElementById('assignment_id').value = data.assignment_id;
                } else {
                    document.getElementById('assignment_id_display').textContent = 'Error loading ID';
                    console.error('Failed to get assignment ID:', data.message);
                }
            })
            .catch(error => {
                console.error('Error fetching assignment ID:', error);
                document.getElementById('assignment_id_display').textContent = 'Connection error';
            });

        loadAvailableVehicles();

        const startDateInput = document.getElementById('start_date');
        const endDateInput = document.getElementById('end_date');
        if (startDateInput && endDateInput) {
            const today = new Date().toISOString().split('T')[0];
            startDateInput.min = today;
            endDateInput.min = today;

            startDateInput.addEventListener('change', () => {
                endDateInput.min = startDateInput.value;
                if (endDateInput.value && endDateInput.value < startDateInput.value) {
                    endDateInput.value = startDateInput.value;
                }
            });
        }
    }

    // =============================
    // 📝 Generic Form Submission Handler
    // =============================
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (form.id === 'loginForm') return;

            try {
                const authCheck = await fetch('/check-auth');
                const authData = await authCheck.json();

                if (!authData.logged_in) {
                    showMessage('Session expired. Please login again.', 'error');
                    setTimeout(() => window.location.href = '/', 1500);
                    return;
                }
            } catch (error) {
                showMessage('Authentication check failed', 'error');
                return;
            }

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            try {
                const response = await fetch(this.action || window.location.pathname, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(new FormData(this))
                });

                const data = await response.json();

                if (data.success) {
                    showMessage(data.message || 'Saved successfully!', 'success');

                    // Update ID fields if returned
                    const idFields = {
                        'driver_id': data.driver_id,
                        'vehicle_id': data.vehicle_id,
                        'assignment_id': data.assignment_id,
                        'record_id': data.record_id,
                        'spare_id': data.spare_id
                    };

                    for (const [fieldName, fieldValue] of Object.entries(idFields)) {
                        if (fieldValue) {
                            const inputField = this.querySelector(`#${fieldName}`);
                            if (inputField) inputField.value = fieldValue;

                            const displayElement = this.querySelector(`#${fieldName}_display`);
                            if (displayElement) displayElement.textContent = fieldValue;
                        }
                    }

                    if (form.dataset.reset !== 'false' && form.id !== 'assignmentForm') {
                        const preserveFields = ['driver_id', 'vehicle_id', 'assignment_id', 'record_id', 'spare_id'];
                        const valuesToPreserve = {};

                        preserveFields.forEach(field => {
                            const input = form.querySelector(`#${field}`) || form.querySelector(`#${field}_display`);
                            if (input) valuesToPreserve[field] = input.value || input.textContent;
                        });

                        form.reset();

                        preserveFields.forEach(field => {
                            const input = form.querySelector(`#${field}`);
                            const display = form.querySelector(`#${field}_display`);
                            if (input && valuesToPreserve[field]) input.value = valuesToPreserve[field];
                            if (display && valuesToPreserve[field]) display.textContent = valuesToPreserve[field];
                        });
                    }

                    if (form.id === 'assignmentForm') {
                        loadAvailableVehicles();
                    }

                } else {
                    showMessage(data.message || 'Failed to save data', 'error');
                }

            } catch (error) {
                console.error('Error:', error);
                showMessage('Failed to save data. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    });

    // =============================
    // 💬 Message Display Function
    // =============================
    function showMessage(text, type) {
        let messageDiv = document.getElementById('message');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'message';
            document.body.appendChild(messageDiv);
        }

        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    // =============================
    // 🎨 Dashboard Animation
    // =============================
    if (document.querySelector('.dashboard-container')) {
        const cards = document.querySelectorAll('.card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }

    // =============================
    // ⏳ Inactivity Auto Logout
    // =============================
    let inactivityTimer;
    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            fetch('/logout').then(() => window.location.href = '/');
        }, 30 * 60 * 1000); // 30 minutes
    }

    ['mousemove', 'keypress', 'click'].forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });
    resetInactivityTimer();
});
